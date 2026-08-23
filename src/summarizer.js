/**
 * summarizer.js — Enriches ranked articles with TL;DR, diagrams, examples.
 * Stage 3 of the pipeline (optional). Uses Ollama if available.
 *
 * Usage: node src/summarizer.js <ranked-file>
 *   or:  node src/summarizer.js --latest
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

/**
 * Check if Ollama is available.
 */
function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_HOST}/api/tags`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Ask Ollama to enrich an article.
 */
async function enrichWithOllama(article) {
  const prompt = `You are a technical intelligence digest system. Given this article, produce a JSON response with:

1. "tldr": A max 400-word TL;DR with sections:
   - WHAT_HAPPENED (1-3 sentences)
   - WHY_CARE (practical consequence for a software engineer)
   - WHAT_CHANGED (specific technical change)
   - WHO_AFFECTED (developers / AI engineers / etc)
   - WHAT_CAN_I_DO (concrete action)
   - SHOULD_LEARN (Yes/Maybe/No + reason)

2. "diagram": A high-level ASCII architecture diagram showing where this concept fits. Use boxes [box] and arrows -> to show relationships. Max 15 lines. Example format:
   [User] -> [Your App] -> [API] -> [Database]

3. "hello_world": A short code example if applicable (max 15 lines). Use the most relevant language. If not applicable, return "N/A".

4. "practical_relevance": 2-3 sentences on practical application.

5. "next_steps": Array of 1-3 actionable next steps.

6. "learning_links": Array of 1-2 suggested search topics or learning paths.

Article title: ${article.title}
Article summary: ${(article.summary || '').slice(0, 2000)}
Source: ${article._sourceName}
Article URL: ${article.url}

