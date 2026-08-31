/* ============================================================
 * 热量手账 · 店铺 / 单品编辑（用户自治菜单）+ 规格合并
 * 依赖：app.js(SHOP_MAP/buildShopMap/openSheet/pickPhoto)、store.js(db*)、
 *       data.js(BRANDS/SHOPS/DRINK_SPECS/FOOD_SPECS)、crop.js(openCropEditor)
 * 所有编辑以「覆盖记录」存进 IndexedDB.edits，buildShopMap 后由 applyShopEdits 合并，
 * 用户编辑优先于平台预置数据；改名/热量/价格同步到「我的食谱」。
 * ============================================================ */
'use strict';

/* ---------- 编辑记录读写 ---------- */
async function getEdits() { return dbGetAll(IDB.edits); }
async function saveEdit(rec) { await dbPut(IDB.edits, rec); }
async function delEdit(ek) { await dbDel(IDB.edits, ek); }
/* 规格记忆：按 shopId+itemName 记录用户常选规格，下次开单预填（累积合并机制） */
async function loadSpecMem(shopId, name) {
  try { return await dbGet(IDB.edits, 'sm:' + shopId + ':' + name) || null; } catch (e) { return null; }
}
async function saveSpecMem(rec) {
  rec.ek = 'sm:' + rec.shopId + ':' + rec.name;
  rec.kind = 'specmem';
  rec.ts = Date.now();
  await dbPut(IDB.edits, rec);
}

/* ---------- 自动累积合并：按 品牌+食物名 聚合用户每一次记录的规格 ---------- */
/* 用户录入只填「当前这一份」的真实情况；后台按 品牌+食物名+规格组合 自动累积：
 * 有相同组合 → 更新食用时间+累计次数；无 → 新增组合。
 * 当达到阈值（≥2容量 / ≥2甜度 / ≥2温度 / ≥1小料 / ≥3次重复）自动在觅食生成规格选择器。 */
function specKey(shopId, name) { return 'spec:' + shopId + '|' + name; }
async function getSpecLedger(shopId, name) {
  try { const r = await dbGet(IDB.edits, specKey(shopId, name)); return r ? r.list : []; } catch (e) { return []; }
}
async function setSpecLedger(shopId, name, list) {
  await dbPut(IDB.edits, { ek: specKey(shopId, name), kind: 'speclog', list });
}
/* 追加一条规格记录（来自录入/记录/下单）。同组合则更新时间+次数，否则新增。 */
async function appendSpecLedger(shopId, name, spec, kcal, price) {
  if (!shopId || !name) return;
  const list = await getSpecLedger(shopId, name);
  const combo = JSON.stringify({
    sweetness: spec.sweetness || '', temp: spec.temp || '', size: spec.size || '',
    toppings: (spec.toppings || []).slice().sort(), portion: spec.portion || '', spice: spec.spice || ''
  });
  const hit = list.find((r) => JSON.stringify({
    sweetness: r.spec.sweetness || '', temp: r.spec.temp || '', size: r.spec.size || '',
    toppings: (r.spec.toppings || []).slice().sort(), portion: r.spec.portion || '', spice: r.spec.spice || ''
  }) === combo);
  if (hit) { hit.ts = Date.now(); hit.count = (hit.count || 1) + 1; hit.kcal = kcal; hit.price = price; }
  else list.push({ spec: {
      sweetness: spec.sweetness || '', temp: spec.temp || '', size: spec.size || '',
      toppings: (spec.toppings || []).slice(), portion: spec.portion || '', spice: spec.spice || ''
    }, kcal, price, ts: Date.now(), count: 1 });
  if (list.length > 40) list.splice(0, list.length - 40);
  await setSpecLedger(shopId, name, list);
}
/* 从累积记录分析出可用的规格选项 + 是否触发选择器 */
function analyzeSpecs(list) {
  const sizes = [...new Set(list.map((r) => r.spec.size).filter(Boolean))];
  const sweetness = [...new Set(list.map((r) => r.spec.sweetness).filter(Boolean))];
  const temp = [...new Set(list.map((r) => r.spec.temp).filter(Boolean))];
  const toppings = [...new Set(list.flatMap((r) => r.spec.toppings || []))];
  const trigger = sizes.length >= 2 || sweetness.length >= 2 || temp.length >= 2 || toppings.length >= 1 || list.length >= 3;
  return { sizes, sweetness, temp, toppings, trigger, count: list.length };
}
/* 取某规格组合的热量/价格：优先该组合最近一次记录，否则所有记录均值 */
function pickSpecValue(list, spec) {
  const combo = JSON.stringify({
    sweetness: spec.sweetness || '', temp: spec.temp || '', size: spec.size || '',
    toppings: (spec.toppings || []).slice().sort(), portion: spec.portion || '', spice: spec.spice || ''
  });
  const same = list.filter((r) => JSON.stringify({
    sweetness: r.spec.sweetness || '', temp: r.spec.temp || '', size: r.spec.size || '',
    toppings: (r.spec.toppings || []).slice().sort(), portion: r.spec.portion || '', spice: r.spec.spice || ''
  }) === combo);
  if (same.length) { const m = same.sort((a, b) => b.ts - a.ts)[0]; return { kcal: m.kcal, price: m.price }; }
  const kcal = Math.round(list.reduce((a, r) => a + r.kcal, 0) / list.length);
  const price = Math.round(list.reduce((a, r) => a + (r.price || 0), 0) / list.length * 100) / 100;
  return { kcal, price };
}
/* 为「我的食谱」里的食物推导它在觅食对应的 shopId（命中平台店铺用其 id，否则合成稳定 id） */
function foodShopId(food) {
  const name = food.shop || food.brand;
  if (!name) return '';
  // 先在完整店铺表（含用户自建）里找，保证自建店铺也能被关联
  if (typeof SHOP_MAP !== 'undefined' && SHOP_MAP) {
    const m = Object.values(SHOP_MAP).find((s) => s.name === name);
    if (m) return m.id;
  }
  const hit = [...BRANDS, ...SHOPS].find((s) => s.name === name);
  if (hit) return hit.id;
  let h = 0; const s = 'u:' + name;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 'u' + h.toString(36);
}

