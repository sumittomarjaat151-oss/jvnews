// ==================== UC NEWS APP - COMPLETE WORKING VERSION ====================
const API_BASE = "/api";

let appState = {
  page: 1,
  category: "general",
  query: "",
  loading: false,
  isInitialLoad: true,
  articles: [],
  saved: JSON.parse(localStorage.getItem("uc-saved") || "[]"),
  reactions: JSON.parse(localStorage.getItem("uc-reactions") || "{}"),
  theme: localStorage.getItem("uc-theme") || "light",
  trending: [],
  recently: JSON.parse(localStorage.getItem("uc-recently") || "[]")
};

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  console.log("App initializing...");
  initUI();
  applyTheme(appState.theme);
  loadTrending();
  appState.isInitialLoad = true;
  fetchNews("general").finally(() => {
    appState.isInitialLoad = false;
  });
});

// ==================== UI INITIALIZATION ====================
function initUI() {
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");
  const categoryBtns = document.querySelectorAll(".category-bar button");

  if (searchBtn) searchBtn.addEventListener("click", handleSearch);
  if (searchInput) searchInput.addEventListener("keypress", (e) => e.key === "Enter" && handleSearch());
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

  categoryBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      categoryBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.dataset.category;
      if (cat === "saved") {
        showSaved();
      } else if (cat === "recently") {
        showRecently();
      } else {
        appState.page = 1;
        appState.category = cat;
        appState.query = "";
        fetchNews(cat);
      }
    });
  });

  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
      if (appState.category !== "saved" && appState.category !== "recently" && !appState.loading) {
        appState.page++;
        fetchNews(appState.category, true);
      }
    }
  });
}

// ==================== NEWS FETCHING ====================
async function fetchNews(category, append = false, refresh = false) {
  if (appState.loading) return;
  appState.loading = true;

  const container = document.getElementById("content");
  if (!container) return;

  if (!append) {
    container.innerHTML = '<div class="loader">📰 Loading news...</div>';
  }

  try {
    const url = `${API_BASE}/news?category=${encodeURIComponent(category)}&page=${appState.page}${refresh ? '&refresh=true' : ''}`;
    console.log("Fetching from:", url);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    console.log("Received articles:", data.articles?.length || 0);

    const articles = data.articles || [];
    if (articles.length === 0) {
      if (!append) container.innerHTML = '<div class="empty">No articles found</div>';
      return;
    }

    if (append) {
      appState.articles.push(...articles);
    } else {
      appState.articles = articles;
      container.innerHTML = "";
    }

    renderNews(append ? articles : appState.articles, append);
  } catch (error) {
    console.error("Fetch error:", error);
    if (!appState.isInitialLoad && !append) {
      container.innerHTML = `<div class="error">❌ Error: ${error.message}</div>`;
    }
  } finally {
    appState.loading = false;
  }
}

async function handleSearch() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) {
    appState.page = 1;
    appState.query = "";
    appState.category = "general";
    fetchNews("general");
    return;
  }

  appState.page = 1;
  appState.query = query;
  appState.category = "search";
  const container = document.getElementById("content");
  if (container) container.innerHTML = '<div class="loader">🔍 Searching...</div>';

  try {
    const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&page=${appState.page}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    const articles = data.articles || [];

    if (articles.length === 0) {
      if (container) container.innerHTML = '<div class="empty">No results found</div>';
      return;
    }

    appState.articles = articles;
    if (container) container.innerHTML = "";
    renderNews(articles);
  } catch (error) {
    console.error("Search error:", error);
    if (container) container.innerHTML = `<div class="error">❌ Search failed: ${error.message}</div>`;
  } finally {
    appState.loading = false;
  }
}

async function loadTrending() {
  try {
    const url = `${API_BASE}/trending`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    appState.trending = (data.articles || []).slice(0, 5);
    renderTrending();
  } catch (error) {
    console.error("Trending load error:", error);
  }
}

