(function () {
  "use strict";

  const storageKey = "huiyu-studio-theme";
  const allowedThemes = new Set(["jade", "indigo", "cinnabar", "monochrome-blue", "monochrome-accent", "graphite-amber"]);

  const readStoredTheme = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      return allowedThemes.has(stored) ? stored : "jade";
    } catch (_error) {
      return "jade";
    }
  };

  let activeTheme = readStoredTheme();
  document.documentElement.dataset.studioTheme = activeTheme;

  const saveTheme = (theme) => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (_error) {
      // Theme still applies for the current page when storage is unavailable.
    }
  };

  const initializeThemePicker = () => {
    const picker = document.getElementById("theme-picker");
    const trigger = document.getElementById("theme-picker-trigger");
    const menu = document.getElementById("theme-picker-menu");
    const options = [...document.querySelectorAll("[data-theme-option]")];
    if (!picker || !trigger || !menu || options.length === 0) return;

    const renderTheme = (theme, persist) => {
      activeTheme = allowedThemes.has(theme) ? theme : "jade";
      document.documentElement.dataset.studioTheme = activeTheme;
      options.forEach((option) => {
        option.setAttribute("aria-checked", String(option.dataset.themeOption === activeTheme));
      });
      if (persist) saveTheme(activeTheme);
      window.dispatchEvent(new CustomEvent("huiju:theme-changed", { detail: { theme: activeTheme } }));
    };

    const closeMenu = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", () => {
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) {
        const selected = options.find((option) => option.dataset.themeOption === activeTheme);
        selected?.focus();
      }
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        renderTheme(option.dataset.themeOption, true);
        closeMenu();
        trigger.focus();
      });
    });

    document.addEventListener("click", (event) => {
      if (!picker.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        closeMenu();
        trigger.focus();
      }
    });

    renderTheme(activeTheme, false);
  };

  const initializeServiceHealth = () => {
    const banner = document.createElement("aside");
    banner.className = "service-health-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.hidden = true;

    const marker = document.createElement("span");
    marker.className = "service-health-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "!";
    const message = document.createElement("span");
    message.className = "service-health-message";
    const action = document.createElement("button");
    action.className = "service-health-action";
    action.type = "button";
    action.textContent = "重试";
    banner.append(marker, message, action);
    document.body.append(banner);

    let requestController = null;
    const show = (state, text, label = "重试") => {
      banner.dataset.state = state;
      message.textContent = text;
      action.textContent = label;
      banner.hidden = false;
    };
    const hide = () => {
      banner.hidden = true;
      delete banner.dataset.state;
    };
    const check = async () => {
      if (window.location.protocol === "file:") {
        show("warning", "请通过本地服务打开，才能使用完整功能。", "打开服务");
        return;
      }
      if (!navigator.onLine) {
        show("danger", "网络已断开，恢复后可继续创作。");
        return;
      }
      requestController?.abort();
      requestController = new AbortController();
      const timer = window.setTimeout(() => requestController.abort(), 5000);
      try {
        const response = await fetch("/api/v1/health/ready", {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: requestController.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.status === "ready") hide();
        else show("warning", "服务正在启动，部分功能暂不可用。");
      } catch (_error) {
        show("danger", "暂时无法连接服务，请稍后重试。");
      } finally {
        window.clearTimeout(timer);
      }
    };

    action.addEventListener("click", () => {
      if (window.location.protocol === "file:") {
        window.location.href = "http://127.0.0.1:8081/studio.html";
        return;
      }
      check();
    });
    window.addEventListener("online", check);
    window.addEventListener("offline", () => show("danger", "网络已断开，恢复后可继续创作。"));
    check();
  };

  const initializeInterface = () => {
    initializeThemePicker();
    initializeServiceHealth();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeInterface, { once: true });
  } else {
    initializeInterface();
  }
})();