/* ---------- 店铺智能匹配：精确 / 模糊（编辑距离≤2）/ 无匹配 ---------- */
const SHOP_CAT_EMOJI = { '奶茶咖啡': '🧋', '汉堡炸鸡': '🍔', '麻辣烫': '🌶️', '粉面': '🍜', '米饭套餐': '🍚', '轻食沙拉': '🥗', '甜品面包': '🍰', '火锅': '🍲', '烧烤': '🍢', '快餐': '🍟', '超市': '🛒', '其他': '🏪' };
function shopCatEmoji(cat) { return SHOP_CAT_EMOJI[cat] || '🏪'; }
/* 所有可关联的店铺（平台 + 用户自建） */
function allShops() { return typeof SHOP_MAP !== 'undefined' && SHOP_MAP ? Object.values(SHOP_MAP) : [...BRANDS, ...SHOPS]; }
function matchShopByName(name) {
  const q = String(name || '').trim();
  if (!q) return { type: 'none', shop: null, candidates: [] };
  const lowers = q.toLowerCase();
  const maxD = q.length <= 2 ? 1 : 2;          // 短名收严，避免误匹配
  const exact = allShops().find((s) => String(s.name).toLowerCase() === lowers);
  if (exact) return { type: 'exact', shop: exact, candidates: [exact] };
  const cands = [];
  for (const s of allShops()) {
    const sn = String(s.name).toLowerCase();
    let d = editDistance(sn, lowers);
    if (sn.includes(lowers) || lowers.includes(sn)) d = Math.min(d, 0.5); // 互为子串视为强候选
    if (d > 0 && d <= maxD) cands.push({ s, d });
  }
  cands.sort((a, b) => a.d - b.d);
  if (cands.length) return { type: 'fuzzy', shop: null, candidates: cands.slice(0, 3).map((x) => x.s) };
  return { type: 'none', shop: null, candidates: [] };
}
/* 自动创建店铺（「我的食谱」录入新店名时），id 与 foodShopId 推导保持一致 */
async function createUserShop(name, opts) {
  const o = opts || {};
  const id = foodShopId({ shop: name });
  // 店铺名判不出品类时，再用食物名兜底（「其他」视为没判出来）
  let cat = o.category || guessShopCat(name);
  if (!cat || cat === '其他') cat = guessShopCat(o.foodName || '') || '其他';
  await saveEdit({
    ek: 'shopnew:' + id, kind: 'shopnew', shopId: id, name,
    category: cat, emoji: o.emoji || shopCatEmoji(cat), color: '#5E5CE6',
    flavor: o.flavor || '咸香', image: ''
  });
  await rebuildShops();
  return SHOP_MAP[id] || null;
}
/* 正向同步：确保「我的食谱」的食物作为单品出现在对应店铺（已存在则更新数值） */
async function syncFoodToShop(food) {
  const shopId = foodShopId(food);
  if (!shopId) return null;
  await rebuildShops();
  if (!SHOP_MAP[shopId]) return null;
  const edits = await getEdits();
  const ek = 'item:' + shopId + '/' + food.name;
  const rec = edits.find((e) => e.kind === 'item' && e.shopId === shopId && (e.origName === food.name || e.name === food.name));
  if (rec) {
    rec.name = food.name; rec.origName = food.name;
    rec.kcal = food.kcal; rec.price = food.price;
    if (food.series) rec.series = food.series;
    await saveEdit(rec);
  } else {
    await saveEdit({
      ek, kind: 'item', shopId, origName: food.name, name: food.name,
      kcal: food.kcal, price: food.price, series: food.series || guessSeries(food.name),
      category: food.category, added: true
    });
  }
  await rebuildShops();
  return SHOP_MAP[shopId];
}

