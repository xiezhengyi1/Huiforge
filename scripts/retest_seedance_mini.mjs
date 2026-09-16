import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const [baseUrl, session] = process.argv.slice(2);
if (!baseUrl || !session) throw new Error("usage: node scripts/retest_seedance_mini.mjs <base-url> <session>");

const root = baseUrl.replace(/\/$/, "");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `seedance-mini-retest-${stamp}`);
const headers = { Cookie: `huiju_session=${session}` };
const report = { started_at: new Date().toISOString(), model: "seedance_2_0_mini", operation: "reference_to_video" };
await mkdir(outputDir, { recursive: true });

function endpoint(path) {
  return `${root}${path}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(path, init = {}) {
  const response = await fetch(endpoint(path), { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

const form = new FormData();
const productPath = "test-results/live-model-validation-2026-09-04T07-38-44-171Z/image-qwen_image-1.jpg";
form.append("image", new Blob([await readFile(productPath)], { type: "image/jpeg" }), basename(productPath));
const source = await request("/api/v1/images/uploads", { method: "POST", body: form });
const job = await request("/api/v1/videos/generations", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": `seedance-mini-${stamp}` },
  body: JSON.stringify({
    model: "seedance_2_0_mini",
    operation: "reference_to_video",
    prompt: "参考茶罐图片的主体与构图，生成稳定的四秒产品展示镜头：镜头缓慢向前推进，晨光自然移动，茶叶有极轻微的风动，罐体标签和比例保持稳定。",
    upload_ids: [source.upload_id], ratio: "16:9", resolution: "720P", duration: 4, style_id: 0, rights_confirmed: false,
  }),
});
report.job_id = job.request_id;
const deadline = Date.now() + 10 * 60 * 1000;
while (Date.now() < deadline) {
  await delay(5000);
  const status = await request(`/api/v1/videos/jobs/${job.request_id}`);
  report.provider_status = status.provider_status || status.status;
  if (status.status === "completed") {
    const artifact = await fetch(endpoint(status.url), { headers });
    if (!artifact.ok) throw new Error(`artifact ${artifact.status}`);
    report.artifact = join(outputDir, "seedance_2_0_mini.mp4");
    await writeFile(report.artifact, Buffer.from(await artifact.arrayBuffer()));
    report.status = "passed";
    break;
  }
  if (status.status === "failed" || status.status === "cancelled") throw new Error(status.error || status.status);
}
if (!report.status) throw new Error("validation_timeout");
report.finished_at = new Date().toISOString();
await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, status: report.status }));
