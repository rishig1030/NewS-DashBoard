// =============================================================================
// Front Page - backend server
//
// What this file does:
//   1. Starts a web server (Express) that our React app talks to.
//   2. When React asks for "bbc-news" headlines, we ask NewsAPI.org for them.
//   3. We tidy the data up and REMEMBER it for a few minutes (a "cache"),
//      so we don't burn through the free limit of 100 NewsAPI requests/day.
//   4. If anything goes wrong, we send back a clear, human-readable message.
//
// Your secret keys live in the file named ".env" - never in this file.
// =============================================================================

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mongoose from 'mongoose';

// Read the settings from the ".env" file into process.env
dotenv.config({ quiet: true });

// -----------------------------------------------------------------------------
// 1. Settings
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5001;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/top-headlines';
const NEWS_COUNTRY = process.env.NEWS_COUNTRY || 'us';
const CACHE_MINUTES = Number(process.env.CACHE_MINUTES) || 15;

// Websites that are allowed to call this server (comma-separated in .env)
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

// -----------------------------------------------------------------------------
// 2. The tabs we support
//    The key (e.g. "bbc-news") is what the React app sends us.
//    "query" is what we send to NewsAPI.
//    NOTE: NewsAPI does not allow "sources" to be mixed with "category"/"country".
// -----------------------------------------------------------------------------
const SOURCES = {
  'bbc-news': { name: 'BBC News', query: { sources: 'bbc-news' } },
  cnn: { name: 'CNN', query: { sources: 'cnn' } },
  techcrunch: { name: 'TechCrunch', query: { sources: 'techcrunch' } },
  'the-verge': { name: 'The Verge', query: { sources: 'the-verge' } },
  wired: { name: 'Wired', query: { sources: 'wired' } },
  'al-jazeera-english': { name: 'Al Jazeera', query: { sources: 'al-jazeera-english' } },
  business: { name: 'Business', query: { category: 'business', country: NEWS_COUNTRY } },
  science: { name: 'Science', query: { category: 'science', country: NEWS_COUNTRY } },
};

// -----------------------------------------------------------------------------
// 3. A custom error type: an Error that also carries an HTTP status code
//    (404 = not found, 429 = too many requests, 502 = other server failed...)
// -----------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// -----------------------------------------------------------------------------
// 4. Database (MongoDB) - used as a long-term memory for the cache.
//    The app still works without it, using only short-term memory (RAM).
// -----------------------------------------------------------------------------
const articleSchema = new mongoose.Schema(
  {
    url: String,
    title: String,
    description: String,
    imageUrl: String,
    author: String,
    sourceName: String,
    publishedAt: String,
  },
  { _id: false }
);

const newsCacheSchema = new mongoose.Schema({
  sourceId: { type: String, required: true, unique: true },
  articles: [articleSchema],
  fetchedAt: { type: Date, default: Date.now },
});

const NewsCache = mongoose.model('NewsCache', newsCacheSchema);

// readyState 1 means "connected"
const dbIsReady = () => mongoose.connection.readyState === 1;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI is not set - running WITHOUT a database (memory cache only).');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.warn(`Could not connect to MongoDB (${err.message}). Continuing without it.`);
  }
}

// -----------------------------------------------------------------------------
// 5. Cache helpers
//    Short-term memory: a Map that lives while the server runs.
//    Long-term memory: MongoDB (survives restarts), only when connected.
// -----------------------------------------------------------------------------
const memoryCache = new Map(); // sourceId -> { articles, fetchedAt }

async function readCache(sourceId) {
  const inMemory = memoryCache.get(sourceId);
  if (inMemory) return inMemory;

  if (!dbIsReady()) return null;
  try {
    const doc = await NewsCache.findOne({ sourceId }).lean();
    if (doc) {
      const entry = { articles: doc.articles, fetchedAt: doc.fetchedAt };
      memoryCache.set(sourceId, entry);
      return entry;
    }
  } catch (err) {
    console.warn(`Could not read cache from MongoDB: ${err.message}`);
  }
  return null;
}

async function writeCache(sourceId, articles) {
  const entry = { articles, fetchedAt: new Date() };
  memoryCache.set(sourceId, entry);

  if (dbIsReady()) {
    try {
      await NewsCache.updateOne({ sourceId }, { $set: entry }, { upsert: true });
    } catch (err) {
      console.warn(`Could not save cache to MongoDB: ${err.message}`);
    }
  }
  return entry;
}

// "Fresh" = saved less than CACHE_MINUTES minutes ago
const isFresh = (entry) => Date.now() - new Date(entry.fetchedAt).getTime() < CACHE_MINUTES * 60 * 1000;

// -----------------------------------------------------------------------------
// 6. Talking to NewsAPI
// -----------------------------------------------------------------------------

// Remove any HTML tags (like <p> or <a>) from a piece of text
const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, '').trim() : null);

// NewsAPI sometimes puts a web address or a very long text in "author"
const cleanAuthor = (author) => {
  if (!author || author.startsWith('http') || author.length > 80) return null;
  return author.trim();
};

