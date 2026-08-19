/* ============================================================
 * 热量手账 · AI 视觉识别层（批量拆解录入）
 * - 支持 OpenAI 兼容视觉接口（GPT-4o / 豆包 / 自定义）
 * - 未配置密钥时自动走"本地演示模式"，流程可完整走通
 * 依赖：store.js 中的 PROFILE / saveProfile
 * ============================================================ */
'use strict';

/* ---------- AI 设置（存在 PROFILE.aiSettings，仅本机浏览器） ---------- */
const AI_DEFAULT = {
  provider: 'openai',                                  // openai | doubao | custom
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini'
};

function getAISettings() {
  return Object.assign({}, AI_DEFAULT, (PROFILE && PROFILE.aiSettings) || {});
}
async function saveAISettings(s) {
  PROFILE.aiSettings = Object.assign({}, AI_DEFAULT, s);
  return saveProfile(PROFILE);
}

/* ---------- 识别提示词 ---------- */
const VISION_SYSTEM =
  '你是食物热量识别助手，负责从"食物汇总图/菜单截图/货架照片"中拆解出每一种独立的食物。' +
  '你只输出一个 JSON 对象，禁止输出任何其他文字、注释或 Markdown。' +
  'JSON 格式：{"items":[{"name":"食物名称","kcal":数字,"unit":"/小包|/块|/100g等","category":"零食|食堂|外卖|自制|饮品|水果","confidence":0到100,"note":"规格或补充说明"}]}' +
  '要求：1) name 为图片中该食物区域的主要文字；2) kcal 为该食物每份的千卡数字（只保留数字）；' +
  '3) confidence 是识别置信度；4) 如果图片无法识别出任何食物，返回 {"items":[]}。';

const VISION_USER =
  '请拆解这张图片中的所有食物，逐项输出。每个食物尽量给出 名称 / 热量(kcal) / 单位 / 分类 / 置信度。';

/* ---------- 工具函数 ---------- */
const _llmSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function _clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function _validBox(b) {
  return Array.isArray(b) && b.length === 4 &&
    b.every((v) => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1);
}

function _normCat(c) {
  const map = { 零食: '零食', 主食: '食堂', 零食小吃: '零食', 水果: '水果', 饮料: '饮品', 饮品: '饮品', 食堂: '食堂', 外卖: '外卖', 自制: '自制' };
  return map[c] || '零食';
}

/* 把 LLM 返回的文本解析成结构化条目数组 */
function parseVisionResult(text) {
  if (!text) return [];
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let obj;
  try { obj = JSON.parse(t.slice(start, end + 1)); } catch { return []; }
  const arr = Array.isArray(obj) ? obj : (Array.isArray(obj.items) ? obj.items : []);
  return arr;
}

/* 归一化识别条目 */
function normalizeItems(arr, { src = '', demo = false } = {}) {
  const out = [];
  (Array.isArray(arr) ? arr : []).forEach((it, i) => {
    if (!it) return;
    const name = String(it.name || it.food || it.title || it.foodName || '').trim();
    const kcalRaw = Number(it.kcal ?? it.calories ?? it.calorie ?? it.heat ?? 0);
    const kcal = Math.max(0, Math.round(kcalRaw));
    if (!name || !(kcal > 0)) return;
    const conf = Math.round(_clamp(Number(it.confidence ?? it.score ?? it.conf ?? 75), 0, 100));
    out.push({
      i,
      name,
      kcal,
      unit: String(it.unit || it.portion || '/份').trim() || '/份',
      category: _normCat(it.category),
      confidence: conf,
      note: String(it.note || '').trim(),
      box: _validBox(it.box) ? it.box : null,
      photo: String(it.photo || '').trim(),
      source: src || 'AI识别',
      demo: !!demo,
      checked: true
    });
  });
  return out;
}