/* ---------- 把编辑合并进 SHOP_MAP ---------- */
async function applyShopEdits() {
  const edits = await getEdits();
  // 用户新建的店铺（「我的食谱」按店铺名自动创建）——先建店，后续单品编辑才能挂上
  edits.filter((e) => e.kind === 'shopnew').forEach((e) => {
    if (SHOP_MAP[e.shopId]) return;
    SHOP_MAP[e.shopId] = {
      id: e.shopId, name: e.name || '未命名店铺', emoji: e.emoji || shopCatEmoji(e.category),
      cat: e.category || '其他', flavor: e.flavor || '咸香', color: e.color || '#5E5CE6',
      image: e.image || '', items: [], _userShop: true
    };
  });
  // 店铺级
  edits.filter((e) => e.kind === 'shop').forEach((e) => {
    const s = SHOP_MAP[e.shopId]; if (!s) return;
    if (e.name != null) s.name = e.name;
    if (e.category != null) { s.cat = e.category; s.category = e.category; }
    if (e.emoji != null) s.emoji = e.emoji;
    if (e.color != null) s.color = e.color;
    if (e.image != null) s.image = e.image;
  });
  // 单品级
  edits.filter((e) => e.kind === 'item').forEach((e) => {
    const s = SHOP_MAP[e.shopId]; if (!s) return;
    if (e.added) {
      const it = { name: e.name || '未命名', series: e.series || '其他', kcal: Number(e.kcal) || 0, price: Number(e.price) || 0, _added: true, _edited: true };
      if (e.category) it.category = e.category;
      if (e.image) it.image = e.image;
      if (e.status) it.status = e.status;
      if (e.specs) it._specs = e.specs;
      s.items.push(it);
    } else if (e.status === 'deleted') {
      const it = s.items.find((x) => x.name === e.origName); if (it) it._deleted = true;
    } else {
      const it = s.items.find((x) => x.name === e.origName); if (!it) return;
      if (e.name != null) it.name = e.name;
      if (e.kcal != null) it.kcal = Number(e.kcal);
      if (e.price != null) it.price = Number(e.price);
      if (e.series != null) it.series = e.series;
      if (e.category != null) it.category = e.category;
      if (e.image != null) it.image = e.image;
      if (e.status != null) it.status = e.status;
      if (e.specs != null) it._specs = e.specs;
      it._edited = true;
    }
  });
  // 重算索引 & 丢弃已删除
  Object.values(SHOP_MAP).forEach((s) => {
    s.items = s.items.filter((it) => !it._deleted);
    s.items.forEach((it, idx) => { it._i = idx; it._shopId = s.id; it._shopName = s.name; it._shopEmoji = s.emoji; });
  });
}
async function rebuildShops() { buildShopMap(); await applyShopEdits(); }

/* ---------- 规格合并（单品自定义规格优先） ---------- */
function isDrinkItem(it) {
  return !!(BRANDS.find((b) => b.id === it._shopId) || (SHOP_MAP[it._shopId] && SHOP_MAP[it._shopId].cat === '奶茶咖啡'));
}
function itemSpecs(it) {
  if (it && it._specs) return it._specs;
  return isDrinkItem(it) ? DRINK_SPECS : FOOD_SPECS;
}

/* ---------- 同步到「我的食谱」 ---------- */
async function syncFoodsForEdit(shopName, origName, patch) {
  await loadFoods();
  const matches = FOODS.filter((f) => f.name === origName && f.shop === shopName);
  for (const f of matches) {
    if (patch.name != null) f.name = patch.name;
    if (patch.kcal != null) f.kcal = patch.kcal;
    if (patch.price != null) f.price = patch.price;
    if (patch.category != null) f.category = patch.category;
    f.updatedAt = nowISO();
    // 名称/分类变了 → 搜索关键词跟着重算，否则以后搜不到
    f.keywords = extractKeywords({ name: f.name, shop: f.shop, brand: f.brand, series: f.series, category: f.category, spec: f.spec });
    await saveFood(f);
  }
}
async function renameShopInFoods(oldName, newName) {
  if (oldName === newName) return;
  await loadFoods();
  const matches = FOODS.filter((f) => f.shop === oldName);
  for (const f of matches) {
    f.shop = newName;
    if (f.brand === oldName) f.brand = newName;
    f.updatedAt = nowISO();
    f.keywords = extractKeywords({ name: f.name, shop: f.shop, brand: f.brand, series: f.series, category: f.category, spec: f.spec });
    await saveFood(f);
  }
}
/* 把某道食物从它所属店铺里摘掉（删单品编辑 + 规格账本）。
   换店铺 / 删除食物时都要调用，否则旧店里会残留同一个单品（孤儿）。 */
