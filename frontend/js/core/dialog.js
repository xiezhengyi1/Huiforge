import { t } from "./locale.js?v=20261125-ui-polish-v3";
import { uiIcon } from "./ui-icon.js?v=20261125-ui-polish-v3";

let decisionOpen = false;

export function confirmAction(message, {
  title = "确认操作", confirmLabel = "确认", destructive = false, signal,
} = {}) {
  if (decisionOpen || signal?.aborted) return Promise.resolve(false);
  const dialog = document.createElement("dialog");
  dialog.className = "decision-dialog dialog-compact";
  dialog.setAttribute("aria-labelledby", "decision-title");
  dialog.setAttribute("aria-describedby", "decision-message");

  const heading = document.createElement("h2");
  heading.id = "decision-title";
  heading.textContent = t(title);
  const description = document.createElement("p");
  description.id = "decision-message";
  description.textContent = t(message);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "dialog-close";
  close.setAttribute("aria-label", t("关闭"));
  close.innerHTML = uiIcon("close");
  close.addEventListener("click", () => dialog.close());

  const actions = document.createElement("form");
  actions.method = "dialog";
  actions.className = "decision-actions";
  const cancel = document.createElement("button");
  cancel.type = "submit";
  cancel.value = "cancel";
  cancel.textContent = t("取消");
  const confirm = document.createElement("button");
  confirm.type = "submit";
  confirm.value = "confirm";
  confirm.className = "primary";
  confirm.toggleAttribute("data-destructive", destructive);
  confirm.textContent = t(confirmLabel);
  actions.append(cancel, confirm);
  dialog.append(close, heading, description, actions);

  return new Promise((resolve) => {
    const abort = () => dialog.close();
    dialog.addEventListener("close", () => {
      decisionOpen = false;
      signal?.removeEventListener("abort", abort);
      dialog.remove();
      resolve(dialog.returnValue === "confirm");
    }, { once:true });
    signal?.addEventListener("abort", abort, { once:true });
    document.body.append(dialog);
    decisionOpen = true;
    dialog.showModal();
    cancel.focus();
  });
}
