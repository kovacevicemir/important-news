/**
 * ranker.js — Scores, filters, and ranks articles.
 * Stage 2 of the pipeline.
 *
 * FOCUS: Practical developer knowledge — tips, tricks, how-to's,
 * real-world techniques (grep, MCP, tokens, terminal, PI harness, etc.)
 *
 * PENALIZES: Company announcements, patch releases, business news,
 * Kubernetes internals, PostgreSQL patches, venture funding.
 *
 * Usage: node src/ranker.js <raw-file>
 *   or:  node src/ranker.js --latest
 */

const fs = require('fs');
const path = require('path');

// ─── Scoring weights ──────────────────────────────────
const WEIGHTS = {
  practical_tips: 0.25,       // How-to, tutorials, tips, tricks, real-world techniques
  developer_relevance: 0.20,  // Relevant to daily developer work (grep, terminal, MCP, etc.)
  ai_practical: 0.15,         // Practical AI usage (prompting, tokens, local models)
  technical_depth: 0.10,      // Genuine technical substance
  career_value: 0.10,         // Makes you a better developer
  novelty: 0.05,              // New tools, techniques worth knowing
  popularity: 0.05,           // Community signal (HN upvotes, etc.)
  source_quality: 0.05,       // Trustworthiness
  evergreen_value: 0.05,      // Will still be useful in 6+ months
};

const MAX_HYPE_PENALTY = 20;
const MAX_DUPLICATE_PENALTY = 10;
const MAX_RELEASE_NOTE_PENALTY = 20;
const MAX_BUSINESS_NEWS_PENALTY = 15;

// ─── Source quality + business-news penalty ──────────
const SOURCE_QUALITY = {
  'Simon Willison': 10,     'Julia Evans': 10,
  'Danny van Kooten': 10,   'Thorsten Ball': 10,
  'Dev.to': 8,              'Echo JS': 8,
  'CSS Tricks': 9,          'Smashing Magazine': 8,
  'Hacker News': 9,         'Stack Overflow Blog': 9,
  'GitHub Blog': 8,         'Cloudflare Blog': 8,
  'Microsoft Dev Blog': 7,  'Google Developers Blog': 7,
  'Hugging Face Blog': 9,   'Google AI Blog': 7,
  'Meta Engineering': 6,    'Apple ML Research': 7,
  'Node.js Blog': 6,        'Rust Blog': 6,
  'Python Insider': 6,      'AWS Blog': 5,
  'Ars Technica': 6,        'The Register': 5,
  'TechCrunch': 3,          'VentureBeat': 3,
};

// ─── Sources known for business/company news ──────────
const BUSINESS_NEWS_SOURCES = new Set([
  'TechCrunch', 'VentureBeat', 'The Register',
]);

// ─── Practical developer tip keywords ─────────────────
const PRACTICAL_TIP_KEYWORDS = [
  // Terminal & CLI
  'grep', 'sed', 'awk', 'jq', 'curl', 'terminal', 'cli', 'command line',
  'bash', 'zsh', 'shell', 'alias', 'pipe', 'stdout', 'stdin',
  // Developer productivity
  'shortcut', 'productivity', 'workflow', 'automation', 'tip', 'trick',
  'efficiency', 'faster', 'speed up', 'optimize', 'streamline',
  // MCP / AI tools
  'mcp', 'model context protocol', 'pi harness', 'herder', 'cursor',
  'copilot', 'aide', 'continue.dev', 'claude code', 'codex',
  // Practical AI
  'prompt', 'token', 'token consumption', 'context window',
  'temperature', 'system prompt', 'few-shot', 'rag', 'embedding',
  'local model', 'ollama', 'vllm', 'quantization',
  // Debugging & tools
  'debug', 'debugging', 'profiling', 'benchmark', 'monitoring',
  'log', 'trace', 'error', 'stack trace', 'breakpoint',
  // Code quality
  'refactor', 'clean code', 'testing', 'tdd', 'lint', 'format',
  'type safety', 'error handling', 'edge case',
  // Learning
  'how to', 'guide', 'tutorial', 'walkthrough', 'cheat sheet',
  'learn', 'understand', 'explain', 'pattern', 'anti-pattern',
  // Web dev practical
  'css', 'layout', 'flexbox', 'grid', 'responsive', 'animation',
  'accessibility', 'a11y', 'performance', 'loading', 'caching',
  'api design', 'rest', 'graphql', 'webhook', 'websocket',
];

// ─── Keywords indicating a boring release note / patch ─
const RELEASE_NOTE_INDICATORS = [
  'released!', 'release', 'announcing', 'announcement',
  'version', 'changelog', 'patch', 'hotfix',
  'upgrade', 'migration guide', 'deprecation',
  // Specific patterns
  'postgresql 1', 'kubernetes v1.', 'node.js 2', 'rust 1.',
  '.net 8', '.net 9', 'python 3.',
];

