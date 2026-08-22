/* ============================================================
 * 热量手账 · 页面组2：觅食 / 多巴胺账单
 * ============================================================ */
'use strict';

/* ============================================================
 * 觅食（外出/外卖决策参考）
 * ============================================================ */
const HUNT = { tab: 'hot', cat: '全部', kcal: '不限', flavor: '不限' };
const SHOP_VIEW = { id: null, series: '全部' };
/* 店铺分类 → emoji（覆盖 BRANDS 饮品品牌与 SHOPS 各品类，避免错误套用食物分类 CAT_EMOJI） */
const SHOP_CAT = { '奶茶咖啡': '🧋', '汉堡炸鸡': '🍔', '麻辣烫': '🌶️', '粉面': '🍜', '米饭套餐': '🍚', '轻食沙拉': '🥗', '甜品面包': '🍰', '火锅': '🍲', '烧烤': '🍢', '快餐': '🍟' };
function shopCatLabel(cat) { return cat ? (SHOP_CAT[cat] || '🍽️') + ' ' + cat : '🧋 奶茶咖啡'; }

registerPage('hunt', async function (root) {
  const stats = await getDayStats(todayKey());
  const target = PROFILE.targetKcal || 1800;
  const remaining = Math.max(0, target - stats.kcal);
  const ratio = stats.kcal / target;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">🍽️</span>觅食</div>
        <div class="page-sub">今天吃什么？先看看额度</div>
      </div>
    </div>
    <div class="card hunt-top" style="padding:18px;text-align:center">
      <div class="hunt-remain">${remaining}<small> kcal</small></div>
      <div class="hunt-remain-sub">目标 ${target}kcal · 已吃 ${stats.kcal}kcal</div>
      <div class="grad-bar" style="margin-top:14px"><div class="marker" style="left:${Math.min(100, ratio * 100)}%"></div><div class="mask" style="width:${Math.min(100, ratio * 100)}%"></div></div>
      <div class="muted small" style="margin-top:10px">根据今日已摄入，你还有这些额度可以自由支配</div>
    </div>
    ${HUNT.tab !== 'fav' ? `
    <div class="hunt-filter">
      <div class="filter-group">
        <div class="filter-title">热量</div>
        <div class="filter-opts">
          ${['不限', '≤300', '300-500', '500-800'].map((k) => `<button class="chip ${HUNT.kcal === k ? 'on' : ''}" data-action="hunt:fk" data-v="${k}">${k === '不限' ? '不限' : k + 'kcal'}</button>`).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">口味</div>
        <div class="filter-opts">
          ${['不限', '辣的', '咸香的', '清淡的', '甜口的'].map((k) => `<button class="chip ${HUNT.flavor === k ? 'on' : ''}" data-action="hunt:ff" data-v="${k}">${k}</button>`).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-title">品类</div>
        <div class="filter-opts">
          ${['全部', '奶茶咖啡', '汉堡炸鸡', '麻辣烫', '粉面'].map((k) => `<button class="chip ${HUNT.cat === k ? 'on' : ''}" data-action="hunt:cat" data-v="${k}">${k}</button>`).join('')}
        </div>
      </div>
    </div>` : ''}
    <div class="tabs">
      ${[['hot', '🔥 附近热门'], ['cat', '📂 按品类找'], ['fav', '⭐ 我的收藏']].map(([k, t]) => `<div class="tab-item ${HUNT.tab === k ? 'on' : ''}" data-action="hunt:tab" data-v="${k}">${t}</div>`).join('')}
    </div>
    <div id="hunt-body">${await renderHuntBody()}</div>
    ${HUNT.tab !== 'fav' ? `<div id="hunt-ai"></div>` : ''}`;
  renderHuntAI();
});

function huntPool() {
  const all = [...BRANDS, ...SHOPS];
  let list = all.slice();
  if (HUNT.tab === 'cat') {
    if (HUNT.cat === '全部') list = all;
    else if (HUNT.cat === '奶茶咖啡') list = BRANDS;
    else list = SHOPS.filter((s) => s.cat === HUNT.cat);
  }
  if (HUNT.kcal !== '不限') {
    if (HUNT.kcal === '≤300') list = list.filter((s) => Math.min(...s.items.map((i) => i.kcal)) <= 300);
    else {
      const [a, b] = HUNT.kcal.split('-').map(Number);
      list = list.filter((s) => { const mn = Math.min(...s.items.map((i) => i.kcal)); return mn >= a && mn <= b; });
    }
  }
  if (HUNT.flavor !== '不限') {
    const f = HUNT.flavor.replace('的', '');
    list = list.filter((s) => s.flavor === f);
  }
  return list;
}
async function renderHuntBody() {
  if (HUNT.tab === 'fav') {
    await loadFoods();
    if (!FOODS.length) return `
      <div class="empty-state"><div class="es-icon">⭐</div><div class="es-title">收藏还空着</div>
      <div class="es-sub">去「按品类找」逛逛，把常吃的店收藏起来吧</div></div>`;
    return `<div class="muted small" style="margin-bottom:10px">从食谱库自动关联 · 共 ${FOODS.length} 样</div>` + FOODS.map((f) => `
      <div class="food-line" data-action="hunt:fv" data-id="${f.id}">
        <div class="fl-photo">${photoHTML(f)}</div>
        <div class="fl-info"><div class="fl-name">${esc(f.name)}</div><div class="fl-meta">${esc(f.shop || f.category || '')} · ${dkr(f.kcal)}</div></div>
        <div class="fl-kcal" style="color:var(--brand);font-size:12px">点一下记录</div>
      </div>`).join('');
  }
  const list = huntPool();
  if (!list.length) return `<div class="empty-state"><div class="es-icon">🔍</div><div class="es-title">没有匹配的店铺</div><div class="es-sub">换个热量档位或口味试试</div></div>`;
  return list.map((s) => {
    const minKcal = Math.min(...s.items.map((i) => i.kcal));
    const hot = shopHotness(s.id);
    const catLabel = shopCatLabel(s.cat);
    return `
    <div class="shop-card" data-action="hunt:shop" data-id="${s.id}">
      <div class="sc-line1">
        <span class="sc-brand">${esc(s.name)}</span>
        <span class="sc-rate">⭐ ${hot.rating} · ${esc(hot.sales)}</span>
      </div>
      <div class="sc-line2">${catLabel} · ${s.items.length}款单品</div>
      <div class="sc-line3">最低热量 🔥 ${minKcal} kcal</div>
    </div>`;
  }).join('');
}
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Number(a)})`;
}
async function renderHuntAI() {
  const box = $('#hunt-ai');
  if (!box || HUNT.tab === 'fav') return;
  const stats = await getDayStats(todayKey());
  const analysis = analyzeDay(stats, PROFILE);
  const pool = [...BRANDS, ...SHOPS].flatMap((s) => s.items.map((it) => ({
    name: it.name, kcal: it.kcal, price: it.price, emoji: s.emoji, shop: s.name, shopId: s.id,
    flavor: s.flavor, macros: it.macros
  })));
  const rec = recommendNextMeal(defaultMeal() === 'lunch' ? 'lunch' : 'dinner', analysis, PROFILE.tastePrefs, pool.slice(0, 30));
  box.innerHTML = `
    <div class="section-title">🤖 AI 智能推荐 <span class="small muted" style="font-weight:500">基于今日缺口</span></div>
    <div class="card" style="padding:14px">
      ${rec.items.length ? rec.items.slice(0, 3).map((it) => `
        <div class="reco-card" style="margin-bottom:10px;box-shadow:none;background:rgba(0,0,0,0.03)" data-action="hunt:ai-item" data-shopid="${it.shopId}" data-name="${esc(it.name)}" data-kcal="${it.kcal}" data-price="${it.price}">
          <div class="reco-photo" style="font-size:22px">${it.emoji}</div>
          <div class="reco-info"><div class="reco-name">${esc(it.name)} <span class="muted small">· ${esc(it.shop)}</span></div>
            <div class="reco-reason">${esc(it.reason || '')}</div></div>
          <div class="reco-kcal">${it.kcal}kcal</div>
        </div>`).join('') : `<div class="muted small">今天额度比较紧张，建议喝水或者吃个苹果 🍎</div>`}
      ${analysis.proteinNeed > 15 ? `<div class="hint" style="margin-top:8px">💡 因为你今日蛋白质还差 ${analysis.proteinNeed}g，推荐了高蛋白选项</div>` : ''}
    </div>`;
}
registerAction('hunt:tab', (el) => { HUNT.tab = el.dataset.v; renderPage('hunt'); });
registerAction('hunt:cat', (el) => { HUNT.cat = el.dataset.v; HUNT.tab = el.dataset.v === '全部' ? 'hot' : 'cat'; renderPage('hunt'); });
registerAction('hunt:fk', (el) => { HUNT.kcal = el.dataset.v; renderPage('hunt'); });
registerAction('hunt:ff', (el) => { HUNT.flavor = el.dataset.v; renderPage('hunt'); });
registerAction('hunt:brand', (el) => { SHOP_VIEW.id = el.dataset.id; SHOP_VIEW.series = '全部'; switchPage('shop'); });
registerAction('hunt:shop', (el) => { SHOP_VIEW.id = el.dataset.id; SHOP_VIEW.series = '全部'; switchPage('shop'); });
registerAction('hunt:fv', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (f) askMealSheet(f);
});
registerAction('hunt:ai-item', async (el) => {
  closeSheet();
  const shop = SHOP_MAP[el.dataset.shopid];
  await recordFood({ id: null, name: el.dataset.name, kcal: Number(el.dataset.kcal), price: Number(el.dataset.price), shop: shop.name, category: '外卖', portion: '一份', macros: null }, defaultMeal());
  await upsertShopFood(el.dataset.name, Number(el.dataset.kcal), Number(el.dataset.price), shop.name, el.dataset.shopid);
  await learnTasteSignal('hunt:ai-item', shopFlavorLabel(shop));
});

