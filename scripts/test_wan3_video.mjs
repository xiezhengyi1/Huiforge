import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [baseUrl, session] = process.argv.slice(2);
if (!baseUrl || !session) throw new Error("usage: node scripts/test_wan3_video.mjs <base-url> <session>");

const root = baseUrl.replace(/\/$/, "");
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDir = join("test-results", `wan3-video-validation-${stamp}`);
const headers = { Cookie: `huiju_session=${session}` };
const report = { started_at: new Date().toISOString(), tests: [] };
await mkdir(outputDir, { recursive: true });

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function request(path, init = {}) {
  const response = await fetch(`${root}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

for (const [model, label] of [["wan3.0-video", "standard"], ["wan3.0-video-prime", "prime"]]) {
  const row = { model, operation: "text_to_video", expected: "白色陶瓷茶杯在木桌上，镜头缓慢推进，无文字", status: "submitted" };
  report.tests.push(row);
  try {
    const created = await request("/api/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `wan3-${label}-${stamp}` },
      body: JSON.stringify({
        model,
        operation: "text_to_video",
        prompt: "一只白色陶瓷茶杯静置在温暖的木桌上，镜头缓慢稳定地向前推进，午后自然光，真实电影质感，无文字，无水印。",
        upload_ids: [],
        ratio: "16:9",
        resolution: "480P",
        duration: 2,
        style_id: 0,
        rights_confirmed: false,
      }),
    });
    row.job_id = created.request_id;
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await delay(5000);
      const result = await request(`/api/v1/videos/jobs/${created.request_id}`);
      row.provider_status = result.provider_status || result.status;
      if (result.status === "completed") {
        const artifact = await fetch(`${root}${result.url}`, { headers });
        if (!artifact.ok) throw new Error(`artifact ${artifact.status}`);
        row.artifact = join(outputDir, `${label}.mp4`);
        await writeFile(row.artifact, Buffer.from(await artifact.arrayBuffer()));
        row.status = "passed";
        break;
      }
      if (result.status === "failed" || result.status === "cancelled") throw new Error(result.error || result.status);
    }
    if (row.status !== "passed") throw new Error("validation_timeout");
  } catch (error) {
    row.status = "failed";
    row.error = String(error.message || error);
  }
  await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${row.status} ${model}`);
}

report.finished_at = new Date().toISOString();
await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, tests: report.tests.map(({ model, status }) => ({ model, status })) }));