// ==================== RENDERING ====================
function renderNews(articles, append = false) {
  const container = document.getElementById("content");
  if (!container) return;

  articles.forEach((article, idx) => {
    const id = article.url;
    const saved = appState.saved.find((a) => a.url === id);
    const reactions = appState.reactions[id] || { likes: 0, dislikes: 0, comments: [] };

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      ${article.image ? `<img src="${article.image}" alt="Article" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22%3E%3Crect fill=%22%23ddd%22 width=%22300%22 height=%22200%22/%3E%3C/svg%3E'">` : ""}
      <div class="card-content">
        <h3>${article.title || "Untitled"}</h3>
        <p>${article.description?.slice(0, 120) || "No description"}</p>
        <div class="meta">
          <span>${article.source?.name || "Source"}</span>
          ${article.publishedAt ? `<span>${new Date(article.publishedAt).toLocaleDateString()}</span>` : ""}
        </div>
        <div class="stats">
          <span>👍 ${reactions.likes}</span>
          <span>👎 ${reactions.dislikes}</span>
          <span>💬 ${reactions.comments.length}</span>
        </div>
        <div class="actions">
          <button class="btn-save ${saved ? "saved" : ""}" onclick="toggleSave('${id}')">🔖 ${saved ? "Saved" : "Save"}</button>
          <button class="btn-like ${reactions.liked ? "liked" : ""}" onclick="toggleLike('${id}')">👍 Like</button>
          <button class="btn-dislike ${reactions.disliked ? "disliked" : ""}" onclick="toggleDislike('${id}')">👎 Dislike</button>
          <button class="btn-comment" onclick="addCommentPrompt('${id}')">💬 Comment</button>
          <button class="btn-view" onclick="viewArticle('${id}')">View</button>
          <button class="btn-share" onclick="shareArticle('${id}')">Share</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderTrending() {
  const strip = document.getElementById("trendingStrip");
  if (!strip) return;

  strip.innerHTML = appState.trending.map((article, idx) => `
    <button class="trend-item" onclick="viewArticle('${article.url}')">
      <span class="fire">🔥</span>
      <div>
        <strong>${article.title?.slice(0, 40) || "Trending"}...</strong>
        <small>${article.source?.name || "Source"}</small>
      </div>
    </button>
  `).join("");
}

function showSaved() {
  const container = document.getElementById("content");
  container.innerHTML = "";

  if (appState.saved.length === 0) {
    container.innerHTML = '<div class="empty">No saved articles yet</div>';
    return;
  }

  appState.articles = appState.saved;
  renderNews(appState.saved);
}

function showRecently() {
  const container = document.getElementById("content");
  container.innerHTML = "";

  if (appState.recently.length === 0) {
    container.innerHTML = '<div class="empty">No recently viewed articles yet 👀</div>';
    return;
  }

  appState.articles = appState.recently;
  renderNews(appState.recently);
}

// ==================== ARTICLE VIEW ====================
function viewArticle(url) {
  const article = appState.articles.find((a) => a.url === url) || appState.trending.find((a) => a.url === url);
  if (!article) return;

  // Track recently viewed
  const existingIdx = appState.recently.findIndex((a) => a.url === url);
  if (existingIdx >= 0) {
    appState.recently.splice(existingIdx, 1);
  }
  appState.recently.unshift(article);
  if (appState.recently.length > 20) {
    appState.recently.pop();
  }
  localStorage.setItem("uc-recently", JSON.stringify(appState.recently));

  const reactions = appState.reactions[url] || { liked: false, disliked: false, likes: 0, dislikes: 0, comments: [] };
  const content = article.content || article.description || "No content available";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
      ${article.image ? `<img src="${article.image}" alt="Article" class="modal-image">` : ""}
      <h2>${article.title}</h2>
      <div class="article-meta">
        <span>${article.source?.name || "Source"}</span>
        ${article.publishedAt ? `<span>${new Date(article.publishedAt).toLocaleDateString()}</span>` : ""}
      </div>
      <p class="article-body">${content}</p>
      <div class="modal-stats">
        <span>👍 ${reactions.likes} Likes</span>
        <span>👎 ${reactions.dislikes} Dislikes</span>
        <span>💬 ${reactions.comments.length} Comments</span>
      </div>
      <div class="modal-actions">
        <button class="btn-like ${reactions.liked ? "liked" : ""}" onclick="toggleLike('${url}'); document.querySelector('.modal').remove(); location.reload()">👍 Like</button>
        <button class="btn-dislike ${reactions.disliked ? "disliked" : ""}" onclick="toggleDislike('${url}'); document.querySelector('.modal').remove(); location.reload()">👎 Dislike</button>
        <button class="btn-save" onclick="toggleSave('${url}'); location.reload()">🔖 Save</button>
        <button class="btn-share" onclick="shareArticle('${url}')">Share</button>
      </div>
      ${article.url ? `<a href="${article.url}" target="_blank" class="btn-primary">Read Full Article 🚀</a>` : ""}
      <div class="comments-area">
        <h4>Comments</h4>
        <div class="comments-list">
          ${reactions.comments.length ? reactions.comments.map((c) => `
            <div class="comment">
              <strong>${c.user}</strong>
              <p>${c.text}</p>
              <small>${c.time}</small>
            </div>
          `).join("") : "<p>No comments yet</p>"}
        </div>
        <div class="comment-form">
          <input type="text" id="comment-${url}" placeholder="Add comment..." maxlength="200">
          <button onclick="submitComment('${url}')">Post</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ==================== INTERACTIONS ====================
function toggleSave(url) {
  const idx = appState.saved.findIndex((a) => a.url === url);
  const article = appState.articles.find((a) => a.url === url) || appState.trending.find((a) => a.url === url);

  if (idx >= 0) {
    appState.saved.splice(idx, 1);
    toast("Removed from saved");
  } else if (article) {
    appState.saved.push(article);
    toast("Added to saved");
  }

  localStorage.setItem("uc-saved", JSON.stringify(appState.saved));
  updateUI();
}

function toggleLike(url) {
  if (!appState.reactions[url]) {
    appState.reactions[url] = { liked: false, disliked: false, likes: 0, dislikes: 0, comments: [] };
  }

  if (appState.reactions[url].liked) {
    // Already liked - remove like
    appState.reactions[url].liked = false;
    appState.reactions[url].likes--;
    toast("👍 Like removed");
  } else {
    // Not liked - add like and remove dislike if exists
    appState.reactions[url].liked = true;
    appState.reactions[url].likes++;
    
    if (appState.reactions[url].disliked) {
      appState.reactions[url].disliked = false;
      appState.reactions[url].dislikes--;
    }
    toast("👍 Liked!");
  }

  localStorage.setItem("uc-reactions", JSON.stringify(appState.reactions));
  updateUI();
}

function toggleDislike(url) {
  if (!appState.reactions[url]) {
    appState.reactions[url] = { liked: false, disliked: false, likes: 0, dislikes: 0, comments: [] };
  }

  if (appState.reactions[url].disliked) {
    // Already disliked - remove dislike
    appState.reactions[url].disliked = false;
    appState.reactions[url].dislikes--;
    toast("👎 Dislike removed");
  } else {
    // Not disliked - add dislike and remove like if exists
    appState.reactions[url].disliked = true;
    appState.reactions[url].dislikes++;
    
    if (appState.reactions[url].liked) {
      appState.reactions[url].liked = false;
      appState.reactions[url].likes--;
    }
    toast("👎 Disliked!");
  }

  localStorage.setItem("uc-reactions", JSON.stringify(appState.reactions));
  updateUI();
}

function addCommentPrompt(url) {
  const text = prompt("Enter your comment:");
  if (!text?.trim()) return;
  if (!appState.reactions[url]) appState.reactions[url] = { liked: false, disliked: false, likes: 0, dislikes: 0, comments: [] };
  appState.reactions[url].comments.push({ user: "You", text: text.trim(), time: new Date().toLocaleString() });
  localStorage.setItem("uc-reactions", JSON.stringify(appState.reactions));
  toast("💬 Comment added!");
  updateUI();
}

function submitComment(url) {
  const input = document.getElementById(`comment-${url}`);
  if (!input?.value?.trim()) return;
  if (!appState.reactions[url]) appState.reactions[url] = { liked: false, disliked: false, likes: 0, dislikes: 0, comments: [] };
  appState.reactions[url].comments.push({ user: "You", text: input.value.trim(), time: new Date().toLocaleString() });
  localStorage.setItem("uc-reactions", JSON.stringify(appState.reactions));
  input.value = "";
  toast("💬 Comment posted!");
  
  // Update comment count in modal
  const commentCount = document.querySelector(".modal-stats span:nth-child(3)");
  if (commentCount) {
    commentCount.textContent = `💬 ${appState.reactions[url].comments.length} Comments`;
  }
  
  // Reload comments list
  const commentsList = document.querySelector(".comments-list");
  if (commentsList) {
    commentsList.innerHTML = appState.reactions[url].comments.map((c) => `
      <div class="comment">
        <strong>${c.user}</strong>
        <p>${c.text}</p>
        <small>${c.time}</small>
      </div>
    `).join("");
  }
}

async function shareArticle(url) {
  const article = appState.articles.find((a) => a.url === url);
  if (!article) return;

  const text = `Check out: ${article.title} ${url}`;

  if (navigator.share) {
    navigator.share({ title: article.title, text, url });
  } else {
    const dialog = document.createElement("div");
    dialog.className = "share-dialog";
    dialog.innerHTML = `
      <div class="share-content">
        <h3>Share Article</h3>
        <a href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" class="share-btn whatsapp">📱 WhatsApp</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" class="share-btn facebook">📘 Facebook</a>
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(url)}" target="_blank" class="share-btn twitter">🐦 Twitter</a>
        <button onclick="copyToClipboard('${url}'); this.parentElement.parentElement.remove();" class="share-btn copy">🔗 Copy Link</button>
        <button onclick="this.parentElement.parentElement.remove()" class="share-btn close">Close</button>
      </div>
    `;
    document.body.appendChild(dialog);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast("Link copied!")).catch(() => toast("Copy failed"));
}

// ==================== THEME ====================
function toggleTheme() {
  appState.theme = appState.theme === "light" ? "dark" : "light";
  localStorage.setItem("uc-theme", appState.theme);
  applyTheme(appState.theme);
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-theme", theme === "dark");
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "Light Mode ☀️" : "Dark Mode 🌙";
}

// ==================== UTILITIES ====================
function updateUI() {
  const container = document.getElementById("content");
  if (container && appState.category !== "saved") {
    container.innerHTML = "";
    renderNews(appState.articles);
  }
  if (appState.category === "saved") {
    showSaved();
  }
}

function toast(msg) {
  const t = document.getElementById("toast");
  if (t) {
    t.textContent = msg;
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 2000);
  }
}

console.log("✅ UC News App loaded successfully");
