import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const [baseUrl, session] = process.argv.slice(2);
if (!baseUrl || !session) throw new Error("usage: node scripts/continue_live_model_validation.mjs <base-url> <session>");

const root = baseUrl.replace(/\/$/, "");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `live-model-validation-continued-${stamp}`);
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
  const response = await fetch(absolute(path), { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path} ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function submit(path, payload, key) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
}

async function uploadImage(path, contentType) {
  const form = new FormData();
  form.append("image", new Blob([await readFile(path)], { type: contentType }), basename(path));
  return request("/api/v1/images/uploads", { method: "POST", body: form });
}

async function uploadMask(path) {
  const form = new FormData();
  form.append("mask", new Blob([await readFile(path)], { type: "image/png" }), basename(path));
  return request("/api/v1/images/masks", { method: "POST", body: form });
}

async function uploadMedia(path, contentType) {
  const form = new FormData();
  form.append("media", new Blob([await readFile(path)], { type: contentType }), basename(path));
  return request("/api/v1/media/uploads", { method: "POST", body: form });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(path, row) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await delay(5000);
    const result = await request(path);
    row.provider_status = result.provider_status || result.status;
    if (result.status === "completed") return result;
    if (["failed", "cancelled"].includes(result.status)) throw new Error(result.error || result.status);
  }
  throw new Error("validation_timeout");
}

function suffix(contentType, url) {
  const table = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/ogg": ".ogg", "audio/mp4": ".m4a" };
  return table[contentType] || extname(new URL(absolute(url)).pathname) || ".bin";
}