/* ---------- 核心：识别图片中的食物 ---------- */
const LLM = {
  isConfigured() {
    return !!(getAISettings().apiKey || '').trim();
  },

  /** 识别：dataURL(JPEG) -> Promise<items[]>；未配置密钥时走本地演示模式 */
  async recognizeFoodsFromImage(dataURL, srcName = '图片导入') {
    const cfg = getAISettings();
    if (!cfg.apiKey.trim()) return this.demoBreakdown(dataURL, srcName);
    return this._callVision(dataURL, cfg, srcName);
  },

  /** 真实调用 OpenAI 兼容 /chat/completions 视觉接口 */
  async _callVision(dataURL, cfg, srcName) {
    const base = (cfg.baseUrl || AI_DEFAULT.baseUrl).replace(/\/+$/, '');
    const url = base + '/chat/completions';
    const body = {
      model: cfg.model || AI_DEFAULT.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: VISION_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_USER },
            { type: 'image_url', image_url: { url: dataURL } }
          ]
        }
      ]
    };
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('无法连接 AI 接口：' + e.message);
    }
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try {
        const e = await res.json();
        if (e && e.error && e.error.message) msg = e.error.message;
      } catch { /* ignore */ }
      throw new Error('AI 接口返回错误：' + msg);
    }
    const data = await res.json();
    const content = data && data.choices && data.choices[0] &&
      data.choices[0].message && data.choices[0].message.content;
    const raw = parseVisionResult(content);
    if (!raw.length) throw new Error('AI 没有识别出任何食物，试试更清晰的图');
    return normalizeItems(raw, { src: srcName, demo: false });
  },

  /** 本地演示模式：从食谱库取若干条，模拟一次"拆解"结果 */
  async demoBreakdown(dataURL, srcName) {
    const list = (typeof FOODS !== 'undefined' && FOODS) || [];
    const picked = list.slice(0, 7);
    const items = picked.map((f, i) => ({
      i,
      name: f.name,
      kcal: f.kcal,
      unit: f.portion || '/份',
      category: f.category || '零食',
      confidence: 60 + ((i * 7) % 30), // 55~89 的黄色区间，提示需核对
      note: '',
      box: null,
      photo: '',
      source: srcName,
      demo: true,
      checked: true
    }));
    if (items.length < 3) { // 食谱库太少时补几条演示零食
      const extra = [
        { name: '旺旺仙贝', kcal: 37, unit: '/小包', category: '零食' },
        { name: '法丽兹', kcal: 65, unit: '/块', category: '零食' },
        { name: 'LIPO 巧克力', kcal: 120, unit: '/小包', category: '零食' }
      ];
      let j = 0;
      while (items.length < 4 && j < extra.length) {
        const e = extra[j++];
        items.push({ i: items.length, ...e, confidence: 62 + j * 6, note: '', box: null, photo: '', source: srcName, demo: true, checked: true });
      }
    }
    return items;
  },

  /** 测试连接：发一条文本消息验证 key/接口可用 */
  async test(cfg) {
    const base = (cfg.baseUrl || AI_DEFAULT.baseUrl).replace(/\/+$/, '');
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || AI_DEFAULT.model,
        temperature: 0,
        max_tokens: 8,
        messages: [{ role: 'user', content: '回复"OK"两个字' }]
      })
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const e = await res.json(); if (e.error && e.error.message) msg = e.error.message; } catch { /* ignore */ }
      return { ok: false, msg };
    }
    const data = await res.json();
    const model = (data && data.model) || cfg.model;
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return { ok: true, model, msg: content };
  }
};

/* 按归一化坐标 box=[x,y,w,h]（0~1）从原图裁剪小图 */
function cropBox(dataURL, box) {
  return new Promise((resolve) => {
    if (!_validBox(box)) return resolve(dataURL);
    const img = new Image();
    img.onload = () => {
      try {
        const [x, y, w, h] = box;
        const c = document.createElement('canvas');
        const W = Math.max(4, Math.round(img.width * w));
        const H = Math.max(4, Math.round(img.height * h));
        c.width = W; c.height = H;
        c.getContext('2d').drawImage(img, img.width * x, img.height * y, W, H, 0, 0, W, H);
        resolve(c.toDataURL('image/jpeg', 0.85));
      } catch { resolve(dataURL); }
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}
