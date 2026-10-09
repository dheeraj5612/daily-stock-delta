(function () {
  "use strict";

  const storageKey = "daily-stock-delta-theme";
  const preference = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  let saved = null;
  try {
    const value = window.localStorage.getItem(storageKey);
    if (value === "dark" || value === "light") saved = value;
  } catch (_) { /* Theme still works when browser storage is unavailable. */ }
  let theme = saved || (preference && preference.matches ? "dark" : "light");

  function apply() {
    document.documentElement.setAttribute("data-theme", theme);
    const button = document.getElementById("theme-toggle");
    if (button) {
      button.textContent = theme === "dark" ? "Light" : "Dark";
      button.setAttribute("aria-label", "Switch to " + (theme === "dark" ? "light" : "dark") + " mode");
      button.setAttribute("aria-pressed", String(theme === "dark"));
    }
  }

  apply();
  function connect() {
    apply();
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    button.addEventListener("click", function () {
      theme = theme === "dark" ? "light" : "dark";
      saved = theme;
      try { window.localStorage.setItem(storageKey, theme); } catch (_) { /* Use the choice for this page. */ }
      apply();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connect, { once: true });
  else connect();

  if (preference && typeof preference.addEventListener === "function") {
    preference.addEventListener("change", function (event) {
      if (!saved) { theme = event.matches ? "dark" : "light"; apply(); }
    });
  }
})();
