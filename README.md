# Tech Intelligence Digest

Scrapes, filters, ranks, and presents the most relevant software development and AI articles — so you can stay informed without reading hundreds of articles every day.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server (runs the full pipeline on first start)
npm start
```

Open [http://localhost:3005](http://localhost:3005) to see the **Top 10** most relevant articles.

Click **Top 50** to expand the list. Click any article to see the detailed view with TL;DR, diagram, and more.

## Features

- **Automated Scraping** — Fetches from 25+ RSS sources across AI, Software, and Engineering categories
- **Smart Ranking** — Scores articles using a weighted formula (technical relevance, practical value, career value, industry importance, novelty, popularity, source quality) minus hype and duplicate penalties
- **TL;DR Summaries** — Each article includes a structured summary: what happened, why care, what changed, who's affected, what to do, and whether to learn it
- **Importance Horizon** — Articles tagged as BREAKING, THIS_WEEK, CURRENT, or EVERGREEN
- **Blocklist** — Configurable blocklist for vendors, domains, keywords, phrases, authors, topics, and specific articles
- **Search** — Full-text search across all historical datasets
- **Lightweight UI** — Clean Tailwind CSS interface, works without JavaScript frameworks

## Architecture

The system is built as **independent pipeline stages**, each replaceable:

```
scraper.js  →  ranker.js  →  summarizer.js  →  server.js
   │               │              │                │
   ▼               ▼              ▼                ▼
 raw/          ranked/         detailed/        API + UI
 JSON          JSON            JSON             (port 3005)
```

### Pipeline Stages

| Stage | Script | Description |
|-------|--------|-------------|
| **Scrape** | `src/scraper.js` | Fetches RSS feeds, extracts articles, applies blocklist early, saves raw data |
| **Rank** | `src/ranker.js` | Scores articles using keyword analysis, deduplicates, selects Top 50 |
| **Enrich** | `src/summarizer.js` | Generates TL;DR, diagrams, examples. Uses Ollama if available, otherwise template-based |
| **Serve** | `src/server.js` | Serves REST API + frontend on port 3005 |

## Usage

### Start the server

```bash
npm start
```

The server automatically runs the full pipeline on first start if no data exists. It also exposes:

- **`POST /api/fetch`** — Trigger a fresh scrape + rank + enrich pipeline
- **`GET /api/top?limit=10`** — Get top articles
- **`GET /api/search?q=query`** — Search all datasets
- **`GET /api/articles/:id`** — Get full article details
- **`GET /api/status`** — Server status and dataset counts
- **`GET /api/datasets`** — List all available dataset files

### Run pipeline manually

```bash
# Full pipeline
npm run pipeline

# Or individual stages
npm run scrape          # Stage 1: Fetch articles
npm run rank            # Stage 2: Rank and filter
npm run enrich          # Stage 3: Generate TL;DR etc.
```

Or use the shell script:

```bash
./scripts/pipeline.sh
```

### Configuration

#### Blocklist

Edit `src/blocklist.js` to block vendors, domains, keywords, phrases, authors, topics, or specific articles.

```js
module.exports = {
  vendors: ["Example Company"],
  domains: ["example.com"],
  keywords: ["AI will replace programmers"],
  // ...
};
```

#### Sources

Edit `src/sources.js` to add or remove RSS feeds.

#### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3005` | Server port |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Ollama model for enrichment |

### LLM Enrichment (Optional)

If you have [Ollama](https://ollama.ai) running locally, the summarizer will use it to generate better TL;DRs, diagrams, and examples. Otherwise, it falls back to template-based enrichment.

```bash
# Install Ollama and pull a model
ollama pull qwen2.5:7b

# Then restart the server — enrichment will use the LLM automatically
npm start
```

## Scoring System

Articles are scored using this weighted formula:

| Component | Weight | What It Measures |
|-----------|--------|-----------------|
| Web Dev Relevance | 20% | Relevant to frontend/backend web development |
| AI Practical | 15% | Practical AI usage (prompting, models, tools) |
| Technical Depth | 15% | Genuine technical substance |
| Career Value | 15% | Makes you more employable |
| Novelty | 10% | New models, tools, techniques |
| Industry Importance | 10% | Broad impact (CVEs, standards, major shifts) |
| Popularity | 5% | How much attention it's getting |
| Source Quality | 5% | Reliability of the source |
| Evergreen Value | 5% | Will still matter in 6+ months |
| Hype Penalty | -15 max | Marketing/hype without substance |
| Niche Penalty | -15 max | Infrastructure internals, process updates |
| Duplicate Penalty | -10 max | Same story covered elsewhere |

## Data Storage

Articles are stored as JSON files in the `data/` directory:

```
data/
├── raw/          # Raw scraped articles
├── ranked/       # Scored and filtered Top 50
└── detailed/     # Enriched with TL;DR, diagrams, etc.
```

Files are timestamped: `articles-YYYY-MM-DD-HH-MM-{type}.json`

## Project Structure

```
important-news/
├── public/            # Frontend (index.html)
├── src/
│   ├── server.js      # API server (port 3005)
│   ├── scraper.js     # RSS feed scraper
│   ├── ranker.js      # Scoring and ranking
│   ├── summarizer.js  # TL;DR enrichment
│   ├── sources.js     # RSS feed list
│   └── blocklist.js   # Configurable blocklist
├── data/              # Stored articles (gitignored)
├── scripts/
│   └── pipeline.sh    # Full pipeline runner
├── package.json
└── README.md
```

## Data Flow

```
Internet (RSS feeds)
    │
    ▼
scraper.js  ──►  data/raw/*.json
    │
    ▼
ranker.js   ──►  data/ranked/*.json
    │
    ▼
summarizer.js ─►  data/detailed/*.json
    │
    ▼
server.js   ──►  API (port 3005) ──►  index.html
```