async function unlinkFoodFromShop(food) {
  if (!food || !food.shop) return 0;
  const shopId = foodShopId(food);
  if (!shopId) return 0;
  const edits = await getEdits();
  let n = 0;
  for (const e of edits) {
    const isItem = e.kind === 'item' && e.shopId === shopId && (e.origName === food.name || e.name === food.name);
    const isSpec = e.ek === 'spec:' + shopId + '|' + food.name;
    if (isItem || isSpec) { await delEdit(e.ek); n++; }
  }
  if (n) await rebuildShops();
  return n;
}

/* ---------- 编辑图片（复用 crop.js） ---------- */
function pickEditImage(cb) {
  pickPhoto((d) => openCropEditor({ src: d, ratio: '1:1', onDone: (c) => cb(c), onCancel: () => {} }));
}

/* ---------- 临时状态 ---------- */
let _es = null; // 编辑店铺 {shopId,name,cat,img}
let _ei = null; // 编辑单品 {shopId,origName,name,kcal,price,series,status,img,specs,isDrink,isAdded}
let _en = null; // 新增单品 {shopId,name,kcal,price,series,img,specs,isDrink}
let _specOwner = null; // 'ei' | 'en'
let _editMode = null; // 'shop' | 'item' | 'new'
let _specOpen = false; // 规格折叠区是否展开（重渲染时保留）

function rerenderEditSheet() {
  if (_editMode === 'item') renderEditItem();
  else if (_editMode === 'new') renderAddItem();
}

/* 规格默认值深拷贝 */
function cloneDrink() {
  return {
    sweetness: DRINK_SPECS.sweetness.map((x) => ({ ...x })),
    temperature: DRINK_SPECS.temperature.map((x) => ({ ...x })),
    sizes: DRINK_SPECS.sizes.map((x) => ({ ...x })),
    toppings: DRINK_SPECS.toppings.map((x) => ({ ...x }))
  };
}
function cloneFood() {
  return {
    portions: FOOD_SPECS.portions.map((x) => ({ ...x })),
    spices: FOOD_SPECS.spices.map((x) => ({ ...x }))
  };
}
function ensureSpecs() {
  const o = _specOwner === 'ei' ? _ei : _en;
  if (o.specs) return;
  o.specs = o.isDrink ? cloneDrink() : cloneFood();
}
function specEditorHTML(obj) {
  if (obj.isDrink) {
    const S = obj.specs || DRINK_SPECS;
    const on = (arr, key, val) => (arr && arr.find((x) => x[key] === val)) ? 'on' : '';
    return `
      <div class="spec-edit">
        <div class="spec-et">甜度 <span class="muted small">点选可删/加</span></div>
        <div class="chips">${DRINK_SPECS.sweetness.map((s) => `<button class="chip ${on(S.sweetness, 'label', s.label)}" data-action="spec:toggle" data-g="sweetness" data-v="${s.label}">${s.label}</button>`).join('')}</div>
        <div class="spec-et">温度</div>
        <div class="chips">${DRINK_SPECS.temperature.map((s) => `<button class="chip ${on(S.temperature, 'label', s.label)}" data-action="spec:toggle" data-g="temperature" data-v="${s.label}">${s.label}</button>`).join('')}</div>
        <div class="spec-et">份量</div>
        <div class="chips">${DRINK_SPECS.sizes.map((s) => `<button class="chip ${on(S.sizes, 'label', s.label)}" data-action="spec:toggle" data-g="sizes" data-v="${s.label}">${s.label}</button>`).join('')}</div>
        <div class="spec-et">小料（可多选）</div>
        <div class="chips">${DRINK_SPECS.toppings.map((t) => `<button class="chip ${on(S.toppings, 'name', t.name)}" data-action="spec:toggle" data-g="topping" data-v="${t.name}">${t.name}</button>`).join('')}</div>
        <div class="spec-add">
          <input id="spec-top-name" placeholder="自定义小料名">
          <input id="spec-top-kcal" placeholder="kcal" type="number" inputmode="numeric">
          <input id="spec-top-price" placeholder="¥" type="number" inputmode="numeric">
          <button class="btn small" data-action="spec:add-topping">+加</button>
        </div>
      </div>`;
  }
  const S = obj.specs || FOOD_SPECS;
  const on = (arr, key, val) => (arr && arr.find((x) => x[key] === val)) ? 'on' : '';
  return `
    <div class="spec-edit">
      <div class="spec-et">分量</div>
      <div class="chips">${FOOD_SPECS.portions.map((s) => `<button class="chip ${on(S.portions, 'label', s.label)}" data-action="spec:toggle" data-g="portions" data-v="${s.label}">${s.label}</button>`).join('')}</div>
      <div class="spec-et">辣度</div>
      <div class="chips">${FOOD_SPECS.spices.map((s) => `<button class="chip ${on(S.spices, 'label', s.label)}" data-action="spec:toggle" data-g="spices" data-v="${s.label}">${s.label}</button>`).join('')}</div>
    </div>`;
}

