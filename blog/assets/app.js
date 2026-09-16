// ============================================================
// CYCの小站 · 共享脚本：主题切换 / 导航 / 渐入动画 / 数据渲染 / Markdown 加载
// ============================================================

/* ---------- 主题切换 ---------- */
(function initTheme() {
  const saved = localStorage.getItem("blog-theme");
  const theme = saved || "dark"; // 默认暗色
  document.documentElement.setAttribute("data-theme", theme);
})();

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("blog-theme", next);
  syncThemeIcon();
}

function syncThemeIcon() {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  const cur = document.documentElement.getAttribute("data-theme");
  btn.textContent = cur === "dark" ? "🌙" : "☀️";
}

/* ---------- 移动端菜单 ---------- */
function bindMenu() {
  const btn = document.getElementById("menuBtn");
  const links = document.getElementById("navLinks");
  if (!btn || !links) return;
  btn.addEventListener("click", () => links.classList.toggle("open"));
  links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
}

/* ---------- 导航高亮（按 body[data-page] 匹配） ---------- */
function highlightNav() {
  const page = document.body.getAttribute("data-page");
  document.querySelectorAll(".nav-links a").forEach(a => {
    if (a.dataset.nav === page) a.classList.add("active");
  });
}

/* ---------- 滚动渐入 ---------- */
function observeReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
    });
  }, { threshold: .1 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

/* ---------- 渲染：文章卡片 ---------- */
function postCardHTML(p) {
  const tags = p.tags.map(t => `<span class="tag">${t}</span>`).join("");
  const pin = p.pin ? `<span class="pin">置顶</span>` : "";
  return `
    <a class="glass hoverable post-card reveal" href="post.html?slug=${p.slug}">
      <h3>${p.title}</h3>
      <p>${p.summary}</p>
      <div class="post-meta">
        <span class="post-date">${p.date}</span>${pin}
        <span class="tag-row" style="margin-left:auto">${tags}</span>
      </div>
    </a>`;
}

function renderPostCards(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = list.map(postCardHTML).join("");
}

/* ---------- 渲染：说说 ---------- */
function momentHTML(m) {
  const tags = m.tags.map(t => `<span class="tag">${t}</span>`).join("");
  return `
    <div class="glass hoverable moment reveal">
      <div class="moment-ava">蔡</div>
      <div class="moment-body">
        <div class="moment-head"><b>${SITE.author}</b><span class="moment-time">${m.date}</span></div>
        <div class="moment-text"><span class="mood">${m.mood}</span>${m.text}</div>
        <div class="tag-row">${tags}</div>
      </div>
    </div>`;
}

function renderMoments(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = list.map(momentHTML).join("");
}

/* ---------- 渲染：归档（按年分组） ---------- */
function renderArchives(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  const byYear = {};
  sorted.forEach(p => {
    const y = p.date.slice(0, 4);
    (byYear[y] = byYear[y] || []).push(p);
  });
  el.innerHTML = Object.keys(byYear).sort((a, b) => b.localeCompare(a)).map(year => `
    <div class="reveal">
      <div class="archive-year"><b>${year}</b><span class="count">${byYear[year].length} 篇</span><span class="line"></span></div>
      ${byYear[year].map(p => `
        <a class="arc-item" href="post.html?slug=${p.slug}">
          <span class="arc-date">${p.date.slice(5)}</span>
          <span class="arc-title">${p.title}</span>
        </a>`).join("")}
    </div>`).join("");
}

/* ---------- 渲染：标签筛选（文章列表页） ---------- */
function renderTagFilter(list) {
  const bar = document.getElementById("filterBar");
  const grid = document.getElementById("postGrid");
  if (!bar || !grid) return;
  const tags = [...new Set(list.flatMap(p => p.tags))];
  bar.innerHTML = `<span class="filter-chip on" data-tag="全部">全部</span>` +
    tags.map(t => `<span class="filter-chip" data-tag="${t}">${t}</span>`).join("");
  bar.addEventListener("click", e => {
    const chip = e.target.closest(".filter-chip");
    if (!chip) return;
    bar.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("on"));
    chip.classList.add("on");
    const t = chip.dataset.tag;
    renderPostCards("postGrid", t === "全部" ? list : list.filter(p => p.tags.includes(t)));
    observeReveal();
  });
}

/* ---------- Markdown 文章加载（post.html 用） ---------- */
// frontmatter 格式：---\ntitle: xxx\ndate: xxx\ntags: [a, b]\n---
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  if (m) {
    m[1].split("\n").forEach(line => {
      const kv = line.match(/^(\w+):\s*(.+)$/);
      if (kv) {
        let v = kv[2].trim();
        if (v.startsWith("[") && v.endsWith("]")) {
          v = v.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        }
        meta[kv[1]] = v;
      }
    });
    return { meta, body: text.slice(m[0].length) };
  }
  return { meta, body: text };
}

async function loadPost(slug) {
  const headEl = document.getElementById("articleHead");
  const bodyEl = document.getElementById("articleBody");
  try {
    const res = await fetch(`posts/${slug}.md`);
    if (!res.ok) throw new Error(res.status);
    const { meta, body } = parseFrontmatter(await res.text());
    document.title = `${meta.title || slug} · ${SITE.name}`;
    const tags = (meta.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
    headEl.innerHTML = `
      <h1>${meta.title || ""}</h1>
      <div class="meta">
        <span class="post-date">📅 ${meta.date || ""}</span>
        <span class="post-date">✍️ ${SITE.author}</span>
        <span class="tag-row">${tags}</span>
      </div>`;
    bodyEl.innerHTML = marked.parse(body);
    if (window.hljs) hljs.highlightAll();
  } catch (err) {
    headEl.innerHTML = `<h1>文章不存在 🥲</h1>`;
    bodyEl.innerHTML = `<p style="color:var(--muted)">没有找到「${slug}」这篇文章，可能还没写完，或者链接打错了。</p>`;
  }
  // 底部上一篇/下一篇
  const idx = POSTS.findIndex(p => p.slug === slug);
  const nav = document.getElementById("postNav");
  if (nav && idx !== -1) {
    const sorted = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
    const i = sorted.findIndex(p => p.slug === slug);
    const prev = sorted[i + 1], next = sorted[i - 1];
    nav.innerHTML = `
      ${prev ? `<a class="btn btn-ghost" href="post.html?slug=${prev.slug}">← 上一篇：${prev.title.slice(0, 16)}…</a>` : "<span></span>"}
      ${next ? `<a class="btn btn-ghost" href="post.html?slug=${next.slug}">下一篇：${next.title.slice(0, 16)}… →</a>` : "<span></span>"}`;
  }
}

/* ---------- 页脚年份 ---------- */
function renderFooter() {
  const y = document.getElementById("footYear");
  if (y) y.textContent = new Date().getFullYear();
}

/* ---------- 页面初始化 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  syncThemeIcon();
  bindMenu();
  highlightNav();
  observeReveal();
  renderFooter();
  const slug = new URLSearchParams(location.search).get("slug");
  if (document.body.getAttribute("data-page") === "post" && slug) loadPost(slug);
});
