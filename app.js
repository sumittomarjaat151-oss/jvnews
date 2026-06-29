const API_BASE = getApiBase();

const appState = {
  page: 1,
  category: "general",
  query: "",
  loading: false,
  articles: [],
  saved: JSON.parse(localStorage.getItem("uc-saved") || "[]"),
  reactions: JSON.parse(localStorage.getItem("uc-reactions") || "{}"),
  theme: localStorage.getItem("uc-theme") || "light",
  trending: [],
  recently: JSON.parse(localStorage.getItem("uc-recently") || "[]")
};

function getApiBase() {
  if (window.location.protocol === "file:") {
    return "http://localhost:3015/api";
  }

  return "/api";
}

// Register Service Worker for offline support
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      console.log("✓ Service Worker registered successfully");

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000);

      // Listen for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New service worker available, notify user
            console.log("New version available! Refresh to update.");
            toast("📱 New version available - refresh to update");
          }
        });
      });
    })
    .catch((error) => {
      console.log("Service Worker registration failed:", error);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  initUI();
  applyTheme(appState.theme);
  loadTrending();
  fetchNews("general");
});

function initUI() {
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");
  const legalBtn = document.getElementById("legalBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const floatingRefreshBtn = document.getElementById("floatingRefreshBtn");
  const categoryBtns = document.querySelectorAll(".category-bar button");
  const content = document.getElementById("content");
  const trendingStrip = document.getElementById("trendingStrip");

  // Hamburger Menu
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  const closeMenuBtn = document.getElementById("closeMenuBtn");
  const menuOverlay = document.getElementById("menuOverlay");
  const mobileCategoryBtns = document.querySelectorAll(".mobile-categories button");
  const mobileThemeToggle = document.getElementById("mobileThemeToggle");
  const mobileLegalBtn = document.getElementById("mobileLegalBtn");

  function toggleMobileMenu() {
    const isHidden = mobileMenu.classList.contains("hidden");
    if (isHidden) {
      mobileMenu.classList.remove("hidden");
      menuOverlay.classList.remove("hidden");
      hamburgerBtn.classList.add("active");
    } else {
      mobileMenu.classList.add("hidden");
      menuOverlay.classList.add("hidden");
      hamburgerBtn.classList.remove("active");
    }
  }

  function closeMobileMenu() {
    mobileMenu.classList.add("hidden");
    menuOverlay.classList.add("hidden");
    hamburgerBtn.classList.remove("active");
  }

  hamburgerBtn?.addEventListener("click", toggleMobileMenu);
  closeMenuBtn?.addEventListener("click", closeMobileMenu);
  menuOverlay?.addEventListener("click", closeMobileMenu);

  mobileCategoryBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      closeMobileMenu();
      const category = btn.dataset.category;
      categoryBtns.forEach((item) => {
        if (item.dataset.category === category) item.classList.add("active");
        else item.classList.remove("active");
      });
      mobileCategoryBtns.forEach((item) => {
        if (item.dataset.category === category) item.classList.add("active");
        else item.classList.remove("active");
      });

      appState.page = 1;
      appState.category = category;
      appState.query = "";

      if (category === "saved") {
        showSaved();
      } else if (category === "recently") {
        showRecently();
      } else {
        fetchNews(category);
      }
    });
  });

  mobileThemeToggle?.addEventListener("click", toggleTheme);
  mobileLegalBtn?.addEventListener("click", () => {
    closeMobileMenu();
    showLegalModal();
  });

  searchBtn?.addEventListener("click", handleSearch);
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleSearch();
  });
  themeToggle?.addEventListener("click", toggleTheme);
  legalBtn?.addEventListener("click", showLegalModal);
  refreshBtn?.addEventListener("click", refreshCurrentContent);
  floatingRefreshBtn?.addEventListener("click", refreshCurrentContent);

  categoryBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      categoryBtns.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");

      const category = btn.dataset.category;
      appState.page = 1;
      appState.category = category;
      appState.query = "";

      if (category === "saved") {
        showSaved();
      } else if (category === "recently") {
        showRecently();
      } else {
        fetchNews(category);
      }
    });
  });

  content?.addEventListener("click", handleArticleAction);
  trendingStrip?.addEventListener("click", (event) => {
    const trendItem = event.target.closest(".trend-item");
    if (trendItem) viewArticle(trendItem.dataset.url);
  });

  // Footer initialization
  const newsletterBtn = document.getElementById("newsletterBtn");
  const newsletterEmail = document.getElementById("newsletterEmail");
  const socialLinks = document.querySelectorAll(".social-links a");
  const footerCategoryLinks = document.querySelectorAll("[data-footer-category]");
  const footerLegalLink = document.getElementById("footerLegalLink");
  const footerRefreshLink = document.getElementById("footerRefreshLink");

  newsletterBtn?.addEventListener("click", handleNewsletterSubscribe);
  newsletterEmail?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleNewsletterSubscribe();
  });

  socialLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      toast("Social link - implement your social URLs");
    });
  });

  footerCategoryLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const category = link.dataset.footerCategory;
      appState.page = 1;
      appState.category = category;
      appState.query = "";
      setActiveCategory(category);
      fetchNews(category);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  footerLegalLink?.addEventListener("click", (event) => {
    event.preventDefault();
    showLegalModal();
  });

  footerRefreshLink?.addEventListener("click", (event) => {
    event.preventDefault();
    refreshCurrentContent();
  });

  // Back-to-Top Button
  const backToTopBtn = document.getElementById("backToTopBtn");
  backToTopBtn?.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleTopControlsVisibility(lastScrollY);
        lastScrollY = Math.max(window.scrollY, 0);
        
        // Show/hide back-to-top button
        if (lastScrollY > 300) {
          backToTopBtn?.classList.add("visible");
        } else {
          backToTopBtn?.classList.remove("visible");
        }
        
        ticking = false;
      });
      ticking = true;
    }

    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
      loadMoreArticles();
    }
  });
}

