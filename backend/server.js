// =============================================================================
// Front Page - backend server  (VERSION 2: country -> channel -> articles)
//
// What this file does:
//   1. Starts a web server (Express) that our React app talks to.
//   2. GET /api/sources?country=in   -> the news channels NewsAPI knows for India
//   3. GET /api/news/the-hindu       -> the latest headlines from ONE channel
//   4. Everything NewsAPI tells us is REMEMBERED for a while (a "cache"), so we
//      don't burn through the free limit of 100 NewsAPI requests per day.
//   5. If anything goes wrong, we send back a clear, human-readable message.
//
// Your secret keys live in the file named ".env" - never in this file.
//
// Legend for the comments below:
//   NEW:     did not exist in version 1
//   CHANGED: existed in version 1, but works differently now
//   REMOVED: existed in version 1 and is gone
// =============================================================================

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mongoose from 'mongoose';

dotenv.config({ quiet: true });

// -----------------------------------------------------------------------------
// 1. Settings
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5001;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// CHANGED: this is now the base address; each request adds its own ending
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

// How long headlines are reused before we ask NewsAPI again
const ARTICLES_CACHE_MINUTES = Number(process.env.CACHE_MINUTES) || 15;

// NEW: the list of channels in a country almost never changes, so keep it a day
const SOURCES_CACHE_MINUTES = 24 * 60;

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

// NEW: the countries we accept (NewsAPI two-letter codes).
// Must match the COUNTRIES list in frontend/src/components/CountrySelector.jsx
const SUPPORTED_COUNTRIES = new Set(['in', 'us', 'gb', 'au', 'ca', 'de', 'fr', 'it', 'br', 'ar', 'za']);

// NEW: a channel id is lowercase letters, digits and dashes, e.g. "the-hindu"
const SOURCE_ID_PATTERN = /^[a-z0-9-]{1,60}$/;

// REMOVED: the hard-coded SOURCES list and NEWS_COUNTRY setting. Channels now
// come from NewsAPI itself, based on the country the visitor picks.

// -----------------------------------------------------------------------------
// 2. A custom error type: an Error that also carries an HTTP status code
// -----------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// -----------------------------------------------------------------------------
// 3. Database (MongoDB) - long-term memory for the cache (optional)
//
// CHANGED: version 1 stored only articles. Now one generic "box" stores
// anything we cache: a list of articles OR a list of channels.
//   key  = "articles:the-hindu"  or  "sources:in"
//   data = whatever we want to remember
// This uses a NEW collection, so older cached data is simply ignored.
// -----------------------------------------------------------------------------
const cacheEntrySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: mongoose.Schema.Types.Mixed,
  fetchedAt: { type: Date, default: Date.now },
});

const CacheEntry = mongoose.model('CacheEntry', cacheEntrySchema);

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
// 4. Cache helpers
//    Short-term memory: a Map that lives while the server runs.
//    Long-term memory: MongoDB (survives restarts), only when connected.
// -----------------------------------------------------------------------------
const memoryCache = new Map(); // key -> { data, fetchedAt }

async function readCache(key) {
  const inMemory = memoryCache.get(key);
  if (inMemory) return inMemory;

  if (!dbIsReady()) return null;
  try {
    const doc = await CacheEntry.findOne({ key }).lean();
    if (doc) {
      const entry = { data: doc.data, fetchedAt: doc.fetchedAt };
      memoryCache.set(key, entry);
      return entry;
    }
  } catch (err) {
    console.warn(`Could not read cache from MongoDB: ${err.message}`);
  }
  return null;
}

async function writeCache(key, data) {
  const entry = { data, fetchedAt: new Date() };
  memoryCache.set(key, entry);

  if (dbIsReady()) {
    try {
      await CacheEntry.updateOne({ key }, { $set: entry }, { upsert: true });
    } catch (err) {
      console.warn(`Could not save cache to MongoDB: ${err.message}`);
    }
  }
  return entry;
}

const isFresh = (entry, ttlMinutes) => Date.now() - new Date(entry.fetchedAt).getTime() < ttlMinutes * 60 * 1000;

// NEW: ONE function that both endpoints use. It does the whole routine:
//   fresh copy saved?  -> use it
//   otherwise          -> ask NewsAPI, save the answer
//   NewsAPI failed?    -> use an older saved copy if we have one
async function getWithCache(key, ttlMinutes, fetchFresh) {
  const cached = await readCache(key);
  if (cached && isFresh(cached, ttlMinutes)) {
    return { ...cached, cached: true, stale: false };
  }

  try {
    const data = await fetchFresh();
    const entry = await writeCache(key, data);
    return { ...entry, cached: false, stale: false };
  } catch (err) {
    if (!cached) throw err;
    console.warn(`Serving an older saved copy of "${key}" because: ${err.message}`);
    return { ...cached, cached: true, stale: true };
  }
}

