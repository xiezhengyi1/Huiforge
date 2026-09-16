import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [baseUrl, session] = process.argv.slice(2);
if (!baseUrl || !session) throw new Error("usage: node scripts/retest_wan_t2v.mjs <base-url> <session>");

const root = baseUrl.replace(/\/$/, "");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `wan-t2v-retest-${stamp}`);
const headers = { Cookie: `huiju_session=${session}` };
const report = {
  started_at: new Date().toISOString(),
  model: "wan2.7-t2v-2026-06-12",
  operation: "text_to_video",
  expected: "雾中茶园的缓慢推进镜头，茶叶与采茶人有自然运动",
};
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

try {
  const job = await request("/api/v1/videos/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `wan-t2v-${stamp}` },
    body: JSON.stringify({
      model: "wan2.7-t2v-2026-06-12",
      operation: "text_to_video",
      prompt: "清晨薄雾中的中国茶园，镜头缓慢稳定地向前推进；露珠在茶叶边缘闪光，一位采茶人从远处经过，真实电影光影，无文字无水印。",
      upload_ids: [], ratio: "16:9", resolution: "720P", duration: 2, style_id: 0, rights_confirmed: false,
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
      report.artifact = join(outputDir, "wan2.7-t2v.mp4");
      await writeFile(report.artifact, Buffer.from(await artifact.arrayBuffer()));
      report.status = "passed";
      break;
    }
    if (status.status === "failed" || status.status === "cancelled") throw new Error(status.error || status.status);
  }
  if (!report.status) throw new Error("validation_timeout");
} catch (error) {
  report.status = "failed";
  report.error = String(error.message || error);
}
report.finished_at = new Date().toISOString();
await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, status: report.status }));