// Turn NewsAPI's messy articles into a small, clean shape for the frontend
function normalizeArticles(rawArticles = []) {
  const articles = [];
  const seenUrls = new Set();

  for (const raw of rawArticles) {
    // Skip broken, removed or duplicate articles
    if (!raw.url || !raw.title || raw.title === '[Removed]') continue;
    if (seenUrls.has(raw.url)) continue;
    seenUrls.add(raw.url);

    articles.push({
      url: raw.url,
      title: raw.title.trim(),
      description: stripHtml(raw.description),
      imageUrl: raw.urlToImage || null,
      author: cleanAuthor(raw.author),
      sourceName: raw.source?.name || null,
      publishedAt: raw.publishedAt || null,
    });
  }
  return articles;
}

// Convert errors from NewsAPI into friendly messages
function translateNewsApiError(err) {
  if (!axios.isAxiosError(err)) return err;

  if (err.response) {
    const { status, data } = err.response;
    if (status === 429) {
      return new HttpError(429, 'The NewsAPI daily limit (100 requests on the free plan) has been reached. Try again tomorrow.');
    }
    if (status === 401) {
      return new HttpError(502, 'NewsAPI rejected our API key. Check NEWS_API_KEY in backend/.env, then restart the server.');
    }
    return new HttpError(502, `NewsAPI returned an error: ${data?.message || status}`);
  }
  if (err.code === 'ECONNABORTED') {
    return new HttpError(504, 'NewsAPI took too long to answer. Please try again.');
  }
  return new HttpError(502, 'Could not reach NewsAPI. Check your internet connection.');
}

async function fetchHeadlines(source) {
  try {
    const response = await axios.get(NEWS_API_URL, {
      headers: { 'X-Api-Key': NEWS_API_KEY }, // the key travels in a header, not in the web address
      params: { ...source.query, pageSize: 20 },
      timeout: 10000,
    });
    return normalizeArticles(response.data.articles);
  } catch (err) {
    throw translateNewsApiError(err);
  }
}

// The exact shape of what we send back to React
function buildResponse(sourceId, source, entry, { cached = false, stale = false } = {}) {
  return {
    source: sourceId,
    name: source.name,
    cached,
    stale,
    fetchedAt: entry.fetchedAt,
    articles: entry.articles,
  };
}

// -----------------------------------------------------------------------------
// 7. The web server and its routes
// -----------------------------------------------------------------------------
const app = express();

// CORS = the browser's safety rule that blocks websites from calling other
// websites. We only allow the addresses listed in CLIENT_URL.
app.use(
  cors({
    origin(origin, callback) {
      // No "origin" means a direct visit (browser address bar, curl) - allow it
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, `Origin ${origin} is not allowed by CORS.`));
    },
    methods: ['GET'],
  })
);
app.use(express.json());

// Route 1: a quick "is the server alive?" check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbIsReady() ? 'connected' : 'not connected',
    newsApiKeyConfigured: Boolean(NEWS_API_KEY),
  });
});

// Route 2: headlines for one tab, e.g. /api/news/bbc-news
app.get('/api/news/:sourceId', async (req, res) => {
  const { sourceId } = req.params;

  // Only accept tabs we know about
  if (!Object.hasOwn(SOURCES, sourceId)) {
    throw new HttpError(404, `Unknown news source "${sourceId}".`);
  }
  const source = SOURCES[sourceId];

  // Is there a recent saved answer? Then use it - no NewsAPI request needed.
  const cached = await readCache(sourceId);
  if (cached && isFresh(cached)) {
    return res.json(buildResponse(sourceId, source, cached, { cached: true }));
  }

  // Otherwise ask NewsAPI for fresh headlines
  let entry;
  try {
    if (!NEWS_API_KEY) {
      throw new HttpError(500, 'The server has no NEWS_API_KEY. Add it to backend/.env and restart the server.');
    }
    const articles = await fetchHeadlines(source);
    entry = await writeCache(sourceId, articles);
  } catch (err) {
    if (!cached) throw err;
    // NewsAPI failed, but we have an older saved copy - better than nothing
    console.warn(`Serving an older saved copy of "${sourceId}" because: ${err.message}`);
    return res.json(buildResponse(sourceId, source, cached, { cached: true, stale: true }));
  }

  res.json(buildResponse(sourceId, source, entry));
});

// Anything else: "page not found"
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} does not exist.` });
});

// The safety net: every error in the app ends up here (it needs all 4 inputs)
app.use((err, req, res, next) => {
  const isKnown = err instanceof HttpError;
  if (!isKnown) console.error('Unexpected server error:', err);

  res.status(isKnown ? err.status : 500).json({
    error: isKnown ? err.message : 'Something went wrong on the server.',
  });
});

// -----------------------------------------------------------------------------
// 8. Start everything
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY is missing - add it to backend/.env (see .env.example).');
  }
  connectDatabase();
});