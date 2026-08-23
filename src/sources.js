/**
 * RSS feed sources.
 * Priority: practical developer content > community news > company blogs
 *
 * "weight" controls source priority in ranking (higher = more weight).
 * The ranker uses this to boost practical developer content.
 */
const sources = [
  // ═══ PRACTICAL DEV CONTENT (highest priority) ══════════
  {
    name: "Simon Willison",
    category: "engineering",
    feeds: ["https://simonwillison.net/atom/everything/"],
    weight: 1.4,  // Practical AI/LLM tips, real-world usage
  },
  {
    name: "Julia Evans",
    category: "engineering",
    feeds: ["https://jvns.ca/atom.xml"],
    weight: 1.4,  // Deep practical dev explanations (grep, DNS, etc.)
  },
  {
    name: "Dev.to",
    category: "engineering",
    feeds: ["https://dev.to/feed"],
    weight: 1.3,  // Developer tutorials and tips
  },
  {
    name: "Echo JS",
    category: "engineering",
    feeds: ["https://echojs.com/rss"],
    weight: 1.3,  // JavaScript community articles
  },
  {
    name: "CSS Tricks",
    category: "engineering",
    feeds: ["https://css-tricks.com/feed/"],
    weight: 1.2,  // Web dev tips
  },
  {
    name: "Smashing Magazine",
    category: "engineering",
    feeds: ["https://www.smashingmagazine.com/feed/"],
    weight: 1.2,  // Web dev tutorials
  },
  {
    name: "Danny van Kooten",
    category: "engineering",
    feeds: ["https://www.dannyvankooten.com/feed/"],
    weight: 1.3,  // Practical dev tips, performance
  },
  {
    name: "Thorsten Ball",
    category: "engineering",
    feeds: ["https://thorstenball.com/atom.xml"],
    weight: 1.3,  // Deep technical writing
  },

  // ═══ HACKER NEWS (community-voted, good signal) ═══════
  {
    name: "Hacker News",
    category: "engineering",
    feeds: ["https://hnrss.org/frontpage?count=30"],
    weight: 1.2,
  },

  // ═══ AI (practical AI usage) ═════════════════════════
  {
    name: "Hugging Face Blog",
    category: "ai",
    feeds: ["https://huggingface.co/blog/feed.xml"],
    weight: 1.1,
  },
  {
    name: "Google AI Blog",
    category: "ai",
    feeds: ["https://feeds.feedburner.com/blogspot/gJZg"],
    weight: 1.0,
  },
  {
    name: "Meta Engineering",
    category: "ai",
    feeds: ["https://engineering.fb.com/feed/"],
    weight: 1.0,
  },
  {
    name: "Apple ML Research",
    category: "ai",
    feeds: ["https://machinelearning.apple.com/rss.xml"],
    weight: 0.9,
  },

  // ═══ SOFTWARE DEV BLOGS ══════════════════════════════
  {
    name: "Stack Overflow Blog",
    category: "engineering",
    feeds: ["https://stackoverflow.blog/feed/"],
    weight: 1.1,
  },
  {
    name: "GitHub Blog",
    category: "software",
    feeds: ["https://github.blog/feed/"],
    weight: 1.0,
  },
  {
    name: "Cloudflare Blog",
    category: "software",
    feeds: ["https://blog.cloudflare.com/rss/"],
    weight: 1.0,
  },
  {
    name: "Microsoft Dev Blog",
    category: "software",
    feeds: ["https://devblogs.microsoft.com/feed/"],
    weight: 1.0,
  },
  {
    name: "Google Developers Blog",
    category: "software",
    feeds: ["https://developers.googleblog.com/feeds/posts/default"],
    weight: 1.0,
  },
  {
    name: "Node.js Blog",
    category: "software",
    feeds: ["https://nodejs.org/en/feed/blog.xml"],
    weight: 0.8,
  },
  {
    name: "Rust Blog",
    category: "software",
    feeds: ["https://blog.rust-lang.org/feed.xml"],
    weight: 0.8,
  },
  {
    name: "Python Insider",
    category: "software",
    feeds: ["https://blog.python.org/feeds/posts/default"],
    weight: 0.8,
  },
  {
    name: "AWS Blog",
    category: "software",
    feeds: ["https://aws.amazon.com/blogs/aws/feed/"],
    weight: 0.7,
  },

  // ═══ TECH NEWS (low priority — business/company focus) ═
  {
    name: "Ars Technica",
    category: "engineering",
    feeds: ["https://feeds.arstechnica.com/arstechnica/index"],
    weight: 0.6,
  },
  {
    name: "The Register",
    category: "engineering",
    feeds: ["https://www.theregister.com/headlines.rss"],
    weight: 0.5,
  },
  {
    name: "TechCrunch",
    category: "engineering",
    feeds: ["https://techcrunch.com/feed/"],
    weight: 0.3,  // Mostly startup/business news
  },
  {
    name: "VentureBeat",
    category: "engineering",
    feeds: ["https://venturebeat.com/feed/"],
    weight: 0.3,  // Mostly business/company news
  },
];

module.exports = sources;
