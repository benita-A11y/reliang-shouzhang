/* ============================================================
 * 热量手账 · 页面组1：首页 / 记录 / 我的食谱
 * ============================================================ */
'use strict';

/* 问候 Emoji（与 greeting() 文字搭配） */
function greetEmoji() {
  const h = new Date().getHours();
  if (h < 6) return '🌙';
  if (h < 11) return '🌞';
  if (h < 14) return '🍱';
  if (h < 18) return '☕';
  return '🌆';
}

/* ============================================================
 * 首页（今日仪表盘）
 * ============================================================ */
registerPage('home', async function (root) {
  const today = todayKey();
  const stats = await getDayStats(today);
  const dayInfo = await getDayInfo(today);
  const exStats = await getExerciseStats(today);
  const streak = await getStreak();
  const weights = await getWeights();
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const prevWeight = weights.length > 1 ? weights[weights.length - 2] : null;
  const target = PROFILE.targetKcal || 1800;
  const burned = exStats.kcal;
  const budget = target + burned;                      // 目标 + 运动 = 今日可摄入额度
  const remaining = Math.max(0, budget - stats.kcal);
  const mt = macroTargets(PROFILE, target);
  const pct = Math.min(1, stats.kcal / budget);
  const ringColor = remaining / target > 0.5 ? '#34C759' : remaining / target > 0.2 ? '#FF9500' : '#FF3B30';
  const waterTarget = PROFILE.waterTarget || 8;
  const water = dayInfo.water || 0;
  const weightDiff = latestWeight && prevWeight ? +(latestWeight.kg - prevWeight.kg).toFixed(1) : null;
  const weightSub = !latestWeight ? '记录今日体重'
    : !prevWeight ? '今日已记录 ✓'
    : weightDiff > 0 ? `较上次 ↑ ${weightDiff}kg`
    : weightDiff < 0 ? `较上次 ↓ ${Math.abs(weightDiff)}kg`
    : '与上次持平';

  await loadFoods();                                   // 保证食谱数量/最近添加准确
  const groups = { breakfast: [], lunch: [], dinner: [], snack: [] };
  stats.records.forEach((r) => { if (groups[r.meal]) groups[r.meal].push(r); });
  const needCount = Math.max(0, 5 - FOODS.length);
  const recentAdded = [...FOODS].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
  const C = 2 * Math.PI * 100;

  root.innerHTML = `
    <div class="home-head">
      <div class="hh-date">${fmtDateCN(new Date())}</div>
      <div class="hh-meta">
        ${streak > 0 ? `🔥 连续打卡 ${streak} 天` : '🔥 连续打卡 0 天'}
        <span class="hh-dot">·</span>
        <span class="hh-record" data-action="nav:go" data-page="record">📷 去记录</span>
      </div>
    </div>
    <!-- ① 核心：今日剩余热量大圆环（自适应 · 绝对居中 · 第一视觉重心） -->
    <div class="card home-ring">
      <div class="ring-wrap lg" role="img" aria-label="今日剩余热量 ${remaining} kcal">
        <svg viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet">
          <circle cx="120" cy="120" r="100" fill="none" stroke="#E9E9EC" stroke-width="17"/>
          <circle cx="120" cy="120" r="100" fill="none" stroke="${ringColor}" stroke-width="17" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" style="transition:stroke-dashoffset .8s cubic-bezier(.25,.8,.35,1),stroke .4s"/>
        </svg>
        <div class="ring-center">
          <div class="rc-block">
            <span class="rc-num">${remaining.toLocaleString()}</span>
            <span class="rc-unit">kcal</span>
          </div>
          <div class="rc-label">今日剩余热量</div>
        </div>
      </div>
      <div class="rc-foot" style="color:${ringColor}">目标 ${target}kcal · 已吃 ${stats.kcal}kcal${burned ? ' · 运动 +' + burned : ''}</div>
      <!-- ② 三大营养素：距圆环 24pt；蛋白紫 / 碳水蓝 / 脂肪橙 -->
      <div class="macro-box">
        ${[['protein', '蛋白质', '#AF52DE', stats.protein, mt.protein], ['carbs', '碳水', '#007AFF', stats.carbs, mt.carbs], ['fat', '脂肪', '#FF9500', stats.fat, mt.fat]].map(([k, label, color, val, tgt]) => `
          <div class="macro-row">
            <div class="macro-label"><span class="macro-dot" style="background:${color}"></span>${label}</div>
            <div class="macro-track"><div class="macro-fill" style="width:${Math.min(100, (val / tgt) * 100)}%;background:${color}"></div></div>
            <div class="macro-val"><b>${val}</b>/${tgt}g</div>
          </div>`).join('')}
      </div>
    </div>
    <!-- ④ 今日已吃三餐汇总 -->
    <div class="section-title eaten-title">📋 今日已吃 <span class="small muted" style="font-weight:500">共 ${stats.count} 样 · ${stats.kcal}kcal</span></div>
    <div class="card eaten-card">
      ${MEALS.map((m) => `
        <div class="meal-block">
          <div class="meal-head">
            <span class="meal-emoji">${m.emoji}</span><span class="meal-name">${m.label}</span>
            <span class="meal-kcal"><b>${groups[m.k].reduce((a, r) => a + r.kcal, 0)}</b> kcal</span>
          </div>
          ${groups[m.k].length ? groups[m.k].map((r) => `
            <div class="food-line">
              <div class="fl-photo">${photoHTML(r)}</div>
              <div class="fl-info"><div class="fl-name">${esc(r.foodName)}</div>
                <div class="fl-meta">${esc(r.portion || '')}${r.shop ? ' · ' + esc(r.shop) : ''}</div></div>
              <div class="fl-kcal">${r.kcal}kcal</div>
              <div class="fl-edit" data-action="rec:edit" data-id="${r.id}" aria-label="修改">✎</div>
              <div class="fl-del" data-action="rec:del" data-id="${r.id}">✕</div>
            </div>`).join('') : `<div class="muted small" style="padding:6px 2px 10px">${m.k === 'breakfast' ? '🌅 记得吃早餐哦' : '→ 去觅食看看吃什么'}</div>`}
        </div>`).join('')}
      <div class="view-full" data-action="nav:go" data-page="board">查看完整记录 →</div>
    </div>
    <!-- ⑤ 辅助功能：饮水 / 运动 / 体重 -->
    <div class="section-title">🧰 生活小记</div>
    <div class="stats-grid">
      <div class="card stat-card">
        <div class="sc-top">
          <span class="sc-icon">💧</span><span class="sc-name">饮水</span>
          <span class="sc-ctl">
            <b class="sc-btn" data-action="home:water-add">＋</b>
            <b class="sc-btn" data-action="home:water-sub">−</b>
          </span>
        </div>
        <div class="sc-num">${water}<small>/${waterTarget}杯</small></div>
        <div class="sc-bar"><i style="width:${Math.min(100, (water / waterTarget) * 100)}%"></i></div>
        <div class="sc-sub">${water >= waterTarget ? '今日目标达成 🎉' : '还差 ' + (waterTarget - water) + ' 杯'}</div>
      </div>
      <div class="card stat-card" data-action="home:sport">
        <div class="sc-top"><span class="sc-icon">🏃</span><span class="sc-name">运动</span></div>
        <div class="sc-num">${burned}<small>kcal</small></div>
        <div class="sc-sub">${exStats.count ? `${exStats.count} 项 · ${exStats.minutes}分钟` : '记录运动消耗'}</div>
      </div>
      <div class="card stat-card" data-action="home:weight">
        <div class="sc-top"><span class="sc-icon">⚖️</span><span class="sc-name">体重</span></div>
        <div class="sc-num">${latestWeight ? latestWeight.kg : '—'}<small>kg</small></div>
        <div class="sc-sub">${weightSub}</div>
      </div>
    </div>
    ${needCount > 0 ? `
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:16px 18px">
      <div style="font-size:26px">📘</div>
      <div style="flex:1;font-size:13px;line-height:1.55">
        <b>前期建食谱，后期闭眼记。</b>
        <div class="muted small">再录 ${needCount} 样，就能开启「闭眼记」模式！</div>
      </div>
      <button class="btn sm" data-action="nav:go" data-page="recipes">去建库</button>
    </div>` : ''}
    <!-- ⑥ 食谱库入口 -->
    <div class="card home-recipes" data-action="nav:go" data-page="recipes">
      <div class="hr-head">
        <span class="hr-emoji">📖</span><b>食谱库</b>
        <span class="hr-count">共 ${FOODS.length} 样食物</span>
        <span class="hr-arrow">→</span>
      </div>
      <div class="hr-recent-label">最近添加</div>
      <div class="hr-recent">
        ${recentAdded.length ? recentAdded.map((f) => `
          <div class="hr-card" data-action="food:detail" data-id="${f.id}">
            <div class="hr-thumb">${f.photo ? `<img src="${f.photo}" alt="">` : `<span class="fc-initial" style="background:${foodTint(f.name)}">${esc((f.name || '?').trim().charAt(0))}</span>`}</div>
            <div class="hr-name">${esc(f.name)}</div>
            <div class="hr-kcal">${dkr(f.kcal)}</div>
          </div>`).join('') : `<div class="hr-empty">还没有添加，去「我的食谱」建库 →</div>`}
      </div>
    </div>
    <div style="height:12px"></div>`;
});