/* ============================================================
 * 店铺详情页（美团/饿了么风格）
 * ============================================================ */
registerPage('shop', async function (root) {
  const shop = SHOP_MAP[SHOP_VIEW.id];
  if (!shop) { switchPage('hunt'); return; }
  setNavActive('hunt');
  const hot = shopHotness(shop.id);
  const stats = await getDayStats(todayKey());
  const target = PROFILE.targetKcal || 1800;
  const remaining = Math.max(0, target - stats.kcal);
  const seriesList = ['全部', ...new Set(shop.items.map((it) => it.series || guessSeries(it.name)))];
  const items = SHOP_VIEW.series === '全部' ? shop.items : shop.items.filter((it) => (it.series || guessSeries(it.name)) === SHOP_VIEW.series);
  const catLabel = shopCatLabel(shop.cat);
  root.innerHTML = `
    <div class="shop-detail-head">
      <button class="shop-back" data-action="shop:back">←</button>
      <div class="shop-detail-title">${esc(shop.name)}</div>
      <button class="shop-edit" data-action="shop:edit" data-id="${shop.id}">✏️</button>
      <button class="shop-fav" data-action="shop:fav" data-id="${shop.id}">⭐</button>
    </div>
    <div class="shop-hero">
      <div class="shop-hero-logo" style="--nc-soft:${hexA(shop.color || '#5E5CE6', 0.14)}">${shop.image ? `<img src="${shop.image}" alt="">` : shop.emoji}</div>
      <div class="shop-hero-info">
        <div class="shop-hero-name">${esc(shop.name)}</div>
        <div class="shop-hero-meta">⭐ <b>${hot.rating}</b> · ${esc(hot.sales)} · ${catLabel}</div>
        <div class="shop-hero-sub">剩余额度 <b style="color:var(--brand)">${remaining}kcal</b> · 已收录 ${shop.items.length} 款</div>
      </div>
    </div>
    <div class="series-tabs">
      ${seriesList.map((s) => `<div class="series-tab ${SHOP_VIEW.series === s ? 'on' : ''}" data-action="shop:series" data-v="${s}">${s}</div>`).join('')}
    </div>
    <div class="menu-list">
      ${items.filter((it) => it.status !== '下架').map((it) => `
        <div class="menu-item" data-action="shop:item" data-i="${it._i}">
          <div class="mi-photo" style="--nc-soft:${hexA(shop.color || '#5E5CE6', 0.12)}">${it.image ? `<img src="${it.image}" alt="">` : shop.emoji}</div>
          <div class="mi-info">
            <div class="mi-name">${esc(it.name)}${it._edited ? '<span class="edited-tag">已编辑</span>' : ''}</div>
            <div class="mi-meta">¥${it.price.toFixed(2)} · ${it.kcal}kcal · ${esc(it.series || guessSeries(it.name))}</div>
          </div>
          <div class="mi-right">
            <button class="mi-more" data-action="item:menu" data-i="${it._i}">⋯</button>
            <button class="point-it" data-action="shop:item" data-i="${it._i}">点它</button>
          </div>
        </div>`).join('')}
    </div>
    ${items.some((it) => it.status === '下架') ? `
    <div class="section-title" style="margin-top:18px">⤵️ 已下架（${items.filter((it) => it.status === '下架').length}）</div>
    <div class="menu-list">
      ${items.filter((it) => it.status === '下架').map((it) => `
        <div class="menu-item down" data-action="item:menu" data-i="${it._i}">
          <div class="mi-photo" style="--nc-soft:rgba(0,0,0,.06)">${it.image ? `<img src="${it.image}" alt="">` : shop.emoji}</div>
          <div class="mi-info"><div class="mi-name">${esc(it.name)}</div><div class="mi-meta">¥${it.price.toFixed(2)} · ${it.kcal}kcal · 已下架</div></div>
          <button class="mi-more" data-action="item:menu" data-i="${it._i}">⋯</button>
        </div>`).join('')}
    </div>` : ''}
    <button class="btn block add-item-btn" data-action="shop:add">➕ 添加新品</button>
    <div class="section-title" style="margin-top:18px">🔥 为你推荐 <span class="small muted" style="font-weight:500">本店其他热销</span></div>
    <div class="rec-row">
      ${shop.items.map((it) => `
        <div class="rec-card" data-action="shop:item" data-i="${it._i}">
          <div class="rec-photo" style="--nc-soft:${hexA(shop.color || '#5E5CE6', 0.12)}">${shop.emoji}</div>
          <div class="rec-name">${esc(it.name)}</div>
          <div class="rec-meta">¥${it.price.toFixed(2)} · ${it.kcal}kcal</div>
        </div>`).join('')}
    </div>
    <div style="height:12px"></div>`;
});
registerAction('shop:back', () => switchPage('hunt'));
registerAction('shop:series', (el) => { SHOP_VIEW.series = el.dataset.v; renderPage('shop'); });
registerAction('shop:fav', async (el) => {
  const shop = SHOP_MAP[el.dataset.id];
  if (!shop) return;
  for (const it of shop.items) await upsertShopFood(it.name, it.kcal, it.price, shop.name, shop.id);
  await learnTasteSignal('shop:fav', shopFlavorLabel(shop));
  toast(`已收藏「${shop.name}」全部 ${shop.items.length} 款到食谱 ⭐`, 'brand');
});
registerAction('shop:item', (el) => {
  const shop = SHOP_MAP[SHOP_VIEW.id];
  const item = shop.items[Number(el.dataset.i)];
  if (item) openBillFlow(item, shop);
});
registerAction('hunt:item-record', async (el) => {
  const shop = SHOP_MAP[el.dataset.shopid];
  closeSheet();
  await recordFood({ id: null, name: el.dataset.name, kcal: Number(el.dataset.kcal), price: Number(el.dataset.price), shop: shop.name, category: shop.cat === '奶茶咖啡' ? '饮品' : '外卖', portion: '一份', macros: null }, defaultMeal());
  await upsertShopFood(el.dataset.name, Number(el.dataset.kcal), Number(el.dataset.price), shop.name, el.dataset.shopid);
  await learnTasteSignal('hunt:item-record', shopFlavorLabel(shop));
});
registerAction('hunt:item-bill', (el) => {
  const shop = SHOP_MAP[el.dataset.shopid];
  const item = shop.items[Number(el.dataset.i)];
  if (item) openBillFlow(item, shop);
});
registerAction('hunt:item-fav', async (el) => {
  const shop = SHOP_MAP[el.dataset.shopid];
  await upsertShopFood(el.dataset.name, Number(el.dataset.kcal), Number(el.dataset.price), shop.name, el.dataset.shopid);
  await learnTasteSignal('hunt:item-fav', shopFlavorLabel(shop));
  toast(`已收藏「${el.dataset.name}」⭐`, 'brand');
});