// -----------------------------------------------------------------------------
// 5. Talking to NewsAPI
// -----------------------------------------------------------------------------
const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, '').trim() : null);

const cleanAuthor = (author) => {
  if (!author || author.startsWith('http') || author.length > 80) return null;
  return author.trim();
};

// Unchanged from version 1: tidy up NewsAPI's articles
function normalizeArticles(rawArticles = []) {
  const articles = [];
  const seenUrls = new Set();

  for (const raw of rawArticles) {
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

// NEW: tidy up NewsAPI's list of channels, keeping only what the screen needs
function normalizeSources(rawSources = []) {
  return rawSources
    .filter((raw) => raw.id && raw.name)
    .map((raw) => ({
      id: raw.id,
      name: raw.name,
      description: raw.description || null,
      url: raw.url || null,
      category: raw.category || null,
      language: raw.language || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// CHANGED: one new "unknown channel" message; everything else as before
function translateNewsApiError(err) {
  if (!axios.isAxiosError(err)) return err;

  if (err.response) {
    const { status, data } = err.response;
    if (status === 400 && data?.code === 'sourceDoesNotExist') {
      return new HttpError(404, 'NewsAPI does not know that news channel.');
    }
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

// NEW: the ONE place where we actually call NewsAPI. Both endpoints use it.
async function callNewsApi(path, params) {
  if (!NEWS_API_KEY) {
    throw new HttpError(500, 'The server has no NEWS_API_KEY. Add it to backend/.env and restart the server.');
  }
  try {
    const response = await axios.get(`${NEWS_API_BASE_URL}${path}`, {
      headers: { 'X-Api-Key': NEWS_API_KEY }, // the key travels in a header, not in the web address
      params,
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    throw translateNewsApiError(err);
  }
}

// NEW: NewsAPI  GET /v2/top-headlines/sources?country=in
async function fetchSourcesFromNewsApi(country) {
  const data = await callNewsApi('/top-headlines/sources', { country });
  return normalizeSources(data.sources);
}

// CHANGED: NewsAPI  GET /v2/top-headlines?sources=the-hindu
// (version 1 got this from the hard-coded list; now any channel id works)
async function fetchHeadlinesFromNewsApi(sourceId) {
  const data = await callNewsApi('/top-headlines', { sources: sourceId, pageSize: 20 });
  return normalizeArticles(data.articles);
}

// -----------------------------------------------------------------------------
// 6. The web server and its routes
// -----------------------------------------------------------------------------
const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, `Origin ${origin} is not allowed by CORS.`));
    },
    methods: ['GET'],
  })
);
app.use(express.json());

// Route 1 (unchanged): a quick "is the server alive?" check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbIsReady() ? 'connected' : 'not connected',
    newsApiKeyConfigured: Boolean(NEWS_API_KEY),
  });
});

// Route 2 (NEW): the channels for one country, e.g. /api/sources?country=in
app.get('/api/sources', async (req, res) => {
  const country = String(req.query.country ?? '').toLowerCase();

  if (!SUPPORTED_COUNTRIES.has(country)) {
    throw new HttpError(
      400,
      `Please give a supported country code, for example /api/sources?country=in (supported: ${[...SUPPORTED_COUNTRIES].join(', ')}).`
    );
  }

  const result = await getWithCache(`sources:${country}`, SOURCES_CACHE_MINUTES, () =>
    fetchSourcesFromNewsApi(country)
  );

  res.json({
    country,
    sources: result.data,
    cached: result.cached,
    stale: result.stale,
    fetchedAt: result.fetchedAt,
  });
});

// Route 3 (CHANGED): the latest headlines from ONE channel, e.g. /api/news/the-hindu
// Version 1 only accepted channels from a fixed list. Now any well-formed
// channel id is passed on to NewsAPI. (When we go live we will add rate limiting.)
app.get('/api/news/:sourceId', async (req, res) => {
  const { sourceId } = req.params;

  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new HttpError(400, 'That does not look like a valid news channel id.');
  }

  const result = await getWithCache(`articles:${sourceId}`, ARTICLES_CACHE_MINUTES, () =>
    fetchHeadlinesFromNewsApi(sourceId)
  );

  res.json({
    source: sourceId,
    articles: result.data,
    cached: result.cached,
    stale: result.stale,
    fetchedAt: result.fetchedAt,
  });
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
// 7. Start everything
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY is missing - add it to backend/.env (see .env.example).');
  }
  connectDatabase();
});