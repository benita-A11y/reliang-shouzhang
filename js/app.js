/* ============================================================
 * 热量手账 · 核心（状态 / 导航 / 通用UI / 记录核心 / 事件分发）
 * 页面渲染在 pages1/2/3.js，通过注册表接入
 * ============================================================ */
'use strict';

/* ---------- 注册表（跨文件） ---------- */
window.PAGE_RENDER = {};
window._ACTIONS = {};
function registerAction(name, fn) { window._ACTIONS[name] = fn; }
function registerPage(key, fn) { window.PAGE_RENDER[key] = fn; }

/* ---------- 全局状态 ---------- */
let PROFILE = null;
let FOODS = [];
let CURRENT = 'home';
let SIDEBAR_PIN = false;
let SHOP_MAP = {};
let overPrompted = {};
let congratsShown = false;

const MEALS = [
  { k: 'breakfast', label: '早餐', emoji: '🌅' },
  { k: 'lunch', label: '午餐', emoji: '☀️' },
  { k: 'dinner', label: '晚餐', emoji: '🌙' },
  { k: 'snack', label: '加餐', emoji: '🍿' }
];
const NAV = [
  { key: 'home', emoji: '🏠', label: '首页', color: '#5E5CE6', soft: 'rgba(94,92,230,.14)' },
  { key: 'record', emoji: '📷', label: '记录', color: '#34C759', soft: 'rgba(52,199,89,.14)' },
  { key: 'recipes', emoji: '📖', label: '我的食谱', color: '#FF9500', soft: 'rgba(255,149,0,.14)' },
  { key: 'hunt', emoji: '🍽️', label: '觅食', color: '#FF2D55', soft: 'rgba(255,45,85,.12)' },
  { key: 'bill', emoji: '🧾', label: '多巴胺账单', color: '#FF3B30', soft: 'rgba(255,59,48,.12)' },
  { key: 'board', emoji: '📊', label: '数据看板', color: '#007AFF', soft: 'rgba(0,122,255,.12)' },
  { key: 'nutri', emoji: '🤖', label: '营养秘书', color: '#AF52DE', soft: 'rgba(175,82,222,.12)' },
  { key: 'wheel', emoji: '🎯', label: '今天吃什么', color: '#FF9500', soft: 'rgba(255,149,0,.16)' },
  { key: 'profile', emoji: '👤', label: '我的', color: '#8E8E93', soft: 'rgba(142,142,147,.14)' }
];
const MEAL_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍿' };
const CAT_EMOJI = { 食堂: '🍚', 外卖: '🥡', 自制: '🏠', 饮品: '🧋' };
const $ = (sel, root) => (root || document).querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const foodEmoji = (f) => (CAT_EMOJI[f.category] || '🍽️');
const dk = (kcal) => displayKcal(kcal, PROFILE ? PROFILE.recordTotal : 0);
const dkr = (kcal) => displayKcalRange(kcal, PROFILE ? PROFILE.recordTotal : 0);
function photoHTML(f, big) {
  // 兼容食物对象(f.photo)与记录对象(records 存 foodPhoto)两种来源
  const src = (f && (f.photo || f.foodPhoto)) || '';
  if (!src) return `<span style="${big ? 'font-size:28px' : ''}">${foodEmoji(f)}</span>`;
  // 图片加载失败时自动移除，露出下方 emoji 占位图
  return `<span class="ph-wrap">${foodEmoji(f)}<img src="${src}" alt="" onerror="this.remove()"></span>`;
}
const defaultMeal = () => {
  const h = new Date().getHours();
  // 时段规范：早餐5-10点 · 午餐11-14点 · 晚餐17-20点 · 其他为加餐
  if (h >= 5 && h < 10) return 'breakfast';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 17 && h < 20) return 'dinner';
  return 'snack';
};

/* ============================================================
 * 初始化
 * ============================================================ */
async function init() {
  await openDB();
  await seedIfNeeded();
  PROFILE = await loadProfile();
  await refreshRecordTotal();
  await buildShopMap();
  renderNav();
  bindGlobalEvents();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  switchPage('home');
  if (!PROFILE.onboarded) setTimeout(() => openOnboarding(), 500);
}
async function buildShopMap() {
  SHOP_MAP = {};
  [...BRANDS, ...SHOPS].forEach((s) => {
    SHOP_MAP[s.id] = s;
    s.items.forEach((it) => { it._shopId = s.id; it._shopName = s.name; it._shopEmoji = s.emoji; it._i = s.items.indexOf(it); });
  });
  await applyShopEdits();
}
async function refreshRecordTotal() {
  const recs = await getRecords();
  PROFILE.recordTotal = recs.length;
  await saveProfile(PROFILE);
}
async function loadFoods() { FOODS = await getFoods(); }

