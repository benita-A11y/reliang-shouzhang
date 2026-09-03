/* ============================================================
 * 热量手账 · 页面组5：🎯 今天吃什么（大转盘）
 * 纯娱乐随机决策：地方分类 + 食物自定义 + 本地保存 + 转盘抽取
 * 不显示热量、不联动首页/食谱/账单。
 * ============================================================ */
'use strict';

const WHEEL = { data: null, place: 0, edit: false, spinning: false, angle: 0, _suppressUntil: 0, _foodI: null, _renameI: null };
const WHEEL_COLORS = ['#FFCDD0', '#FFB74D', '#FFE939', '#65B66A', '#80DEEA', '#64B3F6', '#B39DDB', '#EF9A9A', '#FFEBEC', '#FFF7C4', '#C8E6C9', '#E0F7FA', '#E3F2FD', '#EDE7F6', '#FFF3E0', '#FC6600', '#0096A7', '#5C33B1', '#E53733', '#2E7D32'];
const WHEEL_PLACE_EMOJI = ['🏫', '🏬', '🍢', '🍽️', '🎪', '🌮', '🏞️', '☕', '🍜', '🛍️'];
const WHEEL_FOOD_EMOJIS = ['🍜', '🍛', '🍗', '🍚', '🍝', '🥗', '🍲', '🥟', '🍢', '🫓', '🌶️', '🍳', '🥘', '🍣', '🍖', '🍔', '🍕', '🌭', '🥪', '🍱'];

/* ============================================================
 * 页面渲染
 * ============================================================ */
registerPage('wheel', async function (root) {
  if (!WHEEL.data) WHEEL.data = await getWheelData();
  if (WHEEL.place >= WHEEL.data.places.length) WHEEL.place = Math.max(0, WHEEL.data.places.length - 1);
  if (WHEEL.data.places.length === 0) WHEEL.data.places.push({ id: 'w-' + Date.now(), name: '食堂', emoji: '🏫', foods: [] });
  const p = WHEEL.data.places[WHEEL.place];
  root.innerHTML = `
    <div class="shop-detail-head">
      <button class="shop-back" data-action="wheel:back" aria-label="返回">←</button>
      <div class="shop-detail-title">🎯 今天吃什么</div>
      <div style="width:34px"></div>
    </div>
    <div class="cat-scroll wheel-bar" id="wheel-bar">${renderPlaceChips()}</div>
    <div class="wheel-stage">
      <div class="wheel-pointer">▼</div>
      <div class="wheel-disc" id="wheel-disc"><canvas id="wheel-canvas"></canvas></div>
      <button class="btn primary lg wheel-spin-btn" data-action="wheel:spin">🎰 抽！</button>
      <div class="wheel-tip muted small">${p.foods.length > 0 ? `共 ${p.foods.length} 个选择 · 让命运帮你选` : '先添加几个食物吧'}</div>
    </div>
    ${renderFoodCard(p)}
  `;
  drawWheel();
  bindWheelGestures(root);
});

function renderPlaceChips() {
  const list = WHEEL.data.places.map((p, i) => `
    <button class="chip wheel-place ${WHEEL.place === i ? 'on orange' : ''}" data-action="wheel:place" data-i="${i}">${p.emoji || '📍'} ${esc(p.name)}</button>`).join('');
  return list + `<button class="chip wheel-add" data-action="wheel:add-place">＋ 新增</button>`;
}

function renderFoodCard(p) {
  const rows = p.foods.map((f, i) => `
    <div class="wheel-food">
      <span class="wf-emoji">${f.emoji || '🍽️'}</span>
      <span class="wf-name">${esc(f.name)}</span>
      ${WHEEL.edit ? `
        <button class="wf-btn" data-action="wheel:food-edit" data-i="${i}" aria-label="编辑">✏️</button>
        <button class="wf-btn wf-del" data-action="wheel:food-del" data-i="${i}" aria-label="删除">🗑️</button>` : ''}
    </div>`).join('');
  return `
    <div class="card">
      <div class="wheel-card-head">
        <div class="wheel-card-title">📍 当前：<b>${esc(p.name)}</b>（${p.foods.length} 个食物）</div>
        <button class="btn ghost sm" data-action="wheel:edit-toggle">${WHEEL.edit ? '✅ 完成' : '✏️ 编辑'}</button>
      </div>
      <div class="wheel-food-list">${rows || '<div class="muted small" style="padding:14px;text-align:center">还没有食物，点下方添加～</div>'}</div>
      <button class="btn ghost block wheel-add-food-btn" data-action="wheel:food-add">＋ 添加食物</button>
    </div>`;
}

