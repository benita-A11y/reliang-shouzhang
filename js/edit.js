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

/* ---------- 把编辑合并进 SHOP_MAP ---------- */
async function applyShopEdits() {
  const edits = await getEdits();
  // 店铺级
  edits.filter((e) => e.kind === 'shop').forEach((e) => {
    const s = SHOP_MAP[e.shopId]; if (!s) return;
    if (e.name != null) s.name = e.name;
    if (e.category != null) s.category = e.category;
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
    await saveFood(f);
  }
}
async function renameShopInFoods(oldName, newName) {
  if (oldName === newName) return;
  await loadFoods();
  const matches = FOODS.filter((f) => f.shop === oldName);
  for (const f of matches) { f.shop = newName; f.updatedAt = nowISO(); await saveFood(f); }
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
  if (_ei.isAdded) {
    await delEdit('item:' + _ei.shopId + '/' + _ei.origName);
  } else {
    await saveEdit({ ek: 'item:' + _ei.shopId + '/' + _ei.origName, kind: 'item', shopId: _ei.shopId, origName: _ei.origName, status: 'deleted' });
  }
  await rebuildShops();
  closeSheet();
  renderPage('shop');
  toast('已删除该产品', 'brand');
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
  if (it._added) {
    await delEdit('item:' + shopId + '/' + it.name);
  } else {
    await saveEdit({ ek: 'item:' + shopId + '/' + it.name, kind: 'item', shopId, origName: it.name, status: 'deleted' });
  }
  await rebuildShops();
  closeSheet();
  renderPage('shop');
  toast('已删除该产品', 'brand');
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