/* ---------- 导航 ---------- */
function renderNav() {
  const nav = $('#side-nav');
  nav.innerHTML = NAV.map((n) => `
    <div class="nav-item" data-action="nav:go" data-page="${n.key}" style="--nc:${n.color};--nc-soft:${n.soft}">
      <div class="nav-emoji">${n.emoji}</div>
      <div class="nav-label">${n.label}</div>
    </div>`).join('');
  $('#pin-btn').classList.toggle('on', SIDEBAR_PIN);
  $('#sidebar').classList.toggle('open', SIDEBAR_PIN);
}
function setNavActive(key) {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.page === key));
}
function switchPage(key) {
  CURRENT = key;
  setNavActive(key);
  const view = $('#view');
  view.innerHTML = '<div class="page" id="page-root"></div>';
  renderPage(key);
  view.scrollTop = 0;
}
function renderPage(key) {
  const root = $('#page-root');
  const fn = window.PAGE_RENDER[key];
  if (fn) fn(root); else window.PAGE_RENDER.home(root);
}
const rerender = () => renderPage(CURRENT);

/* ============================================================
 * 通用 UI
 * ============================================================ */
function openSheet(html) {
  $('#sheet-root').innerHTML = `<div class="sheet-handle"></div>${html}`;
  $('#sheet-mask').classList.add('show');
  $('#sheet-root').classList.add('show');
  requestAnimationFrame(() => { $('#sheet-root').scrollTop = 0; });
}
function closeSheet() {
  $('#sheet-root').classList.remove('show');
  $('#sheet-mask').classList.remove('show');
  setTimeout(() => { $('#sheet-root').innerHTML = ''; }, 320);
}
function replaceSheet(html) {
  $('#sheet-root').innerHTML = `<div class="sheet-handle"></div>${html}`;
  // 保证替换内容时弹层一定处于可见状态（配送动画/结果页等场景）
  $('#sheet-mask').classList.add('show');
  $('#sheet-root').classList.add('show');
  $('#sheet-root').scrollTop = 0;
}
function openModal(html) {
  $('#modal-root').innerHTML = `<div class="modal-back" data-action="modal:close"></div><div class="modal-card">${html}</div>`;
}
function closeModal() {
  const had = $('#modal-root').innerHTML.trim() !== '';
  $('#modal-root').innerHTML = '';
  // 关闭任意弹窗即视为已看过新手引导，避免每次打开都弹出引导挡住导航
  if (had && PROFILE && !PROFILE.onboarded) { PROFILE.onboarded = true; saveProfile(PROFILE); }
}
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 1800);
  setTimeout(() => t.remove(), 2200);
}
function confetti() {
  const host = $('#confetti-root');
  const colors = ['#5E5CE6', '#34C759', '#FF9500', '#FF2D55', '#FFCC00', '#007AFF'];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    c.style.width = 7 + Math.random() * 6 + 'px';
    c.style.height = 9 + Math.random() * 8 + 'px';
    host.appendChild(c);
    setTimeout(() => c.remove(), 3100);
  }
}
function bindLongPress(el, cb) {
  let timer = null, sx = 0, sy = 0;
  el.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { timer = null; cb(el); }, 520);
  });
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12) clear(); });
  el.addEventListener('pointerup', clear);
  el.addEventListener('pointerleave', clear);
}

/* ---------- 拍照/选图 ----------
 * Web/PWA 相册权限说明：
 * 本应用为纯前端网页应用，无法直接调用 iOS PHPhotoLibrary / 安卓 READ_MEDIA_IMAGES
 * 原生 API。改用 <input type="file" accept="image/*"> 唤起「系统原生相册选择器」，
 * 系统会自动完成相册权限申请（首次弹系统授权框 / 已授权直接打开 / 拒绝则打开失败）。
 * 若用户取消或打开失败，通过 showAlbumPermGuide() 引导前往系统设置开启权限。
 */
const ALBUM_PERM = { hinted: false };

