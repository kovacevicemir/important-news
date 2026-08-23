/**
 * server.js — Main API server + static file serving.
 * Serves the frontend and provides REST API for articles.
 * Port 3005.
 *
 * Usage: node src/server.js
 *        npm start
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { scrapeAll, saveRaw } = require('./scraper');
const { rankArticles, saveRanked, findLatestRaw } = require('./ranker');
const { enrichArticles, saveEnriched, findLatestRanked } = require('./summarizer');

const PORT = process.env.PORT || 3005;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, '..', 'data');

const app = express();
app.use(express.json());

// ─── Serve static frontend ────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Helper: load latest detailed/ranked articles ─────
function loadLatestArticles() {
  const detailedDir = path.join(DATA_DIR, 'detailed');
  const rankedDir = path.join(DATA_DIR, 'ranked');

  // Try detailed first
  if (fs.existsSync(detailedDir)) {
    const files = fs.readdirSync(detailedDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length > 0) {
      const data = fs.readFileSync(path.join(detailedDir, files[0]), 'utf-8');
      return JSON.parse(data);
    }
  }

  // Fall back to ranked
  if (fs.existsSync(rankedDir)) {
    const files = fs.readdirSync(rankedDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length > 0) {
      const data = fs.readFileSync(path.join(rankedDir, files[0]), 'utf-8');
      return JSON.parse(data);
    }
  }

  return [];
}

// ─── List available datasets ──────────────────────────
function listDatasets() {
  const datasets = [];
  for (const dir of ['detailed', 'ranked', 'raw']) {
    const dirPath = path.join(DATA_DIR, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();
      for (const f of files) {
        datasets.push({ file: f, type: dir, path: path.join(dirPath, f) });
      }
    }
  }
  return datasets;
}

// ─── API: GET /api/top ────────────────────────────────
app.get('/api/top', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const articles = loadLatestArticles();
  const top = articles.slice(0, limit);

  // Return lightweight version (no heavy content)
  const result = top.map((a) => ({
    id: a.id || a.url,
    title: a.title,
    summary: a.summary ? a.summary.slice(0, 300) : '',
    url: a.url,
    source: a._sourceName || a.source,
    category: a._category,
    published: a.published,
    finalScore: a._finalScore,
    horizon: a._horizon,
    scores: a._scores,
    enriched: a._enriched ? {
      tldr: a._enriched.tldr?.WHY_CARE || null,
      diagram: a._enriched.diagram || null,
    } : null,
  }));

  res.json({
    count: result.length,
    total: articles.length,
    timestamp: new Date().toISOString(),
    articles: result,
  });
});

// ─── API: GET /api/article?id=... (query param to handle URLs with slashes) ──
app.get('/api/article', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Query parameter "id" is required' });

  const articles = loadLatestArticles();
  const article = articles.find(
    (a) => a.id === id || a.url === id
  );

  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  res.json(article);
});

// ─── API: GET /api/search ─────────────────────────────
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const allDatasets = listDatasets();
  let results = [];

  for (const ds of allDatasets) {
    try {
      const data = JSON.parse(fs.readFileSync(ds.path, 'utf-8'));
      const matches = (Array.isArray(data) ? data : [data]).filter((a) => {
        const title = (a.title || '').toLowerCase();
        const summary = (a.summary || '').toLowerCase();
        const source = (a._sourceName || a.source || '').toLowerCase();
        return title.includes(q) || summary.includes(q) || source.includes(q);
      });
      results = results.concat(matches);
    } catch (e) {
      // skip unreadable files
    }
  }

  // Deduplicate
  const seen = new Set();
  results = results.filter((a) => {
    const key = a.id || a.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  results.sort((a, b) => (b._finalScore || 0) - (a._finalScore || 0));
  results = results.slice(0, limit);

  res.json({
    query: q,
    count: results.length,
    results,
  });
});

// ─── API: GET /api/datasets ───────────────────────────
app.get('/api/datasets', (req, res) => {
  const datasets = listDatasets();
  res.json({ datasets });
});

// ─── API: POST /api/fetch (trigger pipeline) ──────────
app.post('/api/fetch', async (req, res) => {
  try {
    res.json({ status: 'started', message: 'Scraping started in background' });

    // Run pipeline asynchronously
    runPipeline().catch((err) => {
      console.error('Pipeline error:', err);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: GET /api/status ─────────────────────────────
app.get('/api/status', (req, res) => {
  const datasets = listDatasets();
  const latest = loadLatestArticles();
  res.json({
    status: 'running',
    port: PORT,
    datasets: {
      raw: datasets.filter((d) => d.type === 'raw').length,
      ranked: datasets.filter((d) => d.type === 'ranked').length,
      detailed: datasets.filter((d) => d.type === 'detailed').length,
    },
    latestArticles: latest.length,
    updatedAt: latest[0]?._rankedAt || null,
  });
});

// ─── Pipeline runner ──────────────────────────────────
async function runPipeline() {
  console.log('\n=== Pipeline Start ===');

  // Stage 1: Scrape
  console.log('\n--- Stage 1: Scrape ---');
  const articles = await scrapeAll(500);
  const { filepath: rawPath } = saveRaw(articles);

  // Stage 2: Rank
  console.log('\n--- Stage 2: Rank ---');
  const ranked = rankArticles(articles, 50);
  const rankedPath = saveRanked(ranked, rawPath);

  // Stage 3: Enrich (optional — will use template if Ollama unavailable)
  console.log('\n--- Stage 3: Enrich ---');
  const enriched = await enrichArticles(ranked);
  saveEnriched(enriched, rankedPath);

  console.log('\n=== Pipeline Complete ===');
}

// ─── Startup ──────────────────────────────────────────
async function main() {
  const latestRanked = findLatestRanked();
  const latestDetailed = path.join(DATA_DIR, 'detailed');
  const hasData = latestRanked && fs.existsSync(latestDetailed) &&
    fs.readdirSync(latestDetailed).length > 0;

  if (!hasData) {
    console.log('No existing data found. Running initial pipeline...');
    try {
      await runPipeline();
    } catch (err) {
      console.error('Initial pipeline failed:', err.message);
      console.log('Server will start anyway. Use POST /api/fetch to retry.');
    }
  } else {
    console.log(`Found existing data: ${path.basename(latestRanked)}`);
  }

  app.listen(PORT, HOST, () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let localIP = 'localhost';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIP = net.address;
          break;
        }
      }
      if (localIP !== 'localhost') break;
    }
    console.log(`\n🚀 Tech Intelligence Digest running`);
    console.log(`   Local:  http://localhost:${PORT}`);
    console.log(`   Network: http://${localIP}:${PORT}`);
    console.log(`   API:    http://localhost:${PORT}/api/top`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
