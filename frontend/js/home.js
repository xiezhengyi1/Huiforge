import { localeUrl } from "./core/locale.js?v=20261125-ui-polish-v3";
import { saveLaunchDraft } from "./core/launch-draft.js?v=20261124-forge-v1";

const composer = document.querySelector("#launch-composer");
const prompt = document.querySelector("#launch-prompt");
const reference = document.querySelector("#launch-reference");
const referenceLabel = document.querySelector("#launch-reference-label");
const clearReference = document.querySelector("#launch-clear");
const ratio = document.querySelector("#launch-ratio");
const submit = document.querySelector("#launch-submit");
const errorMessage = document.querySelector("#launch-error");
const showcase = document.querySelector("#launch-example");
const examples = [...showcase.querySelectorAll("[data-example-mode]")];
const exampleTitle = document.querySelector("#launch-example-title");
const exampleKind = document.querySelector("#launch-example-kind");
const video = document.querySelector("#launch-example-video");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let videoInView = false;
let videoPreviewPending = false;

function syncVideoPlayback() {
  if (document.hidden || !videoInView || showcase.dataset.mode !== "unified_video") {
    video.pause();
  } else if (videoPreviewPending && !reducedMotion.matches) {
    videoPreviewPending = false;
    video.play().catch(() => { /* Native controls remain available. */ });
  }
}

function syncExample(mode) {
  if (showcase.dataset.mode === mode) return;
  showcase.dataset.mode = mode;
  for (const example of examples) {
    const selected = example.dataset.exampleMode === mode;
    example.inert = !selected;
    if (selected) {
      exampleTitle.textContent = example.dataset.exampleTitle;
      exampleKind.textContent = example.dataset.exampleKind;
    }
  }
  if (mode === "unified_video" && !video.hasAttribute("src")) video.src = video.dataset.src;
  videoPreviewPending = mode === "unified_video" && !reducedMotion.matches;
  syncVideoPlayback();
}

new IntersectionObserver(([entry]) => {
  videoInView = entry.isIntersecting && entry.intersectionRatio >= .45;
  syncVideoPlayback();
}, { threshold: .45 }).observe(video.parentElement);
document.addEventListener("visibilitychange", syncVideoPlayback);

const editExample = document.querySelector("#launch-edit-example");
const editReveal = document.querySelector("#launch-edit-reveal");
editReveal.addEventListener("input", () => editExample.style.setProperty("--edit-reveal", `${editReveal.value}%`));

const workflowDemo = document.querySelector("#launch-workflow-demo");
const workflowReplay = document.querySelector("#launch-workflow-replay");
let workflowFrame;
function replayWorkflow() {
  if (reducedMotion.matches) return;
  cancelAnimationFrame(workflowFrame);
  workflowDemo.classList.remove("is-running");
  workflowFrame = requestAnimationFrame(() => {
    workflowFrame = requestAnimationFrame(() => {
      workflowDemo.classList.toggle("is-running", !reducedMotion.matches);
    });
  });
}

const workflowObserver = new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio < .45) return;
  workflowObserver.disconnect();
  if (!workflowDemo.classList.contains("is-running")) replayWorkflow();
}, { threshold: .45 });
workflowObserver.observe(workflowDemo);
workflowReplay.addEventListener("click", replayWorkflow);
workflowReplay.hidden = reducedMotion.matches;
reducedMotion.addEventListener("change", () => {
  workflowReplay.hidden = reducedMotion.matches;
  if (reducedMotion.matches) {
    videoPreviewPending = false;
    video.pause();
    workflowDemo.classList.remove("is-running");
  }
});

const modes = {
  unified_image: "A city street at blue hour, neon reflected in the rain.",
  edit: "Warm the lighting and keep the original composition.",
  unified_video: "A slow push toward a lighthouse above a stormy coast.",
};

function showError(message = "") {
  errorMessage.hidden = !message;
  errorMessage.textContent = message;
}

function syncControls() {
  const mode = composer.elements.tool.value;
  syncExample(mode);
  prompt.placeholder = modes[mode];
  ratio.closest("label").hidden = mode === "edit";
  for (const option of ratio.options) {
    option.disabled = mode === "unified_video" && option.value === "4:5";
    option.hidden = option.disabled;
  }
  if (ratio.selectedOptions[0]?.disabled) ratio.value = "16:9";
  const file = reference.files[0];
  referenceLabel.textContent = file?.name || "Reference";
  referenceLabel.title = file?.name || "";
  referenceLabel.toggleAttribute("data-user-content", Boolean(file));
  clearReference.hidden = !file;
  showError();
}

composer.addEventListener("change", syncControls);
clearReference.addEventListener("click", () => {
  reference.value = "";
  syncControls();
  reference.focus();
});
window.addEventListener("pageshow", () => {
  submit.disabled = false;
  syncControls();
  editExample.style.setProperty("--edit-reveal", `${editReveal.value}%`);
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  showError();
  const tool = composer.elements.tool.value;
  const file = reference.files[0] || null;
  const description = prompt.value.trim();
  if (file && (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 15 * 1024 * 1024)) {
    showError("Choose a PNG, JPG, or WebP file up to 15 MB.");
    reference.focus();
    return;
  }

  const studio = new URL(composer.action);
  studio.searchParams.set("tool", tool);
  if (tool !== "edit") studio.searchParams.set("aspect_ratio", ratio.value);
  if (description || file) {
    submit.disabled = true;
    try {
      const id = await saveLaunchDraft({ prompt: description, file });
      studio.searchParams.set("draft", String(id));
    } catch {
      showError("Couldn’t open this draft. Try again or open Tools.");
      submit.disabled = false;
      return;
    }
  }
  window.location.assign(localeUrl(studio.href));
});