function albumPermInfo() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const and = /Android/.test(ua);
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const app = standalone ? '本应用' : ios ? 'Safari' : and ? '浏览器' : '浏览器';
  const src = ios ? '设置 → 隐私 → 照片' : and ? '设置 → 应用管理 → 权限' : '';
  return { ios, and, app, src };
}

function showAlbumPermGuide() {
  const { ios, and, app } = albumPermInfo();
  openModal(`
    <div class="modal-title">🖼️ 无法访问相册？</div>
    <div class="modal-sub" style="line-height:1.9">
      <div>选图由系统相册负责。若无法打开相册，请按以下步骤开启权限：</div>
      ${ios ? `
      <div style="margin-top:10px"><b>①</b> 打开系统「设置 → 隐私 → 照片」</div>
      <div><b>②</b> 找到「${app}」，权限改为「<b>所有照片</b>」</div>
      <div><b>③</b> 返回本页重新选择</div>` : and ? `
      <div style="margin-top:10px"><b>①</b> 打开系统「设置 → 应用管理」</div>
      <div><b>②</b> 找到你的浏览器，进入「<b>权限</b>」</div>
      <div><b>③</b> 允许「<b>照片 / 存储</b>」后返回重试</div>` : `
      <div style="margin-top:10px">请确认浏览器允许访问本地文件（桌面浏览器一般无需额外设置）。</div>`}
    </div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:16px">
      <button class="btn ghost" data-action="modal:close">知道了</button>
    </div>`);
}

/**
 * 从系统相册选图（可多选，最多 maxCount 张）。cb(dataURLs[], files[])
 * 每次动态创建 file input 并立即触发点击：避免复用静态 hidden input
 * 在 PWA/移动端「点击没反应」的问题（这是用户反馈的根因）。
 */
function pickAlbumImages(cb, { capture = false, maxCount = 9, compress = 640 } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = !capture; // 相册支持多选；拍照单张
  if (capture) input.setAttribute('capture', 'environment');
  Object.assign(input.style, { position: 'fixed', left: '-9999px', top: 0, width: '1px', height: '1px', opacity: 0 });
  document.body.appendChild(input);
  let done = false;
  const cleanup = () => input.remove();
  const onChange = async () => {
    if (done) return;
    done = true;
    cleanup();
    const picked = Array.from(input.files || []);
    if (!picked.length) return; // 未选图：静默返回（不打扰）
    if (picked.length > maxCount) toast(`最多选择 ${maxCount} 张，已保留前 ${maxCount} 张`, 'brand');
    const files = picked.slice(0, maxCount);
    const out = [];
    for (const f of files) {
      try {
        const raw = await fileToDataURL(f);
        out.push(await compressImage(raw, compress));
      } catch (e) { /* 单张读取失败则跳过 */ }
    }
    if (out.length) cb(out, files);
  };
  const onCancel = () => {
    if (done) return;
    done = true;
    cleanup();
    // 取消选图（常见于系统权限受限）：首次给一次「去设置」引导
    if (!ALBUM_PERM.hinted) {
      ALBUM_PERM.hinted = true;
      setTimeout(showAlbumPermGuide, 450);
    }
  };
  // change 为标准选图事件；cancel 为关闭/权限拒绝事件（Chrome 113+ / Safari 16.4+）
  input.addEventListener('change', onChange, { once: true });
  input.addEventListener('cancel', onCancel, { once: true });
  try { input.click(); } catch (e) { cleanup(); }
}

/** 单张选图（兼容旧调用方） */
function pickPhoto(cb, capture = false) {
  pickAlbumImages((arr) => { if (arr[0]) cb(arr[0]); }, { capture, maxCount: 1 });
}

/** 读取图片原始尺寸，用于长图（宽高比 > 2）检测 */
function imageSize(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = dataURL;
  });
}