/* ============================================================
 * 编辑店铺
 * ============================================================ */
function openEditShop(shopId) {
  const s = SHOP_MAP[shopId]; if (!s) return;
  _editMode = 'shop';
  _es = { shopId, name: s.name, cat: s.category || '奶茶咖啡', img: s.image || '' };
  renderEditShop();
}
function renderEditShop() {
  const nEl = $('#sheet-root #es-name'); if (nEl) _es.name = nEl.value;
  const cats = ['奶茶咖啡', '咖啡', '汉堡炸鸡', '火锅', '烧烤', '快餐', '食堂', '外卖', '面包甜点', '其他'];
  openSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">✏️ 编辑店铺</div>
    <div class="edit-logo" data-action="edit:pick-shop">${_es.img ? `<img src="${_es.img}" alt="">` : (SHOP_MAP[_es.shopId].emoji || '🏪')}<span class="edit-logo-tip">点击换图</span></div>
    <label class="edit-label">店铺名称</label>
    <input class="edit-input" id="es-name" value="${esc(_es.name)}" placeholder="店铺名称" maxlength="20">
    <label class="edit-label">店铺分类</label>
    <div class="chips">${cats.map((c) => `<button class="chip ${_es.cat === c ? 'on' : ''}" data-action="edit:cat" data-v="${c}">${c}</button>`).join('')}</div>
    <button class="btn primary block" style="margin-top:18px" data-action="edit:save-shop">保存修改</button>
  `);
}
registerAction('edit:cat', (el) => { _es.cat = el.dataset.v; renderEditShop(); });
registerAction('edit:pick-shop', () => {
  pickEditImage((d) => {
    _es.img = d;
    const el = $('#sheet-root .edit-logo');
    if (el) el.innerHTML = `${d ? `<img src="${d}" alt="">` : (SHOP_MAP[_es.shopId].emoji || '🏪')}<span class="edit-logo-tip">点击换图</span>`;
  });
});
registerAction('edit:save-shop', async () => {
  const name = ($('#sheet-root #es-name').value || '').trim() || _es.name;
  const old = SHOP_MAP[_es.shopId].name;
  await saveEdit({ ek: 'shop:' + _es.shopId, kind: 'shop', shopId: _es.shopId, name, category: _es.cat, image: _es.img });
  await renameShopInFoods(old, name);
  await rebuildShops();
  closeSheet();
  renderPage('shop');
  toast('店铺信息已更新 ✓', 'green');
});

/* ============================================================
 * 编辑单品
 * ============================================================ */
function openEditItem(shopId, origName) {
  const s = SHOP_MAP[shopId]; if (!s) return;
  const it = s.items.find((x) => x.name === origName); if (!it) return;
  const isDrink = isDrinkItem(it);
  _editMode = 'item'; _specOwner = 'ei'; _specOpen = true;
  _ei = {
    shopId, origName, name: it.name, kcal: it.kcal, price: it.price,
    series: it.series || (isDrink ? '奶茶' : '其他'), status: it.status || '在售',
    img: it.image || '', specs: it._specs ? JSON.parse(JSON.stringify(it._specs)) : null,
    isDrink, isAdded: !!it._added
  };
  renderEditItem();
}
function renderEditItem() {
  const nEl = $('#sheet-root #ei-name'); if (nEl) _ei.name = nEl.value;
  const pEl = $('#sheet-root #ei-price'); if (pEl) _ei.price = pEl.value;
  const kEl = $('#sheet-root #ei-kcal'); if (kEl) _ei.kcal = kEl.value;
  const isDrink = _ei.isDrink;
  const cats = isDrink ? ['果茶', '奶茶', '纯茶', '咖啡', '其他'] : ['主食', '小吃', '甜点', '饮品', '其他'];
  openSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">✏️ 编辑产品</div>
    <div class="edit-logo" data-action="edit:pick-item">${_ei.img ? `<img src="${_ei.img}" alt="">` : (SHOP_MAP[_ei.shopId].emoji || '🍽️')}<span class="edit-logo-tip">点击换图</span></div>
    <label class="edit-label">产品名称</label>
    <input class="edit-input" id="ei-name" value="${esc(_ei.name)}" maxlength="30">
    <div class="edit-row">
      <div style="flex:1"><label class="edit-label">价格 ¥</label><input class="edit-input" id="ei-price" type="number" inputmode="decimal" value="${_ei.price}"></div>
      <div style="flex:1"><label class="edit-label">热量 kcal</label><input class="edit-input" id="ei-kcal" type="number" inputmode="numeric" value="${_ei.kcal}"></div>
    </div>
    <label class="edit-label">分类</label>
    <div class="chips">${cats.map((c) => `<button class="chip ${_ei.series === c ? 'on' : ''}" data-action="edit:series" data-v="${c}">${c}</button>`).join('')}</div>
    <label class="edit-label">状态</label>
    <div class="chips">
      <button class="chip ${_ei.status === '在售' ? 'on' : ''}" data-action="edit:status" data-v="在售">● 在售</button>
      <button class="chip ${_ei.status === '下架' ? 'on' : ''}" data-action="edit:status" data-v="下架">○ 已下架</button>
    </div>
    <div class="spec-collapsible">
      <div class="spec-et" data-action="edit:toggle-spec">规格选项（可增删）▾</div>
      <div class="spec-collapsible-body" style="display:${_specOpen ? '' : 'none'}">${specEditorHTML(_ei)}</div>
    </div>
    <div class="flex" style="gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="edit:del-item">🗑️ 删除</button>
      <button class="btn primary" data-action="edit:save-item">保存修改</button>
    </div>
  `);
}
registerAction('edit:series', (el) => { _ei.series = el.dataset.v; renderEditItem(); });
registerAction('edit:status', (el) => { _ei.status = el.dataset.v; renderEditItem(); });
registerAction('edit:toggle-spec', () => {
  _specOpen = !_specOpen;
  const b = $('#sheet-root .spec-collapsible-body');
  if (b) b.style.display = (_specOpen ? '' : 'none');
});
registerAction('edit:pick-item', () => {
  pickEditImage((d) => {
    _ei.img = d;
    const el = $('#sheet-root .edit-logo');
    if (el) el.innerHTML = `${d ? `<img src="${d}" alt="">` : (SHOP_MAP[_ei.shopId].emoji || '🍽️')}<span class="edit-logo-tip">点击换图</span>`;
  });
});
registerAction('edit:save-item', async () => {
  const name = ($('#sheet-root #ei-name').value || '').trim() || _ei.name;
  const price = Number($('#sheet-root #ei-price').value) || 0;
  const kcal = Number($('#sheet-root #ei-kcal').value) || 0;
  const shop = SHOP_MAP[_ei.shopId];
  const rec = {
    ek: 'item:' + _ei.shopId + '/' + _ei.origName, kind: 'item', shopId: _ei.shopId, origName: _ei.origName,
    name, price, kcal, series: _ei.series, status: _ei.status, image: _ei.img, specs: _ei.specs
  };
  if (_ei.isAdded) rec.added = true;
  await saveEdit(rec);
  await syncFoodsForEdit(shop.name, _ei.origName, { name, kcal, price, category: _ei.series });
  await rebuildShops();
  closeSheet();
  renderPage('shop');
  toast('产品已更新 ✓', 'green');
});
registerAction('edit:del-item', async () => {
  const shop = SHOP_MAP[_ei.shopId];
  const before = await getEdits();
  const matchEk = (e) => e.kind === 'item' && e.shopId === _ei.shopId && (e.origName === _ei.origName || e.name === _ei.origName || ('item:' + _ei.shopId + '/' + _ei.origName) === e.ek);
  const prev = before.find(matchEk);
  if (_ei.isAdded) {
    await delEdit('item:' + _ei.shopId + '/' + _ei.origName);
  } else {
    await saveEdit({ ek: 'item:' + _ei.shopId + '/' + _ei.origName, kind: 'item', shopId: _ei.shopId, origName: _ei.origName, status: 'deleted' });
  }
  await loadFoods();
  const orphanFoods = FOODS.filter((f) => f.name === _ei.origName && f.shop === shop.name && f.addedByUser);
  for (const f of orphanFoods) await deleteFood(f.id);
  await rebuildShops();
  closeSheet();
  renderPage('shop');
  toast('已删除该产品', 'brand', { undo: '撤销', onUndo: async () => {
    if (prev) await saveEdit(Object.assign({}, prev));
    for (const f of orphanFoods) await saveFood(f);
    await loadFoods();
    await rebuildShops();
    renderPage('shop');
    toast('已恢复 ✓', 'green');
  }});
});