async function getRecentSix() {
  const recs = await getRecords();
  const seen = new Set();
  const recent = [];
  for (const r of recs) {
    const key = r.foodName + (r.shop || '');
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push({ name: r.foodName, kcal: r.kcal, photo: r.foodPhoto, ago: daysAgoText(r.date), id: r.foodId, shop: r.shop, category: r.category, portion: r.portion, macros: r.macros, price: r.price });
    if (recent.length >= 6) break;
  }
  let i = 0;
  while (recent.length < 6 && FOODS.length && i < FOODS.length) {
    const f = FOODS[i++];
    if (seen.has(f.name + (f.shop || ''))) continue;
    seen.add(f.name + (f.shop || ''));
    recent.push({ name: f.name, kcal: f.kcal, photo: f.photo, ago: '—', id: f.id, shop: f.shop, category: f.category, portion: f.portion, macros: f.macros, price: f.price });
  }
  return recent;
}
registerAction('quick:record', async (el) => {
  const idx = Number(el.dataset.i);
  const food = (REC.recent || [])[idx];
  if (!food) return;
  await recordFood(food, defaultMeal());
  toast('已记录 ' + food.name, 'green');
});
registerAction('rec:del', async (el) => {
  const rec = (await getRecords()).find((r) => r.id === el.dataset.id);
  if (!rec) return;
  await delRecord(el.dataset.id);
  await refreshRecordTotal();
  rerender();
  toast('已删除 1 条记录', 'brand', { undo: '撤销', onUndo: async () => {
    const { id, ...rest } = rec;
    await addRecord(rest);
    await refreshRecordTotal();
    rerender();
    toast('已恢复 ✓', 'green');
  }});
});
/* 记录就地编辑：改餐次 / 热量 / 份量，不必删了重记 */
registerAction('rec:edit', async (el) => {
  const rec = (await getRecords()).find((r) => r.id === el.dataset.id);
  if (!rec) return;
  window._recMeal = rec.meal;
  openSheet(`
    <div class="sheet-close" data-action="sheet:close">✕</div>
    <div class="sheet-title">修改这条记录</div>
    <div class="card" style="box-shadow:none;background:rgba(0,0,0,.04);margin-bottom:14px">
      <div class="flex" style="gap:12px;align-items:center">
        <div class="fl-photo" style="width:46px;height:46px;border-radius:14px">${photoHTML(rec)}</div>
        <div><div class="fl-name" style="font-size:16px">${esc(rec.foodName)}</div>
          <div class="muted small">${esc(rec.portion || '')}${rec.shop ? ' · ' + esc(rec.shop) : ''}</div></div>
      </div>
    </div>
    <div class="field"><label>调整到哪一餐</label>
      <div class="chips" id="rec-meal">${MEALS.map((m) => `<button type="button" class="chip ${rec.meal === m.k ? 'on' : ''}" data-action="rec:meal" data-v="${m.k}">${m.emoji} ${m.label}</button>`).join('')}</div>
    </div>
    <div class="field"><label>热量（kcal）<span class="req">*</span></label><input id="rec-kcal" type="number" value="${rec.kcal}"></div>
    <div class="field"><label>份量（选填）</label><input id="rec-portion" type="text" placeholder="一碗 / 一份" value="${esc(rec.portion || '')}"></div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn ghost" style="flex:1" data-action="sheet:close">取消</button>
      <button class="btn primary" style="flex:1.4" data-action="rec:save-edit" data-id="${rec.id}">保存修改</button>
    </div>`);
});
registerAction('rec:meal', (el) => {
  window._recMeal = el.dataset.v;
  document.querySelectorAll('#rec-meal .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === el.dataset.v));
});
registerAction('rec:save-edit', async (el) => {
  const rec = (await getRecords()).find((r) => r.id === el.dataset.id);
  if (!rec) return;
  const before = Object.assign({}, rec);
  const kcal = Number($('#rec-kcal').value);
  if (!(kcal > 0)) { toast('热量要大于 0 哦', 'red'); return; }
  rec.kcal = Math.round(kcal);
  rec.meal = window._recMeal || rec.meal;
  rec.portion = $('#rec-portion').value.trim() || rec.portion;
  await putRecord(rec);
  await refreshRecordTotal();
  closeSheet();
  rerender();
  toast('已更新记录 ✓', 'green', { undo: '撤销', onUndo: async () => {
    await putRecord(before);
    await refreshRecordTotal();
    rerender();
    toast('已撤销修改', 'brand');
  }});
});

/* ============================================================
 * 首页状态卡：饮水 / 运动 / 体重
 * ============================================================ */
registerAction('home:water-add', async () => {
  await addWater(todayKey(), 1);
  toast('咕噜咕噜 +1 杯 💧', 'blue');
  rerender();
});
registerAction('home:water-sub', async () => {
  await addWater(todayKey(), -1);
  rerender();
});

const SPORT_STATE = { name: null, met: 0, emoji: '🏃', minutes: 30, editId: null };
let WEIGHT_EDIT = null;
async function estSportKcal() {
  const weights = await getWeights();
  const kg = Number(PROFILE.weight) || (weights.length ? weights[weights.length - 1].kg : null) || 60;
  return Math.round(SPORT_STATE.met * kg * (SPORT_STATE.minutes / 60));
}
function renderSportSheet() {
  const editing = !!SPORT_STATE.editId;
  openSheet(`
    <div class="sheet-title">${editing ? '✏️ 编辑运动' : '🏃 记录运动'}</div>
    <div class="field"><label>运动类型</label>
      <div class="chips">
        ${EXERCISE_PRESETS.map((e, i) => `
          <div class="chip${SPORT_STATE.name === e.name ? ' on' : ''}" data-action="sport:pick"
               data-i="${i}" data-met="${e.met}" data-name="${e.name}" data-emoji="${e.emoji}">${e.emoji} ${e.name}</div>`).join('')}
      </div>
    </div>
    <div class="field"><label>时长</label>
      <div class="chips">
        ${[15, 30, 45, 60].map((m) => `
          <div class="chip${SPORT_STATE.minutes === m ? ' on' : ''}" data-action="sport:min" data-m="${m}">${m} 分钟</div>`).join('')}
      </div>
    </div>
    <div class="sport-est" id="sport-est">预计消耗 <b>${SPORT_STATE.name ? estSportKcalSync() : 0}</b> kcal</div>
    <button class="btn primary block" data-action="sport:save" style="margin-top:14px">${editing ? '保存修改' : '保存记录'}</button>
    <button class="btn ghost block" data-action="sheet:close" style="margin-top:8px">取消</button>`);
}
// 同步估算（用于 sheet 首屏渲染；实际值 sport:pick 后异步刷新）
function estSportKcalSync() {
  const kg = Number(PROFILE.weight) || 60;
  return Math.round(SPORT_STATE.met * kg * (SPORT_STATE.minutes / 60));
}
registerAction('home:sport', async () => {
  const ex = await getExerciseStats(todayKey());
  if (ex.count) {
    openSheet(`
      <div class="sheet-title">🏃 今日运动</div>
      ${ex.records.map((r) => `
        <div class="food-line">
          <div class="fl-photo">${r.emoji || '🏃'}</div>
          <div class="fl-info"><div class="fl-name">${esc(r.name)} · ${r.minutes} 分钟</div>
            <div class="fl-meta">消耗 ${r.kcal}kcal</div></div>
          <div class="fl-edit" data-action="sport:edit" data-id="${r.id}" title="修改">✎</div>
          <div class="fl-del" data-action="sport:del" data-id="${r.id}">✕</div>
        </div>`).join('')}
      <div class="hint" style="margin-top:4px">共消耗 <b style="color:var(--green)">${ex.kcal}kcal</b>，已计入今日可摄入额度 🔥</div>
      <button class="btn primary block" data-action="home:sport-add" style="margin-top:12px">＋ 再记一笔</button>
      <button class="btn ghost block" data-action="sheet:close" style="margin-top:8px">取消</button>`);
    return;
  }
  if (!SPORT_STATE.name) { SPORT_STATE.name = EXERCISE_PRESETS[0].name; SPORT_STATE.met = EXERCISE_PRESETS[0].met; SPORT_STATE.emoji = EXERCISE_PRESETS[0].emoji; }
  renderSportSheet();
});
registerAction('home:sport-add', () => { SPORT_STATE.editId = null; renderSportSheet(); });
registerAction('sport:edit', async (el) => {
  const ex = (await getExercises()).find((e) => e.id === el.dataset.id);
  if (!ex) return;
  SPORT_STATE.editId = ex.id;
  SPORT_STATE.name = ex.name;
  SPORT_STATE.minutes = ex.minutes;
  SPORT_STATE.emoji = ex.emoji || '🏃';
  const ws = await getWeights();
  const kg = Number(PROFILE.weight) || (ws.length ? ws[ws.length - 1].kg : 60) || 60;
  SPORT_STATE.met = ex.minutes ? ex.kcal / (ex.minutes / 60) / kg : 0;
  renderSportSheet();
});
registerAction('sport:del', async (el) => {
  const ex = (await getExercises()).find((e) => e.id === el.dataset.id);
  if (!ex) return;
  await delExercise(el.dataset.id);
  rerender();
  toast('已删除运动记录', 'brand', { undo: '撤销', onUndo: async () => {
    const { id, ...rest } = ex;
    await addExercise(rest);
    rerender();
    toast('已恢复 ✓', 'green');
  }});
});
registerAction('sport:pick', async (el) => {
  SPORT_STATE.name = el.dataset.name;
  SPORT_STATE.met = Number(el.dataset.met);
  SPORT_STATE.emoji = el.dataset.emoji;
  const kcal = await estSportKcal();
  renderSportSheet();
  const est = $('#sport-est');
  if (est) est.innerHTML = `预计消耗 <b>${kcal}</b> kcal`;
});
registerAction('sport:min', async (el) => {
  SPORT_STATE.minutes = Number(el.dataset.m);
  const kcal = await estSportKcal();
  renderSportSheet();
  const est = $('#sport-est');
  if (est) est.innerHTML = `预计消耗 <b>${kcal}</b> kcal`;
});
registerAction('sport:save', async () => {
  if (!SPORT_STATE.name) { toast('请选择运动类型', 'red'); return; }
  const kcal = await estSportKcal();
  if (SPORT_STATE.editId) {
    const existing = (await getExercises()).find((e) => e.id === SPORT_STATE.editId);
    let undoEx = null;
    if (existing) {
      undoEx = Object.assign({}, existing);
      existing.name = SPORT_STATE.name; existing.minutes = SPORT_STATE.minutes;
      existing.kcal = kcal; existing.emoji = SPORT_STATE.emoji;
      await putExercise(existing);
    }
    SPORT_STATE.editId = null;
    closeSheet();
    rerender();
    toast(`已更新 ${SPORT_STATE.name} ${SPORT_STATE.minutes}分钟 -${kcal}kcal 🔥`, 'green',
      undoEx ? { undo: '撤销', onUndo: async () => { await putExercise(undoEx); rerender(); toast('已恢复 ✓', 'green'); } } : undefined);
  } else {
    await addExercise({ date: todayKey(), name: SPORT_STATE.name, minutes: SPORT_STATE.minutes, kcal, emoji: SPORT_STATE.emoji });
    closeSheet();
    toast(`已记录 ${SPORT_STATE.name} ${SPORT_STATE.minutes}分钟 -${kcal}kcal 🔥`, 'green');
    rerender();
  }
});

/* 体重 */
async function renderWeightSheet() {
  const weights = await getWeights();
  const recent = weights.slice(-10).reverse();
  const editW = WEIGHT_EDIT ? (await getWeight(WEIGHT_EDIT)) : null;
  const inputVal = editW ? editW.kg : '';
  openSheet(`
    <div class="sheet-title">${editW ? '✏️ 编辑体重' : '⚖️ 体重记录'}</div>
    <div class="field"><label>${editW ? editW.date + ' 的体重（kg）' : '今日体重（kg）'}</label>
      <input class="input" type="number" id="weight-input" step="0.1" min="20" max="300" value="${inputVal}" placeholder="${PROFILE.weight ? '当前 ' + PROFILE.weight : '如 60.5'}">
    </div>
    ${editW ? `<div class="hint" style="margin-top:4px">正在编辑 <b>${editW.date}</b> 的体重，保存后覆盖该日记录</div>` : ''}
    <button class="btn primary block" data-action="weight:save">${editW ? '保存修改' : '保存今日体重'}</button>
    <div class="sheet-title small" style="margin-top:18px">📈 最近记录</div>
    ${recent.length ? recent.map((w) => `
      <div class="food-line">
        <div class="fl-photo">⚖️</div>
        <div class="fl-info"><div class="fl-name">${w.kg} kg</div>
          <div class="fl-meta">${w.date}${w.date === todayKey() ? ' · 今天' : ''}</div></div>
        <div class="fl-edit" data-action="weight:edit" data-date="${w.date}" title="修改">✎</div>
        <div class="fl-del" data-action="weight:del" data-date="${w.date}">✕</div>
      </div>`).join('') : `<div class="muted small" style="padding:8px 2px">还没有记录，从今天开始记录吧</div>`}
    <div style="height:6px"></div>
    <button class="btn ghost block" data-action="sheet:close">取消</button>`);
}
registerAction('home:weight', () => { WEIGHT_EDIT = null; renderWeightSheet(); });
registerAction('weight:edit', async (el) => {
  WEIGHT_EDIT = el.dataset.date;
  await renderWeightSheet();
});
registerAction('weight:save', async () => {
  const input = $('#weight-input');
  const kg = Number(input && input.value);
  if (!kg || kg < 20 || kg > 300) { toast('请输入有效体重', 'red'); return; }
  const date = WEIGHT_EDIT || todayKey();
  const prev = await getWeight(date);
  const wasEdit = !!WEIGHT_EDIT;
  await addWeight(date, kg);
  if (date === todayKey()) { PROFILE.weight = kg; await saveProfile(PROFILE); }
  WEIGHT_EDIT = null;
  closeSheet();
  rerender();
  toast(wasEdit ? '体重已更新 ⚖️' : '体重已记录 ⚖️', 'green',
    prev ? { undo: '撤销', onUndo: async () => {
      await addWeight(date, prev.kg);
      if (date === todayKey()) { PROFILE.weight = prev.kg; await saveProfile(PROFILE); }
      rerender(); toast('已恢复 ✓', 'green');
    } } : undefined);
});
registerAction('weight:del', async (el) => {
  const date = el.dataset.date;
  const w = await getWeight(date);
  if (!w) return;
  await delWeight(date);
  WEIGHT_EDIT = null;
  await renderWeightSheet();
  toast('已删除体重记录', 'brand', { undo: '撤销', onUndo: async () => {
    await addWeight(date, w.kg);
    toast('已恢复 ✓', 'green');
    await renderWeightSheet();
  }});
});

/* ============================================================
 * 记录页（拍照识别 / 手动录入）
 * ============================================================ */
const REC = { photo: null, candidates: [], picked: null };

registerPage('record', async function (root) {
  await loadFoods();
  const recent = await getRecentSix();
  REC.recent = recent;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">📷</span>记录</div>
        <div class="page-sub">拍照识别 · 或手动录入</div>
      </div>
    </div>
    <div class="card" style="padding:18px">
      <div class="viewfinder">
        <div class="vf-corner tl"></div>
        <div class="vf-corner tr"></div>
        <div class="vf-corner bl"></div>
        <div class="vf-corner br"></div>
        <div class="vf-center">
          <div class="vf-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
          </div>
          <div class="vf-text">把食物放进圆框</div>
        </div>
      </div>
      <div class="flex" style="gap:10px;justify-content:center">
        <button class="btn primary" data-action="rec:camera">📷 拍照识别</button>
        <button class="btn" data-action="rec:album">🖼️ 从相册选择</button>
      </div>
      <div class="hint" style="text-align:center;margin-top:10px">📷 单张识别 · 🖼️ 支持多选/长图批量拆解入库 · 不联网也能用</div>
    </div>
    ${recent.length ? `
    <div class="section-title">⚡ 经常吃 <span class="small muted" style="font-weight:500">点一下快速记录</span></div>
    <div class="recent-strip">
      ${recent.map((f, i) => `
        <div class="recent-chip" data-action="quick:record" data-i="${i}">
          <div class="rc-photo">${photoHTML(f)}</div>
          <div class="rc-name">${esc(f.name)}</div>
          <div class="rc-kcal">${dk(f.kcal)}</div>
        </div>`).join('')}
    </div>` : ''}
    <div class="card">
      <div class="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="rec-search" placeholder="搜食物 / 品牌外卖，直接记录…" autocomplete="off">
      </div>
      <div id="rec-search-result"></div>
      <div class="divider"></div>
      <button class="btn block" data-action="rec:manual">＋ 快速录入（自己写）</button>
      <div class="hint" style="text-align:center;margin-top:10px">没找到想吃的？<span style="color:var(--brand);cursor:pointer" data-action="contrib:open">没找到？点我新增 →</span></div>
    </div>`;
  $('#rec-search').addEventListener('input', (e) => renderSearchResult(e.target.value));
});
async function renderSearchResult(q) {
  const box = $('#rec-search-result');
  if (!q.trim()) { box.innerHTML = ''; return; }
  const ql = q.trim().toLowerCase();
  // ① 我的食谱库
  const lib = FOODS.filter((f) => f.name.toLowerCase().includes(ql)).slice(0, 4);
  const libKeys = new Set(lib.map((f) => (f.name + (f.shop || '')).toLowerCase()));
  // ② 平台品牌 / 外卖（SHOP_MAP：奶茶、麻辣烫、粉面…）
  const plat = [];
  for (const s of Object.values(SHOP_MAP)) {
    if (!s.items) continue;
    for (const it of s.items) {
      if (it.name.toLowerCase().includes(ql)) {
        if (libKeys.has((it.name + (s.name || '')).toLowerCase())) continue; // 已是自建，去重
        plat.push({ s, it });
        if (plat.length >= 6) break;
      }
    }
    if (plat.length >= 6) break;
  }
  const has = lib.length || plat.length;
  box.innerHTML = has ? `
    ${lib.length ? `<div class="rs-tag">📖 我的食谱</div>` + lib.map((f) => `
      <div class="food-line" data-action="rec:quick" data-id="${f.id}">
        <div class="fl-photo">${photoHTML(f)}</div>
        <div class="fl-info"><div class="fl-name">${esc(f.name)}</div><div class="fl-meta">${dk(f.kcal)} · 我的食谱</div></div>
        <div class="fl-kcal" style="color:var(--brand);font-size:12px">记录</div>
      </div>`).join('') : ''}
    ${plat.length ? `<div class="rs-tag">🌐 品牌 / 外卖</div>` + plat.map(({ s, it }) => `
      <div class="food-line" data-action="rec:shopquick" data-shopid="${s.id}" data-name="${esc(it.name)}" data-kcal="${it.kcal}" data-price="${it.price || 0}">
        <div class="fl-photo">${s.emoji || '🍽️'}</div>
        <div class="fl-info"><div class="fl-name">${esc(it.name)}</div><div class="fl-meta">${dk(it.kcal)} · ${esc(s.name)}</div></div>
        <div class="fl-kcal" style="color:var(--brand);font-size:12px">记录</div>
      </div>`).join('') : ''}
  ` : `<div class="muted small" style="padding:10px 4px">没找到「${esc(q.trim())}」…<span style="color:var(--brand);cursor:pointer" data-action="contrib:open">点我新增 →</span></div>`;
}
registerAction('rec:quick', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (f) askMealSheet(f);
});
registerAction('rec:shopquick', async (el) => {
  const shop = SHOP_MAP[el.dataset.shopid];
  if (!shop) return;
  const name = el.dataset.name, kcal = Number(el.dataset.kcal), price = Number(el.dataset.price || 0);
  const food = { id: null, name, kcal, price, shop: shop.name, category: shop.cat === '奶茶咖啡' ? '饮品' : '外卖', portion: '一份', macros: null };
  await recordFood(food, defaultMeal());
  await upsertShopFood(name, kcal, price, shop.name, el.dataset.shopid);
});
/* ---------- 拍照 / 相册 → 单张 AI 识别 ----------
 * 有密钥：真实视觉识别（名称+热量+置信度）
 * 无密钥：本地食谱库匹配演示
 */
async function startSingleRecog(dataURL, src) {
  REC.photo = dataURL; REC.picked = null; REC.src = src;
  replaceSheet(`
    <div class="sheet-title">🤖 正在识别…</div>
    <div style="text-align:center;padding:26px 0">
      <img src="${dataURL}" style="width:150px;height:150px;border-radius:24px;object-fit:cover;margin:0 auto;filter:blur(1px)">
      <div class="muted small" style="margin-top:14px">${LLM.isConfigured() ? 'AI 视觉识别中，请稍候' : '本地匹配食谱库中，请稍候'}</div>
    </div>`);
  try {
    const items = LLM.isConfigured()
      ? await LLM.recognizeFoodsFromImage(dataURL, src)
      : await localMatchCandidates(dataURL);
    REC.candidates = items;
    if (!items.length) {
      replaceSheet(`
        <div class="sheet-title">未能识别到食物</div>
        <div class="empty-state" style="margin:10px 0">
          <div class="es-icon">🤔</div>
          <div class="es-sub">没能识别出食物，换一张更清晰的图吧。</div>
        </div>
        <button class="btn primary block" data-action="album:reselect">🖼️ 重新选图</button>
        <div style="height:8px"></div>
        <button class="btn block" data-action="rec:manual">＋ 手动录入</button>`);
      return;
    }
    await renderSingleCandidates();
  } catch (e) {
    replaceSheet(`
      <div class="sheet-title">识别失败了</div>
      <div class="reason-box" style="border-left-color:var(--red);margin:10px 0 14px">${esc(e.message)}</div>
      <button class="btn primary block" data-action="album:reselect">🔄 重新选图</button>
      <div style="height:8px"></div>
      <button class="btn block" data-action="rec:manual">＋ 手动录入</button>`);
  }
}

async function localMatchCandidates(dataURL) {
  await _sleep(900);
  const pool = FOODS.length ? FOODS : [{ id: null, name: '未知食物', kcal: 300, category: '外卖', shop: '', portion: '一份', macros: null, price: 0 }];
  const picks = pool.slice(0, Math.min(4, pool.length));
  return picks.map((f, i) => ({
    i, id: f.id || null, name: f.name, kcal: f.kcal, unit: f.portion || '/份',
    category: f.category || '零食', confidence: 92 + i * 2, note: '',
    photo: f.photo || '', source: REC.src, demo: true, checked: true
  }));
}

/* 单张识别候选列表：1 个食物选一个；识别出多个时提示可批量导入 */
async function renderSingleCandidates() {
  const items = REC.candidates;
  const stats = await getDayStats(todayKey());
  const remaining = Math.max(0, (PROFILE.targetKcal || 1800) - stats.kcal);
  const multi = items.length > 1;
  replaceSheet(`
    <div class="sheet-title">识别到 ${items.length} 个食物</div>
    ${multi ? `
    <div class="reason-box" style="border-left-color:var(--brand);margin-bottom:10px">
      🧩 图中识别出多个食物。<b style="color:var(--brand);cursor:pointer;text-decoration:underline" data-action="batch:single-to-batch">一键批量导入全部 →</b>
    </div>` : ''}
    ${items.map((f, i) => {
      const tl = trafficLight(f.kcal, remaining, PROFILE.recordTotal);
      const confTxt = f.confidence > 90 ? '高置信度' : f.confidence >= 60 ? '建议核对' : '需修正';
      const confCls = f.confidence > 90 ? 'green' : f.confidence >= 60 ? 'yellow' : 'red';
      const img = f.thumb || f.photo || REC.photo;
      return `
      <div class="food-line" data-action="rec:candidate" data-i="${i}">
        <div class="fl-photo">${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:14px">` : photoHTML(f)}</div>
        <div class="fl-info"><div class="fl-name">${esc(f.name)} <span class="bconf ${confCls}" title="${confTxt}"></span></div>
          <div class="fl-meta">${dk(f.kcal)}${f.unit ? ' ' + esc(f.unit) : ''} · ${confTxt}</div></div>
        <div class="fl-kcal">${f.kcal}kcal</div>
      </div>`;}).join('')}
    <button class="btn ghost block" data-action="rec:manual" style="margin-top:6px">都不是，手动录入</button>`);
}

/* 单张识别结果 → 一键进入批量拆解预览（汇总图多食物场景） */
registerAction('batch:single-to-batch', () => {
  BATCH.photo = REC.photo; BATCH.items = REC.candidates.map((it) => ({ ...it, thumb: it.thumb || REC.photo }));
  renderBatchPreview();
});

registerAction('rec:camera', () => pickPhoto((d) => startSingleRecog(d, '拍照识别'), true));
registerAction('rec:album', () => startAlbumFlow());

/* ============================================================
 * 相册多选 → 选图确认 → 智能分流：
 *   单张普通图 → 单张识别；单张长图(宽高比>2) / 多张 → 批量拆解
 * ============================================================ */
const ALBUM = { imgs: [], mode: 'batch' };

async function startAlbumFlow() {
  pickAlbumImages(async (imgs) => {
    if (!imgs.length) return;
    ALBUM.imgs = imgs;
    await renderAlbumConfirm();
  });
}

async function renderAlbumConfirm() {
  const imgs = ALBUM.imgs;
  const n = imgs.length;
  if (!n) { closeSheet(); return; } // 全部删除后关闭
  let modeText = '批量拆解', modeDesc = '逐张识别后汇总，可勾选导入';
  if (n === 1) {
    const { w, h } = await imageSize(imgs[0]);
    // 长图 = 长边/短边 > 2（横图或竖图截图均适用）
    const isLong = w > 0 && h > 0 && Math.max(w, h) / Math.min(w, h) > 2;
    if (isLong) { ALBUM.mode = 'batch'; modeText = '长图批量拆解'; modeDesc = '检测到长图，自动拆解其中所有食物'; }
    else { ALBUM.mode = 'single'; modeText = '单张食物识别'; modeDesc = '识别图中食物的名称与热量'; }
  } else {
    ALBUM.mode = 'batch';
    modeText = `批量拆解（${n} 张图）`;
    modeDesc = '逐张识别后汇总，可勾选导入';
  }
  openSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">🖼️ 已选择 ${n} 张图片</div>
    <div class="album-previews">${imgs.map((d, i) => `
      <div class="ap-wrap">
        <img src="${d}" data-action="album:preview" data-i="${i}">
        <button class="ap-del" data-action="album:del" data-i="${i}">✕</button>
      </div>`).join('')}</div>
    <div class="hint" style="text-align:center;margin:10px 0 0">
      识别模式：<b style="color:var(--brand)">${modeText}</b><br>
      <span class="muted small">${modeDesc}</span>
    </div>
    <div class="flex" style="gap:8px;margin-top:14px">
      <button class="btn primary lg" style="flex:1" data-action="album:go">🔍 识别这些图片</button>
      <button class="btn ghost lg" data-action="album:reselect">🔄</button>
    </div>
    <div style="height:6px"></div>
    <button class="btn ghost block" data-action="album:perm">⚙️ 无法访问相册？查看帮助</button>`);
}

registerAction('album:reselect', () => startAlbumFlow());
registerAction('album:perm', () => showAlbumPermGuide());
registerAction('album:preview', (el) => {
  const img = ALBUM.imgs[Number(el.dataset.i)];
  if (img) openModal(`
    <div class="modal-title">图片预览</div>
    <img src="${img}" style="width:100%;border-radius:16px;max-height:60vh;object-fit:contain">
    <button class="btn primary block" data-action="modal:close" style="margin-top:14px">知道了</button>`);
});
registerAction('album:del', async (el) => {
  const i = Number(el.dataset.i);
  if (i >= 0 && i < ALBUM.imgs.length) ALBUM.imgs.splice(i, 1);
  await renderAlbumConfirm();
});
registerAction('album:go', async () => {
  const imgs = ALBUM.imgs;
  if (!imgs.length) return;
  if (imgs.length === 1 && ALBUM.mode === 'single') {
    await startSingleRecog(imgs[0], '相册识别');
  } else {
    await runBatchBreakdown(imgs, '相册');
  }
});

/* ============================================================
 * 批量拆解录入：相册汇总图 → AI 拆解 → 预览勾选 → 一键导入食谱库
 * ============================================================ */
const ALL_CATS = ['食堂', '外卖', '自制', '饮品', '零食', '水果'];
const BATCH = { photo: '', items: [], src: '图片导入' };
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 批量拆解：imgs 可为 1~9 张图，逐张 AI 识别后合并结果 */
async function runBatchBreakdown(imgs, label = '图片导入') {
  BATCH.photo = imgs[0] || ''; BATCH.items = []; BATCH.src = label;
  replaceSheet(renderBatchProgress(imgs.length));
  const steps = ['batch-step-0', 'batch-step-1', 'batch-step-2'];
  for (let i = 0; i < steps.length; i++) {
    await _sleep(420);
    const el = document.getElementById(steps[i]);
    if (el) el.classList.add('done');
  }
  try {
    const all = [];
    for (let n = 0; n < imgs.length; n++) {
      const numEl = document.getElementById('batch-progress-num');
      if (numEl) numEl.textContent = `（第 ${n + 1}/${imgs.length} 张）`;
      const src = imgs.length > 1 ? `${label} · 第${n + 1}张` : label;
      let items = [];
      try {
        items = await LLM.recognizeFoodsFromImage(imgs[n], src);
      } catch (e) {
        if (!/没有识别出任何食物/.test(e.message)) throw e;
        items = [];
      }
      for (const it of items) {
        if (it.box) it.thumb = await cropBox(imgs[n], it.box); // 有坐标则裁剪区域小图
        if (!it.thumb) it.thumb = imgs[n];                      // 无坐标用整图作缩略图
        all.push(it);
      }
    }
    const done = document.getElementById('batch-step-3');
    if (done) done.classList.add('done');
    await _sleep(320);
    BATCH.items = all;
    if (!all.length) { renderBatchEmpty(); return; }
    renderBatchPreview();
  } catch (e) {
    if (/没有识别出任何食物/.test(e.message)) renderBatchEmpty();
    else renderBatchError(e.message);
  }
}

function renderBatchProgress(total = 1) {
  const steps = [
    ['🔍', '正在识别图片中的食物区域…'],
    ['🧾', '正在提取食物名称和热量…'],
    ['📦', '正在整理数据…'],
    ['✅', '拆解完成！']
  ];
  return `
    <div class="sheet-title">🔍 AI 正在拆解${total > 1 ? ' ' + total + ' 张图' : '这张图'}中的食物…<span id="batch-progress-num" class="muted small"></span></div>
    <div style="text-align:center;padding:4px 0 14px">
      <img src="${BATCH.photo}" style="width:110px;height:110px;border-radius:20px;object-fit:cover;margin:0 auto;filter:blur(0.6px)">
    </div>
    <div class="batch-steps">
      ${steps.map(([e, t], i) => `
        <div class="batch-step" id="batch-step-${i}">
          <div class="bs-dot">${e}</div>
          <div class="bs-text">${t}</div>
        </div>`).join('')}
    </div>`;
}

/* 第三步：拆解结果预览（可勾选 / 可编辑 / 可删除） */
function renderBatchPreview() {
  const items = BATCH.items;
  const checked = items.filter((x) => x.checked).length;
  const demoNote = LLM.isConfigured() ? '' : `
    <div class="reason-box" style="border-left-color:var(--orange);margin-bottom:12px">
      ⚠️ 未连接 AI，当前为<b>演示数据</b>（取自你的食谱库）。到「我的 → AI 识别设置」填入密钥后即可真实拆解图片。
    </div>`;
  replaceSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">🧩 拆解结果</div>
    <div class="muted small" style="text-align:center;margin:-6px 0 12px">共识别到 ${items.length} 个食物 · 已选 <b id="batch-count">${checked}</b> 个</div>
    ${demoNote}
    <div id="batch-list">${items.map((it, idx) => renderBatchItem(it, idx)).join('')}</div>
    <div id="batch-foot">${renderBatchFooter()}</div>`);
}

function renderBatchItem(it, idx) {
  const confTxt = it.confidence > 90 ? '高置信度' : it.confidence >= 60 ? '建议核对' : '请手动修正';
  const confCls = it.confidence > 90 ? 'green' : it.confidence >= 60 ? 'yellow' : 'red';
  const img = it.thumb || it.photo || BATCH.photo;
  const srcTxt = it.source;
  return `
    <div class="batch-item">
      <div class="batch-check ${it.checked ? '' : 'off'}" data-action="batch:toggle" data-i="${idx}">✓</div>
      <div class="bi-photo" data-action="batch:zoom" data-i="${idx}"><img src="${img}"></div>
      <div class="bi-info">
        <div class="bi-name"><span>${esc(it.name)}</span><span class="bconf ${confCls}" title="${confTxt}"></span></div>
        <div class="bi-meta">${it.kcal} 大卡 ${esc(it.unit)} · ${confTxt}${it.edited ? ' · ✏️已改' : ''}</div>
        ${srcTxt ? `<div class="bi-src">📎 来源：${esc(srcTxt)}</div>` : ''}
      </div>
      <div class="bi-edit" data-action="batch:edit" data-i="${idx}">✏️</div>
    </div>`;
}

function renderBatchFooter() {
  const items = BATCH.items;
  const checked = items.filter((x) => x.checked).length;
  const allOn = checked === items.length;
  return `
    <div class="flex" style="gap:8px;margin-bottom:10px">
      <button class="btn sm ghost" style="flex:1" data-action="batch:all">${allOn ? '☐ 全不选' : '☑ 全选'}</button>
      <button class="btn sm ghost" style="flex:1" data-action="batch:remove">🗑 删除选中 (${checked})</button>
    </div>
    <button class="btn primary lg block" data-action="batch:import" ${checked ? '' : 'disabled'}>📥 一键全部导入 (${checked})</button>`;
}

registerAction('batch:toggle', (el) => {
  const it = BATCH.items[Number(el.dataset.i)];
  if (!it) return;
  it.checked = !it.checked;
  el.classList.toggle('off', !it.checked);
  const foot = document.getElementById('batch-foot');
  if (foot) foot.innerHTML = renderBatchFooter();
  const c = document.getElementById('batch-count');
  if (c) c.textContent = BATCH.items.filter((x) => x.checked).length;
});

registerAction('batch:all', () => {
  const allOn = BATCH.items.every((x) => x.checked);
  BATCH.items.forEach((x) => { x.checked = !allOn; });
  renderBatchPreview();
});

registerAction('batch:remove', () => {
  BATCH.items = BATCH.items.filter((x) => !x.checked);
  if (!BATCH.items.length) { renderBatchEmpty(); return; }
  renderBatchPreview();
});

registerAction('batch:zoom', (el) => {
  const it = BATCH.items[Number(el.dataset.i)];
  if (!it) return;
  openModal(`
    <div class="modal-title">${esc(it.name)}</div>
    <img src="${it.thumb || it.photo || BATCH.photo}" style="width:100%;border-radius:16px;margin-bottom:14px">
    <div class="modal-sub">${it.kcal} 大卡 ${esc(it.unit)} · ${it.confidence > 90 ? '高置信度' : it.confidence >= 60 ? '建议核对' : '请手动修正'}</div>
    <button class="btn primary block" data-action="modal:close">知道了</button>`);
});

/* 第四步：确认导入 → 存入食谱库 → 跳转 */
registerAction('batch:import', () => {
  const items = BATCH.items.filter((x) => x.checked);
  if (!items.length) return;
  openModal(`
    <div class="modal-title">确认将 ${items.length} 个食物导入「我的食谱」？</div>
    <div class="modal-sub">这将一次性新增 ${items.length} 样食物，导入后可随时编辑修改。</div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn primary" data-action="batch:import-go">确认导入</button>
    </div>`);
});

registerAction('batch:import-go', async () => {
  const items = BATCH.items.filter((x) => x.checked);
  if (!items.length) return;
  const now = nowISO();
  for (const it of items) {
    await saveFood({
      id: uid(), name: it.name, kcal: it.kcal, price: 0, shop: '',
      portion: it.unit || '一份', category: it.category || '零食',
      photo: it.thumb || it.photo || '', source: it.source || '用户导入',
      createdAt: now, updatedAt: now, editCount: 0,
      macros: estimateMacros(it.kcal)
    });
  }
  await loadFoods();
  closeModal(); closeSheet();
  toast(`🎉 已成功导入 ${items.length} 样食物到你的食谱库！`, 'brand');
  switchPage('recipes');
});

/* 单条编辑：名称 / 热量 / 单位 / 分类 / 换图（批量条目与单张识别结果共用） */
let _beIdx = null, _bePhoto = '', _beCat = '零食', _beTarget = null;

registerAction('batch:edit', (el) => openBatchEdit(Number(el.dataset.i)));

function openBatchEdit(idx) {
  const it = BATCH.items[idx];
  if (!it) return;
  _beIdx = idx;
  _beTarget = { obj: it, onSave: () => renderBatchPreview() };
  _openEditSheet(it);
}

/* 单张识别结果修正入口 */
function openSingleEdit() {
  const it = REC.picked;
  if (!it) return;
  _beIdx = null;
  _beTarget = { obj: it, onSave: (o) => { REC.picked = o; renderRecResult(o); } };
  _openEditSheet(it);
}

function _openEditSheet(it) {
  _bePhoto = it.thumb || it.photo || ''; _beCat = it.category || '零食';
  openSheet(`
    <div class="sheet-title">✏️ 编辑「${esc(it.name)}」</div>
    <div class="field">
      <label>照片</label>
      <div class="photo-pick" data-action="batch:photo">
        ${_bePhoto ? `<img src="${_bePhoto}"><div class="pp-x" data-action="batch:photo-clear">✕</div>` : '<span>＋</span><span>拍照 / 相册</span>'}
      </div>
    </div>
    <div class="field"><label>食物名称 <span class="req">*</span></label><input id="be-name" type="text" value="${esc(it.name)}"></div>
    <div class="field"><label>热量（大卡）<span class="req">*</span></label><input id="be-kcal" type="number" value="${it.kcal}"></div>
    <div class="field"><label>单位（选填）</label><input id="be-unit" type="text" placeholder="如：/包 /块 /100g" value="${esc(it.unit)}"></div>
    <div class="field"><label>分类</label>
      <div class="chips" id="be-cat">${ALL_CATS.map((c) => `<button class="chip ${_beCat === c ? 'on' : ''}" data-action="batch:cat" data-v="${c}">${c}</button>`).join('')}</div>
    </div>
    <div style="height:6px"></div>
    <button class="btn primary lg block" data-action="batch:edit-save">💾 保存</button>`);
}

registerAction('batch:cat', (el) => {
  _beCat = el.dataset.v;
  document.querySelectorAll('#be-cat .chip').forEach((c) => c.classList.toggle('on', c === el));
});

registerAction('batch:photo', () => pickPhoto((d) => { _bePhoto = d; if (_beTarget) _openEditSheet(_beTarget.obj); }, false));

registerAction('batch:photo-clear', () => {
  _bePhoto = '';
  if (_beTarget) _openEditSheet(_beTarget.obj);
});

registerAction('batch:edit-save', () => {
  const it = _beTarget && _beTarget.obj;
  if (!it) return;
  const name = document.getElementById('be-name').value.trim();
  const kcal = Number(document.getElementById('be-kcal').value);
  if (!name || !(kcal > 0)) { toast('名称和热量必填哦', 'red'); return; }
  it.name = name; it.kcal = Math.round(kcal);
  it.unit = document.getElementById('be-unit').value.trim() || '/份';
  it.category = _beCat || '零食';
  if (_bePhoto) it.thumb = _bePhoto;
  it.edited = true;
  _beTarget.onSave(it); // 批量 → 刷新预览；单张 → 回显结果卡
});

/* 识别失败 / 空结果的兜底 */
function renderBatchEmpty() {
  replaceSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">未能识别到食物</div>
    <div class="empty-state" style="margin:10px 0">
      <div class="es-icon">🤔</div>
      <div class="es-sub">没能从这张图中认出食物。换一张更清晰的图，或手动录入吧。</div>
    </div>
    <button class="btn primary block" data-action="batch:retry">🖼️ 换一张图</button>
    <div style="height:8px"></div>
    <button class="btn block" data-action="rec:manual">＋ 手动录入</button>`);
}

function renderBatchError(msg) {
  replaceSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">识别失败了</div>
    <div class="reason-box" style="border-left-color:var(--red);margin:10px 0 14px">${esc(msg)}</div>
    <button class="btn primary block" data-action="batch:retry">🔄 重试</button>
    <div style="height:8px"></div>
    <button class="btn block" data-action="rec:manual">＋ 手动录入</button>`);
}

registerAction('batch:retry', () => startAlbumFlow());
registerAction('rec:candidate', (el) => {
  const f = REC.candidates[Number(el.dataset.i)];
  if (f) { REC.picked = f; renderRecResult(f); }
});
async function renderRecResult(f) {
  const target = PROFILE.targetKcal || 1800;
  const remaining = Math.max(0, target - (await getDayStats(todayKey())).kcal);
  const tl = trafficLight(f.kcal, remaining, PROFILE.recordTotal);
  const btnCls = tl.level === 'green' ? 'green' : tl.level === 'red' ? 'red' : 'primary';
  const confTxt = f.confidence != null ? (f.confidence > 90 ? '🟢 高置信度' : f.confidence >= 60 ? '🟡 建议核对' : '🔴 请手动修正') : '';
  const img = f.thumb || f.photo || REC.photo;
  const inLib = !!f.id;
  replaceSheet(`
    <div class="sheet-title">识别结果</div>
    <div class="card" style="margin-bottom:0;box-shadow:none;background:rgba(0,0,0,0.03)">
      <div class="food-line" style="box-shadow:none;background:transparent;padding:4px 0">
        <div class="fl-photo" style="width:56px;height:56px;border-radius:18px">${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:18px">` : photoHTML(f, true)}</div>
        <div class="fl-info">
          <div class="fl-name" style="font-size:16px">${esc(f.name)} ${confTxt ? `<span class="small" style="color:var(--sub);font-weight:600">${confTxt}</span>` : ''}</div>
          <div class="fl-meta">${esc(f.portion || f.unit || '约一份')} · 约 ${Math.max(30, Math.round(f.kcal / 1.3))}g · 预估 ${Math.round(f.kcal * 0.5)}~${f.kcal}kcal</div>
        </div>
        <div class="fl-kcal" style="font-size:18px">${f.kcal}kcal</div>
      </div>
      <div style="margin-top:6px"><span class="light-badge ${tl.level}">${tl.level === 'green' ? '🟢 放心吃' : tl.level === 'yellow' ? '🟡 控制量' : '🔴 今天超标'}</span></div>
      <div class="reason-box">${esc(tl.reason)}</div>
    </div>
    <div style="height:10px"></div>
    <div class="flex" style="gap:8px">
      <button class="btn ${btnCls} lg" style="flex:1" data-action="rec:confirm">确认记录</button>
      <button class="btn ghost lg" data-action="rec:fix">✏️ 修正</button>
    </div>
    ${inLib ? '' : `
    <div style="height:8px"></div>
    <button class="btn block" data-action="rec:save-food">📥 存入我的食谱</button>`}
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="sheet:close">换一张</button>`);
}
registerAction('rec:fix', () => openSingleEdit());
registerAction('rec:save-food', async () => {
  const f = REC.picked;
  if (!f || f.id) return;
  const now = nowISO();
  const id = uid();
  await saveFood({
    id, name: f.name, kcal: f.kcal, price: 0, shop: '',
    portion: f.unit || '一份', category: f.category || '零食',
    photo: f.thumb || f.photo || REC.photo || '', source: REC.src || 'AI识别',
    createdAt: now, updatedAt: now, editCount: 0, macros: estimateMacros(f.kcal)
  });
  await loadFoods();
  f.id = id; // 标记已入库，隐藏重复按钮
  toast('已存入我的食谱 📖', 'green');
  renderRecResult(f);
});
registerAction('rec:confirm', async () => {
  const f = REC.picked;
  if (!f) return;
  closeSheet();
  await recordFood({
    id: f.id || null, name: f.name, kcal: f.kcal,
    photo: f.thumb || f.photo || REC.photo || '',
    shop: f.shop, category: f.category,
    portion: f.portion || f.unit || '一份',
    macros: f.macros, price: f.price
  }, defaultMeal());
});
/* 快速录入表单 */
window._formPhoto = '';
window._formCat = '食堂';
window._formUpdateCal = false;
window._formCompare = null;
window._formCompareId = null;

function openManualForm(existing, compare) {
  const f = existing || {};
  openSheet(`
    <div class="sheet-title">${existing ? '编辑食物' : '快速录入'}</div>
    <div class="field">
      <label>照片 <span class="req">*</span></label>
      <div class="photo-pick" data-action="form:photo">
        ${f.photo ? `<img src="${f.photo}"><div class="pp-x" data-action="form:photo-clear">✕</div>` : '<span>＋</span><span>拍照 / 相册</span>'}
      </div>
    </div>
    <div class="field">
      <label>品牌 / 店铺 <span class="muted small">选填 · 自动匹配已有</span></label>
      <input id="f-brand" type="text" list="brand-opts" placeholder="如：蜜雪冰城 / 学校食堂" value="${esc(f.brand || f.shop || '')}" autocomplete="off">
      <datalist id="brand-opts">${optList(brandOptions())}</datalist>
    </div>
    <div class="field">
      <label>系列 / 品类 <span class="muted small">选填 · 自动匹配已有</span></label>
      <input id="f-series" type="text" list="series-opts" placeholder="如：奶茶 / 果茶 / 主食" value="${esc(f.series || '')}" autocomplete="off">
      <datalist id="series-opts">${optList(seriesOptions())}</datalist>
    </div>
    <div class="field"><label>产品名称 <span class="req">*</span></label><input id="f-name" type="text" placeholder="如：珍珠奶茶 / 食堂麻辣香锅" value="${esc(f.name || '')}"></div>
    <div class="field"><label>预估热量（kcal）<span class="req">*</span></label><input id="f-kcal" type="number" placeholder="如：580" value="${f.kcal != null ? f.kcal : ''}"></div>
    <div class="field"><label>价格（元，选填）</label><input id="f-price" type="number" step="0.1" placeholder="用于多巴胺账单省钱统计" value="${f.price != null ? f.price : ''}"></div>
    <div class="field"><label>店铺名（选填）</label><input id="f-shop" type="text" placeholder="留空则自动用品牌名关联觅食" value="${esc(f.shop || '')}"></div>
    <div class="field"><label>分量描述（选填）</label><input id="f-portion" type="text" placeholder="一碗 / 一份 / 大份 / 小份" value="${esc(f.portion || '')}"></div>
    <div class="field">
      <label>规格（选填 · 只填「当前这一份」的真实情况）</label>
      <div class="spec-mini">
        <div class="sm-row"><span class="sm-k">甜度</span><div class="chips" data-spec="sweetness">${['无糖','3分糖','5分糖','7分糖','全糖'].map((v) => `<button type="button" class="chip sm ${f.spec && f.spec.sweetness === v ? 'on' : ''}" data-action="form:spec" data-g="sweetness" data-v="${v}">${v}</button>`).join('')}</div></div>
        <div class="sm-row"><span class="sm-k">温度</span><div class="chips" data-spec="temp">${['热','温','常温','冰'].map((v) => `<button type="button" class="chip sm ${f.spec && f.spec.temp === v ? 'on' : ''}" data-action="form:spec" data-g="temp" data-v="${v}">${v}</button>`).join('')}</div></div>
        <div class="sm-row"><span class="sm-k">容量</span><div class="chips" data-spec="size">${['小杯','中杯','大杯'].map((v) => `<button type="button" class="chip sm ${f.spec && f.spec.size === v ? 'on' : ''}" data-action="form:spec" data-g="size" data-v="${v}">${v}</button>`).join('')}</div></div>
        <div class="sm-row"><span class="sm-k">小料</span><div class="chips" data-spec="toppings">${['珍珠','椰果','布丁','芋圆','燕麦'].map((v) => `<button type="button" class="chip sm ${f.spec && f.spec.toppings && f.spec.toppings.includes(v) ? 'on' : ''}" data-action="form:spec" data-g="toppings" data-v="${v}">${v}</button>`).join('')}</div></div>
        <div class="sm-row"><span class="sm-k">分量</span><div class="chips" data-spec="portion">${['小份','中份','大份'].map((v) => `<button type="button" class="chip sm ${f.spec && f.spec.portion === v ? 'on' : ''}" data-action="form:spec" data-g="portion" data-v="${v}">${v}</button>`).join('')}</div></div>
        <div class="sm-row"><span class="sm-k">口味</span><div class="chips" data-spec="spice">${['不辣','微辣','中辣','特辣'].map((v) => `<button type="button" class="chip sm ${f.spec && f.spec.spice === v ? 'on' : ''}" data-action="form:spec" data-g="spice" data-v="${v}">${v}</button>`).join('')}</div></div>
      </div>
    </div>
    <div class="field">
      <label>分类</label>
      <div class="chips" id="f-cat">
        ${ALL_CATS.map((c) => `<button class="chip ${(f.category || '食堂') === c ? 'on' : ''}" data-action="form:cat" data-v="${c}">${c}</button>`).join('')}
      </div>
    </div>
    ${compare ? `<div class="card" style="box-shadow:none;background:var(--brand-soft);padding:14px;margin-bottom:6px">
      <div class="small" style="font-weight:800;color:var(--brand);margin-bottom:8px">📢 平台数据有更新</div>
      <div class="small" style="line-height:1.8">
        <div>原数据（你的录入）：<b>约${f.kcal}kcal</b></div>
        <div>新数据（平台校准）：<b>${compare.kcal}kcal</b> <span class="muted">（来源：${esc(compare.source)}）</span></div>
      </div>
      <div class="flex" style="margin-top:10px;gap:8px">
        <button class="btn sm primary" data-action="form:update-cal">一键更新</button>
        <button class="btn sm ghost" data-action="form:ignore-cal">忽略</button>
      </div>
    </div>` : ''}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <input type="checkbox" id="also-record" ${existing ? '' : 'checked'} style="width:18px;height:18px;accent-color:var(--brand)">
      <label for="also-record" class="small muted" style="cursor:pointer">保存${existing ? '' : '并记录到今日（' + MEALS.find((m) => m.k === defaultMeal()).label + '）'}</label>
    </div>
    <button class="btn primary lg" data-action="form:save" data-id="${f.id || ''}">${existing ? '保存修改' : '保存'}</button>`);
  window._formPhoto = f.photo || '';
  window._formCat = f.category || '食堂';
  window._formSpec = f.spec ? JSON.parse(JSON.stringify(f.spec)) : { sweetness: '', temp: '', size: '', toppings: [], portion: '', spice: '' };
  window._formUpdateCal = false;
  window._formCompare = compare;
  window._formCompareId = existing ? existing.id : null;
  window._cropOriginal = f.photo || ''; // 编辑已有食物时，以当前图作为「重新裁剪」的源
}
registerAction('rec:manual', () => openManualForm());
registerAction('form:photo', () => {
  // 需求三-第一步：点击照片占位区 → 弹出「拍照 / 从相册选择 / 取消」底部菜单
  // 用 modal 承载菜单（不覆盖表单 sheet），取消/点背景不会丢失已输入内容
  const has = !!window._formPhoto;
  let menu = '';
  if (has) menu += '<button class="btn block" style="margin-bottom:10px" data-action="form:photo-recrop">✂️ 重新裁剪</button>';
  menu += '<button class="btn block" style="margin-bottom:10px" data-action="form:photo-camera">📷 拍照</button>';
  menu += '<button class="btn block" style="margin-bottom:10px" data-action="form:photo-album">🖼️ 从相册选择</button>';
  if (has) menu += '<button class="btn ghost block" style="margin-bottom:10px" data-action="form:photo-clear2">🗑️ 删除照片</button>';
  $('#modal-root').innerHTML = `
    <div class="modal-back" data-action="modal:close"></div>
    <div class="photo-menu">
      <div class="photo-menu-title">📷 ${has ? '修改食物照片' : '添加食物照片'}</div>
      ${menu}
      <button class="btn ghost block" data-action="modal:close">取消</button>
    </div>`;
});
registerAction('form:photo-camera', () => {
  closeModal();
  pickThenCrop(true);
});
registerAction('form:photo-album', () => {
  closeModal();
  pickThenCrop(false);
});
registerAction('form:photo-recrop', () => {
  closeModal();
  const src = window._cropOriginal || window._formPhoto;
  if (!src) return;
  openCropEditor({ src, onDone: (c) => setFormPhoto(c, false), onCancel: () => {} });
});
registerAction('form:photo-clear2', () => {
  closeModal();
  window._formPhoto = '';
  window._cropOriginal = '';
  const pick = $('#sheet-root .photo-pick');
  if (pick) pick.innerHTML = '<span>＋</span><span>拍照 / 相册</span>';
  toast('已删除照片', 'brand');
});
/* 选图 → 裁剪 → 落库：保留原图以便「重新裁剪」，裁剪后输出直接作为食物照片 */
function pickThenCrop(capture) {
  pickAlbumImages((imgs) => {
    if (!imgs[0]) return;
    window._cropOriginal = imgs[0];
    openCropEditor({ src: imgs[0], onDone: (c) => setFormPhoto(c, false), onCancel: () => {} });
  }, { capture, maxCount: 1, compress: 1280 });
}
async function setFormPhoto(dataURL, compress) {
  // 直接显示裁剪后的图（压缩由裁剪编辑器完成）；compress=true 时再压一次（兼容旧路径）
  window._formPhoto = compress ? await compressImage(dataURL, 480, 0.7) : dataURL;
  const pick = $('#sheet-root .photo-pick');
  if (pick) pick.innerHTML = `<img src="${window._formPhoto}"><div class="pp-x" data-action="form:photo-clear">✕</div><div class="pp-crop" data-action="form:photo-recrop">✂️ 重新裁剪</div>`;
  toast('照片已添加，可直接保存 📷', 'green');
}
async function applyFormPhoto(dataURL) {
  await setFormPhoto(dataURL, true);
}
registerAction('form:photo-clear', () => {
  window._formPhoto = '';
  // 直接还原占位区，保留表单其他已输入内容
  // （全局事件委托经 closest 分发，不会冒泡触发父级 form:photo）
  const pick = $('#sheet-root .photo-pick');
  if (pick) pick.innerHTML = '<span>＋</span><span>拍照 / 相册</span>';
});
registerAction('form:cat', (el) => {
  window._formCat = el.dataset.v;
  document.querySelectorAll('#f-cat .chip').forEach((c) => c.classList.toggle('on', c === el));
});
registerAction('form:spec', (el) => {
  const g = el.dataset.g, v = el.dataset.v;
  if (g === 'toppings') {
    const arr = window._formSpec.toppings;
    if (arr.includes(v)) { window._formSpec.toppings = arr.filter((t) => t !== v); el.classList.remove('on'); }
    else { arr.push(v); el.classList.add('on'); }
  } else {
    if (window._formSpec[g] === v) { window._formSpec[g] = ''; el.classList.remove('on'); }
    else {
      window._formSpec[g] = v;
      document.querySelectorAll(`#sheet-root .chips[data-spec="${g}"] .chip`).forEach((c) => c.classList.toggle('on', c === el));
    }
  }
});
registerAction('form:update-cal', () => {
  const cal = window._formCompare;
  if (!cal) return;
  $('#f-kcal').value = cal.kcal;
  window._formUpdateCal = true;
  toast(`已采用平台数据 ${cal.kcal}kcal ✓`, 'green');
  const panel = $('#sheet-root .card');
  if (panel && panel.querySelector('[data-action="form:update-cal"]')) panel.style.display = 'none';
});
registerAction('form:ignore-cal', () => {
  window._formUpdateCal = false;
  const panel = $('#sheet-root .card');
  if (panel && panel.querySelector('[data-action="form:update-cal"]')) panel.style.display = 'none';
  toast('已忽略，继续使用你的数据', 'brand');
});
registerAction('form:save', async (el) => {
  const id = el.dataset.id;
  const name = $('#f-name').value.trim();
  const kcal = Number($('#f-kcal').value);
  if (!name || !(kcal > 0)) { toast('名称和热量必填哦', 'red'); return; }
  if (!id && !window._formPhoto) { toast('新增食物请先拍张照片哦 📷', 'red'); return; }
  const now = nowISO();
  const old = id ? (FOODS.find((x) => x.id === id) || null) : null;
  const brand = $('#f-brand').value.trim();
  const series = $('#f-series').value.trim();
  // 品牌匹配平台店铺 → 自动关联 shop（打通觅食），并据品类自动分类
  let shop = $('#f-shop').value.trim();
  const matchShop = brand ? [...BRANDS, ...SHOPS].find((s) => s.name === brand) : null;
  if (!shop && matchShop) shop = matchShop.name;
  // 分类：用户未改（仍是默认「食堂」）且品牌命中平台店铺时，自动归入对应大类
  let category = window._formCat || '食堂';
  if (category === '食堂' && matchShop) {
    category = (matchShop.cat === '奶茶咖啡') ? '饮品' : (matchShop.cat === '火锅' || matchShop.cat === '烧烤') ? '外卖' : '外卖';
  }
  const food = {
    id: id || uid(), name, kcal: Math.round(kcal),
    price: Number($('#f-price').value) || 0,
    shop,
    brand: brand || shop,        // 品牌层级优先取品牌名，无则回退店铺名
    series,
    portion: $('#f-portion').value.trim() || '一份',
    category,
    photo: window._formPhoto || '',
    createdAt: old ? old.createdAt : now,
    updatedAt: now,
    editCount: old ? (old.editCount || 0) + 1 : 0,
    macros: old ? old.macros : estimateMacros(kcal)
  };
  const sp = window._formSpec || {};
  const specFilled = !!(sp.sweetness || sp.temp || sp.size || (sp.toppings && sp.toppings.length) || sp.portion || sp.spice);
  if (specFilled) food.spec = { sweetness: sp.sweetness || '', temp: sp.temp || '', size: sp.size || '', toppings: (sp.toppings || []).slice(), portion: sp.portion || '', spice: sp.spice || '' };
  if (window._formUpdateCal) { food.calAdopted = true; }
  const synced = await saveFood(food);
  if (specFilled) await appendSpecLedger(foodShopId(food), food.name, food.spec, food.kcal, food.price);
  /* 反向同步：食谱里改了名字/热量/价格 → 同步到「觅食」对应的单品（仅更新已存在的链接，不凭空新建） */
  if (old && food.shop) {
    const sid = foodShopId(food);
    const edits = await getEdits();
    const it = edits.find((e) => e.kind === 'item' && e.shopId === sid && (e.origName === old.name || e.name === old.name));
    if (it) {
      if (it.added) {
        const newEk = 'item:' + sid + '/' + food.name;
        const upd = Object.assign({}, it); delete upd.ek;
        upd.name = food.name; upd.origName = food.name; upd.kcal = food.kcal; upd.price = food.price;
        await delEdit(it.ek);
        await saveEdit(Object.assign({ ek: newEk }, upd));
        const oldSpec = 'spec:' + sid + '|' + old.name;
        const specE = edits.find((e) => e.ek === oldSpec);
        if (specE) { const su = Object.assign({}, specE); delete su.ek; await delEdit(oldSpec); await saveEdit(Object.assign({ ek: 'spec:' + sid + '|' + food.name }, su)); }
      } else {
        it.name = food.name; it.kcal = food.kcal; it.price = food.price;
        await saveEdit(it);
      }
      await rebuildShops();
    }
  }
  await loadFoods();
  if (old && synced > 0) toast(`已同步 ${synced} 条历史记录的名称/照片 · 历史热量保持不变`, 'brand');
  const also = $('#also-record') && $('#also-record').checked;
  closeSheet();
  if (also) {
    await recordFood(food, defaultMeal());
  } else {
    toast('已存入食谱库 📖', 'green');
    rerender();
  }
  if (!id && FOODS.length === 5 && !congratsShown) {
    congratsShown = true;
    toast('🎉 你的专属食谱库已就绪！点两下就能记录', 'brand');
  }
});

