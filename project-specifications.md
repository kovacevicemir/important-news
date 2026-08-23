# Tech Intelligence Digest — Project Specifications

## Purpose

A local intelligence system that discovers, filters, ranks, and presents the most relevant **practical software development and AI** articles — helping the user stay informed without reading hundreds of articles daily.

**Core focus:** practical, usable knowledge for web developers and AI practitioners. Things you can actually apply at work.

**Not the focus:** niche infrastructure internals (Kubernetes SIG updates, etcd internals), corporate M&A, vendor marketing fluff, process/governance updates from specific projects.

## Ideal Situation

The user opens `index.html` and sees the **Top 10 most relevant stories for today**, with the option to expand to the **Top 50**.

Each article contains:
- Title
- TL;DR summary (what happened, why care, what changed, who's affected)
- Importance score (0–100)
- Importance horizon (BREAKING / THIS_WEEK / CURRENT / EVERGREEN)
- Category / tags
- Source & published date
- Link to original article

Clicking an article shows a detailed view with:
1. **Original article link** (clickable URL)
2. **Concept diagram** — high-level ASCII architecture showing where this fits (e.g., `[Browser] → [Framework] → [API] → [DB]`)
3. **TL;DR** — structured summary (max 400 words)
4. **Hello-world example** — short code snippet demonstrating the concept (if applicable)
5. **Practical relevance** — why this matters for your daily work
6. **Next steps** — actionable things to try
7. **Learning links** — suggested searches for deeper learning

## How It Works

Every time the server starts (or on demand via API), it:
1. **Scrapes** 100s–1000s of articles from RSS feeds
2. **Filters & ranks** them using a weighted scoring system
3. **Enriches** with summaries, diagrams, and examples
4. **Stores** the Top 50 as timestamped JSON files
5. **Serves** via REST API on port 3005

Pipeline is split into independent stages: `scrape → rank → enrich → serve`. Each stage can be replaced independently.

## Scoring System

Articles are scored using these dimensions:

| Score                | Weight | What It Measures                              |
|---------------------|--------|-----------------------------------------------|
| Web Dev Relevance   | 20%    | Relevant to frontend/backend web development  |
| AI Practical        | 15%    | Practical AI usage (prompting, models, tools) |
| Technical Depth     | 15%    | Genuine technical substance                   |
| Career Value        | 15%    | Makes you more employable                     |
| Novelty             | 10%    | New models, tools, techniques                 |
| Industry Importance | 10%    | Broad impact (CVEs, standards, major shifts)  |
| Popularity          | 5%     | How much attention it's getting               |
| Source Quality      | 5%     | Reliability of the source                     |
| Evergreen Value     | 5%     | Will still matter in 6+ months                |

### Penalties

| Penalty             | Max    | Why                                     |
|--------------------|--------|------------------------------------------|
| Hype Penalty       | -15    | Marketing fluff, buzzwords               |
| Niche Penalty      | -15    | Infrastructure internals, process updates|
| Duplicate Penalty  | -10    | Same story from multiple sources         |

Niche penalty specifically targets content like individual Kubernetes SIG updates, internal project governance, vendor-specific process changes — things that matter to maintainers of that specific project but not to general web/AI developers.

### Scoring Formula

```text
final_score =
    (20% web_dev_relevance
   + 15% ai_practical
   + 15% technical_depth
   + 15% career_value
   + 10% novelty
   + 10% industry_importance
   +  5% popularity
   +  5% source_quality
   +  5% evergreen_value)
   × category_boost
   - hype_penalty
   - niche_penalty
   - duplicate_penalty
```

## What Gets Included (Priority)

Highest priority content (scores highest):
- **Web development** — framework releases, TypeScript/JS improvements, CSS/HTML advances, frontend/backend tooling, performance techniques
- **Practical AI** — new model releases with practical impact (Qwen, GPT, Claude, DeepSeek), prompting techniques, RAG patterns, token optimization, local AI, AI coding tools
- **Productivity** — keyboard shortcuts, workflow automation, debugging techniques, profiling, developer tooling
- **Security** — significant CVEs, vulnerabilities with broad impact, patching guidance
- **Career** — useful techniques, architecture patterns, best practices that make you a better engineer

Lower priority (penalized unless truly major):
- **Niche infrastructure** — specific Kubernetes SIG updates, etcd internals, internal Docker changes, Headlamp plugins, individual project governance
- **Vendor announcements** — unless they have significant technical depth
- **M&A / funding news** — without technical substance
- **Generic "AI will change everything"** — without actionable content

## Source Universe

Sources are categorized and scored by quality/relevance:

### AI (boosted)
- Hugging Face Blog
- Google AI Blog
- Apple ML Research
- Meta Engineering
- Microsoft Research
- NVIDIA Blog
- Simon Willison's Blog

### Software (web dev focus)
- GitHub Blog
- Node.js Blog
- Microsoft Dev Blog
- Google Developers Blog
- Rust Blog
- Python Insider
- .NET Blog
- PostgreSQL News
- Cloudflare Blog
- AWS Blog
- Docker Blog

### Engineering / News
- Hacker News
- Ars Technica
- The Register
- TechCrunch
- VentureBeat
- Phoronix
- Stack Overflow Blog
- Simon Willison

## Concept Diagrams

Each article should include a high-level ASCII architecture diagram showing where the concept fits. Examples:

```
# AI Model
[Your App] → [API/SDK] → [LLM Model]
                              ↓
                        [Response tokens]

# Web Framework
[Browser] → [Framework] → [API] → [Database]
                          ↓
                    [Cache/CDN]

# AI Agent
[User] → [Agent/LLM] → [Tools/APIs] → [External Services]
              ↓                ↑
         [Results]─────────────┘
```

## TL;DR Structure

### WHAT HAPPENED?
1–3 sentences.

### WHY SHOULD I CARE?
Practical consequence for a software engineer.

### WHAT CHANGED?
Specific technical change.

### WHO IS AFFECTED?
Web developers / AI engineers / etc.

### WHAT CAN I DO WITH IT?
**URL to the full article** (clickable).

### SHOULD I LEARN IT?
Yes / Maybe / No + reason.

## Importance Horizon

### BREAKING
Important today. CVEs, outages, emergency patches.

### THIS WEEK
Worth knowing this week. New releases, announcements.

### CURRENT
Relevant for the next few weeks/months.

### EVERGREEN
Useful technical knowledge that remains valuable.

## Blocklist

Configurable blocklist (see `src/blocklist.js`) for:
- Vendors / companies
- Domains
- Keywords & phrases
- Specific article URLs
- Authors
- Topics

Blocked content is filtered out as early as possible in the pipeline.
