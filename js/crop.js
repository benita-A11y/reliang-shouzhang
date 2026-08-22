/* ============================================================
 * 热量手账 · 照片裁剪编辑器（快速录入）
 * 纯前端实现：四边/四角 20pt 大触控区拖拽（1:1 跟随、边界阻尼吸附）
 *           / 框内拖动移动选框 / 框外拖动移动图片 / 双指捏合缩放
 *           / 旋转90° / 重置 / 预设比例（自由·1:1·4:3·3:2·16:9）
 *           / 井字网格线 / 框外暗化 / 中心十字 / 边缘高亮 / 触觉反馈
 * 不依赖任何第三方库，输出压缩后的 dataURL，直接走现有统一渲染链路。
 * ============================================================ */
'use strict';

/**
 * 打开裁剪编辑器
 * @param {Object} opts
 *   src      {string}  原始图片 dataURL
 *   ratio    {string}  'free' | '1:1' | '4:3' | '3:2' | '16:9'
 *   onDone   {function(dataURL)} 裁剪完成后回调（已压缩的 dataURL）
 *   onCancel {function}          取消回调
 */
function openCropEditor(opts) {
  const src = opts.src;
  const onDone = opts.onDone || function () {};
  const onCancel = opts.onCancel || function () {};
  let ratio = opts.ratio || 'free';

  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.innerHTML = `
    <div class="crop-top">
      <button class="crop-x" data-crop="cancel" type="button">✕ 取消</button>
      <div class="crop-title">裁剪照片</div>
      <button class="crop-done" data-crop="done" type="button">完成 ✓</button>
    </div>
    <div class="crop-stage" id="crop-stage">
      <canvas id="crop-canvas"></canvas>
      <div class="crop-box" id="crop-box">
        <div class="crop-grid"></div>
        <span class="crop-center"></span>
        <span class="crop-size"></span>
        <span class="ch tl" data-h="tl"></span><span class="ch tr" data-h="tr"></span>
        <span class="ch bl" data-h="bl"></span><span class="ch br" data-h="br"></span>
        <span class="ch t" data-h="t"></span><span class="ch b" data-h="b"></span>
        <span class="ch l" data-h="l"></span><span class="ch r" data-h="r"></span>
      </div>
    </div>
    <div class="crop-bottom">
      <div class="crop-tools">
        <button data-crop="rotate" type="button">↺ 旋转</button>
        <button data-crop="reset" type="button">⟳ 重置</button>
      </div>
      <div class="crop-ratios">
        <button data-ratio="free" class="on">自由</button>
        <button data-ratio="1:1">1:1</button>
        <button data-ratio="4:3">4:3</button>
        <button data-ratio="3:2">3:2</button>
        <button data-ratio="16:9">16:9</button>
      </div>
      <div class="crop-hint">拖动四边/四角裁剪 · 框内移动选框 · 框外移动图片 · 双指缩放</div>
    </div>`;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector('#crop-stage');
  const canvas = overlay.querySelector('#crop-canvas');
  const ctx = canvas.getContext('2d');
  const box = overlay.querySelector('#crop-box');

  const img = new Image();
  img.onload = start;
  img.onerror = function () { cleanup(); onCancel(); };
  img.src = src;

  let iw = 0, ih = 0, dpr = 1, SW = 0, SH = 0;
  let scale = 1, tx = 0, ty = 0, rot = 0;       // 图片变换：缩放 / 偏移 / 旋转(度)
  let bx = 0, by = 0, bw = 0, bh = 0;           // 裁剪框（舞台坐标 px）
  let raf = 0;
  const pointers = new Map();
  let mode = '';                                // 'pan' | 'resize' | 'pinch' | 'box-move'
  let stageRect = null;
  let rs = null;                                // resize / pan / box-move 基线
  let pz = null;                                // pinch 基线
  const TOUCH = 22;                             // 边缘触控外延（px），角点热区直径 ≈ 2*1.4*TOUCH ≥ 44pt
  let clampFlash = 0;                           // 边界红色提示 timer
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (_) {} };

  function ratioVal() {
    if (ratio === '1:1') return 1;
    if (ratio === '4:3') return 4 / 3;
    if (ratio === '3:2') return 3 / 2;
    if (ratio === '16:9') return 16 / 9;
    return 0;
  }
  function measure() {
    stageRect = stage.getBoundingClientRect();
    SW = stageRect.width; SH = stageRect.height;
    canvas.style.width = SW + 'px';
    canvas.style.height = SH + 'px';
    canvas.width = Math.max(1, Math.round(SW * dpr));
    canvas.height = Math.max(1, Math.round(SH * dpr));
  }
  function fitScale() { return Math.min(SW / iw, SH / ih) || 1; }

  function setBoxByRatio() {
    const rv = ratioVal();
    let w, h;
    if (rv > 0) {
      const m = 0.06;
      const maxW = SW * (1 - m * 2), maxH = SH * (1 - m * 2);
      if (maxW / maxH > rv) { h = maxH; w = h * rv; } else { w = maxW; h = w / rv; }
    } else {
      w = SW * 0.86; h = SH * 0.72;
    }
    bw = w; bh = h;
    bx = (SW - w) / 2; by = (SH - h) / 2;
  }
  function positionBox() {
    box.style.left = bx + 'px';
    box.style.top = by + 'px';
    box.style.width = bw + 'px';
    box.style.height = bh + 'px';
    const sz = box.querySelector('.crop-size');
    if (sz) sz.textContent = Math.round(bw) + ' × ' + Math.round(bh);
  }
  function reset() {
    scale = fitScale() * 0.92;
    tx = 0; ty = 0; rot = 0;
    setBoxByRatio();
    positionBox();
  }
  function draw() {
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(SW / 2 + tx, SH / 2 + ty);
    ctx.rotate(rot * Math.PI / 180);
    ctx.scale(scale, scale);
    ctx.translate(-iw / 2, -ih / 2);
    ctx.drawImage(img, 0, 0, iw, ih);
    ctx.restore();
  }
  function scheduleDraw() { if (!raf) raf = requestAnimationFrame(draw); }

  function start() {
    iw = img.naturalWidth || img.width;
    ih = img.naturalHeight || img.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    measure();
    if (SW === 0) { requestAnimationFrame(start); return; }
    reset();
    bind();
    draw();
  }

  /* ---------- 几何辅助：分层触控（角点圆形热区 / 边缘中段 / 框内） ---------- */
  // 关键修复：角点只在「离角点的圆形热区」内才触发双向缩放，避免沿边拖拽时误触角落（四角过于灵敏）。
  function edgeHit(x, y) {
    const corners = [
      { h: 'tl', cx: bx, cy: by },
      { h: 'tr', cx: bx + bw, cy: by },
      { h: 'bl', cx: bx, cy: by + bh },
      { h: 'br', cx: bx + bw, cy: by + bh },
    ];
    let best = '', bestD = Infinity;
    for (const c of corners) {
      const d = Math.hypot(x - c.cx, y - c.cy);
      if (d < bestD) { bestD = d; best = c.h; }
    }
    if (bestD <= TOUCH * 1.4) return best;     // 角点：圆形热区（直径≈2*1.4*TOUCH ≥ 44pt）
    // 边缘：仅命中边中段（排除角点区域），单向缩放
    const dT = y - by, dB = (by + bh) - y, dL = x - bx, dR = (bx + bw) - x;
    const midX = x > bx + TOUCH * 1.4 && x < bx + bw - TOUCH * 1.4;
    const midY = y > by + TOUCH * 1.4 && y < by + bh - TOUCH * 1.4;
    if (dT >= 0 && dT <= TOUCH && midX) return 't';
    if (dB >= 0 && dB <= TOUCH && midX) return 'b';
    if (dL >= 0 && dL <= TOUCH && midY) return 'l';
    if (dR >= 0 && dR <= TOUCH && midY) return 'r';
    return '';
  }
  function insideBox(x, y) { return x >= bx && x <= bx + bw && y >= by && y <= by + bh; }

  /* ---------- 边界反馈：红色提示 + 震动 ---------- */
  function flashClamp() {
    if (clampFlash) clearTimeout(clampFlash);
    box.classList.add('clamp');
    buzz(22);
    clampFlash = setTimeout(() => box.classList.remove('clamp'), 220);
  }

  /* ---------- 事件 ---------- */
  function bind() {
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    // 悬停：靠近边缘高亮 + 光标反馈（未按下的鼠标移动）
    stage.addEventListener('pointermove', onHover);
    stage.addEventListener('pointerleave', clearHover);
    overlay.querySelectorAll('[data-crop]').forEach((b) => {
      b.addEventListener('click', () => {
        const a = b.dataset.crop;
        if (a === 'cancel') { cleanup(); onCancel(); }
        else if (a === 'done') { done(); }
        else if (a === 'rotate') { rot = (rot + 90) % 360; scheduleDraw(); }
        else if (a === 'reset') { reset(); scheduleDraw(); }
      });
    });
    overlay.querySelectorAll('[data-ratio]').forEach((b) => {
      b.addEventListener('click', () => {
        ratio = b.dataset.ratio;
        overlay.querySelectorAll('[data-ratio]').forEach((x) => x.classList.toggle('on', x === b));
        setBoxByRatio();
        positionBox();
      });
    });
  }

  function setActiveHandles(h) {
    box.querySelectorAll('.ch').forEach((x) => x.classList.toggle('active', h.indexOf(x.dataset.h) >= 0));
  }

  function onHover(e) {
    if (pointers.size > 0) return;
    const sRect = stage.getBoundingClientRect();
    const sx = e.clientX - sRect.left, sy = e.clientY - sRect.top;
    const h = edgeHit(sx, sy);
    const inBox = insideBox(sx, sy);
    if (h) {
      box.classList.add('edge-near');
      stage.style.cursor = h.length === 2 ? 'nwse-resize' : (h === 't' || h === 'b' ? 'ns-resize' : 'ew-resize');
    } else {
      box.classList.remove('edge-near');
      stage.style.cursor = inBox ? 'move' : 'default';
    }
  }
  function clearHover() {
    box.classList.remove('edge-near');
    stage.style.cursor = '';
  }

  function onDown(e) {
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const sRect = stage.getBoundingClientRect();
    const sx = e.clientX - sRect.left, sy = e.clientY - sRect.top;
    if (pointers.size === 2) {
      mode = 'pinch';
      const pts = [...pointers.values()];
      const m = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const ms = { x: m.x - sRect.left, y: m.y - sRect.top };
      pz = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        scale0: scale, tx0: tx, ty0: ty,
        p0: invMap(ms, scale, tx, ty, rot)
      };
      rs = null;
      return;
    }
    // 单指：近边缘 → 缩放；框内 → 移动选框；框外 → 移动图片
    const h = edgeHit(sx, sy);
    if (h) {
      mode = 'resize';
      box.classList.add('resizing');
      setActiveHandles(h);
      rs = { h: h, bx: bx, by: by, bw: bw, bh: bh, px: e.clientX, py: e.clientY };
      buzz(10);
    } else if (insideBox(sx, sy)) {
      mode = 'box-move';
      rs = { bx0: bx, by0: by, px: e.clientX, py: e.clientY };
    } else {
      mode = 'pan';
      rs = { panTx: tx, panTy: ty, px: e.clientX, py: e.clientY };
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (mode === 'resize' && rs) {
      const dx = e.clientX - rs.px, dy = e.clientY - rs.py;
      resizeBox(rs.h, dx, dy);
      positionBox();
    } else if (mode === 'box-move' && rs) {
      const nx = rs.bx0 + (e.clientX - rs.px);
      const ny = rs.by0 + (e.clientY - rs.py);
      bx = Math.max(0, Math.min(SW - bw, nx));
      by = Math.max(0, Math.min(SH - bh, ny));
      positionBox();
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const m = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const sRect = stage.getBoundingClientRect();
      const ms = { x: m.x - sRect.left, y: m.y - sRect.top };
      const s = Math.max(0.05, pz.scale0 * (dist / pz.dist));
      applyPinch(ms, s, pz);
    } else if (mode === 'pan' && rs) {
      tx = rs.panTx + (e.clientX - rs.px);
      ty = rs.panTy + (e.clientY - rs.py);
    }
    scheduleDraw();
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    if (pointers.size === 1) {
      // 从双指退回单指：以剩余手指重置为平移基准，避免跳变
      const p = [...pointers.values()][0];
      mode = 'pan';
      rs = { panTx: tx, panTy: ty, px: p.x, py: p.y };
      pz = null;
    } else if (pointers.size === 0) {
      mode = ''; rs = null; pz = null;
      box.classList.remove('resizing', 'edge-near');
      setActiveHandles('');
      clearHover();
      buzz(10);
    }
  }

  /* ---------- 几何辅助 ---------- */
  function invMap(M, sc, txx, tyy, rt) {
    const cx = SW / 2 + txx, cy = SH / 2 + tyy;
    const vx = M.x - cx, vy = M.y - cy;
    const a = -rt * Math.PI / 180;
    const rx = vx * Math.cos(a) - vy * Math.sin(a);
    const ry = vx * Math.sin(a) + vy * Math.cos(a);
    return { x: rx / sc + iw / 2, y: ry / sc + ih / 2 };
  }
  function applyPinch(m, s, base) {
    const ax = base.p0.x - iw / 2, ay = base.p0.y - ih / 2;
    const ang = s * Math.PI / 180 * 0; // 无旋转手势，仅缩放
    const a = (rot) * Math.PI / 180;
    const dxp = s * ax, dyp = s * ay;
    const vx = dxp * Math.cos(a) - dyp * Math.sin(a);
    const vy = dxp * Math.sin(a) + dyp * Math.cos(a);
    const cx = m.x - vx, cy = m.y - vy;
    scale = s;
    tx = cx - SW / 2; ty = cy - SH / 2;
  }

  function resizeBox(handle, dx, dy) {
    let x1 = bx, y1 = by, x2 = bx + bw, y2 = by + bh;
    if (handle.indexOf('l') >= 0) x1 = bx + dx;
    if (handle.indexOf('r') >= 0) x2 = bx + bw + dx;
    if (handle.indexOf('t') >= 0) y1 = by + dy;
    if (handle.indexOf('b') >= 0) y2 = by + bh + dy;
    let nw = x2 - x1, nh = y2 - y1;
    const rv = ratioVal();
    const MIN = 36;
    if (nw < MIN) nw = MIN;
    if (nh < MIN) nh = MIN;
    if (rv > 0) {
      const isCorner = handle.length === 2;
      if (isCorner) {
        if (Math.abs(dx) >= Math.abs(dy)) nh = nw / rv; else nw = nh * rv;
      } else {
        if (handle === 'l' || handle === 'r') nh = nw / rv; else nw = nh * rv;
      }
      const anchorLeft = handle.indexOf('l') >= 0 ? (bx + bw) : x1;
      const anchorTop = handle.indexOf('t') >= 0 ? (by + bh) : y1;
      x1 = anchorLeft - nw; y1 = anchorTop - nh; x2 = anchorLeft; y2 = anchorTop;
    }
    // 限制在舞台内（吸附边界；触到边界给红色反馈）
    let over = 0;
    if (x1 < 0) { over += -x1; x2 -= x1; x1 = 0; }
    if (y1 < 0) { over += -y1; y2 -= y1; y1 = 0; }
    if (x2 > SW) { over += x2 - SW; x1 -= (x2 - SW); x2 = SW; }
    if (y2 > SH) { over += y2 - SH; y1 -= (y2 - SH); y2 = SH; }
    bx = x1; by = y1; bw = Math.max(MIN, x2 - x1); bh = Math.max(MIN, y2 - y1);
    if (over > 0.5) flashClamp();
  }

  /* ---------- 输出 ---------- */
  function done() {
    let OW = Math.round(bw * dpr), OH = Math.round(bh * dpr);
    const CAP = 1000;
    if (Math.max(OW, OH) > CAP) {
      const k = CAP / Math.max(OW, OH);
      OW = Math.round(OW * k); OH = Math.round(OH * k);
    }
    const out = document.createElement('canvas');
    out.width = OW; out.height = OH;
    const octx = out.getContext('2d');
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, OW, OH);
    octx.scale(OW / bw, OH / bh);          // 1 单位 = 1 舞台px
    octx.translate(-bx, -by);              // 裁剪原点移到 0,0
    octx.translate(SW / 2 + tx, SH / 2 + ty);
    octx.rotate(rot * Math.PI / 180);
    octx.scale(scale, scale);
    octx.translate(-iw / 2, -ih / 2);
    octx.drawImage(img, 0, 0, iw, ih);
    let dataURL;
    try { dataURL = out.toDataURL('image/jpeg', 0.82); }
    catch (_) { dataURL = src; }
    cleanup();
    onDone(dataURL);
  }

  function cleanup() {
    if (raf) cancelAnimationFrame(raf);
    overlay.remove();
  }
}