/* ============================================================
 * 我的食谱（专属食品库）
 * ============================================================ */
let RECIPES_FILTER = '全部';
let RECIPES_Q = '';
let RECIPES_SORT = 'recent';
let RECIPES_OPEN = { brands: {}, series: {}, cats: {} };   // 品牌/系列/品类 折叠态（key→true 表示收起）
/* 候选品牌名（食谱库已有 + 平台品牌/店铺），用于录入时自动匹配 */
function brandOptions() {
  const set = new Set();
  FOODS.forEach((f) => { if (f.brand) set.add(f.brand); else if (f.shop) set.add(f.shop); });
  [...BRANDS, ...SHOPS].forEach((s) => set.add(s.name));
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}
function seriesOptions() {
  const set = new Set();
  FOODS.forEach((f) => { if (f.series) set.add(f.series); });
  [...BRANDS, ...SHOPS].forEach((s) => s.items.forEach((it) => { if (it.series) set.add(it.series); }));
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}
function optList(arr) { return arr.map((v) => `<option value="${esc(v)}">`).join(''); }
function catEmoji(c) {
  const m = { '奶茶咖啡': '🧋', '汉堡炸鸡': '🍔', '火锅': '🍲', '烧烤': '🍢', '快餐': '🍟', '食堂': '🍚', '外卖': '🥡', '自制': '🏠', '面包甜点': '🍰', '零食': '🍬', '水果': '🍎', '麻辣烫': '🌶️', '粉面': '🍜' };
  return m[c] || '🍽️';
}
function foodTint(name) {
  let h = 0;
  for (const ch of (name || 'x')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 68% 92%), hsl(${(h + 38) % 360} 62% 87%))`;
}
function recipesEmpty(searching) {
  if (searching) return `<div class="empty-state"><div class="es-icon">🔍</div><div class="es-title">没有匹配的食物</div><div class="es-sub">换个关键词试试（品牌 / 系列 / 食物名）</div></div>`;
  return `<div class="empty-state"><div class="es-icon">📖</div><div class="es-title">食谱库还空着</div><div class="es-sub">点击下方「添加新食物」开始建立你的专属食谱库吧</div><div style="height:16px"></div><button class="btn primary" data-action="food:add">＋ 添加新食物</button></div>`;
}
/* 仅渲染列表区域（品牌树 / 网格 / 空态），供初次渲染与搜索输入复用，避免整页重渲染打断中文输入法 */
/* 食谱卡（两列网格单元），供网格与按品类分组复用 */
function recipeCardHTML(f) {
  const cal = PLATFORM_CALIBRATIONS[f.name];
  const hasNew = cal && f.kcal !== cal.kcal && !f.calAdopted;
  const isNewToday = (f.createdAt || '').slice(0, 10) === todayKey();
  return `
    <div class="food-card" data-action="food:detail" data-id="${f.id}">
      ${hasNew ? '<div class="badge-new">📢 有更新</div>' : isNewToday ? '<div class="badge-new" style="background:var(--green-soft);color:var(--green)">新</div>' : ''}
      <div class="fc-photo">${f.photo ? `<img src="${f.photo}" alt="">` : `<span class="fc-initial" style="background:${foodTint(f.name)}">${esc((f.name || '?').trim().charAt(0))}</span>`}</div>
      <div class="fc-body">
        <div class="fc-name">${esc(f.name)}</div>
        <div class="fc-kcal">${dkr(f.kcal)}</div>
        <div class="cat-tag">${catEmoji(f.category)} ${esc(f.category || '')}</div>
        ${f.brand ? `<div class="fc-meta">${esc(f.brand)}${f.series ? ' · ' + esc(f.series) : ''}</div>` : `<div class="fc-meta">${f.lastEatenAt ? '上次吃：' + daysAgoText(f.lastEatenAt.slice(0, 10)) : '📌 已录入'}</div>`}
      </div>
      <button class="fc-more" data-action="food:edit" data-id="${f.id}" aria-label="编辑或删除">⋯</button>
      <button class="fc-add" data-action="food:quick" data-id="${f.id}" aria-label="快速记录">＋</button>
    </div>`;
}
function renderRecipesList() {
  const filter = RECIPES_FILTER, q = RECIPES_Q, sort = RECIPES_SORT;
  const ql = (q || '').trim().toLowerCase();
  let list = FOODS.slice();
  if (filter !== '全部') list = list.filter((f) => f.category === filter);
  // 搜索优先级：品牌 > 系列 > 产品（模糊包含即可）
  if (ql) list = list.filter((f) => {
    const brand = (f.brand || f.shop || '').toLowerCase();
    const series = (f.series || '').toLowerCase();
    const name = (f.name || '').toLowerCase();
    return brand.includes(ql) || series.includes(ql) || name.includes(ql);
  });
  if (sort === 'kcal-asc') list.sort((a, b) => (a.kcal || 0) - (b.kcal || 0));
  else if (sort === 'kcal-desc') list.sort((a, b) => (b.kcal || 0) - (a.kcal || 0));
  else if (sort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh'));
  else list.sort((a, b) => ((b.lastEatenAt || b.updatedAt) || '').localeCompare((a.lastEatenAt || a.updatedAt) || ''));

  const showTree = sort === 'brand' && !ql;
  if (showTree) {
    const groups = {};
    list.forEach((f) => {
      const brand = f.brand || f.shop || '未分类';
      const series = f.series || '其他';
      (groups[brand] = groups[brand] || {})[series] = (groups[brand][series] || []);
      groups[brand][series].push(f);
    });
    const brands = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'zh'));
    if (!brands.length) return recipesEmpty(false);
    return '<div class="brand-tree">' + brands.map((brand) => {
      const all = Object.values(groups[brand]).flat();
      const bCol = RECIPES_OPEN.brands[brand] ? ' collapsed' : '';
      const seriesKeys = Object.keys(groups[brand]).sort((a, b) => a.localeCompare(b, 'zh'));
      return `
      <div class="brand-group${bCol}" data-b="${esc(brand)}">
        <div class="bg-head" data-action="bg:toggle">
          <span class="bg-caret">${RECIPES_OPEN.brands[brand] ? '▸' : '▾'}</span>
          <span class="bg-name">🏪 ${esc(brand)}</span>
          <span class="bg-count">${all.length} 款产品</span>
          <span class="bg-arrow">→</span>
        </div>
        ${seriesKeys.map((series) => {
          const items = groups[brand][series];
          const sKey = brand + '|' + series;
          const sCol = RECIPES_OPEN.series[sKey] ? ' collapsed' : '';
          return `
          <div class="series-group${sCol}" data-b="${esc(brand)}" data-s="${esc(series)}">
            <div class="sg-head" data-action="sg:toggle">
              <span class="sg-caret">${RECIPES_OPEN.series[sKey] ? '▸' : '▾'}</span>
              <span class="sg-name">${esc(series)}</span>
              <span class="sg-count">${items.length} 种口味</span>
            </div>
            <div class="sg-body">
              ${items.map((f) => `
                <div class="food-line fg-item" data-action="food:detail" data-id="${f.id}">
                  <div class="fl-photo">${photoHTML(f)}</div>
                  <div class="fl-info"><div class="fl-name">${esc(f.name)}</div>
                    <div class="fl-meta">${dkr(f.kcal)}${f.price ? ' · ¥' + f.price : ''}</div></div>
                  <div class="fl-kcal" style="color:var(--brand);font-size:12px" data-action="food:quick" data-id="${f.id}">记录</div>
                  <button class="fl-more" data-action="food:edit" data-id="${f.id}" aria-label="编辑或删除">⋯</button>
                </div>`).join('')}
            </div>
          </div>`;}).join('')}
      </div>`;
    }).join('') + '</div>';
  }
  const showCatTree = sort === 'cat' && !ql;
  if (showCatTree) {
    const groups = {};
    list.forEach((f) => { const c = f.category || '其他'; (groups[c] = groups[c] || []).push(f); });
    const cats = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'zh'));
    if (!cats.length) return recipesEmpty(false);
    return '<div class="brand-tree">' + cats.map((c) => {
      const items = groups[c];
      const col = RECIPES_OPEN.cats[c] ? ' collapsed' : '';
      return `
      <div class="brand-group${col}" data-b="${esc(c)}">
        <div class="bg-head" data-action="cat:toggle">
          <span class="bg-caret">${RECIPES_OPEN.cats[c] ? '▸' : '▾'}</span>
          <span class="bg-name">${catEmoji(c)} ${esc(c)}</span>
          <span class="bg-count">${items.length} 样</span>
          <span class="bg-arrow">→</span>
        </div>
        <div class="sg-body"><div class="food-grid">
          ${items.map((f) => recipeCardHTML(f)).join('')}
        </div></div>
      </div>`;
    }).join('') + '</div>';
  }
  if (!list.length) return recipesEmpty(!!ql);
  return '<div class="food-grid">' + list.map((f) => recipeCardHTML(f)).join('') + '</div>';
}
registerPage('recipes', async function (root) {
  await loadFoods();
  const filter = RECIPES_FILTER, q = RECIPES_Q, sort = RECIPES_SORT;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">📖</span>我的食谱</div>
        <div class="page-sub">你的专属食品库 · ${FOODS.length} 样食物</div>
      </div>
      <button class="btn sm primary" data-action="food:add">＋ 添加</button>
    </div>
    <div class="search" style="margin-bottom:12px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="recipes-search" placeholder="搜品牌 / 系列 / 食物…" value="${esc(q)}" autocomplete="off">
      ${q ? '<span class="search-clear" data-action="recipes:clear">✕</span>' : ''}
    </div>
    <div class="chips" id="recipes-chips" style="margin-bottom:10px">
      ${['全部', '食堂', '外卖', '自制', '饮品', '零食', '水果'].map((c) => `<button class="chip ${filter === c ? 'on' : ''}" data-action="recipes:cat" data-v="${c}">${c}</button>`).join('')}
    </div>
    <div class="chips" id="recipes-sort" style="margin-bottom:16px;opacity:.85">
      ${[['recent', '⏱️ 最近食用'], ['brand', '🏷️ 按品牌'], ['cat', '🍱 按品类'], ['kcal-asc', '热量低→高'], ['kcal-desc', '热量高→低']].map(([v, t]) => `<button class="chip sm ${sort === v ? 'on' : ''}" data-action="recipes:sort" data-v="${v}">${t}</button>`).join('')}
    </div>
    <div id="recipes-body">${renderRecipesList()}</div>`;
  // 搜索：只更新列表区域，不重建 input（保护中文输入法组合）
  const box = $('#recipes-search');
  if (box) box.addEventListener('input', (e) => {
    RECIPES_Q = e.target.value;
    const body = $('#recipes-body');
    if (body) body.innerHTML = renderRecipesList();
    const clr = document.querySelector('#view .search-clear');
    if (clr) clr.style.display = e.target.value ? '' : 'none';
  });
  // 长按卡片 → 快速记录
  setTimeout(() => {
    document.querySelectorAll('#recipes-body .food-card').forEach((card) => {
      bindLongPress(card, () => {
        const f = FOODS.find((x) => x.id === card.dataset.id);
        if (f) askMealSheet(f);
      });
    });
  }, 60);
});
registerAction('recipes:cat', (el) => {
  RECIPES_FILTER = el.dataset.v;
  renderPage('recipes');
});
registerAction('recipes:sort', (el) => {
  RECIPES_SORT = el.dataset.v;
  renderPage('recipes');
});
registerAction('bg:toggle', (el) => {
  const g = el.closest('.brand-group');
  if (!g) return;
  const b = g.dataset.b;
  RECIPES_OPEN.brands[b] = !RECIPES_OPEN.brands[b];
  g.classList.toggle('collapsed', !!RECIPES_OPEN.brands[b]);
  const caret = g.querySelector(':scope > .bg-head .bg-caret');
  if (caret) caret.textContent = RECIPES_OPEN.brands[b] ? '▸' : '▾';
});
registerAction('sg:toggle', (el) => {
  const g = el.closest('.series-group');
  if (!g) return;
  const sKey = g.dataset.b + '|' + g.dataset.s;
  RECIPES_OPEN.series[sKey] = !RECIPES_OPEN.series[sKey];
  g.classList.toggle('collapsed', !!RECIPES_OPEN.series[sKey]);
  const caret = g.querySelector(':scope > .sg-head .sg-caret');
  if (caret) caret.textContent = RECIPES_OPEN.series[sKey] ? '▸' : '▾';
});
registerAction('cat:toggle', (el) => {
  const g = el.closest('.brand-group');
  if (!g) return;
  const c = g.dataset.b;
  RECIPES_OPEN.cats[c] = !RECIPES_OPEN.cats[c];
  g.classList.toggle('collapsed', !!RECIPES_OPEN.cats[c]);
  const caret = g.querySelector(':scope > .bg-head .bg-caret');
  if (caret) caret.textContent = RECIPES_OPEN.cats[c] ? '▸' : '▾';
});
registerAction('recipes:clear', () => {
  RECIPES_Q = '';
  const box = $('#recipes-search');
  if (box) box.value = '';
  const body = $('#recipes-body');
  if (body) body.innerHTML = renderRecipesList();
  const clr = document.querySelector('#view .search-clear');
  if (clr) clr.style.display = 'none';
});
registerAction('food:add', () => openManualForm());
registerAction('food:edit', async (el) => {
  await loadFoods();
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  openSheet(`
    <div class="sheet-title">「${esc(f.name)}」</div>
    <div class="food-line" data-action="food:edit-open" data-id="${f.id}">
      <div class="fl-photo" style="background:var(--brand-soft)">✏️</div>
      <div class="fl-info"><div class="fl-name">编辑</div><div class="fl-meta">修改名称/热量/价格/照片/分类</div></div>
      <div class="li-arrow">›</div>
    </div>
    <div class="food-line" data-action="food:delete" data-id="${f.id}">
      <div class="fl-photo" style="background:var(--red-soft)">🗑️</div>
      <div class="fl-info"><div class="fl-name" style="color:var(--red)">删除</div><div class="fl-meta">历史记录会保留</div></div>
      <div class="li-arrow">›</div>
    </div>
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="sheet:close">取消</button>`);
});
registerAction('food:edit-open', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  const cal = PLATFORM_CALIBRATIONS[f.name];
  const compare = cal && f.kcal !== cal.kcal && !f.calAdopted ? cal : null;
  openManualForm(f, compare);
});
registerAction('food:detail', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  const recs = (await getRecords()).filter((r) => r.foodId === f.id);
  const remaining = Math.max(0, (PROFILE.targetKcal || 1800) - (await getDayStats(todayKey())).kcal);
  const tl = trafficLight(f.kcal, remaining, PROFILE.recordTotal);
  openSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">食物详情</div>
    <div class="card" style="box-shadow:none;background:rgba(0,0,0,0.03)">
      <div class="flex" style="gap:14px">
        <div class="fl-photo" style="width:64px;height:64px;border-radius:20px">${photoHTML(f, true)}</div>
        <div style="flex:1">
          <div class="fl-name" style="font-size:17px">${esc(f.name)} <span class="traffic ${tl.level}"></span></div>
          <div class="muted small" style="margin-top:2px">${dkr(f.kcal)}${f.shop ? ' · ' + esc(f.shop) : ''}</div>
          <div class="muted small">${esc(f.portion || '')}${f.price ? ' · ¥' + f.price : ''} · ${f.category || ''}</div>
        </div>
      </div>
    </div>
    <div class="section-title" style="font-size:14px;margin-top:14px">📜 历史记录（${recs.length}）</div>
    ${recs.length ? recs.slice(0, 8).map((r) => `
      <div class="food-line">
        <div class="fl-photo">${MEAL_EMOJI[r.meal]}</div>
        <div class="fl-info"><div class="fl-name">${MEALS.find((m) => m.k === r.meal).label} · ${r.date}</div>
          <div class="fl-meta">${esc(r.portion || '')}${r.shop ? ' · ' + esc(r.shop) : ''}</div></div>
        <div class="fl-kcal">${r.kcal}kcal</div>
      </div>`).join('') : `<div class="muted small" style="padding:8px 4px">还没有吃过的记录</div>`}
    <div style="height:12px"></div>
    <div class="flex" style="gap:10px">
      <button class="btn primary" style="flex:1" data-action="food:quick" data-id="${f.id}">⚡ 快速记录</button>
      <button class="btn ghost" style="flex:1" data-action="food:edit" data-id="${f.id}">编辑</button>
    </div>`);
});
registerAction('food:quick', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  closeSheet();
  await recordFood(f, defaultMeal());
  toast('⚡ 已记录「' + f.name + '」', 'green');
});
registerAction('food:delete', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  openModal(`
    <div class="modal-title">删除「${esc(f.name)}」？</div>
    <div class="modal-sub">历史记录会保留，只从食谱库移除。</div>
    <div class="flex" style="justify-content:flex-end;gap:10px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn red" data-action="food:del-confirm" data-id="${f.id}">删除</button>
    </div>`);
});
registerAction('food:del-confirm', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  await deleteFood(el.dataset.id);
  // 同步清理「觅食」中由该食物生成的店铺单品/规格账本，避免删不干净又冒出来
  const shopId = foodShopId(f);
  const edits = await getEdits();
  for (const e of edits) {
    if (e.kind === 'item' && e.shopId === shopId && (e.origName === f.name || e.name === f.name)) await delEdit(e.ek);
    if (e.ek === 'spec:' + shopId + '|' + f.name) await delEdit(e.ek);
  }
  await loadFoods();
  closeModal();
  rerender();
  toast('已删除「' + f.name + '」', 'brand', { undo: '撤销', onUndo: async () => {
    await saveFood(Object.assign({}, f, { updatedAt: nowISO() }));
    await loadFoods();
    rerender();
    toast('已恢复', 'green');
  }});
});