Respond ONLY with a valid JSON object. No markdown, no explanation.`;

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

    const data = await response.json();
    const text = data.response || '';

    // Extract JSON from response (it might have markdown fences)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    return JSON.parse(jsonStr);
  } catch (err) {
    console.error(`  ✗ Ollama enrichment failed: ${err.message}`);
    return null;
  }
}

/**
 * Build a concept diagram based on article category and title keywords.
 * Uses high-level box+arrow architecture format.
 */
function buildDiagram(article) {
  const title = (article.title || '').toLowerCase();
  // Match word start (no trailing \b so plurals like "agents" match "agent")
  const has = (...kws) => kws.some(kw => new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(title));

  // ── Security / CVE ──
  if (has('cve', 'vulnerability', 'security', 'patch', 'breach', 'zero-day', 'malware', 'exploit')) {
    return [
      '┌──────────┐   ┌────────────┐   ┌──────────────┐',
      '│  Attacker│──▶│ Vulnerable │──▶│  Your        │',
      '│  /Threat │   │  Component │   │  Application │',
      '└──────────┘   └────────────┘   └──────────────┘',
      '                      │                  │',
      '               ┌──────┴──────┐    ┌──────┴──────┐',
      '               │  CVE/Patch  │    │  Mitigation │',
      '               │  Released   │──▶│  (update/   │',
      '               │             │    │   workaround│',
      '               └─────────────┘    └─────────────┘',
    ].join('\n');
  }

  // ── Database / Storage ──
  if (has('postgresql', 'sqlite', 'database', 'sql', 'redis', 'message queue')) {
    return [
      '┌──────────┐   ┌──────────┐   ┌──────────────┐',
      '│  App     │──▶│  Query   │──▶│  Database    │',
      '│  Layer   │   │  Layer   │   │  (SQL/NoSQL) │',
      '└──────────┘   └──────────┘   └──────────────┘',
      '                     │                │',
      '                     │         ┌──────┴──────┐',
      '                     │         │  Indexes    │',
      '                     │         │  + Cache    │',
      '                     │         └─────────────┘',
      '                     └──▶ Connection Pool',
    ].join('\n');
  }

  // ── CSS / Styling ──
  if (has('css', 'tailwind', 'styling', 'styles', 'design system', 'ui', 'ux')) {
    return [
      '┌──────────────┐     ┌──────────────┐     ┌──────────────┐',
      '│  Design      │────▶│  CSS Rules   │────▶│  Rendered    │',
      '│  Tokens/     │     │  (selectors, │     │  Page        │',
      '│  Variables   │     │   layout)    │     │              │',
      '└──────────────┘     └──────────────┘     └──────────────┘',
      '       │                     │',
      '       │              ┌──────┴──────┐',
      '       │              │  Components │',
      '       └──────────────│  (reusable) │',
      '                      └─────────────┘',
    ].join('\n');
  }

  // ── AI Model / LLM ──
  if (has('llm', 'gpt', 'claude', 'qwen', 'deepseek', 'gemini', 'openai', 'anthropic')) {
    return [
      '┌─────────────┐    ┌──────────────┐    ┌──────────────┐',
      '│  Your App   │───▶│  API/SDK     │───▶│   LLM Model  │',
      '│  (frontend) │    │  (prompt +   │    │  (inference) │',
      '│             │    │   context)   │    │              │',
      '└─────────────┘    └──────────────┘    └──────────────┘',
      '       │                                      │',
      '       │                              ┌───────┴────────┐',
      '       │                              │  Response       │',
      '       │                              │  (tokens back)  │',
      '       └──────────────────────────────┴────────────────┘',
    ].join('\n');
  }

  // ── AI Agent / MCP ──
  if (has('agent', 'mcp', 'function calling', 'tool use')) {
    return [
      '┌──────────┐   ┌───────────┐   ┌───────────────┐   ┌──────────┐',
      '│  User    │──▶│  Agent    │──▶│  Tools/APIs   │──▶│ External │',
      '│  Query   │   │  (LLM +   │   │  (search,     │   │ Services │',
      '│          │   │  planner) │   │   code, etc)  │   │          │',
      '└──────────┘   └───────────┘   └───────────────┘   └──────────┘',
      '                     │                                  │',
      '                     └─────────◀────────────────────────┘',
      '                           (results fed back)',
    ].join('\n');
  }

  // ── Web Dev / Framework ──
  if (has('react', 'vue', 'svelte', 'next.js', 'angular', 'frontend', 'backend')) {
    return [
      '┌──────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────┐',
      '│ Browser  │──▶│  Framework   │──▶│  API/     │──▶│ Database │',
      '│ (UI)     │   │  (React/Vue/ │   │  Backend  │   │          │',
      '│          │◀──│   Svelte)    │◀──│  (Node/   │◀──│          │',
      '└──────────┘   └──────────────┘   └───────────┘   └──────────┘',
      '                                   │',
      '                                   └──▶ Cache/CDN ──▶ Edge',
    ].join('\n');
  }

  // ── Productivity / Shortcuts / Terminal ──
  if (has('shortcut', 'productivity', 'workflow', 'automation', 'tip', 'terminal', 'cli', 'grep', 'bash', 'shell')) {
    return [
      '┌──────────────────────────────────────────────────────┐',
      '│           Developer Workflow                          │',
      '│                                                      │',
      '│  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐  │',
      '│  │  Code  │─▶│  Build  │─▶│   Test   │─▶│ Deploy │  │',
      '│  │ (edit) │  │ (watch) │  │ (verify) │  │ (ship) │  │',
      '│  └────────┘  └─────────┘  └──────────┘  └────────┘  │',
      '│       │          │            │            │         │',
      '│       └──────────┴────────────┴────────────┘         │',
      '│                 Shortcuts & Automation                │',
      '└──────────────────────────────────────────────────────┘',
    ].join('\n');
  }

  // ── Generic tech ──
  return [
    '┌────────────┐   ┌────────────┐   ┌────────────┐',
    '│   User     │──▶│  System    │──▶│  Service   │',
    '│   (input)  │   │  (logic)   │   │  (output)  │',
    '└────────────┘   └────────────┘   └────────────┘',
    '                       │',
    '               ┌───────┴───────┐',
    '               │  Dependencies  │',
    '               │  (libs, APIs,  │',
    '               │   databases)   │',
    '               └───────────────┘',
  ].join('\n');
}

/**
 * Generate a hello-world-style example based on article topic.
 */
function buildHelloWorld(article) {
  const title = (article.title || '').toLowerCase();
  // Match word start (supports plurals)
  const has = (...kws) => kws.some(kw => new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(title));

  // CSS / Styling
  if (has('css', 'tailwind', 'styling', 'style', 'design')) {
    return [
      '/* CSS custom properties + layout example */',
      ':root {',
      '  --primary: #3b82f6;',
      '  --surface: #f8fafc;',
      '  --text: #0f172a;',
      '  --spacing: 1rem;',
      '}',
      '',
      '.card {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));',
      '  gap: var(--spacing);',
      '  padding: var(--spacing);',
      '  background: var(--surface);',
      '  color: var(--text);',
      '}',
      '',
      '/* Component-based structure */',
      '.card-header { font-size: 1.25rem; font-weight: 600; }',
      '.card-body  { line-height: 1.6; }',
    ].join('\n');
  }

  // Database
  if (has('postgresql', 'sqlite', 'database', 'sql', 'redis', 'message queue')) {
    return [
      '// Query a database',
      'import { Pool } from "pg";',
      '',
      'const pool = new Pool({ connectionString: process.env.DATABASE_URL });',
      '',
      'const result = await pool.query(',
      '  "SELECT id, name FROM users WHERE status = $1",',
      '  ["active"]',
      ');',
      '',
      'console.log(`Found ${result.rows.length} active users`);',
      '// → Found 42 active users',
    ].join('\n');
  }

  // Security
  if (has('cve', 'vulnerability', 'security', 'patch', 'breach', 'malware', 'exploit')) {
    return [
      '// Validate and sanitize user input',
      'import { z } from "zod";',
      '',
      'const UserInput = z.object({',
      '  email: z.string().email(),',
      '  age: z.number().min(0).max(150),',
      '  role: z.enum(["user", "admin"]).default("user"),',
      '});',
      '',
      'const safe = UserInput.parse(req.body);',
      '// Throws if validation fails — prevents injection',
    ].join('\n');
  }

  // AI / LLM API call
  if (has('openai', 'llm', 'gpt', 'claude', 'prompt', 'qwen', 'deepseek', 'gemini', 'anthropic')) {
    return [
      '// Call an LLM from your app',
      'import { OpenAI } from "openai";',
      '',
      'const ai = new OpenAI({ apiKey: process.env.API_KEY });',
      '',
      'const response = await ai.chat.completions.create({',
      '  model: "gpt-4",',
      '  messages: [',
      '    { role: "system", content: "You are a helpful assistant" },',
      '    { role: "user", content: "Explain this in one sentence" }',
      '  ],',
      '  temperature: 0.7,',
      '  max_tokens: 150,',
      '});',
      '',
      'console.log(response.choices[0].message.content);',
    ].join('\n');
  }

  // AI Agent / MCP
  if (has('agent', 'mcp', 'function calling')) {
    return [
      '// Define a tool your AI agent can use',
      'const tools = [{',
      '  name: "search_docs",',
      '  description: "Search technical documentation",',
      '  parameters: {',
      '    type: "object",',
      '    properties: {',
      '      query: { type: "string" },',
      '    },',
      '  },',
      '  async execute({ query }) {',
      '    return await fetchDocs(query);',
      '  },',
      '}];',
      '',
      'const agent = new AIAgent({ tools });',
      'const result = await agent.run("Find the API docs for v2");',
    ].join('\n');
  }

  // Web framework
  if (has('react', 'vue', 'svelte', 'next.js', 'angular', 'frontend')) {
    return [
      '// Simple counter component',
      'function Counter() {',
      '  const [count, setCount] = React.useState(0);',
      '',
      '  return (',
      '    <div>',
      '      <p>Count: {count}</p>',
      '      <button onClick={() => setCount(c => c + 1)}>',
      '        Increment',
      '      </button>',
      '    </div>',
      '  );',
      '}',
      '',
      '// Usage: <Counter />',
    ].join('\n');
  }

  // Terminal / CLI / grep
  if (has('terminal', 'cli', 'grep', 'bash', 'shell', 'command line')) {
    return [
      '# Recursively search for a pattern in code',
      '$ grep -rn "TODO\|FIXME" src/ --include="*.js"',
      '',
      '# Count lines of code per language',
      '$ find . -name "*.js" | xargs wc -l | tail -1',
      '',
      '# Watch a directory and run tests on changes',
      '$ while inotifywait -q -e modify src/; do npm test; done',
    ].join('\n');
  }

  // Productivity / Shortcuts
  if (has('shortcut', 'productivity', 'automation', 'workflow', 'tip')) {
    return [
      '// VS Code: Multi-cursor edit',
      '// 1. Select word: Ctrl+D (Cmd+D on Mac)',
      '// 2. Skip occurrence: Ctrl+K Ctrl+D',
      '// 3. Add cursor above/below: Ctrl+Alt+↑/↓',
      '// 4. Select all occurrences: Ctrl+Shift+L',
      '',
      '// Example: rename "user" to "customer"',
      '// in 10 places at once using multi-cursor',
      '',
      '// Terminal: reuse last argument',
      '// $ mkdir my-project',
      '// $ cd !$    →  cd my-project',
    ].join('\n');
  }

  // Generic fallback — nothing shown
  return null;
}

/**
 * Generate a template-based enrichment (no LLM needed).
 */
/**
 * Check if an article is about a practical tool/concept (vs. generic news).
 * Diagrams and hello-world examples only make sense for practical articles.
 */
function isPracticalArticle(article) {
  const title = (article.title || '').toLowerCase();

  // Word-boundary regex matching (supports plurals: "agents" matches "agent")
  const hasWord = (...kws) => kws.some(kw => new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(title));
  // Phrase matching (for multi-word phrases)
  const hasPhrase = (...kws) => kws.some(kw => title.includes(kw));

  // These are NOT practical — whole word only to avoid false positives
  const isReleaseNote = (...kws) => kws.some(kw => new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(title));
  if (isReleaseNote('released', 'announcing', 'announcement', 'changelog',
                    'funding', 'acquisition', 'partnership',
                    'appointed')) return false;
  if (hasPhrase('sneak peek', 'spotlight on')) return false;

  // These ARE practical
  if (hasWord('css', 'tailwind', 'sqlite', 'django', 'react', 'vue',
              'mcp', 'prompt', 'token', 'grep', 'terminal', 'cli',
              'harness', 'herder', 'cursor', 'copilot', 'debug',
              'tutorial', 'guide', 'workflow', 'pipeline', 'architecture',
              'agent') ||
      hasPhrase('how to', 'best practice', 'function calling', 'tool use')) return true;

  return false;
}

function templateEnrich(article) {
  const title = article.title || '';
  const summary = (article.summary || '').slice(0, 1000);
  const url = article.url || '';

  const isPractical = isPracticalArticle(article);

  return {
    tldr: {
      WHAT_HAPPENED: summary.slice(0, 300) || `${title} — see original article for details.`,
      WHY_CARE: `This article from ${article._sourceName} covers ${article._category} developments. Read the full article to assess relevance to your work.`,
      WHAT_CHANGED: 'See original article for specific technical changes.',
      WHO_AFFECTED: article._category === 'ai' ? 'AI/ML engineers and software developers' :
                    article._category === 'software' ? 'Web and software developers' :
                    'Software engineers and IT professionals',
      WHAT_CAN_I_DO: url,
      SHOULD_LEARN: 'Maybe — depends on your current stack. Read the article to decide.',
    },
    diagram: isPractical ? buildDiagram(article) : null,
    hello_world: isPractical ? buildHelloWorld(article) : null,
    practical_relevance: `This article from ${article._sourceName} is relevant to ${article._category} developers. ` +
      `It covers: ${title}. ` +
      `Read the full article to understand how this applies to your projects.`,
    next_steps: [
      `Read the full article: ${url}`,
      'Try the concepts in a small side project',
      'Check if this replaces or improves any of your current tools',
    ],
    learning_links: [
      `Search "${title.slice(0, 60)}" on Google`,
      `Search "${title.slice(0, 60)}" on YouTube`,
    ],
  };
}

/**
 * Enrich a batch of ranked articles.
 */
async function enrichArticles(articles) {
  console.log(`Enriching ${articles.length} articles...`);

  const ollamaAvailable = await checkOllama();
  if (ollamaAvailable) {
    console.log(`✓ Ollama available at ${OLLAMA_HOST} (model: ${OLLAMA_MODEL})`);
  } else {
    console.log('ℹ Ollama not available — using template-based enrichment');
  }

  const enriched = [];
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`  [${i + 1}/${articles.length}] ${(article.title || '').slice(0, 60)}...`);

    let enrichment;
    if (ollamaAvailable) {
      enrichment = await enrichWithOllama(article);
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!enrichment) {
      enrichment = templateEnrich(article);
    }

    enriched.push({
      ...article,
      _enriched: enrichment,
      _enrichedAt: new Date().toISOString(),
    });
  }

  return enriched;
}

/**
 * Save enriched articles.
 */
function saveEnriched(articles, rankedFilepath) {
  const basename = path.basename(rankedFilepath).replace('-ranked', '-detailed');
  const filepath = path.join(path.dirname(rankedFilepath).replace('/ranked', '/detailed'), basename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(articles, null, 2));
  console.log(`✓ Saved enriched to ${filepath}`);
  return filepath;
}

/**
 * Find the latest ranked file.
 */
function findLatestRanked() {
  const rankedDir = path.join(__dirname, '..', 'data', 'ranked');
  if (!fs.existsSync(rankedDir)) return null;
  const files = fs.readdirSync(rankedDir)
    .filter((f) => f.endsWith('-ranked.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(rankedDir, files[0]) : null;
}

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let rankedFile;

  if (args.includes('--latest')) {
    rankedFile = findLatestRanked();
    if (!rankedFile) {
      console.error('No ranked articles found. Run ranker first.');
      process.exit(1);
    }
  } else if (args[0] && !args[0].startsWith('--')) {
    rankedFile = args[0];
  } else {
    rankedFile = findLatestRanked();
    if (!rankedFile) {
      console.error('No ranked articles found. Provide a file path or run ranker first.');
      process.exit(1);
    }
  }

  console.log(`Using: ${rankedFile}`);
  const articles = JSON.parse(fs.readFileSync(rankedFile, 'utf-8'));

  enrichArticles(articles).then((enriched) => {
    saveEnriched(enriched, rankedFile);
    process.exit(0);
  }).catch((err) => {
    console.error('Enrichment failed:', err);
    process.exit(1);
  });
}

module.exports = { enrichArticles, saveEnriched, findLatestRanked, checkOllama };
