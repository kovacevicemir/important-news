/**
 * server.js — Main API server + static file serving.
 * Serves the frontend and provides REST API for articles.
 * Port 3005.
 *
 * Features:
 * - 50 articles per day, combining fresh + historical
 * - Date-based pagination (browse yesterday, today, etc.)
 * - Top 10 from the selected date highlighted
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

// ─── Helper: extract date from filename ───────────────
// Files: articles-2026-09-04-21-13-detailed.json → "2026-09-04"
function extractDateFromFilename(filename) {
  const match = filename.match(/articles-(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// ─── Helper: load articles by date ────────────────────
function loadArticlesByDate(dateStr) {
  const detailedDir = path.join(DATA_DIR, 'detailed');
  const rankedDir = path.join(DATA_DIR, 'ranked');

  // Try detailed first
  if (fs.existsSync(detailedDir)) {
    const files = fs.readdirSync(detailedDir)
      .filter((f) => f.endsWith('.json') && extractDateFromFilename(f) === dateStr)
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
      .filter((f) => f.endsWith('.json') && extractDateFromFilename(f) === dateStr)
      .sort()
      .reverse();
    if (files.length > 0) {
      const data = fs.readFileSync(path.join(rankedDir, files[0]), 'utf-8');
      return JSON.parse(data);
    }
  }

  return null;
}

// ─── Helper: load latest available articles ───────────
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

// ─── Helper: get latest available date ────────────────
function getLatestDate() {
  const dates = listAvailableDates();
  return dates.length > 0 ? dates[0] : null;
}

// ─── List available dates (sorted newest first) ───────
function listAvailableDates() {
  const dateSet = new Set();
  for (const dir of ['detailed', 'ranked', 'raw']) {
    const dirPath = path.join(DATA_DIR, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        const d = extractDateFromFilename(f);
        if (d) dateSet.add(d);
      }
    }
  }
  return [...dateSet].sort().reverse();
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

// ─── API: GET /api/top?date=YYYY-MM-DD&limit=N ────────
app.get('/api/top', (req, res) => {
  const dateStr = req.query.date || getLatestDate();
  const limit = Math.min(parseInt(req.query.limit) || 50, 50);

  if (!dateStr) {
    return res.status(404).json({ error: 'No articles found. Run the pipeline first.' });
  }

  let articles;
  if (dateStr === getLatestDate()) {
    // For the latest date, load the most recent file
    articles = loadLatestArticles();
  } else {
    articles = loadArticlesByDate(dateStr);
  }

  if (!articles || articles.length === 0) {
    return res.status(404).json({
      error: `No articles found for ${dateStr}`,
      date: dateStr,
      availableDates: listAvailableDates(),
    });
  }

  const top = articles.slice(0, limit);

  // Return lightweight version
  const result = top.map((a) => ({
    id: a.id || a.url,
    title: a.title,
    summary: a.summary ? a.summary.slice(0, 300) : '',
    url: a.url,
    source: a._sourceName || a.source,
    category: a._category,
    published: a.published,         // when the article was published
    fetchedAt: a._fetchedAt,         // when the pipeline fetched it
    fetchedDate: a._fetchedDate,     // YYYY-MM-DD of fetch
    finalScore: a._finalScore,
    scores: a._scores,
    enriched: a._enriched ? {
      tldr: a._enriched.tldr?.WHY_CARE || null,
      diagram: a._enriched.diagram || null,
    } : null,
  }));

  res.json({
    count: result.length,
    total: articles.length,
    date: dateStr,                    // the digest date (when pipeline ran)
    availableDates: listAvailableDates(),
    timestamp: new Date().toISOString(),
    articles: result,
  });
});

// ─── API: GET /api/dates ──────────────────────────────
app.get('/api/dates', (req, res) => {
  const dates = listAvailableDates();
  res.json({
    dates,
    latest: dates.length > 0 ? dates[0] : null,
  });
});

// ─── API: GET /api/article?id=... ─────────────────────
app.get('/api/article', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Query parameter "id" is required' });

  // Search across all dates
  const dates = listAvailableDates();
  for (const dateStr of dates) {
    const articles = loadArticlesByDate(dateStr);
    if (!articles) continue;
    const article = articles.find((a) => a.id === id || a.url === id);
    if (article) return res.json(article);
  }

  // Also try latest
  const latest = loadLatestArticles();
  const article = latest.find((a) => a.id === id || a.url === id);
  if (article) return res.json(article);

  return res.status(404).json({ error: 'Article not found' });
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
  const dates = listAvailableDates();
  res.json({
    status: 'running',
    port: PORT,
    datasets: {
      raw: datasets.filter((d) => d.type === 'raw').length,
      ranked: datasets.filter((d) => d.type === 'ranked').length,
      detailed: datasets.filter((d) => d.type === 'detailed').length,
    },
    dates,
    latestDate: dates.length > 0 ? dates[0] : null,
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

  // Stage 2: Rank (always produce top 50)
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