// ─── Business news indicators ─────────────────────────
const BUSINESS_INDICATORS = [
  'funding', 'series a', 'series b', 'series c', 'raised',
  'million', 'billion', 'acquisition', 'acquired', 'merger',
  'partnership', 'collaboration', 'strategic', 'investor',
  'ceo', 'cto', 'appointed', 'hired', 'promoted',
  'market', 'valuation', 'ipo', 'public offering',
];

// ─── Hype indicators ──────────────────────────────────
const HYPE_PHRASES = [
  'game-changer', 'revolutionary', 'cutting-edge', 'next-generation',
  'industry-leading', 'best-in-class', 'groundbreaking', 'disruptive',
  'unprecedented', 'world-class', 'state-of-the-art', 'breakthrough',
  '10x', 'blazingly fast', 'the future of', 'will change everything',
];

// ─── Niche infrastructure indicators ──────────────────
const NICHE_INDICATORS = [
  'sig-', 'sig ', 'wg-', 'wg ', 'kubelet', 'cgroup',
  'headlamp', 'sneak peek', 'spotlight on sig',
  'device management', 'cluster api', 'ingress2gateway',
  'pod-level', 'admission policy', 'node readiness',
  'mixed version proxy', 'tiered memory', 'memory qos',
  'selinux volume', 'reconciling the past',
  'synchdb', 'libredb', 'powa-archivist', 'credentio',
  'knative', 'volcano', 'dasha',
];

/**
 * Score a single article.
 */
