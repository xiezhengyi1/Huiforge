import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const root = process.argv[2] || "http://127.0.0.1:8081";
const sourcePath = "test-results/live-model-validation-2026-09-04T07-38-44-171Z/image-qwen_image-1.jpg";
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `multiangle-matrix-${stamp}`);
const selectedModels = new Set((process.env.HUIJU_TEST_MODELS || "").split(",").filter(Boolean));
const report = {
  started_at: new Date().toISOString(),
  source: sourcePath,
  camera: { azimuth: 45, elevation: 20, distance: 5 },
  prompt: "将相机移动到图1主体的右前方 45°、上方 20° 的中景位置。保持白色茶罐、中文标签、木桌、窗边晨光和茶叶的身份、比例、材质与位置不变；只改变观察机位。",
  tests: [],
};
let session = process.env.HUIJU_TEST_SESSION || "";

await mkdir(outputDir, { recursive: true });

function url(path) {
  return `${root.replace(/\/$/, "")}${path}`;
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (session) headers.set("Cookie", `huiju_session=${session}`);
  const response = await fetch(url(path), { ...init, headers });
  const setCookie = response.headers.get("set-cookie");
  const match = setCookie?.match(/huiju_session=([a-f0-9]{32})/);
  if (match) session = match[1];
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function saveReport() {
  await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

async function uploadSource() {
  const form = new FormData();
  form.append("image", new Blob([await readFile(sourcePath)], { type: "image/jpeg" }), basename(sourcePath));
  return request("/api/v1/images/uploads", { method: "POST", body: form });
}

async function submit(model, uploadId) {
  return request("/api/v1/images/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `multiangle-${stamp}-${model}`.replace(/[^A-Za-z0-9_-]/g, "-"),
    },
    body: JSON.stringify({
      operation: "multiangle",
      model,
      upload_id: uploadId,
      prompt: report.prompt,
      preset_id: "multiangle-product",
      resolution: "720p",
      quality: "standard",
      views: 3,
      camera: report.camera,
    }),
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function poll(row) {
  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    await delay(4000);
    const result = await request(`/api/v1/images/jobs/${row.job_id}`);
    row.provider_status = result.provider_status || result.status;
    if (result.status === "completed") return result;
    if (result.status === "failed" || result.status === "cancelled") throw new Error(result.error || result.status);
  }
  throw new Error("timeout");
}

async function retain(urlPath, model) {
  const response = await fetch(url(urlPath), { headers: { Cookie: `huiju_session=${session}` } });
  if (!response.ok) throw new Error(`artifact ${response.status}`);
  const type = response.headers.get("content-type")?.split(";", 1)[0] || "image/png";
  const extension = type === "image/jpeg" ? ".jpg" : type === "image/webp" ? ".webp" : ".png";
  const path = join(outputDir, `${model}${extension}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return { path, content_type: type };
}

const catalog = await request("/api/v1/models");
const source = await uploadSource();
for (const [model, info] of Object.entries(catalog.tool_models)) {
  if (selectedModels.size && !selectedModels.has(model)) continue;
  if (!info.available) {
    report.tests.push({ model, status: "skipped", reason: "provider_not_configured" });
    continue;
  }
  const row = { model, status: "submitting" };
  report.tests.push(row);
  try {
    const job = await submit(model, source.upload_id);
    row.job_id = job.request_id;
    row.status = "queued";
    console.log(`queued ${model} ${row.job_id}`);
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
    console.log(`failed ${model} ${row.error}`);
  }
  await saveReport();
}

for (const row of report.tests.filter((item) => item.status === "queued")) {
  try {
    const result = await poll(row);
    row.images = [];
    for (const image of result.images || []) row.images.push(await retain(image.url, row.model));
    row.status = "passed";
    console.log(`passed ${row.model} ${row.images.map((image) => image.path).join(",")}`);
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
    console.log(`failed ${row.model} ${row.error}`);
  }
  await saveReport();
}

report.finished_at = new Date().toISOString();
report.summary = report.tests.reduce((summary, row) => ({ ...summary, [row.status]: (summary[row.status] || 0) + 1 }), {});
await saveReport();
console.log(JSON.stringify({ outputDir, summary: report.summary }));