/** 长图压缩：限制宽度，保留高度（普通压缩会按高压缩导致宽太小看不清） */
function compressToWidth(dataURL, maxW = 900, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const r = img.width > maxW ? maxW / img.width : 1;
        const c = document.createElement('canvas');
        c.width = Math.max(4, Math.round(img.width * r));
        c.height = Math.max(4, Math.round(img.height * r));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch { resolve(dataURL); }
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

/* ============================================================
 * 记录核心
 * ============================================================ */
async function recordFood(food, meal) {
  const rec = await addRecord({
    foodId: food.id || null,
    foodName: food.name,
    foodPhoto: food.photo || '',
    kcal: food.kcal,
    price: food.price || 0,
    shop: food.shop || '',
    portion: food.portion || '一份',
    meal,
    category: food.category || '食堂',
    macros: food.macros || null
  });
  await refreshRecordTotal();
  toast(`已记录：${food.name} +${food.kcal}kcal`, 'green');
  const stats = await getDayStats(todayKey());
  if (stats.kcal > (PROFILE.targetKcal || 1800) && !overPrompted[todayKey()]) {
    overPrompted[todayKey()] = true;
    setTimeout(askIndulge, 600);
  }
  rerender();
  return rec;
}
function askMealSheet(food) {
  openSheet(`
    <div class="sheet-title">记录「${esc(food.name)}」到哪一餐？</div>
    ${MEALS.map((m) => `
      <div class="food-line" data-action="meal:pick" data-meal="${m.k}"
           data-name="${esc(food.name)}" data-kcal="${food.kcal}" data-id="${food.id || ''}"
           data-price="${food.price || 0}" data-shop="${esc(food.shop || '')}"
           data-cat="${food.category || '食堂'}" data-photo="${esc(food.photo || '')}"
           data-portion="${esc(food.portion || '')}" data-macros='${JSON.stringify(food.macros || {})}'>
        <div class="fl-photo">${m.emoji}</div>
        <div class="fl-info"><div class="fl-name">${m.label}</div><div class="fl-meta">记录到${m.label}</div></div>
        <div class="fl-kcal">+${food.kcal}kcal</div>
      </div>`).join('')}
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="sheet:close">取消</button>`);
}
async function mealPickHandler(el) {
  const food = {
    id: el.dataset.id || null, name: el.dataset.name, kcal: Number(el.dataset.kcal),
    price: Number(el.dataset.price || 0), shop: el.dataset.shop, category: el.dataset.cat,
    photo: el.dataset.photo, portion: el.dataset.portion,
    macros: el.dataset.macros ? JSON.parse(el.dataset.macros) : null
  };
  closeSheet();
  await recordFood(food, el.dataset.meal);
}
function askIndulge() {
  openModal(`
    <div class="modal-title">今天吃超标了 ✨</div>
    <div class="modal-sub">要标记今天为放纵日吗？放纵日不算失败，只是给努力放个假。</div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:6px">
      <button class="btn ghost" data-action="modal:close">算了</button>
      <button class="btn primary" data-action="day:indulge" data-date="${todayKey()}">标记放纵日</button>
    </div>`);
}
/* 店铺单品同步进食谱库（数据闭环） */
async function upsertShopFood(name, kcal, price, shop, shopId) {
  const s = SHOP_MAP[shopId];
  await loadFoods();
  if (!FOODS.some((f) => f.name === name && f.shop === shop)) {
    const now = nowISO();
    await saveFood({
      id: uid(), name, kcal, price, shop, portion: '一份',
      category: s && s.cat === '奶茶咖啡' ? '饮品' : '外卖',
      photo: '', macros: estimateMacros(kcal),
      createdAt: now, updatedAt: now, editCount: 0, favorite: true
    });
  }
}

/* ============================================================
 * 全局事件分发
 * ============================================================ */
function bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = window._ACTIONS[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  $('#sheet-mask').addEventListener('click', closeSheet);
}
registerAction('nav:go', (el) => {
  // 用户点导航时自动关闭可能挂起的引导弹窗并标记已看过
  const mr = $('#modal-root');
  if (mr && mr.innerHTML.trim() !== '') {
    mr.innerHTML = '';
    if (PROFILE && !PROFILE.onboarded) { PROFILE.onboarded = true; saveProfile(PROFILE); }
  }
  switchPage(el.dataset.page);
});
registerAction('sidebar:pin', () => {
  SIDEBAR_PIN = !SIDEBAR_PIN;
  renderNav();
});
registerAction('sheet:close', closeSheet);
registerAction('modal:close', closeModal);
registerAction('meal:pick', mealPickHandler);
// 注意：dayIndulgeHandler 定义在 pages3.js（后加载），此处必须惰性引用
registerAction('day:indulge', (el) => dayIndulgeHandler(el.dataset.date));

document.addEventListener('DOMContentLoaded', init);
