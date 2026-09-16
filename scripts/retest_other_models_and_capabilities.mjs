import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const [baseUrl, session] = process.argv.slice(2);
if (!baseUrl || !session) throw new Error("usage: node scripts/retest_other_models_and_capabilities.mjs <base-url> <session>");

const root = baseUrl.replace(/\/$/, "");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `other-model-capability-retest-${stamp}`);
const headers = { Cookie: `huiju_session=${session}` };
const report = {
  started_at: new Date().toISOString(),
  scope: "图像编辑/分析、三种语音、此前失败的视频模型、服务器本地视频工具",
  tests: [],
};

await mkdir(outputDir, { recursive: true });

function absolute(path) {
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function persistReport() {
  await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

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

function extension(contentType, url) {
  const byType = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "video/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/ogg": ".ogg",
  };
  return byType[contentType] || extname(new URL(absolute(url)).pathname) || ".bin";
}

async function retain(url, name) {
  const response = await fetch(absolute(url), { headers });
  if (!response.ok) throw new Error(`GET ${url} ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0] || "application/octet-stream";
  const path = join(outputDir, `${name}${extension(contentType, url)}`);
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

async function runImageTool(model, operation, prompt, uploadId, options = {}) {
  const row = { kind: "image_tool", model, operation, expected: options.expected, status: "submitted" };
  report.tests.push(row);
  await persistReport();
  try {
    const job = await request("/api/v1/images/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `retest-${operation}-${model}-${stamp}` },
      body: JSON.stringify({
        model, operation, upload_id: uploadId, prompt, resolution: "720p", quality: "standard",
        views: options.views || 3, ...(options.camera ? { camera: options.camera } : {}),
      }),
    });
    row.job_id = job.request_id;
    const result = await waitFor(`/api/v1/images/jobs/${job.request_id}`, row);
    row.artifacts = [];
    for (const [index, image] of result.images.entries()) row.artifacts.push(await retain(image.url, `${operation}-${model}-${index + 1}`));
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await persistReport();
  console.log(`${row.status} image_tool ${model} ${operation}`);
  return row;
}

async function runAnalysis(uploadId) {
  const row = { kind: "image_analysis", model: "qwen3-vl", operation: "commerce", expected: "输出可执行的商品构图、布光和电商风险分析", status: "submitted" };
  report.tests.push(row);
  await persistReport();
  try {
    const result = await request("/api/v1/images/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id: uploadId, focus: "commerce", instruction: "重点评价商品主体、布光、背景和留白。" }),
    });
    row.analysis_length = result.analysis.length;
    row.analysis_excerpt = result.analysis.slice(0, 160);
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await persistReport();
  console.log(`${row.status} image_analysis commerce`);
}

async function runAudio(model) {
  const row = { kind: "audio", model, operation: "text_to_speech", expected: "生成可播放的中文品牌旁白", status: "submitted" };
  report.tests.push(row);
  await persistReport();
  try {
    const job = await request("/api/v1/audio/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        text: "一只白色茶罐，留住清晨茶园最安静的光。绘域测试旁白。",
        voice: model === "doubao-tts-2.0" ? "zh_female_vv_uranus_bigtts" : "Cherry",
        language_type: "Chinese", format: "mp3", sample_rate: 24000, speed_ratio: 1, loudness_ratio: 1,
        emotion: "", emotion_scale: 4,
        instructions: model === "qwen3-tts-instruct-flash" ? "以温暖、克制、清晰的普通话朗读，适合高级商品短片。" : "",
      }),
    });
    row.job_id = job.request_id;
    const result = await waitFor(`/api/v1/audio/jobs/${job.request_id}`, row);
    row.artifact = await retain(result.url, `audio-${model}`);
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await persistReport();
  console.log(`${row.status} audio ${model}`);
  return row;
}

async function runVideo(model, operation, prompt, uploadIds, options = {}) {
  const row = { kind: "video", model, operation, expected: options.expected, status: "submitted" };
  report.tests.push(row);
  await persistReport();
  try {
    const job = await request("/api/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `retest-video-${model.replace(/[^A-Za-z0-9_-]/g, "-")}-${stamp}` },
      body: JSON.stringify({
        model, operation, prompt, upload_ids: uploadIds, ratio: "16:9", resolution: options.resolution || "720P",
        duration: options.duration, style_id: 0, rights_confirmed: Boolean(options.rights_confirmed),
      }),
    });
    row.job_id = job.request_id;
    const result = await waitFor(`/api/v1/videos/jobs/${job.request_id}`, row);
    row.artifact = await retain(result.url, `video-${model}`);
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await persistReport();
  console.log(`${row.status} video ${model} ${operation}`);
  return row;
}

async function runLocalVideoTool(operation, options = {}) {
  const row = { kind: "local_video_tool", model: "ffmpeg-local", operation, expected: options.expected, status: "submitted" };
  report.tests.push(row);
  await persistReport();
  try {
    const form = new FormData();
    form.append("video", new Blob([await readFile("frontend/static/showcase/v167/plaza/ocean-cliff-motion.mp4")], { type: "video/mp4" }), "ocean-cliff-motion.mp4");
    form.append("operation", operation);
    if (operation === "extract_frame") form.append("frame_time", "1");
    if (operation === "trim_video") { form.append("start_time", "0.5"); form.append("end_time", "2.5"); }
    if (operation === "crop_video") form.append("crop_ratio", "1:1");
    if (operation === "enhance_video") form.append("enhance_scale", "1.5");
    const response = await fetch(absolute("/api/v1/videos/tools"), { method: "POST", headers, body: form });
    if (!response.ok) throw new Error(`POST /api/v1/videos/tools ${response.status}`);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0] || "application/octet-stream";
    const path = join(outputDir, `local-${operation}${contentType === "image/png" ? ".png" : ".mp4"}`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    row.artifact = { path, content_type: contentType };
    row.status = "passed";
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await persistReport();
  console.log(`${row.status} local_video_tool ${operation}`);
}

const catalog = await request("/api/v1/models");
const product = await uploadImage("test-results/live-model-validation-2026-09-04T07-38-44-171Z/image-qwen_image-1.jpg", "image/jpeg");
const sourcePortrait = await uploadImage("frontend/static/showcase/v167/plaza/red-dancer.webp", "image/webp");
const replacementPortrait = await uploadImage("test-results/live-model-validation-continued-2026-09-04T08-12-40-743Z/replacement-portrait.jpg", "image/jpeg");
const portraitVideo = await uploadMedia("test-results/live-video-validation-2026-09-04T08-20-25-509Z/video-wan2.7-i2v-2026-04-25.mp4", "video/mp4");
const sourceVideo = await uploadMedia("frontend/static/showcase/v167/plaza/ocean-cliff-motion.mp4", "video/mp4");

await runAnalysis(product.upload_id);
if (catalog.tool_models.bailian_wan_2_7?.available) await runImageTool(
  "bailian_wan_2_7", "edit",
  "只将背景改为柔和暖灰摄影棚，保持茶罐本体、中文标签、茶叶、比例、位置与左侧窗光完全一致。",
  product.upload_id,
  { expected: "只变更背景，商品身份和构图保持不变" },
);
if (catalog.tool_models.bailian_qwen_3?.available) await runImageTool(
  "bailian_qwen_3", "panorama",
  "向左右自然延展为宽幅茶园晨雾场景，原茶罐稳定处于画面中央，边缘不出现重复物体或文字。",
  product.upload_id,
  { expected: "生成横向延展的全景构图" },
);
if (catalog.tool_models.bailian_wan_2_7_pro?.available) await runImageTool(
  "bailian_wan_2_7_pro", "multiview",
  "生成同一茶罐的正面、左侧与右侧三个标准产品视图，纯白背景，标签和材质一致。",
  product.upload_id,
  { expected: "同一主体的三视图", views: 3 },
);

const audioRows = [];
for (const model of ["doubao-tts-2.0", "qwen3-tts-flash", "qwen3-tts-instruct-flash"]) {
  if (catalog.audio_models[model]?.available) audioRows.push(await runAudio(model));
}
const qwenAudio = audioRows.find((row) => row.model === "qwen3-tts-flash" && row.status === "passed");
if (!qwenAudio) throw new Error("qwen3-tts-flash failed; cannot construct synthetic-audio video tests");
const sourceAudio = await uploadMedia(qwenAudio.artifact.path, qwenAudio.artifact.content_type);

if (catalog.video_models.seedance_2_0_fast?.available) await runVideo(
  "seedance_2_0_fast", "reference_to_video",
  "参考人物肖像，生成轻微眨眼、自然呼吸和非常小幅度转头的四秒短片，身份、服装与背景稳定，镜头固定。",
  [sourcePortrait.upload_id], { duration: 4, expected: "静态肖像的自然微动" },
);
if (catalog.video_models["wanx2.1-vace-plus"]?.available) await runVideo(
  "wanx2.1-vace-plus", "video_extension",
  "从原视频末尾自然延展五秒：镜头继续平稳前进，海浪运动连续，悬崖轮廓不跳变。",
  [sourceVideo.upload_id], { duration: 5, expected: "连续延展五秒视频" },
);
if (catalog.video_models["wan2.2-animate-mix"]?.available) await runVideo(
  "wan2.2-animate-mix", "character_swap_video",
  "将输入视频中的人物替换为参考肖像人物，保持原视频动作、镜头与服装运动节奏。",
  [portraitVideo.upload_id, replacementPortrait.upload_id], { duration: 2, resolution: "480P", rights_confirmed: true, expected: "人物替换并保留动作" },
);
if (catalog.video_models["wan2.2-s2v"]?.available) await runVideo(
  "wan2.2-s2v", "digital_human",
  "让参考肖像以自然站姿完成简短中文品牌旁白，口型与音频同步，表情克制专业。",
  [replacementPortrait.upload_id, sourceAudio.upload_id], { duration: 2, resolution: "480P", expected: "图像加音频驱动的数字人" },
);

await runLocalVideoTool("extract_frame", { expected: "从第 1 秒提取 PNG 帧" });
await runLocalVideoTool("trim_video", { expected: "裁出 0.5–2.5 秒连续片段" });
await runLocalVideoTool("crop_video", { expected: "输出 1:1 构图视频" });
await runLocalVideoTool("enhance_video", { expected: "放大并锐化视频画面" });

report.finished_at = new Date().toISOString();
report.summary = report.tests.reduce((summary, row) => ({ ...summary, [row.status]: (summary[row.status] || 0) + 1 }), {});
await persistReport();
console.log(JSON.stringify({ outputDir, summary: report.summary }));
