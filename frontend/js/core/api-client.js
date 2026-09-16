export const API = Object.freeze({
  create: "/api/v1/images/generations",
  upload: "/api/v1/images/uploads",
  mediaUpload: "/api/v1/media/uploads",
  analyze: "/api/v1/images/analyze",
  tool: "/api/v1/images/tools",
  toolPresets: "/api/v1/images/tool-presets",
  video: "/api/v1/videos/generations",
  videoTools: "/api/v1/videos/tools",
  audioTts: "/api/v1/audio/tts",
  models: "/api/v1/models",
  pricing: "/api/v1/pricing",
  capabilities: "/api/v1/capabilities",
  credits: "/api/v1/credits",
  currentUser: "/api/v1/users/me",
  bootstrap: "/api/v1/bootstrap",
  feedback: "/api/v1/feedback",
  feedbackScreenshot: "/api/v1/feedback/screenshots",
  userHistory: "/api/v1/users/history",
  assets: "/api/v1/assets",
  assetUpload: "/api/v1/assets/uploads",
  assetCategories: "/api/v1/assets/categories",
  workflows: "/api/v1/workflows",
  plaza: "/api/v1/plaza",
  timeoutMs: 90000,
  pollIntervalMs: 5000,
  maxPolls: 240,
});

export async function fetchJson(url, options = {}, timeoutMs = API.timeoutMs) {
  const requestController = new AbortController();
  const cancelRequest = () => requestController.abort();
  const timer = window.setTimeout(cancelRequest, timeoutMs);
  options.signal?.addEventListener("abort", cancelRequest, { once: true });

  try {
    const response = await fetch(url, {
      ...options,
      signal: requestController.signal,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...options.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error("request_failed");
      error.status = response.status;
      error.retryAfter = response.headers.get("Retry-After");
      throw error;
    }
    return { status: response.status, body };
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancelRequest);
  }
}
