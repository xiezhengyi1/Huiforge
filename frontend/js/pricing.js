const textOf = (id, value) => { const node = document.querySelector(id); if (node) node.textContent = value; };
let tariff = null;
let activeTariff = 'image';
import { locale, t } from "./core/locale.js?v=20261125-ui-polish-v3";
const MODEL_NAMES = {
  qwen_image:'Qwen Standard', qwen_image_edit:'Qwen Image Edit', zimage_turbo:'Z-Image Turbo', zimage:'Z-Image',
  flux:'FLUX.1', flux2:'FLUX.2', gpt_image:'GPT Image', seedream_4_0:'Seedream 4.0', seedream_4_5:'Seedream 4.5',
  seedream_5_0:'Seedream 5.0 Lite', seedream_5_0_pro:'Seedream 5.0 Pro', bailian_qwen_3:'Qwen Image 3.0',
  bailian_qwen_3_pro:'Qwen Image 3.0 Pro', bailian_wan_2_7:'Wan Image 2.7', bailian_wan_2_7_pro:'Wan Image 2.7 Pro',
  google_nano_banana:'Nano Banana', google_nano_banana_pro:'Nano Banana Pro',
  google_nano_banana_2:'Nano Banana 2', google_nano_banana_2_lite:'Nano Banana 2 Lite',
  seedance_2_0:'Seedance 2.0', seedance_2_0_mini:'Seedance 2.0 Mini', seedance_2_0_fast:'Seedance 2.0 Fast', seedance_2_5:'Seedance 2.5',
  'wan2.7-t2v-2026-06-12':'Wan 2.7 文生视频', 'wan2.7-i2v-2026-04-25':'Wan 2.7 图生视频',
  'wan2.7-r2v-2026-06-12':'Wan 2.7 参考生视频', 'wan2.7-videoedit':'Wan 2.7 视频编辑', 'wanx2.1-vace-plus':'VACE 视频延展',
  'video-style-transform':'视频风格化', videoretalk:'口型同步', 'wan2.2-animate-mix':'视频角色替换', 'wan2.2-s2v':'数字人播报',
  'video-depth-anything-small':'转深度图', 'qwen3-tts-flash':'Qwen3 配音', 'qwen3-tts-instruct-flash':'Qwen3 指令配音',
  'qwen-audio-3.0-tts-flash':'Qwen Audio 配音 Flash', 'qwen-audio-3.0-tts-plus':'Qwen Audio 配音 Plus', 'doubao-tts-2.0':'豆包语音 2.0',
};

function tariffRow(model, specification, publicPrice, memberPrice, unit) {
  const row = document.createElement('div');
  const modelName = MODEL_NAMES[model] || model;
  for (const value of [locale !== "zh-CN" && /[\u3400-\u9fff]/.test(modelName) ? model : modelName, specification, `${publicPrice} ${unit}`, `${memberPrice} ${unit}`]) {
    const cell = document.createElement('span');
    cell.textContent = value;
    row.append(cell);
  }
  return row;
}

function renderTariff() {
  const table = document.querySelector('#tariff-table');
  if (!table || !tariff) return;
  table.replaceChildren();
  const head = document.createElement('div');
  head.className = 'tariff-head';
  for (const value of ['模型','规格','非会员','会员']) {
    const cell = document.createElement('b');
    cell.textContent = value;
    head.append(cell);
  }
  table.append(head);
  if (activeTariff === 'image') {
    for (const [model, rule] of Object.entries(tariff.image || {})) {
      for (const [resolution, publicPrice] of Object.entries(rule.by_resolution_public || {})) {
        table.append(tariffRow(model, resolution, publicPrice, rule.by_resolution_member?.[resolution] ?? publicPrice, t('额度/张','credits/image')));
      }
    }
  } else if (activeTariff === 'video') {
    for (const [model, rules] of Object.entries(tariff.video || {})) {
      for (const [specification, price] of Object.entries(rules)) {
        const label = specification.replace(':video',t(' · 含视频',' · With input video')).replace(':no_video',t(' · 不含视频',' · No input video'));
        table.append(tariffRow(model, label, price.public, price.member, t('额度/秒','credits/sec')));
      }
    }
  } else {
    for (const [model, price] of Object.entries(tariff.audio || {})) {
      table.append(tariffRow(model, t('按输出时长预估'), price.public, price.member, t('额度/秒','credits/sec')));
    }
  }
}

async function loadBalance() {
  try {
    const response = await fetch('/api/v1/credits', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('balance unavailable');
    const balance = await response.json();
    textOf('#pricing-total', balance.total ?? 0);
    textOf('#pricing-daily', balance.daily ?? 0);
    textOf('#pricing-daily-card', balance.daily ?? 0);
    textOf('#pricing-monthly', balance.monthly ?? 0);
    textOf('#pricing-topup', balance.topup ?? 0);
    textOf('#pricing-membership-status', balance.membership_tier && balance.membership_tier !== 'free' ? '会员用户' : '免费用户');
  } catch {
    textOf('#pricing-total', '—');
  }
}

async function loadTariff() {
  try {
    const response = await fetch('/api/v1/pricing', { credentials:'same-origin' });
    if (!response.ok) throw new Error('tariff unavailable');
    tariff = await response.json();
    renderTariff();
  } catch {
    const table = document.querySelector('#tariff-table');
    if (table) table.textContent = '暂时无法读取价格，请刷新重试。';
  }
}

document.querySelectorAll('[data-tariff-tab]').forEach((button) => button.addEventListener('click', () => {
  activeTariff = button.dataset.tariffTab;
  document.querySelectorAll('[data-tariff-tab]').forEach((entry) => entry.classList.toggle('active', entry === button));
  renderTariff();
}));

document.querySelectorAll('[data-purchase]').forEach((button) => button.addEventListener('click', () => {
  textOf('#purchase-note', '支付功能即将接入，当前不会产生扣款。');
}));

loadBalance();
loadTariff();
