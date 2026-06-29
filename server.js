require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const rawApiKey = (process.env.GNEWS_API_KEY || '').trim();
const GNEWS_API_KEY = rawApiKey && rawApiKey !== 'YOUR_GNEWS_API_KEY_HERE' ? rawApiKey : '';
const CACHE_FILE = path.join(__dirname, 'cache.json');
const ADMIN_ARTICLES_FILE = path.join(__dirname, 'admin-articles.json');
const CACHE_TTL = (Number(process.env.CACHE_TTL_SECONDS) || 600) * 1000;
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').trim();

if (!GNEWS_API_KEY) {
  console.warn('Missing GNEWS_API_KEY environment variable. Running with demo fallback news.');
}

let cache = loadCache();
let adminArticles = loadAdminArticles();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/api/news', async (req, res) => {
  const category = req.query.category || 'general';
  const page = Number(req.query.page || 1);
  const refresh = req.query.refresh === 'true';
  const cacheKey = `news:${category}:${page}`;

  try {
    const data = await getCachedOrFetch(cacheKey, buildNewsUrl(category, page), refresh);
    data.articles = mergeAdminArticles(data.articles || [], category, page);
    data.totalArticles = data.articles.length;
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
    const localMatches = searchAdminArticles(query);
    data.articles = page === 1 ? [...localMatches, ...(data.articles || [])] : (data.articles || []);
    data.totalArticles = data.articles.length;
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
    data.articles = [...getPublishedAdminArticles().slice(0, 2), ...(data.articles || [])].slice(0, 5);
    data.totalArticles = data.articles.length;
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    mode: GNEWS_API_KEY ? 'live' : 'demo',
    cacheTTLSeconds: CACHE_TTL / 1000,
    cachedKeys: Object.keys(cache).length,
    adminArticles: adminArticles.length
  });
});

app.get('/api/admin/articles', (req, res) => {
  res.json({ articles: adminArticles });
});

app.post('/api/admin/articles', (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  const article = normalizeAdminArticle(req.body || {});
  const validationError = validateAdminArticle(article);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  adminArticles.unshift(article);
  saveAdminArticles();
  res.status(201).json({ article });
});

app.delete('/api/admin/articles/:id', (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  const before = adminArticles.length;
  adminArticles = adminArticles.filter((article) => article.id !== req.params.id);

  if (adminArticles.length === before) {
    return res.status(404).json({ error: 'Article not found' });
  }

  saveAdminArticles();
  res.json({ ok: true });
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

function loadAdminArticles() {
  try {
    if (fs.existsSync(ADMIN_ARTICLES_FILE)) {
      const content = fs.readFileSync(ADMIN_ARTICLES_FILE, 'utf-8');
      return JSON.parse(content || '[]');
    }
  } catch (error) {
    console.warn('Admin articles file could not be loaded, starting empty.');
  }
  return [];
}

function saveAdminArticles() {
  try {
    fs.writeFileSync(ADMIN_ARTICLES_FILE, JSON.stringify(adminArticles, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write admin articles file:', error);
  }
}

function buildNewsUrl(category, page) {
  const topic = category === 'world' ? 'general' : category;
  const encodedCategory = encodeURIComponent(topic);
  return `https://gnews.io/api/v4/top-headlines?apikey=${GNEWS_API_KEY}&category=${encodedCategory}&country=in&lang=hi&page=${page}`;
}

function buildSearchUrl(query, page) {
  const encodedQuery = encodeURIComponent(query);
  return `https://gnews.io/api/v4/search?apikey=${GNEWS_API_KEY}&q=${encodedQuery}&lang=hi&page=${page}`;
}

function isAdmin(req) {
  return String(req.headers['x-admin-password'] || req.body?.password || '') === ADMIN_PASSWORD;
}

function normalizeAdminArticle(input) {
  const now = new Date().toISOString();
  const id = input.id || `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    content: String(input.content || input.description || '').trim(),
    category: String(input.category || 'general').trim().toLowerCase(),
    image: String(input.image || '').trim(),
    url: `/admin-story/${encodeURIComponent(id)}`,
    publishedAt: input.publishedAt || now,
    source: { name: String(input.source || 'JV News Desk').trim() || 'JV News Desk' },
    adminPost: true
  };
}

function validateAdminArticle(article) {
  if (!article.title || article.title.length < 5) return 'Title must be at least 5 characters';
  if (!article.description || article.description.length < 10) return 'Summary must be at least 10 characters';
  if (!article.content || article.content.length < 20) return 'Content must be at least 20 characters';
  if (article.image && !/^https?:\/\//i.test(article.image)) return 'Image must be a valid http/https URL';
  return '';
}

function getPublishedAdminArticles(category = '') {
  return adminArticles.filter((article) => {
    if (!category || category === 'general' || category === 'world') return true;
    return article.category === category;
  });
}

function mergeAdminArticles(apiArticles, category, page) {
  if (Number(page) !== 1) return apiArticles;
  return [...getPublishedAdminArticles(category), ...apiArticles];
}

function searchAdminArticles(query) {
  const term = String(query || '').toLowerCase();
  if (!term) return [];
  return adminArticles.filter((article) => {
    return [article.title, article.description, article.content, article.category]
      .some((value) => String(value || '').toLowerCase().includes(term));
  });
}

async function getCachedOrFetch(key, url, refresh = false) {
  const cached = cache[key];
  const now = Date.now();
  const [type, name, page = 1] = key.split(':');

  // Fresh cache available
  if (!refresh && cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Try fresh API request
    const data = await fetchNews(url);

    cache[key] = {
      timestamp: now,
      data
    };

    saveCache();

    return data;

  } catch (error) {

    // If API fails, use old cache
    if (cached?.data) {
      console.warn('Using expired cache because API failed.');
      return cached.data;
    }

    console.warn(`Using demo fallback because live news failed: ${error.message}`);
    return buildFallbackResponse(type, name, Number(page) || 1);
  }
}

async function fetchNews(url) {
  if (!GNEWS_API_KEY) {
    throw new Error('GNEWS_API_KEY is not configured');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GNews API failed with status ${response.status}`);
  }
  return response.json();
}

function buildFallbackResponse(type = 'news', name = 'general', page = 1) {
  const label = type === 'search' ? `Search: ${name}` : toTitleCase(name || 'general');
  const sources = ['JV Desk', 'Metro Brief', 'Tech Wire', 'Market Watch', 'Health Note', 'Sports Line'];
  const topics = [
    'Morning brief: key updates you should know',
    'Policy changes and public services in focus',
    'Markets open steady as investors track global cues',
    'Technology teams push faster digital services',
    'Health experts share simple safety reminders',
    'Sports roundup: big fixtures and standout moments',
    'Entertainment buzz from films, music, and streaming',
    'Science update: research teams report fresh progress'
  ];

  const articles = topics.map((topic, index) => {
    const id = `${type}-${name}-${page}-${index + 1}`;
    return {
      title: `${label} - ${topic}`,
      description: 'Demo story shown because the live news API is not configured or temporarily unavailable. Add GNEWS_API_KEY in .env to enable real headlines.',
      content: 'This is fallback content for local testing. The app, save, reactions, comments, sharing, search layout, and modals still work while you set up the live API key.',
      url: `https://example.com/jv-news/${encodeURIComponent(id)}`,
      image: `https://picsum.photos/seed/${encodeURIComponent(id)}/900/520`,
      publishedAt: new Date(Date.now() - (index + page) * 3600000).toISOString(),
      source: { name: sources[index % sources.length] }
    };
  });

  return {
    totalArticles: articles.length,
    articles
  };
}

function toTitleCase(value) {
  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