function scoreArticle(article, allArticles) {
  const title = (article.title || '').toLowerCase();
  const summary = (article.summary || '').toLowerCase();
  const combined = `${title} ${summary}`;

  const scores = {
    practical_tips: 0,
    developer_relevance: 0,
    ai_practical: 0,
    technical_depth: 0,
    career_value: 0,
    novelty: 0,
    popularity: 0,
    source_quality: 0,
    evergreen_value: 0,
    // Penalties
    hype_penalty: 0,
    duplicate_penalty: 0,
    release_note_penalty: 0,
    business_news_penalty: 0,
    niche_penalty: 0,
  };

  // ── Source quality ──
  scores.source_quality = SOURCE_QUALITY[article._sourceName] || 5;

  // ── Practical tips (highest value) ──
  let tipMatches = 0;
  for (const kw of PRACTICAL_TIP_KEYWORDS) {
    if (combined.includes(kw)) tipMatches++;
  }
  scores.practical_tips = Math.min(10, tipMatches * 1.5);

  // ── Developer relevance ──
  const devKws = ['developer', 'engineer', 'programming', 'code', 'software',
    'web', 'app', 'api', 'tool', 'library', 'framework', 'cli',
    'build', 'deploy', 'test', 'debug', 'config'];
  let devMatches = 0;
  for (const kw of devKws) {
    if (combined.includes(kw)) devMatches++;
  }
  scores.developer_relevance = Math.min(10, devMatches * 1.5);

  // ── Practical AI ──
  const aiKws = ['prompt', 'token', 'llm', 'gpt', 'claude', 'model',
    'rag', 'embedding', 'ollama', 'local', 'inference', 'fine-tun',
    'agent', 'mcp', 'tool use', 'context window', 'temperature'];
  let aiMatches = 0;
  for (const kw of aiKws) {
    if (combined.includes(kw)) aiMatches++;
  }
  scores.ai_practical = Math.min(10, aiMatches * 1.5);

  // ── Career / Evergreen ──
  const careerKws = ['learn', 'skill', 'tutorial', 'guide', 'how to',
    'best practice', 'pattern', 'architecture', 'design',
    'refactoring', 'testing', 'debugging', 'profiling'];
  let careerMatches = 0;
  for (const kw of careerKws) {
    if (combined.includes(kw)) careerMatches++;
  }
  scores.career_value = Math.min(10, careerMatches * 2);
  scores.evergreen_value = Math.min(10, careerMatches * 2);

  // ── Novelty ──
  const noveltyKws = ['new', 'introducing', 'launch', 'beta', 'preview'];
  let noveltyMatches = 0;
  for (const kw of noveltyKws) {
    if (title.includes(kw)) noveltyMatches++;
  }
  scores.novelty = Math.min(10, noveltyMatches * 3);

  // ── Popularity ──
  const popKws = ['trending', 'popular', 'stars', 'most used', 'growing'];
  for (const kw of popKws) {
    if (combined.includes(kw)) scores.popularity += 2;
  }
  scores.popularity = Math.min(10, scores.popularity);

  // ── Technical depth ──
  scores.technical_depth = Math.min(10, (tipMatches + devMatches + aiMatches) / 3);

  // ── RELEASE NOTE PENALTY ──
  let releaseCount = 0;
  for (const ind of RELEASE_NOTE_INDICATORS) {
    if (combined.includes(ind)) releaseCount++;
  }
  scores.release_note_penalty = Math.min(MAX_RELEASE_NOTE_PENALTY, releaseCount * 5);

  // ── BUSINESS NEWS PENALTY ──
  if (BUSINESS_NEWS_SOURCES.has(article._sourceName)) {
    scores.business_news_penalty += 8; // Heavy base penalty for known biz-news sources
  }
  let bizCount = 0;
  for (const ind of BUSINESS_INDICATORS) {
    if (combined.includes(ind)) bizCount++;
  }
  scores.business_news_penalty = Math.min(MAX_BUSINESS_NEWS_PENALTY,
    scores.business_news_penalty + bizCount * 3);

  // ── Hype penalty ──
  let hypeCount = 0;
  for (const phrase of HYPE_PHRASES) {
    if (combined.includes(phrase)) hypeCount++;
  }
  scores.hype_penalty = Math.min(MAX_HYPE_PENALTY, hypeCount * 4);

  // ── Niche penalty ──
  let nicheCount = 0;
  for (const ind of NICHE_INDICATORS) {
    if (combined.includes(ind)) nicheCount++;
  }
  scores.niche_penalty = Math.min(MAX_RELEASE_NOTE_PENALTY, nicheCount * 4);

  // ── Duplicate penalty ──
  const titleWords = new Set(title.split(/\s+/).filter((w) => w.length > 3));
  let duplicates = 0;
  for (const other of allArticles) {
    if (other === article) continue;
    const otherTitle = (other.title || '').toLowerCase();
    const otherWords = new Set(otherTitle.split(/\s+/).filter((w) => w.length > 3));
    const intersection = new Set([...titleWords].filter((w) => otherWords.has(w)));
    const union = new Set([...titleWords, ...otherWords]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;
    if (jaccard > 0.6) duplicates++;
  }
  scores.duplicate_penalty = Math.min(MAX_DUPLICATE_PENALTY, duplicates * 4);

  // ── Compute final score ──
  let finalScore = 0;
  for (const [dimension, weight] of Object.entries(WEIGHTS)) {
    finalScore += scores[dimension] * weight * 10;
  }
  // Apply source weight multiplier
  const sourceWeight = article._sourceWeight || 1.0;
  finalScore *= sourceWeight;
  // Apply penalties
  finalScore -= scores.hype_penalty;
  finalScore -= scores.release_note_penalty;
  finalScore -= scores.business_news_penalty;
  finalScore -= scores.niche_penalty;
  finalScore -= scores.duplicate_penalty;
  finalScore = Math.max(0, Math.min(100, finalScore));

  return { scores, finalScore: Math.round(finalScore * 10) / 10 };
}

/**
 * Rank a batch of articles and return top N.
 */
function rankArticles(articles, topN = 50) {
  console.log(`Ranking ${articles.length} articles...`);

  const scored = articles.map((article) => {
    const { scores, finalScore } = scoreArticle(article, articles);
    const now = new Date();
    return {
      ...article,
      _scores: scores,
      _finalScore: finalScore,
      _fetchedAt: now.toISOString(),
      _fetchedDate: now.toISOString().slice(0, 10), // YYYY-MM-DD
      _rankedAt: now.toISOString(),
    };
  });

  const filtered = scored.filter((a) => a._finalScore >= 5);
  filtered.sort((a, b) => b._finalScore - a._finalScore);

  const top = filtered.slice(0, topN);
  console.log(`✓ Ranked: ${top.length} articles selected (from ${scored.length} scored)`);
  return top;
}

function loadRaw(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function saveRanked(articles, rawFilepath) {
  const basename = path.basename(rawFilepath).replace('-raw', '-ranked');
  const filepath = path.join(path.dirname(rawFilepath).replace('/raw', '/ranked'), basename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(articles, null, 2));
  console.log(`✓ Saved ranked to ${filepath}`);
  return filepath;
}

function findLatestRaw() {
  const rawDir = path.join(__dirname, '..', 'data', 'raw');
  if (!fs.existsSync(rawDir)) return null;
  const files = fs.readdirSync(rawDir).filter((f) => f.endsWith('-raw.json')).sort().reverse();
  return files.length > 0 ? path.join(rawDir, files[0]) : null;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let rawFile;

  if (args.includes('--latest')) {
    rawFile = findLatestRaw();
    if (!rawFile) { console.error('No raw articles found.'); process.exit(1); }
  } else if (args[0] && !args[0].startsWith('--')) {
    rawFile = args[0];
  } else {
    rawFile = findLatestRaw();
    if (!rawFile) { console.error('No raw articles found.'); process.exit(1); }
  }

  const topN = parseInt(args.find((a) => a.startsWith('--top='))?.split('=')[1] || '50', 10);
  const articles = loadRaw(rawFile);
  const ranked = rankArticles(articles, topN);
  saveRanked(ranked, rawFile);
  process.exit(0);
}

module.exports = { rankArticles, loadRaw, saveRanked, findLatestRaw };