/* ============================================================
 * 大转盘绘制（canvas 扇形）
 * ============================================================ */
function drawWheel() {
  const canvas = $('#wheel-canvas');
  if (!canvas) return;
  const foods = WHEEL.data.places[WHEEL.place].foods;
  const n = Math.max(2, Math.min(foods.length, 20));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const SIZE = 300;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2, cy = SIZE / 2, R = SIZE / 2 - 8;
  const sweep = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const start = -Math.PI / 2 + i * sweep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start, start + sweep);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const f = foods[i];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + sweep / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    if (f) {
      const fs = Math.min(15, Math.max(10, Math.floor(150 / n)));
      ctx.font = `bold ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      const name = f.name.length > 5 ? f.name.slice(0, 5) + '…' : f.name;
      ctx.fillText(name, R * 0.52, 0);
      ctx.font = `${Math.min(22, Math.max(15, Math.floor(170 / n)))}px serif`;
      ctx.fillText(f.emoji || '🍽️', R * 0.86, 0);
    } else {
      ctx.font = 'bold 12px "PingFang SC",sans-serif';
      ctx.fillText('—', R * 0.52, 0);
    }
    ctx.restore();
  }
  // 中心圆 + 装饰
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 36);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(1, '#fff2e6');
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,149,0,.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = '19px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎯', cx, cy + 1);
}

/* ============================================================
 * 转盘旋转 + 结果
 * ============================================================ */
function spinWheel() {
  if (WHEEL.spinning) return;
  const p = WHEEL.data.places[WHEEL.place];
  const foods = p.foods;
  const n = foods.length;
  if (n < 2) { toast('至少添加 2 个食物才能抽 🎰', 'red'); return; }
  const idx = Math.floor(Math.random() * n);
  const sweep = 360 / n;
  // 目标：使 idx 扇区中心对准顶部指针（0°=顶部）
  const target = (360 - (idx + 0.5) * sweep + 360) % 360;
  const spins = 5 + Math.floor(Math.random() * 3);
  const total = WHEEL.angle + spins * 360 + ((target - (WHEEL.angle % 360) + 360) % 360);
  WHEEL.angle = total;
  WHEEL.spinning = true;
  const disc = $('#wheel-disc');
  const btn = $('#wheel-spin');
  if (btn) btn.disabled = true;
  disc.style.transition = 'transform 4.4s cubic-bezier(.12,.72,.1,1)';
  disc.style.transform = `rotate(${total}deg)`;
  setTimeout(() => {
    WHEEL.spinning = false;
    if (btn) btn.disabled = false;
    showWheelResult(idx);
  }, 4450);
}

function showWheelResult(idx) {
  const p = WHEEL.data.places[WHEEL.place];
  const f = p.foods[idx];
  if (!f) return;
  openModal(`
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:46px;line-height:1">${f.emoji || '🍽️'}</div>
      <div class="modal-title" style="font-size:22px;margin-top:6px">🎉 今天就吃这个！</div>
      <div style="font-size:19px;font-weight:800;margin:10px 0 4px">${esc(f.name)}</div>
      <div class="muted small">来自 ${esc(p.name)}</div>
    </div>
    <div class="flex" style="gap:10px;margin-top:18px">
      <button class="btn primary" style="flex:1" data-action="wheel:result-go">确定！就去吃</button>
      <button class="btn ghost" style="flex:1" data-action="wheel:result-again">再抽一次</button>
    </div>`);
}

/* ============================================================
 * 手势绑定：长按删除 / 双击重命名 / 拖动排序（分类 chip）
 * ============================================================ */
function bindWheelGestures(root) {
  const bar = root.querySelector('#wheel-bar');
  if (!bar) return;
  let drag = null;
  let pressTimer = null;
  bar.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest('.wheel-place');
    if (!chip) return;
    const i = Number(chip.dataset.i);
    drag = { chip, i, startX: e.clientX, startY: e.clientY, moved: false };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (drag && !drag.moved) { drag.suppressed = true; confirmDelPlace(i); }
    }, 600);
    try { chip.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag || drag.moved) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 8) {
      drag.moved = true;
      clearTimeout(pressTimer);
      drag.chip.classList.add('dragging');
      drag.chip.style.transform = `translateX(${dx}px)`;
    }
  });
  const endDrag = (e) => {
    if (!drag) return;
    clearTimeout(pressTimer);
    if (drag.moved) {
      const dx = e.clientX - drag.startX;
      const step = Math.round(dx / 92);
      const from = drag.i;
      const to = Math.max(0, Math.min(WHEEL.data.places.length - 1, from + step));
      if (to !== from) {
        const [m] = WHEEL.data.places.splice(from, 1);
        WHEEL.data.places.splice(to, 0, m);
        WHEEL.place = to;
        saveWheelData(WHEEL.data);
      }
      drag.chip.classList.remove('dragging');
      drag.chip.style.transform = '';
      drag = null;
      WHEEL._suppressUntil = Date.now() + 350;
      rerender();
      return;
    }
    const longPressed = !!drag.suppressed;
    drag = null;
    if (longPressed) WHEEL._suppressUntil = Date.now() + 350;
  };
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
  bar.addEventListener('dblclick', (e) => {
    const chip = e.target.closest('.wheel-place');
    if (!chip) return;
    clearTimeout(pressTimer);
    drag = null;
    WHEEL._suppressUntil = Date.now() + 350;
    renamePlace(Number(chip.dataset.i));
  });
}

/* ============================================================
 * Actions
 * ============================================================ */
registerAction('wheel:back', () => switchPage('home'));

registerAction('wheel:place', (el) => {
  if (Date.now() < WHEEL._suppressUntil) return;
  WHEEL.place = Number(el.dataset.i);
  rerender();
});

/* ---- 地方分类：新增 / 删除 / 重命名 ---- */
registerAction('wheel:add-place', () => {
  openModal(`
    <div class="modal-title">➕ 新增地方分类</div>
    <div class="field" style="margin-top:14px">
      <label>地方名称</label>
      <input id="wheel-place-input" class="input" maxlength="8" placeholder="如：夜市、美食城…">
    </div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn primary" data-action="wheel:add-place-go">添加</button>
    </div>`);
  setTimeout(() => { const i = $('#wheel-place-input'); if (i) i.focus(); }, 80);
});
registerAction('wheel:add-place-go', async () => {
  const v = ($('#wheel-place-input').value || '').trim();
  if (!v) { toast('请输入地方名称', 'red'); return; }
  if (WHEEL.data.places.some((p) => p.name === v)) { toast('已存在同名地方', 'red'); return; }
  const emoji = WHEEL_PLACE_EMOJI[WHEEL.data.places.length % WHEEL_PLACE_EMOJI.length];
  WHEEL.data.places.push({ id: 'w-' + Date.now() + '-' + Math.floor(Math.random() * 999), name: v, emoji, foods: [] });
  WHEEL.place = WHEEL.data.places.length - 1;
  await saveWheelData(WHEEL.data);
  closeModal();
  rerender();
  toast(`已添加「${v}」`, 'green');
});

function confirmDelPlace(i) {
  const p = WHEEL.data.places[i];
  if (!p) return;
  openModal(`
    <div class="modal-title">删除「${esc(p.name)}」？</div>
    <div class="modal-sub">该地方下的 ${p.foods.length} 个食物将一并删除，不可恢复。</div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn primary" data-action="wheel:del-place-go" data-i="${i}">删除</button>
    </div>`);
}
registerAction('wheel:del-place-go', async (el) => {
  const i = Number(el.dataset.i);
  WHEEL.data.places.splice(i, 1);
  if (WHEEL.place >= WHEEL.data.places.length) WHEEL.place = Math.max(0, WHEEL.data.places.length - 1);
  await saveWheelData(WHEEL.data);
  closeModal();
  rerender();
  toast('已删除', 'green');
});

function renamePlace(i) {
  const p = WHEEL.data.places[i];
  if (!p) return;
  WHEEL._renameI = i;
  openModal(`
    <div class="modal-title">✏️ 重命名地方</div>
    <div class="field" style="margin-top:14px">
      <input id="wheel-place-input" class="input" maxlength="8" value="${esc(p.name)}">
    </div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn primary" data-action="wheel:rename-place-go">保存</button>
    </div>`);
  setTimeout(() => { const i = $('#wheel-place-input'); if (i) { i.focus(); i.select(); } }, 80);
}
registerAction('wheel:rename-place-go', async () => {
  const v = ($('#wheel-place-input').value || '').trim();
  const i = WHEEL._renameI;
  if (!v) { toast('名称不能为空', 'red'); return; }
  if (WHEEL.data.places[i]) {
    WHEEL.data.places[i].name = v;
    await saveWheelData(WHEEL.data);
    rerender();
  }
  closeModal();
  toast('已重命名', 'green');
});

/* ---- 食物：添加 / 编辑 / 删除 ---- */
registerAction('wheel:food-add', () => openFoodModal(null));
registerAction('wheel:food-edit', (el) => openFoodModal(Number(el.dataset.i)));

function openFoodModal(i) {
  const p = WHEEL.data.places[WHEEL.place];
  const f = i != null ? p.foods[i] : null;
  WHEEL._foodI = i;
  openModal(`
    <div class="modal-title">${f ? '✏️ 编辑食物' : '➕ 添加食物'}</div>
    <div class="field" style="margin-top:14px">
      <label>食物名称</label>
      <input id="wheel-food-input" class="input" maxlength="8" value="${f ? esc(f.name) : ''}" placeholder="如：麻辣烫">
    </div>
    <div class="field">
      <label>图标（可选）</label>
      <div class="emoji-grid">${WHEEL_FOOD_EMOJIS.map((e) => `<button class="emoji-opt ${f && f.emoji === e ? 'on' : ''}" data-emoji="${e}" data-action="wheel:emoji-pick">${e}</button>`).join('')}</div>
    </div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn primary" data-action="wheel:food-go">保存</button>
    </div>`);
  setTimeout(() => { const i = $('#wheel-food-input'); if (i) i.focus(); }, 80);
}
registerAction('wheel:emoji-pick', (el) => {
  const on = document.querySelector('.emoji-grid .on');
  if (on) on.classList.remove('on');
  el.classList.add('on');
});
registerAction('wheel:food-go', async () => {
  const v = ($('#wheel-food-input').value || '').trim();
  if (!v) { toast('请输入食物名称', 'red'); return; }
  const pick = document.querySelector('.emoji-grid .on');
  const emoji = pick ? pick.dataset.emoji : '🍽️';
  const p = WHEEL.data.places[WHEEL.place];
  if (WHEEL._foodI != null && p.foods[WHEEL._foodI]) {
    p.foods[WHEEL._foodI].name = v;
    p.foods[WHEEL._foodI].emoji = emoji;
  } else {
    p.foods.push({ id: 'w-' + Date.now() + '-' + Math.floor(Math.random() * 999), name: v, emoji });
  }
  await saveWheelData(WHEEL.data);
  closeModal();
  rerender();
  toast('已保存 ✅', 'green');
});

registerAction('wheel:food-del', (el) => {
  const i = Number(el.dataset.i);
  const p = WHEEL.data.places[WHEEL.place];
  const f = p.foods[i];
  if (!f) return;
  openModal(`
    <div class="modal-title">删除「${esc(f.name)}」？</div>
    <div class="modal-sub">删除后该食物将从转盘中移除。</div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn primary" data-action="wheel:food-del-go" data-i="${i}">删除</button>
    </div>`);
});
registerAction('wheel:food-del-go', async (el) => {
  const i = Number(el.dataset.i);
  WHEEL.data.places[WHEEL.place].foods.splice(i, 1);
  await saveWheelData(WHEEL.data);
  closeModal();
  rerender();
  toast('已删除', 'green');
});

/* ---- 编辑模式切换 ---- */
registerAction('wheel:edit-toggle', () => { WHEEL.edit = !WHEEL.edit; rerender(); });

/* ---- 转盘：抽奖 / 结果 ---- */
registerAction('wheel:spin', () => spinWheel());
registerAction('wheel:result-go', () => { closeModal(); toast('🎉 就去吃它！', 'green'); });
registerAction('wheel:result-again', () => { closeModal(); setTimeout(spinWheel, 150); });