/* ============================================================
 * 多巴胺账单（虚拟点单）
 * ============================================================ */
const BILL = { item: null, shop: null, sweetness: '5分糖', temp: '冰', size: '中杯', toppings: [], portion: '中份', spice: '微辣', isDrink: true };

/* 口味标签统一（店铺 flavor 无「的」→ 秘书偏好标签带「的」） */
function shopFlavorLabel(shop) {
  const f = (shop && shop.flavor) || '咸香';
  return f.endsWith('的') ? f : f + '的';
}
/* 规格选择后的口味信号：饮品按甜度推断，食品按店铺口味 */
function billFlavor() {
  if (BILL.isDrink) return (BILL.sweetness === '无糖' || BILL.sweetness === '3分糖') ? '清淡的' : '甜口的';
  return shopFlavorLabel(BILL.shop);
}

registerPage('bill', async function (root) {
  const st = await getBillStats();
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">🧾</span>多巴胺账单</div>
        <div class="page-sub">假装点单 · 快乐省钱省热量</div>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-card"><div class="num">${st.savedKcal.toLocaleString()}</div><div class="label">累计节省热量 kcal</div></div>
      <div class="stat-card"><div class="num" style="color:var(--orange)">¥${st.savedPrice.toFixed(2)}</div><div class="label">累计节省金额</div></div>
    </div>
    <div class="card" style="margin-top:12px;padding:14px 18px">
      <div class="flex" style="gap:10px;flex-wrap:wrap">
        <span class="pill-num">${convertKcal(st.savedKcal)}</span>
        <span class="pill-num" style="background:var(--orange-soft);color:var(--orange)">≈ ${Math.round(st.savedKcal / 500)} 个汉堡</span>
        <span class="pill-num" style="background:var(--green-soft);color:var(--green)">≈ ${Math.round(st.savedKcal / 400)} 杯奶茶</span>
        <span class="pill-num">已躲过 ${st.count} 单</span>
      </div>
      <div class="hint" style="margin-top:8px">去「觅食」选个想吃的，先过把瘾，热量和钱都省下啦</div>
    </div>
    <div class="section-title">📋 历史虚拟订单</div>
    ${st.orders.length ? renderOrderGroups(st.orders) : `
      <div class="empty-state" style="padding:34px 20px">
        <div class="es-icon">🧾</div>
        <div class="es-title">账单还空着</div>
        <div class="es-sub">去「觅食」选个想吃的，先过把瘾</div>
      </div>`}
    <div style="height:6px"></div>
    <button class="btn block" data-action="nav:go" data-page="hunt">🍽️ 去觅食逛逛</button>
  `;
});

function timeLabel(iso) {
  try { const d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } catch (e) { return ''; }
}
/* 需求 4.3：历史订单按「今天 / 昨天 / M月D日」分组展示 */
function renderOrderGroups(orders) {
  const today = todayKey();
  const yest = addDays(todayKey(), -1);
  const groups = {};
  orders.forEach((o) => {
    const d = (o.date || '').slice(0, 10);
    const label = d === today ? '今天' : d === yest ? '昨天' : (d.slice(5).replace('-', '/'));
    (groups[label] = groups[label] || []).push(o);
  });
  return Object.keys(groups).map((label) => `
    <div class="order-group-title">${label}</div>
    ${groups[label].map((o) => `
      <div class="order-card">
        <div class="order-emoji">${o.shopEmoji || '🧋'}</div>
        <div class="order-info"><div class="order-name">${esc(o.itemName)}</div>
          <div class="order-shop">${esc(o.shopName || '')}${o.specs ? ' · ' + esc(o.specs) : ''}</div>
          <div class="order-date">${label} ${timeLabel(o.createdAt)}</div></div>
        <div class="order-save">-${o.savedKcal}kcal<br>${o.priceSource === 'none' ? '未定价' : '-¥' + o.savedPrice.toFixed(2)}</div>
      </div>`).join('')}`).join('');
}
function openBillFlow(item, shop) {
  const isDrink = shop.cat === '奶茶咖啡' || !!BRANDS.find((b) => b.id === shop.id);
  BILL.item = item; BILL.shop = shop; BILL.isDrink = isDrink;
  BILL.sweetness = '5分糖'; BILL.temp = '冰'; BILL.size = '中杯'; BILL.toppings = [];
  BILL.portion = '中份'; BILL.spice = '微辣';
  openSheet(''); // 先打开弹层（replaceSheet 只替换内容，不会弹出）
  renderSpecSheet();
}
function computeBill() {
  const it = BILL.item;
  const S = itemSpecs(it);
  if (BILL.isDrink) {
    const s = (S.sweetness || DRINK_SPECS.sweetness).find((x) => x.label === BILL.sweetness) || { deltaKcal: 0, deltaPrice: 0 };
    const z = (S.sizes || DRINK_SPECS.sizes).find((x) => x.label === BILL.size) || { coef: 1, priceCoef: 1 };
    let topK = 0, topP = 0;
    const tops = S.toppings || DRINK_SPECS.toppings;
    BILL.toppings.forEach((t) => { const tp = tops.find((x) => x.name === t); if (tp) { topK += tp.kcal; topP += tp.price; } });
    const kcal = Math.round((it.kcal + s.deltaKcal) * z.coef + topK);
    const price = Math.round(((it.price + s.deltaPrice) * z.priceCoef + topP) * 100) / 100;
    return { kcal, price, specs: `${BILL.size}/${BILL.sweetness}/${BILL.temp}${BILL.toppings.length ? '/+' + BILL.toppings.join('+') : ''}` };
  }
  const p = (S.portions || FOOD_SPECS.portions).find((x) => x.label === BILL.portion) || { coef: 1, priceCoef: 1 };
  const sp = (S.spices || FOOD_SPECS.spices).find((x) => x.label === BILL.spice) || { deltaKcal: 0 };
  const kcal = Math.round(it.kcal * p.coef + sp.deltaKcal);
  const price = Math.round(it.price * p.priceCoef * 100) / 100;
  return { kcal, price, specs: `${BILL.portion}/${BILL.spice}` };
}
function renderSpecSheet() {
  const it = BILL.item;
  const total = computeBill();
  const isDrink = BILL.isDrink;
  const S = itemSpecs(it);
  const base = isDrink ? `${it.price.toFixed(2)} · 基础 ${it.kcal}kcal` : `${it.price.toFixed(2)} · 基础 ${it.kcal}kcal`;
  replaceSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">${BILL.shop.emoji} ${esc(it.name)}</div>
    <div class="muted small" style="text-align:center;margin-bottom:14px">基础价 ¥${base.split(' · ')[0]} · 基础热量 ${it.kcal}kcal</div>
    ${isDrink ? `
    <div class="spec-group">
      <div class="spec-title">甜度 <span class="delta">每档约差15-20kcal</span></div>
      <div class="chips">${S.sweetness.map((s) => `<button class="chip ${BILL.sweetness === s.label ? 'on' : ''}" data-action="spec:choose" data-g="sweetness" data-v="${s.label}">${s.label}${s.deltaKcal ? ` (${s.deltaKcal > 0 ? '+' : ''}${s.deltaKcal})` : ''}</button>`).join('')}</div>
    </div>
    <div class="spec-group">
      <div class="spec-title">温度</div>
      <div class="chips">${S.temperature.map((t) => `<button class="chip ${BILL.temp === t.label ? 'on' : ''}" data-action="spec:choose" data-g="temp" data-v="${t.label}">${t.label}</button>`).join('')}</div>
    </div>
    <div class="spec-group">
      <div class="spec-title">容量 <span class="delta">大杯约×1.2</span></div>
      <div class="chips">${S.sizes.map((s) => `<button class="chip ${BILL.size === s.label ? 'on' : ''}" data-action="spec:choose" data-g="size" data-v="${s.label}">${s.label}</button>`).join('')}</div>
    </div>
    <div class="spec-group">
      <div class="spec-title">小料 <span class="delta">可多选</span></div>
      <div class="chips">${S.toppings.map((t) => `<button class="chip ${BILL.toppings.includes(t.name) ? 'on' : ''}" data-action="spec:topping" data-v="${t.name}">${t.name} +${t.kcal}kcal / +¥${t.price}</button>`).join('')}</div>
    </div>` : `
    <div class="spec-group">
      <div class="spec-title">分量</div>
      <div class="chips">${S.portions.map((p) => `<button class="chip ${BILL.portion === p.label ? 'on' : ''}" data-action="spec:choose" data-g="portion" data-v="${p.label}">${p.label}</button>`).join('')}</div>
    </div>
    <div class="spec-group">
      <div class="spec-title">口味</div>
      <div class="chips">${S.spices.map((s) => `<button class="chip ${BILL.spice === s.label ? 'on' : ''}" data-action="spec:choose" data-g="spice" data-v="${s.label}">${s.label}</button>`).join('')}</div>
    </div>`}
    <div class="spec-summary">已选规格：${esc(total.specs)}</div>
    <div class="spec-panel" style="background:rgba(0,0,0,0.04)">
      <div class="spec-total">
        <div class="st-kcal">${total.kcal}<span class="small muted" style="font-size:12px"> kcal</span></div>
        <div class="st-price">¥${total.price.toFixed(2)}</div>
        <div class="st-tip">${isDrink ? `基础 ${it.kcal}kcal × 容量系数 + 甜度/小料` : `基础 ${it.kcal}kcal × 分量系数 + 口味`}</div>
      </div>
    </div>
    <div style="height:10px"></div>
    <div class="spec-exits">
      <button class="exit-btn record" data-action="spec:record">📝 真实记录<br><small>记入今日三餐</small></button>
      <button class="exit-btn bill" data-action="spec:confirm">🧾 多巴胺账单<br><small>过过瘾不真吃</small></button>
      <button class="exit-btn fav" data-action="spec:fav">⭐ 收藏到食谱<br><small>存进我的食谱</small></button>
    </div>
  `);
}
registerAction('spec:record', async () => {
  const total = computeBill();
  const shop = BILL.shop;
  const isDrink = BILL.isDrink;
  closeSheet();
  await recordFood({
    id: null, name: BILL.item.name, kcal: total.kcal, price: total.price,
    shop: shop.name, category: isDrink ? '饮品' : '外卖',
    portion: total.specs, macros: estimateMacros(total.kcal)
  }, defaultMeal());
  await upsertShopFood(BILL.item.name, total.kcal, total.price, shop.name, shop.id);
  await learnTasteSignal('spec:record', billFlavor());
});
registerAction('spec:fav', async () => {
  const total = computeBill();
  await upsertShopFood(BILL.item.name, total.kcal, total.price, BILL.shop.name, BILL.shop.id);
  await learnTasteSignal('spec:fav', billFlavor());
  toast(`已收藏「${BILL.item.name}」(${total.kcal}kcal) ⭐`, 'brand');
});
registerAction('spec:choose', (el) => {
  const g = el.dataset.g, v = el.dataset.v;
  if (g === 'sweetness' || g === 'temp' || g === 'size') BILL[g] = v;
  if (g === 'portion') BILL.portion = v;
  if (g === 'spice') BILL.spice = v;
  renderSpecSheet();
});
registerAction('spec:topping', (el) => {
  const v = el.dataset.v;
  if (BILL.toppings.includes(v)) BILL.toppings = BILL.toppings.filter((t) => t !== v);
  else BILL.toppings.push(v);
  renderSpecSheet();
});
async function getRealPrice(item, shop) {
  // 省下金额 = 现实价格：用户食谱价 > 平台预置价 > 未定价
  try { await loadFoods(); } catch (e) { /* 未初始化时忽略 */ }
  const mine = FOODS.find((f) => f.name === item.name && (!shop || !f.shop || f.shop === shop.name));
  if (mine && mine.price > 0) return { price: mine.price, source: 'user' };
  if (item.price > 0) return { price: item.price, source: 'platform' };
  return { price: 0, source: 'none' };
}
registerAction('spec:confirm', async () => {
  // 需求 4.1：加入账单前弹出确认卡 → 用户确认虚拟下单
  const total = computeBill();
  const real = await getRealPrice(BILL.item, BILL.shop);
  openModal(`
    <div class="modal-title">🧾 确认虚拟下单？</div>
    <div class="confirm-food">${BILL.shop.emoji} ${esc(BILL.item.name)}</div>
    <div class="confirm-spec">规格：${esc(total.specs)}</div>
    <div class="confirm-line"><span>总热量</span><b>${total.kcal} kcal</b></div>
    <div class="confirm-line"><span>总价格</span><b>¥${total.price.toFixed(2)}</b></div>
    <div class="confirm-line save"><span>将节省</span><b>${real.price > 0 ? '-¥' + real.price.toFixed(2) : '未定价'} · -${total.kcal}kcal</b></div>
    <div class="flex" style="gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="modal:close">再想想</button>
      <button class="btn primary" data-action="bill:do">✅ 确认下单</button>
    </div>`);
});
registerAction('bill:do', async () => {
  closeModal();
  const total = computeBill();
  const real = await getRealPrice(BILL.item, BILL.shop);
  const order = {
    itemName: BILL.item.name, shopName: BILL.shop.name, shopEmoji: BILL.shop.emoji,
    specs: total.specs, totalKcal: total.kcal, totalPrice: total.price,
    savedKcal: total.kcal, savedPrice: real.price, priceSource: real.source, date: todayKey()
  };
  await addOrder(order);
  await upsertShopFood(BILL.item.name, total.kcal, total.price, BILL.shop.name, BILL.shop.id);
  await learnTasteSignal('spec:confirm', billFlavor());
  confetti();
  renderDelivery(order);
});
function renderBillResult(order) {
  const hours = jogHours(order.savedKcal);
  replaceSheet(`
    <div style="text-align:center;padding-top:16px">
      <div class="result-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
      <div class="result-title">🎉 虚拟下单成功！</div>
      <div class="result-food">${order.shopEmoji || '🍔'} ${esc(order.itemName)}</div>
      <div class="result-spec">规格：${esc(order.specs || '默认规格')}</div>
      <div class="result-line">✅ 避免摄入热量 <b>- ${order.savedKcal} kcal</b></div>
      <div class="result-line">✅ 节省金额 <b>${order.priceSource === 'none' ? '¥0.00（未定价）' : '- ¥' + order.savedPrice.toFixed(2)}</b></div>
      <div class="result-note">💡 相当于慢跑 <b>${hours}</b> 小时才能消耗掉这杯奶茶的热量哦！<br>你成功躲过一劫！</div>
      <div class="flex" style="justify-content:center;gap:10px">
        <button class="btn ghost" data-action="bill:again">再来一单</button>
        <button class="btn primary" data-action="bill:view">查看我的账单</button>
      </div>
    </div>`);
}
registerAction('bill:again', () => {
  if (BILL.item && BILL.shop) renderSpecSheet();
  else { closeSheet(); switchPage('hunt'); }
});
registerAction('bill:view', () => {
  closeSheet();
  switchPage('bill');
});