/* ============================================================
 * 新增单品
 * ============================================================ */
function openAddItem(shopId) {
  const s = SHOP_MAP[shopId]; if (!s) return;
  const isDrink = s.cat === '奶茶咖啡' || !!BRANDS.find((b) => b.id === shopId);
  _editMode = 'new'; _specOwner = 'en'; _specOpen = false;
  _en = { shopId, name: '', kcal: '', price: '', series: isDrink ? '奶茶' : '其他', img: '', specs: null, isDrink };
  renderAddItem();
}
function renderAddItem() {
  const nEl = $('#sheet-root #en-name'); if (nEl) _en.name = nEl.value;
  const pEl = $('#sheet-root #en-price'); if (pEl) _en.price = pEl.value;
  const kEl = $('#sheet-root #en-kcal'); if (kEl) _en.kcal = kEl.value;
  const isDrink = _en.isDrink;
  const cats = isDrink ? ['果茶', '奶茶', '纯茶', '咖啡', '其他'] : ['主食', '小吃', '甜点', '饮品', '其他'];
  openSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">➕ 新增产品</div>
    <div class="edit-logo" data-action="edit:pick-new">${_en.img ? `<img src="${_en.img}" alt="">` : '📷'}<span class="edit-logo-tip">点击添加图片</span></div>
    <label class="edit-label">产品名称 *</label>
    <input class="edit-input" id="en-name" value="${esc(_en.name)}" placeholder="必填，如：多肉葡萄" maxlength="30">
    <div class="edit-row">
      <div style="flex:1"><label class="edit-label">价格 ¥ *</label><input class="edit-input" id="en-price" type="number" inputmode="decimal" value="${_en.price}"></div>
      <div style="flex:1"><label class="edit-label">热量 kcal *</label><input class="edit-input" id="en-kcal" type="number" inputmode="numeric" value="${_en.kcal}"></div>
    </div>
    <label class="edit-label">分类 *</label>
    <div class="chips">${cats.map((c) => `<button class="chip ${_en.series === c ? 'on' : ''}" data-action="edit:new-series" data-v="${c}">${c}</button>`).join('')}</div>
    <div class="spec-collapsible">
      <div class="spec-et" data-action="edit:toggle-spec">规格选项（选填）▾</div>
      <div class="spec-collapsible-body" style="display:${_specOpen ? '' : 'none'}">${specEditorHTML(_en)}</div>
    </div>
    <button class="btn primary block" style="margin-top:18px" data-action="edit:save-new">确认添加</button>
  `);
}
registerAction('edit:new-series', (el) => { _en.series = el.dataset.v; renderAddItem(); });
registerAction('edit:pick-new', () => {
  pickEditImage((d) => {
    _en.img = d;
    const el = $('#sheet-root .edit-logo');
    if (el) el.innerHTML = `${d ? `<img src="${d}" alt="">` : '📷'}<span class="edit-logo-tip">点击添加图片</span>`;
  });
});
registerAction('edit:save-new', async () => {
  const name = ($('#sheet-root #en-name').value || '').trim();
  const priceV = ($('#sheet-root #en-price').value || '').trim();
  const kcalV = ($('#sheet-root #en-kcal').value || '').trim();
  if (!name || priceV === '' || kcalV === '' || isNaN(Number(priceV)) || isNaN(Number(kcalV))) { toast('请填写名称、价格、热量', 'red'); return; }
  const price = Number(priceV), kcal = Number(kcalV);
  const shop = SHOP_MAP[_en.shopId];
  await saveEdit({
    ek: 'item:' + _en.shopId + '/' + name, kind: 'item', shopId: _en.shopId, origName: name,
    name, price, kcal, series: _en.series, status: '在售', image: _en.img, specs: _en.specs, added: true
  });
  await rebuildShops();
  // 同步进「我的食谱」（带用户新增标记）
  await upsertShopFood(name, kcal, price, shop.name, _en.shopId);
  await loadFoods();
  const f = FOODS.find((x) => x.name === name && x.shop === shop.name && !x.isSeed);
  if (f) { f.addedByUser = true; f.category = _en.series; f.updatedAt = nowISO(); await saveFood(f); }
  closeSheet();
  renderPage('shop');
  toast('已新增「' + name + '」并存入食谱 ⭐', 'green');
});

/* ============================================================
 * 单品 ⋯ 菜单（编辑 / 下架切换 / 删除）
 * ============================================================ */
function openItemMenu(shopId, i) {
  const s = SHOP_MAP[shopId]; if (!s) return;
  const it = s.items[i]; if (!it) return;
  const down = it.status === '下架';
  openSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">${esc(it.name)}</div>
    <div class="menu-actions">
      <button class="menu-act" data-action="item:edit2" data-id="${shopId}" data-name="${esc(it.name)}">✏️ 编辑</button>
      <button class="menu-act" data-action="item:toggle-down" data-id="${shopId}" data-i="${i}">${down ? '⤴️ 上架' : '⤵️ 下架'}</button>
      <button class="menu-act danger" data-action="item:del" data-id="${shopId}" data-i="${i}">🗑️ 删除</button>
    </div>
  `);
}
registerAction('item:edit2', (el) => openEditItem(el.dataset.id, el.dataset.name));
registerAction('item:toggle-down', async (el) => {
  const shopId = el.dataset.id; const i = Number(el.dataset.i);
  const it = SHOP_MAP[shopId].items[i]; if (!it) return;
  const down = it.status === '下架';
  const newStatus = down ? '在售' : '下架';
  const rec = {
    ek: 'item:' + shopId + '/' + it.name, kind: 'item', shopId, origName: it.name,
    name: it.name, kcal: it.kcal, price: it.price, series: it.series, category: it.category,
    image: it.image || '', status: newStatus, specs: it._specs
  };
  if (it._added) rec.added = true;
  await saveEdit(rec);
  await rebuildShops();
  closeSheet();
  renderPage('shop');
  toast(down ? '已上架' : '已下架', 'brand');
});
registerAction('item:del', async (el) => {
  const shopId = el.dataset.id; const i = Number(el.dataset.i);
  const it = SHOP_MAP[shopId].items[i]; if (!it) return;
  const shop = SHOP_MAP[shopId];
  const before = await getEdits();
  const matchEk = (e) => e.kind === 'item' && e.shopId === shopId && (e.origName === it.name || e.name === it.name || ('item:' + shopId + '/' + it.name) === e.ek);
  const prev = before.find(matchEk);
  if (it._added) {
    await delEdit('item:' + shopId + '/' + it.name);
  } else {
    await saveEdit({ ek: 'item:' + shopId + '/' + it.name, kind: 'item', shopId, origName: it.name, status: 'deleted' });
  }
  // 同步清理「我的食谱」中由该单品生成的食物，避免孤儿数据
  await loadFoods();
  const orphanFoods = FOODS.filter((f) => f.name === it.name && f.shop === shop.name && f.addedByUser);
  for (const f of orphanFoods) await deleteFood(f.id);
  await rebuildShops();
  closeSheet();
  renderPage('shop');
  toast('已删除该产品', 'brand', { undo: '撤销', onUndo: async () => {
    if (prev) await saveEdit(Object.assign({}, prev));
    for (const f of orphanFoods) await saveFood(f);
    await loadFoods();
    await rebuildShops();
    renderPage('shop');
    toast('已恢复 ✓', 'green');
  }});
});