async function retain(url, name) {
  const response = await fetch(absolute(url), { headers });
  if (!response.ok) throw new Error(`GET ${url} ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0] || "application/octet-stream";
  const path = join(outputDir, `${name}${suffix(contentType, url)}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return { path, content_type: contentType };
}

async function runTool(model, operation, prompt, sourceId, extra = {}) {
  const row = { kind: "image_tool", model, operation, status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const job = await submit("/api/v1/images/tools", {
      model, operation, upload_id: sourceId, prompt, resolution: extra.resolution || "720p", quality: "standard", views: extra.views || 3,
      ...(extra.mask_upload_id ? { mask_upload_id: extra.mask_upload_id } : {}),
      ...(extra.camera ? { camera: extra.camera } : {}),
      ...(extra.annotations ? { annotations: extra.annotations } : {}),
    }, `continued-tool-${model}-${operation}`);
    const result = await waitFor(`/api/v1/images/jobs/${job.request_id}`, row);
    row.image_count = result.images.length;
    row.artifacts = [];
    for (const [index, image] of result.images.entries()) row.artifacts.push(await retain(image.url, `tool-${model}-${operation}-${index + 1}`));
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await saveReport();
  console.log(`${row.status} image_tool ${model} ${operation}`);
}

async function runPortrait() {
  const row = { kind: "image", model: "qwen_image", operation: "text_to_image_portrait_reference", status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const job = await submit("/api/v1/images/generations", {
      model: "qwen_image",
      prompt: "一位穿米白色风衣的成年女性，短发，自然站姿，半身正面肖像，纯浅灰背景，柔和棚拍光线，面部清晰，写实摄影，无文字、无水印。",
      aspect_ratio: "3:4", quality: "standard", resolution: "720p", style: "portrait", count: 1, output_mode: "independent",
    }, "continued-portrait-reference");
    const result = await waitFor(`/api/v1/images/jobs/${job.request_id}`, row);
    row.artifact = await retain(result.images[0].url, "replacement-portrait");
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await saveReport();
  console.log(`${row.status} image qwen_image portrait_reference`);
  return row;
}

async function runAudio(model) {
  const row = { kind: "audio", model, operation: "text_to_speech", status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const job = await submit("/api/v1/audio/tts", {
      model,
      text: "清晨的茶园刚刚苏醒。请跟随一缕茶香，感受这一杯茶从山野到桌面的安静时刻。",
      voice: model === "doubao-tts-2.0" ? "zh_female_vv_uranus_bigtts" : "Cherry",
      language_type: "Chinese", format: "mp3", sample_rate: 24000, speed_ratio: 1, loudness_ratio: 1, emotion: "", emotion_scale: 4,
      instructions: model === "qwen3-tts-instruct-flash" ? "用温暖、自然、清晰的普通话朗读，语速舒缓，适合品牌短片旁白。" : "",
    }, `continued-audio-${model}`);
    const result = await waitFor(`/api/v1/audio/jobs/${job.request_id}`, row);
    row.charged_credits = result.charged_credits;
    row.artifact = await retain(result.url, `audio-${model}`);
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await saveReport();
  console.log(`${row.status} audio ${model}`);
  return row;
}

async function runVideo(model, operation, prompt, uploadIds, options = {}) {
  const row = { kind: "video", model, operation, status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const job = await submit("/api/v1/videos/generations", {
      model, operation, prompt, upload_ids: uploadIds, resolution: options.resolution || "720P", ratio: "16:9", duration: options.duration, style_id: options.style_id || 0, rights_confirmed: Boolean(options.rights_confirmed),
    }, `continued-video-${model.replace(/[^A-Za-z0-9_-]/g, "-")}`);
    const result = await waitFor(`/api/v1/videos/jobs/${job.request_id}`, row);
    row.charged_credits = result.charged_credits;
    row.artifact = await retain(result.url, `video-${model}`);
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await saveReport();
  console.log(`${row.status} video ${model} ${operation}`);
  return row;
}

const catalog = await request("/api/v1/models");
const product = await uploadImage("test-results/live-model-validation-2026-09-04T07-38-44-171Z/image-qwen_image-1.jpg", "image/jpeg");
const sourcePortrait = await uploadImage("frontend/static/showcase/v167/plaza/red-dancer.webp", "image/webp");
const sourceVideo = await uploadMedia("frontend/static/showcase/v167/plaza/ocean-cliff-motion.mp4", "video/mp4");
const redrawMask = await uploadMask("test-results/validation-redraw-mask.png");

if (catalog.tool_models.seedream_4_5.available) await runTool("seedream_4_5", "redraw", "只在白色蒙版区域重绘出一束白色小花，蒙版外的产品、光线和构图保持不变。", product.upload_id, { mask_upload_id: redrawMask.upload_id });
if (catalog.tool_models.bailian_qwen_3_pro.available) await runTool("bailian_qwen_3_pro", "multiangle", "只移动相机到左前方四十五度，产品身份、比例、标签位置、材质和布光保持不变。", product.upload_id, { camera: { azimuth: 45, elevation: 20, distance: 5 } });
if (catalog.tool_models.bailian_wan_2_7.available) await runTool("bailian_wan_2_7", "edit", "把产品背景改为干净的暖灰摄影棚背景，茶罐本体、位置、比例和标签区域保持一致。", product.upload_id);
if (catalog.tool_models.bailian_wan_2_7_pro.available) await runTool("bailian_wan_2_7_pro", "multiview", "同一茶罐生成正面、左侧和右侧三个标准产品视图，白色无缝背景，材质和标签位置一致。", product.upload_id, { views: 3 });
if (catalog.tool_models.seedream_5_0_pro.available) await runTool("seedream_5_0_pro", "interactive", "以标注点为中心，把局部光线调为柔和暖色，未标注区域保持不变。", product.upload_id, { annotations: [{ image_index: 1, kind: "point", coordinates: [500, 500] }] });

const replacementPortrait = await runPortrait();
if (replacementPortrait.status !== "passed") throw new Error("replacement portrait unavailable");
const replacement = await uploadImage(replacementPortrait.artifact.path, replacementPortrait.artifact.content_type);

const audioRows = [];
for (const [model, value] of Object.entries(catalog.audio_models)) if (value.available) audioRows.push(await runAudio(model));
const qwenAudio = audioRows.find((row) => row.model === "qwen3-tts-flash" && row.status === "passed");
if (!qwenAudio) throw new Error("qwen3-tts-flash audio reference unavailable");
const referenceAudio = await uploadMedia(qwenAudio.artifact.path, qwenAudio.artifact.content_type);

const availableVideo = (model) => Boolean(catalog.video_models[model]?.available);
if (availableVideo("wan2.7-t2v-2026-06-12")) await runVideo("wan2.7-t2v-2026-06-12", "text_to_video", "清晨薄雾中的中国茶园缓慢推进镜头，露珠在茶叶边缘闪光，远处采茶人走过，真实电影光影。", [], { duration: 2 });
let portraitVideo;
if (availableVideo("wan2.7-i2v-2026-04-25")) {
  const row = await runVideo("wan2.7-i2v-2026-04-25", "image_to_video", "人物自然眨眼、轻微转头和呼吸，面部身份、服装和浅灰背景稳定，镜头固定。", [sourcePortrait.upload_id], { duration: 2 });
  if (row.status !== "passed") throw new Error("portrait image-to-video unavailable");
  portraitVideo = await uploadMedia(row.artifact.path, row.artifact.content_type);
}
if (availableVideo("wan2.7-r2v-2026-06-12")) await runVideo("wan2.7-r2v-2026-06-12", "reference_to_video", "参考产品图的茶罐、桌面和光线，生成稳定的产品推镜，主体比例不变。", [product.upload_id], { duration: 2 });
if (availableVideo("seedance_2_0")) await runVideo("seedance_2_0", "reference_to_video", "参考输入的海岸悬崖、海浪和电影机位，生成镜头缓慢向前推进的自然风景视频。", [sourceVideo.upload_id], { duration: 4 });
if (availableVideo("seedance_2_0_mini")) await runVideo("seedance_2_0_mini", "reference_to_video", "参考产品图的主体与构图，生成短促稳定的产品展示镜头，光线自然变化。", [product.upload_id], { duration: 4 });
if (availableVideo("seedance_2_0_fast")) await runVideo("seedance_2_0_fast", "reference_to_video", "参考人物肖像，生成轻微转头、眨眼和呼吸的自然人物短片，背景保持简洁。", [sourcePortrait.upload_id], { duration: 4 });
if (availableVideo("seedance_2_5")) await runVideo("seedance_2_5", "reference_to_video", "参考输入视频的海岸悬崖场景，生成连贯的航拍式前推进镜头，海浪和薄雾具有真实运动。", [sourceVideo.upload_id], { duration: 4 });
if (availableVideo("wan2.7-videoedit")) await runVideo("wan2.7-videoedit", "video_edit", "保留悬崖和海面运动，将整体调色改为日落金色时刻，阴影保留细节。", [sourceVideo.upload_id], { duration: 2 });
if (availableVideo("wanx2.1-vace-plus")) await runVideo("wanx2.1-vace-plus", "video_extension", "从原视频末尾自然延展五秒：镜头继续平稳前进，海浪运动连续，悬崖轮廓不跳变。", [sourceVideo.upload_id], { duration: 5 });
if (availableVideo("video-style-transform")) await runVideo("video-style-transform", "video_style", "将原视频转为细腻水彩插画风格，保留镜头运动、海岸结构和时间连续性。", [sourceVideo.upload_id], { duration: 2, resolution: "480P", style_id: 3 });
if (availableVideo("videoretalk")) await runVideo("videoretalk", "lip_sync", "让输入视频中的人物与普通话音频自然同步口型，保持面部身份和背景稳定。", [portraitVideo.upload_id, referenceAudio.upload_id], { duration: 2, resolution: "480P" });
if (availableVideo("wan2.2-animate-mix")) await runVideo("wan2.2-animate-mix", "character_swap_video", "将输入视频中的人物替换为参考肖像人物，保持原视频动作、镜头和服装运动节奏。", [portraitVideo.upload_id, replacement.upload_id], { duration: 2, resolution: "480P", rights_confirmed: true });
if (availableVideo("wan2.2-s2v")) await runVideo("wan2.2-s2v", "digital_human", "让参考肖像以自然站姿完成品牌旁白，口型与中文音频同步，表情克制专业。", [replacement.upload_id, referenceAudio.upload_id], { duration: 2, resolution: "480P" });

report.finished_at = new Date().toISOString();
report.summary = report.tests.reduce((summary, item) => ({ ...summary, [item.status]: (summary[item.status] || 0) + 1 }), {});
await saveReport();
console.log(JSON.stringify(report.summary));
