import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const [baseUrl, session] = process.argv.slice(2);
if (!baseUrl || !session) throw new Error("usage: node scripts/run_live_model_validation.mjs <base-url> <session>");

const root = baseUrl.replace(/\/$/, "");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `live-model-validation-${stamp}`);
const report = { started_at: new Date().toISOString(), base_url: root, tests: [] };
const headers = { Cookie: `huiju_session=${session}` };

await mkdir(outputDir, { recursive: true });

function absolute(path) {
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

async function saveReport() {
  await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

async function request(path, init = {}) {
  const response = await fetch(absolute(path), {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path} ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function submitJson(path, payload, key) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
}

async function uploadImage(path, contentType = "image/webp") {
  const source = await readFile(path);
  const form = new FormData();
  form.append("image", new Blob([source], { type: contentType }), basename(path));
  return request("/api/v1/images/uploads", { method: "POST", body: form });
}

async function uploadMedia(path, contentType) {
  const source = await readFile(path);
  const form = new FormData();
  form.append("media", new Blob([source], { type: contentType }), basename(path));
  return request("/api/v1/media/uploads", { method: "POST", body: form });
}

async function uploadAudio(path, contentType) {
  const source = await readFile(path);
  const form = new FormData();
  form.append("media", new Blob([source], { type: contentType }), basename(path));
  return request("/api/v1/media/uploads", { method: "POST", body: form });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(path, name, row) {
  const limit = Date.now() + 10 * 60 * 1000;
  while (Date.now() < limit) {
    await delay(5000);
    const result = await request(path);
    row.provider_status = result.provider_status || result.status;
    if (result.status === "completed") return result;
    if (["failed", "cancelled"].includes(result.status)) throw new Error(`${name} ${result.error || result.status}`);
  }
  throw new Error(`${name} validation timeout`);
}

function suffix(contentType, url) {
  const byMime = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "video/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav",
    "audio/ogg": ".ogg", "audio/mp4": ".m4a",
  };
  return byMime[contentType] || extname(new URL(absolute(url)).pathname) || ".bin";
}

async function retain(url, filename) {
  const response = await fetch(absolute(url), { headers });
  if (!response.ok) throw new Error(`GET ${url} ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0] || "application/octet-stream";
  const path = join(outputDir, `${filename}${suffix(contentType, url)}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return { path, content_type: contentType };
}

async function runImage(model) {
  const row = { kind: "image", model, operation: "text_to_image", status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const job = await submitJson("/api/v1/images/generations", {
      model,
      prompt: "一张无品牌精品茶叶的电商主视觉：白色陶瓷茶罐置于浅色胡桃木桌面，窗边晨光从左侧照入，罐旁有三片新鲜茶叶，留出右上角干净留白，写实产品摄影，画面无水印、无商标。",
      aspect_ratio: "4:5",
      quality: "standard",
      resolution: "720p",
      style: "editorial",
      count: 1,
      output_mode: "independent",
    }, `live-image-${model}`);
    const result = await waitFor(`/api/v1/images/jobs/${job.request_id}`, model, row);
    row.image_count = result.images.length;
    row.artifacts = [];
    for (const [index, image] of result.images.entries()) {
      row.artifacts.push(await retain(image.url, `image-${model}-${index + 1}`));
    }
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await saveReport();
  console.log(`${row.status} image ${model}`);
}

const toolScenarios = {
  seedream_4_0: { operation: "edit", prompt: "只把天空改成傍晚柔和粉橙色，保留茶罐、木桌、茶叶的形状、位置和材质。" },
  seedream_4_5: { operation: "redraw", prompt: "重新绘制背景为干净的浅灰摄影棚背景，主体茶罐和茶叶保持一致。" },
  seedream_5_0: { operation: "multiview", prompt: "生成同一茶罐的正面、左侧 45 度和俯视三视角产品展示，三视角排在同一画面。", views: 3 },
  seedream_5_0_pro: { operation: "layers", prompt: "按背景、茶罐、茶叶、桌面阴影拆分为可独立复用的透明图层，并保留完整底图。" },
  bailian_qwen_3: { operation: "panorama", prompt: "将画面向左右自然延展成 2:1 的茶园晨雾全景，原有茶罐位于画面中央，边缘无重复物体。" },
  bailian_qwen_3_pro: { operation: "multiangle", prompt: "保持同一个白色茶罐，生成正面、左前方 45 度、右前方 45 度三个产品角度，材质与标签区域一致。", views: 3 },
  bailian_wan_2_7: { operation: "upscale", prompt: "在不改变构图和主体细节的前提下提升产品边缘、陶瓷高光与茶叶纹理清晰度。", resolution: "2k" },
  bailian_wan_2_7_pro: { operation: "interactive", prompt: "以标注点为中心，将该局部的光线调整为柔和暖色，其余主体和构图完全保持不变。", annotations: [{ image_index: 1, kind: "point", coordinates: [120, 120] }] },
};

async function runTool(model, sourceId) {
  const scenario = toolScenarios[model];
  if (!scenario) throw new Error(`missing tool scenario for ${model}`);
  const row = { kind: "image_tool", model, ...scenario, status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const job = await submitJson("/api/v1/images/tools", {
      model,
      upload_id: sourceId,
      resolution: scenario.resolution || "720p",
      quality: "standard",
      views: scenario.views || 3,
      annotations: scenario.annotations || [],
      operation: scenario.operation,
      prompt: scenario.prompt,
    }, `live-tool-${model}`);
    const result = await waitFor(`/api/v1/images/jobs/${job.request_id}`, model, row);
    row.image_count = result.images.length;
    row.artifacts = [];
    for (const [index, image] of result.images.entries()) {
      row.artifacts.push(await retain(image.url, `tool-${model}-${index + 1}`));
    }
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await saveReport();
  console.log(`${row.status} image_tool ${model} ${scenario.operation}`);
}

async function runAudio(model) {
  const row = { kind: "audio", model, operation: "text_to_speech", status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const payload = {
      model,
      text: "清晨的茶园刚刚苏醒。请跟随一缕茶香，感受这一杯茶从山野到桌面的安静时刻。",
      voice: model === "doubao-tts-2.0" ? "zh_female_vv_uranus_bigtts" : "Cherry",
      language_type: "Chinese",
      format: "mp3",
      sample_rate: 24000,
      speed_ratio: 1,
      loudness_ratio: 1,
      emotion: "",
      emotion_scale: 4,
      instructions: model === "qwen3-tts-instruct-flash" ? "用温暖、自然、清晰的普通话朗读，语速舒缓，适合品牌短片旁白。" : "",
    };
    const job = await submitJson("/api/v1/audio/tts", payload, `live-audio-${model}`);
    const result = await waitFor(`/api/v1/audio/jobs/${job.request_id}`, model, row);
    row.charged_credits = result.charged_credits;
    row.artifact = await retain(result.url, `audio-${model}`);
    row.status = "passed";
    await saveReport();
    console.log(`${row.status} audio ${model}`);
    return { row, result };
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
    await saveReport();
    console.log(`${row.status} audio ${model}`);
    return { row };
  }
}

const videoScenarios = {
  "wan2.7-t2v-2026-06-12": { operation: "text_to_video", upload_ids: [], duration: 2, prompt: "清晨薄雾中的中国茶园缓慢推进镜头，露珠在茶叶边缘闪光，一位采茶人从远处经过，真实电影光影。" },
  "wan2.7-i2v-2026-04-25": { operation: "image_to_video", source: "tea", duration: 2, prompt: "镜头从静止的茶罐缓慢环绕到左前方，晨光轻微移动，茶叶随微风轻轻摆动。" },
  "wan2.7-r2v-2026-06-12": { operation: "reference_to_video", source: "tea", duration: 2, prompt: "参考这张产品图的茶罐、桌面和光线，生成稳定的三秒产品推镜，主体比例不变。" },
  seedance_2_0: { operation: "reference_to_video", source: "video", duration: 4, prompt: "参考输入视频的海岸悬崖、海浪和电影机位，生成一段镜头向前缓慢推进的自然风景视频。" },
  seedance_2_0_mini: { operation: "reference_to_video", source: "tea", duration: 4, prompt: "参考茶罐图片的主体与构图，生成短促稳定的产品展示镜头，光线自然变化。" },
  seedance_2_0_fast: { operation: "reference_to_video", source: "portrait", duration: 4, prompt: "参考人物肖像，生成轻微转头、眨眼和呼吸的自然人物短片，背景保持简洁。" },
  seedance_2_5: { operation: "reference_to_video", source: "video", duration: 4, prompt: "参考输入视频的海岸悬崖场景，生成连贯的航拍式前推进镜头，海浪和薄雾具有真实运动。" },
  "wan2.7-videoedit": { operation: "video_edit", source: "video", duration: 2, prompt: "保留原视频中的悬崖和海面运动，将整体调色改为日落金色时刻，阴影保持细节。" },
  "wanx2.1-vace-plus": { operation: "video_extension", source: "video", duration: 5, prompt: "从原视频末尾自然延展五秒：镜头继续平稳前进，海浪运动连续，悬崖轮廓不跳变。" },
  "video-style-transform": { operation: "video_style", source: "video", duration: 2, style_id: 3, prompt: "将原视频转为细腻水彩插画风格，保留镜头运动、海岸结构和时间连续性。" },
  videoretalk: { operation: "lip_sync", source: "video_audio", duration: 2, prompt: "让输入视频中的人物与普通话音频自然同步口型，保持面部身份和背景稳定。" },
  "wan2.2-animate-mix": { operation: "character_swap_video", source: "video_portrait", duration: 2, prompt: "将输入视频中的人物替换为参考肖像人物，保持原视频动作、镜头和服装运动节奏。", rights_confirmed: true },
  "wan2.2-s2v": { operation: "digital_human", source: "portrait_audio", duration: 2, prompt: "让参考肖像以自然站姿完成品牌旁白，口型与中文音频同步，表情克制专业。" },
};

async function runVideo(model, sourceIds) {
  const scenario = videoScenarios[model];
  if (!scenario) throw new Error(`missing video scenario for ${model}`);
  const row = { kind: "video", model, operation: scenario.operation, status: "submitted" };
  report.tests.push(row);
  await saveReport();
  const uploadIds = {
    tea: [sourceIds.tea],
    portrait: [sourceIds.portrait],
    video: [sourceIds.video],
    video_audio: [sourceIds.video, sourceIds.audio],
    video_portrait: [sourceIds.video, sourceIds.portrait],
    portrait_audio: [sourceIds.portrait, sourceIds.audio],
  }[scenario.source] || scenario.upload_ids;
  try {
    const job = await submitJson("/api/v1/videos/generations", {
      model,
      operation: scenario.operation,
      upload_ids: uploadIds,
      prompt: scenario.prompt,
      resolution: model === "video-style-transform" || model === "videoretalk" || model === "wan2.2-animate-mix" || model === "wan2.2-s2v" ? "480P" : "720P",
      ratio: "16:9",
      duration: scenario.duration,
      style_id: scenario.style_id || 0,
      rights_confirmed: Boolean(scenario.rights_confirmed),
    }, `live-video-${model.replace(/[^A-Za-z0-9_-]/g, "-")}`);
    const result = await waitFor(`/api/v1/videos/jobs/${job.request_id}`, model, row);
    row.charged_credits = result.charged_credits;
    row.artifact = await retain(result.url, `video-${model}`);
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await saveReport();
  console.log(`${row.status} video ${model} ${scenario.operation}`);
}

const catalog = await request("/api/v1/models");
const portrait = await uploadImage("frontend/static/showcase/v167/plaza/red-dancer.webp");
const video = await uploadMedia("frontend/static/showcase/v167/plaza/ocean-cliff-motion.mp4", "video/mp4");

for (const [model, value] of Object.entries(catalog.models)) if (value.available) await runImage(model);
const teaImage = report.tests.find((item) => item.kind === "image" && item.status === "passed");
if (!teaImage) throw new Error("no image model produced the required product-image reference");
const tea = await uploadImage(teaImage.artifacts[0].path, teaImage.artifacts[0].content_type);
for (const [model, value] of Object.entries(catalog.tool_models)) if (value.available) await runTool(model, tea.upload_id);

const audioResults = [];
for (const [model, value] of Object.entries(catalog.audio_models)) if (value.available) audioResults.push(await runAudio(model));
const qwenAudio = audioResults.find(({ row }) => row.model === "qwen3-tts-flash" && row.status === "passed");
if (!qwenAudio) throw new Error("qwen3-tts-flash did not provide the required audio reference");
const audio = await uploadAudio(qwenAudio.row.artifact.path, qwenAudio.row.artifact.content_type);

for (const [model, value] of Object.entries(catalog.video_models)) if (value.available) {
  await runVideo(model, { tea: tea.upload_id, portrait: portrait.upload_id, video: video.upload_id, audio: audio.upload_id });
}

report.finished_at = new Date().toISOString();
report.summary = report.tests.reduce((summary, item) => {
  summary[item.status] = (summary[item.status] || 0) + 1;
  return summary;
}, {});
await saveReport();
console.log(JSON.stringify(report.summary));