/* ============================================================
 * 配送动画（确认下单 → 三段简笔画自动切换 → 结果页）
 * ============================================================ */
let _deliTimer = null, _deliOrder = null;
function renderDelivery(order) {
  _deliOrder = order;
  if (_deliTimer) clearTimeout(_deliTimer);
  const stages = [
    { emoji: '📦', t: '骑手已取餐', sub: '商家出餐完毕，骑手到店取走你的订单' },
    { emoji: '🛵', t: '配送中', sub: '骑手正在飞奔向你……' },
    { emoji: '🍽️', t: '已送达！', sub: '（空盘子）这单你成功躲过，热量和钱都省下啦' }
  ];
  let idx = 0;
  const draw = () => replaceSheet(`
    <div class="delivery" data-action="delivery:skip">
      <div class="deli-emoji">${stages[idx].emoji}</div>
      <div class="deli-title">${stages[idx].t}</div>
      <div class="deli-sub">${stages[idx].sub}</div>
      <div class="deli-dots">${stages.map((s, i) => `<span class="deli-dot ${i === idx ? 'on' : ''}"></span>`).join('')}</div>
      <div class="deli-tip">点击任意处跳过动画 →</div>
    </div>`);
  draw();
  const advance = () => {
    idx++;
    if (idx < stages.length) { draw(); _deliTimer = setTimeout(advance, 3000); }
    else { _deliTimer = setTimeout(() => renderBillResult(order), 3000); }
  };
  _deliTimer = setTimeout(advance, 3000);
}
registerAction('delivery:skip', () => {
  if (_deliTimer) clearTimeout(_deliTimer);
  if (_deliOrder) renderBillResult(_deliOrder);
});
