import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const [baseUrl, session] = process.argv.slice(2);
if (!baseUrl || !session) throw new Error("usage: node scripts/run_live_video_validation.mjs <base-url> <session>");

const root = baseUrl.replace(/\/$/, "");
const remainingOnly = process.argv.includes("--remaining");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `live-video-validation-${stamp}`);
const report = { started_at: new Date().toISOString(), base_url: root, tests: [] };
const headers = { Cookie: `huiju_session=${session}` };
await mkdir(outputDir, { recursive: true });

function absolute(path) { return `${root}${path.startsWith("/") ? path : `/${path}`}`; }
function key(prefix, model) { return `${prefix}-${model.replace(/[^A-Za-z0-9_-]/g, "-")}`; }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function saveReport() { await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`); }

async function request(path, init = {}) {
  const response = await fetch(absolute(path), { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path} ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function uploadImage(path, contentType) {
  const form = new FormData();
  form.append("image", new Blob([await readFile(path)], { type: contentType }), basename(path));
  return request("/api/v1/images/uploads", { method: "POST", body: form });
}

async function uploadMedia(path, contentType) {
  const form = new FormData();
  form.append("media", new Blob([await readFile(path)], { type: contentType }), basename(path));
  return request("/api/v1/media/uploads", { method: "POST", body: form });
}

function suffix(contentType, url) {
  const table = { "video/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg", "audio/mp4": ".m4a" };
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

async function run(model, operation, prompt, uploadIds, options) {
  const row = { kind: "video", model, operation, status: "submitted" };
  report.tests.push(row);
  await saveReport();
  try {
    const job = await request("/api/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key("video", model) },
      body: JSON.stringify({ model, operation, prompt, upload_ids: uploadIds, ratio: "16:9", resolution: options.resolution, duration: options.duration, style_id: options.style_id || 0, rights_confirmed: Boolean(options.rights_confirmed) }),
    });
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

async function latestReferenceArtifacts() {
  const folders = (await readdir("test-results", { withFileTypes: true })).filter((item) => item.isDirectory() && item.name.startsWith("live-model-validation-continued-")).map((item) => item.name).sort();
  const latest = folders.filter((name) => name !== basename(outputDir)).at(-1);
  if (!latest) throw new Error("continued image/audio report missing");
  const prior = JSON.parse(await readFile(join("test-results", latest, "report.json"), "utf8"));
  const portrait = prior.tests.find((item) => item.kind === "image" && item.operation === "text_to_image_portrait_reference" && item.status === "passed");
  const audio = prior.tests.find((item) => item.kind === "audio" && item.model === "qwen3-tts-flash" && item.status === "passed");
  if (!portrait || !audio) throw new Error("portrait or qwen audio artifact missing");
  return { portrait: portrait.artifact, audio: audio.artifact };
}

async function latestPortraitVideo() {
  const folders = (await readdir("test-results", { withFileTypes: true })).filter((item) => item.isDirectory() && item.name.startsWith("live-video-validation-")).map((item) => item.name).sort();
  const latest = folders.filter((name) => name !== basename(outputDir)).at(-1);
  if (!latest) throw new Error("portrait image-to-video report missing");
  const prior = JSON.parse(await readFile(join("test-results", latest, "report.json"), "utf8"));
  const row = prior.tests.find((item) => item.model === "wan2.7-i2v-2026-04-25" && item.status === "passed");
  if (!row) throw new Error("portrait image-to-video artifact missing");
  return row.artifact;
}

const catalog = await request("/api/v1/models");
const reference = await latestReferenceArtifacts();
const product = await uploadImage("test-results/live-model-validation-2026-09-04T07-38-44-171Z/image-qwen_image-1.jpg", "image/jpeg");
const sourcePortrait = await uploadImage("frontend/static/showcase/v167/plaza/red-dancer.webp", "image/webp");
const replacementPortrait = await uploadImage(reference.portrait.path, reference.portrait.content_type);
const sourceVideo = await uploadMedia("frontend/static/showcase/v167/plaza/ocean-cliff-motion.mp4", "video/mp4");
const sourceAudio = await uploadMedia(reference.audio.path, reference.audio.content_type);
const available = (model) => Boolean(catalog.video_models[model]?.available);

if (!remainingOnly && available("wan2.7-t2v-2026-06-12")) await run("wan2.7-t2v-2026-06-12", "text_to_video", "清晨薄雾中的中国茶园缓慢推进镜头，露珠在茶叶边缘闪光，远处采茶人走过，真实电影光影。", [], { resolution: "720P", duration: 2 });

let portraitVideo;
if (remainingOnly) {
  const portraitVideoArtifact = await latestPortraitVideo();
  portraitVideo = await uploadMedia(portraitVideoArtifact.path, portraitVideoArtifact.content_type);
} else if (available("wan2.7-i2v-2026-04-25")) {
  const row = await run("wan2.7-i2v-2026-04-25", "image_to_video", "人物自然眨眼、轻微转头和呼吸，面部身份、服装和浅灰背景稳定，镜头固定。", [sourcePortrait.upload_id], { resolution: "720P", duration: 2 });
  if (row.status === "passed") portraitVideo = await uploadMedia(row.artifact.path, row.artifact.content_type);
}

if (!remainingOnly && available("wan2.7-r2v-2026-06-12")) await run("wan2.7-r2v-2026-06-12", "reference_to_video", "参考产品图的茶罐、桌面和光线，生成稳定的产品推镜，主体比例不变。", [product.upload_id], { resolution: "720P", duration: 2 });
if (available("seedance_2_0")) await run("seedance_2_0", "reference_to_video", "参考输入视频的海岸悬崖、海浪和电影机位，生成镜头缓慢向前推进的自然风景视频。", [sourceVideo.upload_id], { resolution: "720P", duration: 4 });
if (available("seedance_2_0_mini")) await run("seedance_2_0_mini", "reference_to_video", "参考产品图的主体与构图，生成短促稳定的产品展示镜头，光线自然变化。", [product.upload_id], { resolution: "720P", duration: 4 });
if (available("seedance_2_0_fast")) await run("seedance_2_0_fast", "reference_to_video", "参考人物肖像，生成轻微转头、眨眼和呼吸的自然人物短片，背景保持简洁。", [sourcePortrait.upload_id], { resolution: "720P", duration: 4 });
if (available("seedance_2_5")) await run("seedance_2_5", "reference_to_video", "参考输入视频的海岸悬崖场景，生成连贯的航拍式前推进镜头，海浪和薄雾具有真实运动。", [sourceVideo.upload_id], { resolution: "720P", duration: 4 });
if (available("wan2.7-videoedit")) await run("wan2.7-videoedit", "video_edit", "保留悬崖和海面运动，将整体调色改为日落金色时刻，阴影保留细节。", [sourceVideo.upload_id], { resolution: "720P", duration: 2 });
if (available("wanx2.1-vace-plus")) await run("wanx2.1-vace-plus", "video_extension", "从原视频末尾自然延展五秒：镜头继续平稳前进，海浪运动连续，悬崖轮廓不跳变。", [sourceVideo.upload_id], { resolution: "720P", duration: 5 });
if (available("video-style-transform")) await run("video-style-transform", "video_style", "将原视频转为细腻水彩插画风格，保留镜头运动、海岸结构和时间连续性。", [sourceVideo.upload_id], { resolution: "480P", duration: 2, style_id: 3 });

if (portraitVideo && available("videoretalk")) await run("videoretalk", "lip_sync", "让输入视频中的人物与普通话音频自然同步口型，保持面部身份和背景稳定。", [portraitVideo.upload_id, sourceAudio.upload_id], { resolution: "480P", duration: 2 });
if (portraitVideo && available("wan2.2-animate-mix")) await run("wan2.2-animate-mix", "character_swap_video", "将输入视频中的人物替换为参考肖像人物，保持原视频动作、镜头和服装运动节奏。", [portraitVideo.upload_id, replacementPortrait.upload_id], { resolution: "480P", duration: 2, rights_confirmed: true });
if (available("wan2.2-s2v")) await run("wan2.2-s2v", "digital_human", "让参考肖像以自然站姿完成品牌旁白，口型与中文音频同步，表情克制专业。", [replacementPortrait.upload_id, sourceAudio.upload_id], { resolution: "480P", duration: 2 });

report.finished_at = new Date().toISOString();
report.summary = report.tests.reduce((summary, item) => ({ ...summary, [item.status]: (summary[item.status] || 0) + 1 }), {});
await saveReport();
console.log(JSON.stringify(report.summary));