/* ============================================================
 * 规格编辑器交互（toggle / 自定义小料）
 * ============================================================ */
registerAction('spec:toggle', (el) => {
  ensureSpecs();
  const g = el.dataset.g, v = el.dataset.v;
  const S = _specOwner === 'ei' ? _ei.specs : _en.specs;
  if (g === 'topping') {
    const i = S.toppings.findIndex((t) => t.name === v);
    if (i >= 0) S.toppings.splice(i, 1);
    else { const d = DRINK_SPECS.toppings.find((t) => t.name === v); if (d) S.toppings.push({ name: d.name, kcal: d.kcal, price: d.price }); }
  } else {
    const arr = S[g];
    const i = arr.findIndex((x) => x.label === v);
    if (i >= 0) arr.splice(i, 1);
    else {
      const pool = g === 'sweetness' ? DRINK_SPECS.sweetness : g === 'temperature' ? DRINK_SPECS.temperature : g === 'sizes' ? DRINK_SPECS.sizes : g === 'portions' ? FOOD_SPECS.portions : FOOD_SPECS.spices;
      const d = pool.find((x) => x.label === v); if (d) arr.push({ ...d });
    }
  }
  rerenderEditSheet();
});
registerAction('spec:add-topping', () => {
  ensureSpecs();
  const S = _specOwner === 'ei' ? _ei.specs : _en.specs;
  if (!S.toppings) S.toppings = [];
  const n = ($('#sheet-root #spec-top-name').value || '').trim();
  const k = Number($('#sheet-root #spec-top-kcal').value) || 0;
  const p = Number($('#sheet-root #spec-top-price').value) || 0;
  if (!n) { toast('请输入小料名', 'red'); return; }
  if (!S.toppings.find((t) => t.name === n)) S.toppings.push({ name: n, kcal: k, price: p });
  rerenderEditSheet();
});

/* ============================================================
 * 入口（觅食店铺详情页调用）
 * ============================================================ */
registerAction('shop:edit', (el) => openEditShop(el.dataset.id));
registerAction('shop:add', () => openAddItem(SHOP_VIEW.id));
registerAction('item:menu', (el) => openItemMenu(SHOP_VIEW.id, Number(el.dataset.i)));
