/**
 * scraper.js — Fetches articles from RSS feeds.
 * Stage 1 of the pipeline. Saves raw articles as JSON.
 *
 * Usage: node src/scraper.js [--limit <number>]
 */

const RssParser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const sources = require('./sources');
const blocklist = require('./blocklist');

const rssParser = new RssParser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

/**
 * Check if an article matches the blocklist.
 */
function isBlocked(article) {
  const title = (article.title || '').toLowerCase();
  const url = (article.link || article.guid || '').toLowerCase();
  const content = (article.contentSnippet || article.content || '').toLowerCase();
  const author = (article.creator || article.author || '').toLowerCase();

  // Blocked domains
  for (const domain of blocklist.domains) {
    if (url.includes(domain.toLowerCase())) return true;
  }

  // Blocked vendors (check source name and content)
  for (const vendor of blocklist.vendors) {
    if (title.includes(vendor.toLowerCase())) return true;
  }

  // Blocked keywords
  for (const kw of blocklist.keywords) {
    if (title.includes(kw.toLowerCase())) return true;
  }

  // Blocked phrases
  for (const phrase of blocklist.phrases) {
    if (content.includes(phrase.toLowerCase())) return true;
  }

  // Blocked authors
  for (const a of blocklist.authors) {
    if (author.includes(a.toLowerCase())) return true;
  }

  // Blocked topics
  for (const topic of blocklist.topics) {
    if (title.includes(topic.toLowerCase()) || content.includes(topic.toLowerCase())) {
      return true;
    }
  }

  // Blocked specific articles
  for (const articleUrl of blocklist.articles) {
    if (url === articleUrl.toLowerCase()) return true;
  }

  return false;
}

/**
 * Fetch a single RSS feed and return parsed items.
 */
async function fetchFeed(feedUrl) {
  try {
    const feed = await rssParser.parseURL(feedUrl);
    return feed.items.map((item) => ({
      title: item.title || 'Untitled',
      url: item.link || item.guid || '',
      summary: item.contentSnippet || item.content || '',
      content: item.content || item.contentSnippet || '',
      author: item.creator || item.author || '',
      published: item.isoDate || item.pubDate || item.date || new Date().toISOString(),
      source: feed.title || feedUrl,
      feedUrl,
      categories: item.categories || [],
      id: item.guid || item.link || `${feedUrl}-${item.title}`,
    }));
  } catch (err) {
    console.error(`  ✗ Failed to fetch ${feedUrl}: ${err.message}`);
    return [];
  }
}

/**
 * Fetch all sources and return deduplicated articles.
 */
async function scrapeAll(limit = 500) {
  const allArticles = [];
  const seenUrls = new Set();

  for (const source of sources) {
    console.log(`Fetching ${source.name}...`);
    for (const feedUrl of source.feeds) {
      const items = await fetchFeed(feedUrl);
      for (const item of items) {
        // Skip blocked items early
        if (isBlocked(item)) continue;

        // Deduplicate by URL
        const urlKey = item.url.toLowerCase().trim();
        if (seenUrls.has(urlKey)) continue;
        seenUrls.add(urlKey);

        allArticles.push({
          ...item,
          _category: source.category,
          _sourceName: source.name,
          _sourceWeight: source.weight || 1.0,
        });
      }
    }
  }

  // Sort by published date (newest first), then limit
  allArticles.sort((a, b) => new Date(b.published) - new Date(a.published));

  const limited = allArticles.slice(0, limit);
  console.log(`\n✓ Scraped ${limited.length} articles (from ${allArticles.length} total, deduplicated & unblocked)`);
  return limited;
}

/**
 * Save articles to a timestamped JSON file.
 */
function saveRaw(articles) {
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `articles-${ts}-raw.json`;
  const filepath = path.join(__dirname, '..', 'data', 'raw', filename);
  fs.writeFileSync(filepath, JSON.stringify(articles, null, 2));
  console.log(`✓ Saved to ${filepath}`);
  return { filename, filepath, timestamp: ts };
}

// Run if executed directly
if (require.main === module) {
  const limit = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
  scrapeAll(limit).then((articles) => {
    saveRaw(articles);
    process.exit(0);
  }).catch((err) => {
    console.error('Scraping failed:', err);
    process.exit(1);
  });
}

module.exports = { scrapeAll, saveRaw };