async function fetchNews(category, append = false, refresh = false) {
  if (appState.loading) return;
  appState.loading = true;

  const container = document.getElementById("content");
  if (!container) return;

  if (!append) {
    renderSkeletons(6);
  }

  try {
    const url = `${API_BASE}/news?category=${encodeURIComponent(category)}&page=${appState.page}${refresh ? "&refresh=true" : ""}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(await getApiError(response));

    const data = await response.json();
    const articles = data.articles || [];

    if (!articles.length) {
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
    if (!append) {
      container.innerHTML = `<div class="error">Could not load news: ${escapeHtml(getReadableError(error))}</div>`;
    }
  } finally {
    appState.loading = false;
  }
}

async function fetchSearch(query, append = false, refresh = false) {
  if (appState.loading) return;
  appState.loading = true;

  const container = document.getElementById("content");
  if (!container) return;

  if (!append) {
    renderSkeletons(6);
  }

  try {
    const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&page=${appState.page}${refresh ? "&refresh=true" : ""}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(await getApiError(response));

    const data = await response.json();
    const articles = data.articles || [];

    if (!articles.length) {
      if (!append) container.innerHTML = '<div class="empty">No results found</div>';
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
    if (!append) {
      container.innerHTML = `<div class="error">Search failed: ${escapeHtml(getReadableError(error))}</div>`;
    }
  } finally {
    appState.loading = false;
  }
}

async function loadTrending(refresh = false) {
  try {
    const response = await fetch(`${API_BASE}/trending${refresh ? "?refresh=true" : ""}`);
    if (!response.ok) throw new Error(await getApiError(response));
    const data = await response.json();
    appState.trending = (data.articles || []).slice(0, 5);
    renderTrending();
  } catch (error) {
    const strip = document.getElementById("trendingStrip");
    if (strip) strip.innerHTML = '<div class="empty compact">Trending unavailable</div>';
  }
}

function handleSearch() {
  const input = document.getElementById("searchInput");
  const query = input?.value.trim() || "";

  appState.page = 1;

  if (!query) {
    appState.query = "";
    appState.category = "general";
    setActiveCategory("general");
    fetchNews("general");
    return;
  }

  appState.query = query;
  appState.category = "search";
  setActiveCategory("");
  fetchSearch(query);
}

async function refreshCurrentContent() {
  if (appState.loading) return;

  const refreshBtn = document.getElementById("refreshBtn");
  setRefreshState(true);
  appState.page = 1;

  try {
    if (appState.category === "saved") {
      showSaved();
      toast("Saved articles refreshed");
    } else if (appState.category === "recently") {
      showRecently();
      toast("Recently viewed refreshed");
    } else if (appState.category === "search" && appState.query) {
      await fetchSearch(appState.query, false, true);
      toast("Fresh search results loaded");
    } else {
      await fetchNews(appState.category, false, true);
      toast("Latest news loaded");
    }

    loadTrending(false);
  } finally {
    if (refreshBtn) setRefreshState(false);
  }
}

function loadMoreArticles() {
  if (appState.loading || appState.category === "saved" || appState.category === "recently") return;

  appState.page += 1;

  if (appState.category === "search") {
    fetchSearch(appState.query, true);
  } else {
    fetchNews(appState.category, true);
  }
}

function renderSkeletons(count = 6) {
  const container = document.getElementById("content");
  if (!container) return;
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    skeleton.innerHTML = `
      <div class="skeleton-image skeleton"></div>
      <div class="skeleton-content">
        <div class="skeleton-title skeleton"></div>
        <div class="skeleton-text skeleton"></div>
        <div class="skeleton-text skeleton skeleton-text-short"></div>
        <div class="skeleton-meta">
          <div class="skeleton-meta-item skeleton"></div>
          <div class="skeleton-meta-item skeleton"></div>
        </div>
        <div class="skeleton-actions">
          <div class="skeleton-action-btn skeleton"></div>
          <div class="skeleton-action-btn skeleton"></div>
          <div class="skeleton-action-btn skeleton"></div>
        </div>
      </div>
    `;
    fragment.appendChild(skeleton);
  }

  container.appendChild(fragment);
}

function renderNews(articles, append = false) {
  const container = document.getElementById("content");
  if (!container) return;
  if (!append) container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  articles.forEach((article) => {
    const id = article.url;
    const saved = appState.saved.some((item) => item.url === id);
    const reactions = getReactions(id);

    const card = document.createElement("article");
    card.className = "card";
    card.dataset.url = id;
    card.innerHTML = `
      ${article.image ? `<img src="${escapeAttr(article.image)}" alt="${escapeAttr(article.title || "News image")}" loading="lazy">` : ""}
      <div class="card-content">
        <h3>${escapeHtml(article.title || "Untitled")}</h3>
        <p>${escapeHtml((article.description || "No description").slice(0, 140))}</p>
        <div class="meta">
          <span>${escapeHtml(article.source?.name || "Source")}</span>
          ${article.adminPost ? '<span class="admin-badge">JV Published</span>' : ""}
          ${article.publishedAt ? `<span>${formatDate(article.publishedAt)}</span>` : ""}
        </div>
        <div class="stats">
          <span>${reactions.likes} Likes</span>
          <span>${reactions.dislikes} Dislikes</span>
          <span>${reactions.comments.length} Comments</span>
        </div>
        <div class="actions">
          <button class="btn-save ${saved ? "saved" : ""}" data-action="save">${saved ? "Saved" : "Save"}</button>
          <button class="btn-like ${reactions.liked ? "liked" : ""}" data-action="like">Like</button>
          <button class="btn-dislike ${reactions.disliked ? "disliked" : ""}" data-action="dislike">Dislike</button>
          <button class="btn-comment" data-action="comment">Comment</button>
          <button class="btn-view" data-action="view">View</button>
          <button class="btn-share" data-action="share">Share</button>
        </div>
      </div>
    `;

    const img = card.querySelector("img");
    img?.addEventListener("error", () => img.remove());
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function renderTrending() {
  const strip = document.getElementById("trendingStrip");
  if (!strip) return;

  strip.innerHTML = appState.trending.map((article) => `
    <button class="trend-item" data-url="${escapeAttr(article.url)}">
      <span class="fire">Hot</span>
      <div>
        <strong>${escapeHtml((article.title || "Trending").slice(0, 58))}</strong>
        <small>${escapeHtml(article.source?.name || "Source")}</small>
      </div>
    </button>
  `).join("");
}

function handleArticleAction(event) {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest(".card");
  if (!button || !card) return;

  const url = card.dataset.url;

  if (button.dataset.action === "save") toggleSave(url);
  if (button.dataset.action === "like") toggleLike(url);
  if (button.dataset.action === "dislike") toggleDislike(url);
  if (button.dataset.action === "comment") addCommentPrompt(url);
  if (button.dataset.action === "view") viewArticle(url);
  if (button.dataset.action === "share") shareArticle(url);
}

function showSaved() {
  const container = document.getElementById("content");
  if (!container) return;
  container.innerHTML = "";

  if (!appState.saved.length) {
    container.innerHTML = '<div class="empty">No saved articles yet</div>';
    return;
  }

  appState.articles = appState.saved;
  renderNews(appState.saved);
}

function showRecently() {
  const container = document.getElementById("content");
  if (!container) return;
  container.innerHTML = "";

  if (!appState.recently.length) {
    container.innerHTML = '<div class="empty">No recently viewed articles yet</div>';
    return;
  }

  appState.articles = appState.recently;
  renderNews(appState.recently);
}

function viewArticle(url) {
  const article = findArticle(url);
  if (!article) return;

  trackRecently(article);
  const reactions = getReactions(url);
  const content = article.content || article.description || "No content available.";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content" data-url="${escapeAttr(url)}">
      <button class="close-btn" data-modal-action="close">x</button>
      ${article.image ? `<img src="${escapeAttr(article.image)}" alt="${escapeAttr(article.title || "News image")}" class="modal-image">` : ""}
      <h2>${escapeHtml(article.title || "Untitled")}</h2>
      <div class="article-meta">
        <span>${escapeHtml(article.source?.name || "Source")}</span>
        ${article.publishedAt ? `<span>${formatDate(article.publishedAt)}</span>` : ""}
      </div>
      <p class="article-body">${escapeHtml(content)}</p>
      <div class="modal-stats">
        <span>${reactions.likes} Likes</span>
        <span>${reactions.dislikes} Dislikes</span>
        <span>${reactions.comments.length} Comments</span>
      </div>
      <div class="modal-actions">
        <button class="btn-like ${reactions.liked ? "liked" : ""}" data-modal-action="like">Like</button>
        <button class="btn-dislike ${reactions.disliked ? "disliked" : ""}" data-modal-action="dislike">Dislike</button>
        <button class="btn-save" data-modal-action="save">Save</button>
        <button class="btn-share" data-modal-action="share">Share</button>
      </div>
      ${article.url ? `<a href="${escapeAttr(article.url)}" target="_blank" rel="noopener" class="btn-primary">Read Full Article</a>` : ""}
      <div class="comments-area">
        <h4>Comments</h4>
        <div class="comments-list">${renderComments(reactions.comments)}</div>
        <div class="comment-form">
          <input type="text" id="modalCommentInput" placeholder="Add comment..." maxlength="200">
          <button data-modal-action="post-comment">Post</button>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener("click", handleModalAction);
  document.body.appendChild(modal);
}

function handleModalAction(event) {
  const modal = event.currentTarget;
  const content = modal.querySelector(".modal-content");
  const actionEl = event.target.closest("[data-modal-action]");
  const url = content?.dataset.url;

  if (event.target === modal || actionEl?.dataset.modalAction === "close") {
    modal.remove();
    return;
  }

  if (!actionEl || !url) return;

  const action = actionEl.dataset.modalAction;
  if (action === "like") toggleLike(url);
  if (action === "dislike") toggleDislike(url);
  if (action === "save") toggleSave(url);
  if (action === "share") shareArticle(url);
  if (action === "post-comment") submitComment(url);

  refreshModalStats(modal, url);
}

function toggleSave(url) {
  const index = appState.saved.findIndex((article) => article.url === url);
  const article = findArticle(url);

  if (index >= 0) {
    appState.saved.splice(index, 1);
    toast("Removed from saved");
  } else if (article) {
    appState.saved.unshift(article);
    toast("Added to saved");
  }

  localStorage.setItem("uc-saved", JSON.stringify(appState.saved));
  updateUI();
}

function toggleLike(url) {
  const reactions = getReactions(url);

  if (reactions.liked) {
    reactions.liked = false;
    reactions.likes = Math.max(reactions.likes - 1, 0);
    toast("Like removed");
  } else {
    reactions.liked = true;
    reactions.likes += 1;
    if (reactions.disliked) {
      reactions.disliked = false;
      reactions.dislikes = Math.max(reactions.dislikes - 1, 0);
    }
    toast("Liked");
  }

  saveReactions();
  updateUI();
}

function toggleDislike(url) {
  const reactions = getReactions(url);

  if (reactions.disliked) {
    reactions.disliked = false;
    reactions.dislikes = Math.max(reactions.dislikes - 1, 0);
    toast("Dislike removed");
  } else {
    reactions.disliked = true;
    reactions.dislikes += 1;
    if (reactions.liked) {
      reactions.liked = false;
      reactions.likes = Math.max(reactions.likes - 1, 0);
    }
    toast("Disliked");
  }

  saveReactions();
  updateUI();
}

function addCommentPrompt(url) {
  const text = prompt("Enter your comment:");
  if (!text?.trim()) return;
  addComment(url, text.trim());
  toast("Comment added");
  updateUI();
}

function submitComment(url) {
  const input = document.getElementById("modalCommentInput");
  if (!input?.value.trim()) return;
  addComment(url, input.value.trim());
  input.value = "";
  toast("Comment posted");
}

function addComment(url, text) {
  const reactions = getReactions(url);
  reactions.comments.push({
    user: "You",
    text,
    time: new Date().toLocaleString()
  });
  saveReactions();
}

async function shareArticle(url) {
  const article = findArticle(url);
  if (!article) return;

  const text = `Check out: ${article.title}`;

  if (navigator.share) {
    await navigator.share({ title: article.title, text, url });
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "share-dialog";
  dialog.innerHTML = `
    <div class="share-content">
      <h3>Share Article</h3>
      <a href="https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}" target="_blank" rel="noopener" class="share-btn whatsapp">WhatsApp</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" class="share-btn facebook">Facebook</a>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title || "News")}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener" class="share-btn twitter">Twitter</a>
      <button class="share-btn copy">Copy Link</button>
      <button class="share-btn close">Close</button>
    </div>
  `;

  dialog.addEventListener("click", (event) => {
    if (event.target.classList.contains("copy")) {
      copyToClipboard(url);
      dialog.remove();
    }
    if (event.target === dialog || event.target.classList.contains("close")) {
      dialog.remove();
    }
  });

  document.body.appendChild(dialog);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast("Link copied")).catch(() => toast("Copy failed"));
}

function showLegalModal() {
  const existing = document.querySelector(".legal-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "modal legal-modal";
  modal.innerHTML = `
    <div class="modal-content legal-content">
      <button class="close-btn" data-legal-action="close">x</button>
      <h2>Legal</h2>
      <div class="legal-grid">
        <section>
          <h3>Privacy</h3>
          <p>Saved articles, reactions, comments, theme, and newsletter email are stored locally in your browser for this demo app.</p>
        </section>
        <section>
          <h3>Terms</h3>
          <p>JV News displays headlines from the configured news provider. Full article ownership remains with the original publishers.</p>
        </section>
        <section>
          <h3>Cookies</h3>
          <p>This app uses local browser storage for preferences. Add a full cookie policy before launching publicly.</p>
        </section>
        <section>
          <h3>Contact</h3>
          <p>Replace this with your support email, business address, and social links when the project goes live.</p>
        </section>
      </div>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-legal-action='close']")) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

function toggleTheme() {
  appState.theme = appState.theme === "light" ? "dark" : "light";
  localStorage.setItem("uc-theme", appState.theme);
  applyTheme(appState.theme);
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-theme", theme === "dark");
  const btn = document.getElementById("themeToggle");
  const mobileBtn = document.getElementById("mobileThemeToggle");
  if (btn) btn.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
  if (mobileBtn) mobileBtn.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function handleTopControlsVisibility(lastScrollY) {
  const currentY = Math.max(window.scrollY, 0);
  const goingDown = currentY > lastScrollY;
  const nearTop = currentY < 80;
  document.body.classList.toggle("controls-hidden", !nearTop && goingDown);
}

function setRefreshState(isRefreshing) {
  const buttons = [
    document.getElementById("refreshBtn"),
    document.getElementById("floatingRefreshBtn")
  ].filter(Boolean);

  buttons.forEach((button) => {
    button.disabled = isRefreshing;
    button.textContent = isRefreshing ? "Refreshing..." : "Refresh";
  });
}

function setActiveCategory(category) {
  document.querySelectorAll(".category-bar button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });
}

function updateUI() {
  if (appState.category === "saved") {
    showSaved();
    return;
  }

  const container = document.getElementById("content");
  if (!container) return;
  container.innerHTML = "";
  renderNews(appState.articles);
}

function refreshModalStats(modal, url) {
  const reactions = getReactions(url);
  const stats = modal.querySelector(".modal-stats");
  const comments = modal.querySelector(".comments-list");

  if (stats) {
    stats.innerHTML = `
      <span>${reactions.likes} Likes</span>
      <span>${reactions.dislikes} Dislikes</span>
      <span>${reactions.comments.length} Comments</span>
    `;
  }

  if (comments) comments.innerHTML = renderComments(reactions.comments);
}

function renderComments(comments) {
  if (!comments.length) return "<p>No comments yet</p>";
  return comments.map((comment) => `
    <div class="comment">
      <strong>${escapeHtml(comment.user)}</strong>
      <p>${escapeHtml(comment.text)}</p>
      <small>${escapeHtml(comment.time)}</small>
    </div>
  `).join("");
}

function trackRecently(article) {
  const existingIndex = appState.recently.findIndex((item) => item.url === article.url);
  if (existingIndex >= 0) appState.recently.splice(existingIndex, 1);
  appState.recently.unshift(article);
  appState.recently = appState.recently.slice(0, 20);
  localStorage.setItem("uc-recently", JSON.stringify(appState.recently));
}

function findArticle(url) {
  return appState.articles.find((article) => article.url === url)
    || appState.trending.find((article) => article.url === url)
    || appState.saved.find((article) => article.url === url)
    || appState.recently.find((article) => article.url === url);
}

function getReactions(url) {
  if (!appState.reactions[url]) {
    appState.reactions[url] = { liked: false, disliked: false, likes: 0, dislikes: 0, comments: [] };
  }
  return appState.reactions[url];
}

function saveReactions() {
  localStorage.setItem("uc-reactions", JSON.stringify(appState.reactions));
}

function handleNewsletterSubscribe() {
  const emailInput = document.getElementById("newsletterEmail");
  const email = emailInput?.value.trim() || "";

  if (!email || !email.includes("@")) {
    toast("Please enter a valid email address");
    return;
  }

  // Store in localStorage for demo
  const subscribers = JSON.parse(localStorage.getItem("uc-subscribers") || "[]");
  if (!subscribers.includes(email)) {
    subscribers.push(email);
    localStorage.setItem("uc-subscribers", JSON.stringify(subscribers));
  }

  emailInput.value = "";
  toast("✓ Subscribed! Check your email for confirmation");
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl.hideTimer);
  toastEl.hideTimer = setTimeout(() => toastEl.classList.add("hidden"), 2000);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

async function getApiError(response) {
  try {
    const data = await response.json();
    return data.error || `API Error: ${response.status}`;
  } catch (error) {
    return `API Error: ${response.status}`;
  }
}

function getReadableError(error) {
  const message = error?.message || "";
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Backend is not running. Start it with npm start, then open http://localhost:3015.";
  }
  return message || "Something went wrong while loading news.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
