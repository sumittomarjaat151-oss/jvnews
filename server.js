require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const CACHE_FILE = path.join(__dirname, 'cache.json');
const CACHE_TTL = (Number(process.env.CACHE_TTL_SECONDS) || 600) * 1000;

if (!GNEWS_API_KEY) {
  console.error('Missing GNEWS_API_KEY environment variable.');
  process.exit(1);
}

let cache = loadCache();

app.use(cors());
app.use(express.static(path.join(__dirname)));

app.get('/api/news', async (req, res) => {
  const category = req.query.category || 'general';
  const page = Number(req.query.page || 1);
  const refresh = req.query.refresh === 'true';
  const cacheKey = `news:${category}:${page}`;

  try {
    const data = await getCachedOrFetch(cacheKey, buildNewsUrl(category, page), refresh);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';
  const page = Number(req.query.page || 1);
  const refresh = req.query.refresh === 'true';
  const cacheKey = `search:${query}:${page}`;

  if (!query.trim()) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const data = await getCachedOrFetch(cacheKey, buildSearchUrl(query, page), refresh);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/trending', async (req, res) => {
  const cacheKey = 'trending';
  const refresh = req.query.refresh === 'true';
  try {
    const data = await getCachedOrFetch(cacheKey, buildNewsUrl('general', 1), refresh);
    data.articles = (data.articles || []).slice(0, 5);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', cacheTTLSeconds: CACHE_TTL / 1000, cachedKeys: Object.keys(cache).length });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UC News backend running on http://localhost:${PORT}`);
});

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (error) {
    console.warn('Cache file could not be loaded, starting fresh.');
  }
  return {};
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write cache file:', error);
  }
}

function buildNewsUrl(category, page) {
  const encodedCategory = encodeURIComponent(category);
  return `https://gnews.io/api/v4/top-headlines?apikey=${GNEWS_API_KEY}&topic=${encodedCategory}&country=in&lang=hi&page=${page}`;
}

function buildSearchUrl(query, page) {
  const encodedQuery = encodeURIComponent(query);
  return `https://gnews.io/api/v4/search?apikey=${GNEWS_API_KEY}&q=${encodedQuery}&lang=hi&page=${page}`;
}

async function getCachedOrFetch(key, url, refresh = false) {
  const cached = cache[key];
  const now = Date.now();

  if (!refresh && cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchNews(url);
  cache[key] = { timestamp: now, data };
  saveCache();
  return data;
}

async function fetchNews(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GNews API failed with status ${response.status}`);
  }
  return response.json();
}

