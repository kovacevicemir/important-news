# Tech Intelligence Digest — Technical Specification

## 1. Purpose

Build a local intelligence system that continuously discovers, filters, ranks, summarizes, and stores the most relevant **practical software development and AI** articles.

The primary goal is to help a **web developer / AI practitioner** quickly understand the most important things happening without reading hundreds of articles.

The system prioritizes **practical, usable knowledge** — things you can apply at work today. It penalizes niche infrastructure internals, vendor marketing fluff, and process/governance updates from individual projects.

---

## 2. Architecture

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  scraper.js │───▶│  ranker.js  │───▶│ summarizer.js│───▶│  server.js   │
│  (Stage 1)  │    │  (Stage 2)  │    │  (Stage 3)   │    │  (Stage 4)   │
└─────────────┘    └─────────────┘    └──────────────┘    └──────────────┘
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
  data/raw/          data/ranked/       data/detailed/       API :3005
  *.json             *.json             *.json               + index.html
```

Each stage is **independent and replaceable**. Stages communicate through JSON files on disk. You can replace any stage without affecting the others.

---

## 3. Pipeline Stages

### Stage 1: Scraper (`src/scraper.js`)
- Fetches RSS feeds from 25+ sources (configurable in `src/sources.js`)
- Applies blocklist early (before storage)
- Deduplicates by URL
- Saves raw articles as timestamped JSON: `data/raw/articles-YYYY-MM-DD-HH-MM-raw.json`
- Default: fetches up to 500 articles

### Stage 2: Ranker (`src/ranker.js`)
- Scores articles using weighted keyword analysis
- **Prioritizes**: web dev topics (React, TypeScript, CSS, frameworks), practical AI (prompting, models, RAG), productivity (shortcuts, automation, tooling)
- **Penalizes**: niche infrastructure internals (Kubernetes SIG updates, etcd internals, project governance), marketing hype, duplicates
- Determines importance horizon (BREAKING / THIS_WEEK / CURRENT / EVERGREEN)
- Outputs top 50: `data/ranked/articles-*-ranked.json`

### Stage 3: Summarizer (`src/summarizer.js`)
- Enriches articles with structured content:
  - **TL;DR** — structured summary with WHAT_HAPPENED, WHY_CARE, WHAT_CHANGED, WHO_AFFECTED, WHAT_CAN_I_DO (URL), SHOULD_LEARN
  - **Concept diagram** — high-level ASCII architecture diagram (box/arrow format)
  - **Hello-world example** — short code snippet demonstrating the concept (language-appropriate)
  - **Practical relevance** — why this matters for daily work
  - **Next steps** — actionable things to try
  - **Learning links** — suggested searches
- Uses Ollama if available (configurable `OLLAMA_HOST` / `OLLAMA_MODEL`)
- Falls back to template-based enrichment (deterministic, no LLM needed)
- Outputs: `data/detailed/articles-*-detailed.json`

### Stage 4: Server (`src/server.js`)
- Express.js server on port 3005
- Serves static frontend (`public/index.html`)
- REST API endpoints
- Runs full pipeline on first start (if no data exists)
- Exposes `POST /api/fetch` for manual pipeline trigger

---

## 4. Scoring System

### Dimensions

| Dimension           | Weight | Keywords / Detection                          |
|--------------------|--------|-----------------------------------------------|
| web_dev_relevance  | 20%    | React, TypeScript, CSS, frameworks, API, etc. |
| ai_practical       | 15%    | Prompting, models, RAG, tokens, agents, etc.  |
| technical_depth    | 15%    | Keyword density across all tech terms         |
| career_value       | 15%    | Skills, tutorials, best practices, patterns   |
| novelty            | 10%    | New, announcing, launch, release, beta        |
| industry_importance| 10%    | CVE, vulnerability, security, standards       |
| popularity         | 5%     | Trending, popular, stars, downloads           |
| source_quality     | 5%     | Per-source rating (0-10)                      |
| evergreen_value    | 5%     | Tutorials, patterns, architecture, skills     |

### Penalties

| Penalty            | Max | Trigger                                          |
|-------------------|-----|--------------------------------------------------|
| hype_penalty      | -15 | Buzzwords (game-changer, revolutionary, 10x)     |
| niche_penalty     | -15 | SIG updates, Kubernetes internals, etcd, Headlamp|
| duplicate_penalty | -10 | Title Jaccard similarity > 0.6 with other articles|

Sources classified as "niche" (Kubernetes Blog, Docker Blog, Phoronix) get extra niche penalty unless the article has broad web dev or AI relevance.

### Category Boost

| Category     | Boost |
|-------------|-------|
| ai          | 1.15x |
| software    | 1.05x |
| engineering | 1.00x |

---

## 5. Scoring Formula

```
final_score =
  (0.20 × web_dev_relevance
   + 0.15 × ai_practical
   + 0.15 × technical_depth
   + 0.15 × career_value
   + 0.10 × novelty
   + 0.10 × industry_importance
   + 0.05 × popularity
   + 0.05 × source_quality
   + 0.05 × evergreen_value)
  × category_boost
  - hype_penalty
  - niche_penalty
  - duplicate_penalty
```

Each dimension is scored 0–10, then weighted and scaled to produce a 0–100 final score.

---

## 6. Data Storage

JSON files in `data/` directory:

```
data/
├── raw/          # Raw scraped articles (up to 500)
├── ranked/       # Scored Top 50
└── detailed/     # Enriched with summaries, diagrams, examples
```

Files are timestamped: `articles-YYYY-MM-DD-HH-MM-{type}.json`

No database required. Simple, portable, inspectable with any text editor.

---

## 7. REST API

All endpoints on port 3005:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/top?limit=N` | Top N articles (default 10, max 50) |
| GET | `/api/articles/:id` | Full article details |
| GET | `/api/search?q=term` | Search across all datasets |
| GET | `/api/status` | Server status & dataset counts |
| GET | `/api/datasets` | List all dataset files |
| POST | `/api/fetch` | Trigger full pipeline (async) |

---

## 8. Technology Stack

| Component | Technology |
|-----------|-----------|
| Backend   | Node.js + Express |
| Frontend  | HTML + Tailwind CSS (CDN) + vanilla JS |
| Storage   | JSON files |
| Scraping  | rss-parser npm package |
| LLM       | Ollama (optional, local) |
| Port      | 3005 |

---

## 9. LLM Integration (Optional)

If Ollama is running locally, the summarizer uses it for better enrichment.

Environment variables:

```bash
OLLAMA_HOST=http://localhost:11434   # Default
OLLAMA_MODEL=qwen2.5:7b             # Default
```

Without Ollama, the system uses deterministic template-based enrichment — no external dependencies required.

---

## 10. Blocklist

Configurable in `src/blocklist.js`:

- **vendors**: Block all content from specific companies
- **domains**: Block specific domains
- **keywords**: Block articles containing specific keywords
- **phrases**: Block articles containing specific phrases
- **articles**: Block specific article URLs
- **authors**: Block specific authors
- **topics**: Block entire topic areas

Blocked content is filtered at scrape time (Stage 1) to avoid wasting resources on downstream stages.

---

## 11. Frontend (`public/index.html`)

Single-page app using Tailwind CSS (CDN).

Features:
- **Top 10** view (default) with relevance scores and importance horizons
- **Top 50** expand button
- **Full-text search** across all historical datasets
- **Article detail modal** with TL;DR, diagram, hello-world example, next steps
- **Score breakdown** visualization
- **Refresh button** to trigger a new pipeline run

No build step required. Served directly by Express.
