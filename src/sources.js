/**
 * RSS feed sources.
 * Only sources that actually fetch successfully. Non-working ones removed.
 *
 * Priority: practical developer content > community news > company blogs
 * "weight" controls source priority in ranking (higher = more weight).
 */
const sources = [
  // ═══ PRACTICAL DEV CONTENT (highest priority) ══════════
  {
    name: "Julia Evans",
    category: "engineering",
    feeds: ["https://jvns.ca/atom.xml"],
    weight: 1.4,
  },
  {
    name: "Dev.to",
    category: "engineering",
    feeds: ["https://dev.to/feed"],
    weight: 1.3,
  },
  {
    name: "Echo JS",
    category: "engineering",
    feeds: ["https://echojs.com/rss"],
    weight: 1.3,
  },
  {
    name: "CSS Tricks",
    category: "engineering",
    feeds: ["https://css-tricks.com/feed/"],
    weight: 1.2,
  },
  {
    name: "Smashing Magazine",
    category: "engineering",
    feeds: ["https://www.smashingmagazine.com/feed/"],
    weight: 1.2,
  },
  {
    name: "Martin Fowler",
    category: "engineering",
    feeds: ["https://martinfowler.com/feed.atom"],
    weight: 1.2,
  },

  // ═══ COMMUNITY / AGGREGATORS ═════════════════════════
  {
    name: "Hacker News",
    category: "engineering",
    feeds: ["https://hnrss.org/frontpage?count=30"],
    weight: 1.2,
  },
  {
    name: "Stack Overflow Blog",
    category: "engineering",
    feeds: ["https://stackoverflow.blog/feed/"],
    weight: 1.1,
  },
  {
    name: "The New Stack",
    category: "engineering",
    feeds: ["https://thenewstack.io/feed/"],
    weight: 1.0,
  },
  {
    name: "Pragmatic Engineer",
    category: "engineering",
    feeds: ["https://newsletter.pragmaticengineer.com/feed"],
    weight: 1.1,
  },

  // ═══ AI (practical AI usage) ═════════════════════════
  {
    name: "OpenAI",
    category: "ai",
    feeds: ["https://openai.com/blog/rss.xml"],
    weight: 1.2,
  },
  {
    name: "Latent Space",
    category: "ai",
    feeds: ["https://www.latent.space/feed"],
    weight: 1.1,
  },
  {
    name: "One Useful Thing",
    category: "ai",
    feeds: ["https://www.oneusefulthing.org/feed"],
    weight: 1.1,
  },
  {
    name: "Meta Engineering",
    category: "ai",
    feeds: ["https://engineering.fb.com/feed/"],
    weight: 1.0,
  },

  // ═══ SOFTWARE DEV BLOGS ══════════════════════════════
  {
    name: "GitHub Blog",
    category: "software",
    feeds: ["https://github.blog/feed/"],
    weight: 1.0,
  },
  {
    name: "GitHub Engineering",
    category: "software",
    feeds: ["https://github.blog/engineering/feed/"],
    weight: 1.1,
  },
  {
    name: "Cloudflare Blog",
    category: "software",
    feeds: ["https://blog.cloudflare.com/rss/"],
    weight: 1.0,
  },
  {
    name: "Vercel Blog",
    category: "software",
    feeds: ["https://vercel.com/blog/feed.xml"],
    weight: 0.9,
  },
  {
    name: "Netflix Tech Blog",
    category: "software",
    feeds: ["https://netflixtechblog.com/feed"],
    weight: 0.9,
  },
  {
    name: "Spotify Engineering",
    category: "software",
    feeds: ["https://engineering.atspotify.com/feed/"],
    weight: 0.9,
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
    name: "Heroku Blog",
    category: "software",
    feeds: ["https://blog.heroku.com/feed"],
    weight: 0.7,
  },

  // ═══ TECH NEWS ══════════════════════════════════════
  {
    name: "AWS Blog",
    category: "software",
    feeds: ["https://aws.amazon.com/blogs/aws/feed/"],
    weight: 0.7,
  },
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
    weight: 0.3,
  },
  {
    name: "SD Times",
    category: "software",
    feeds: ["https://sdtimes.com/feed/"],
    weight: 0.5,
  },

];

module.exports = sources;
