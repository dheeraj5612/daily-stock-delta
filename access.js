/* Version 1: optional account and hosted checkout UI, never an entitlement gate. */
(function () {
  "use strict";

  const VERSION = 1;
  const state = { auth: "disabled", billing: "disabled" };
  const selectors = {
    signIn: "[data-access-sign-in]",
    user: "[data-access-user]",
    billing: "[data-access-billing]",
    status: "[data-access-status]"
  };
  const elements = (selector) => Array.from(document.querySelectorAll(selector));

  function hideControls() {
    [selectors.signIn, selectors.user, selectors.billing].forEach((selector) => {
      elements(selector).forEach((element) => { element.hidden = true; });
    });
    elements(selectors.billing).forEach((element) => element.removeAttribute("href"));
  }

  function status(message) {
    elements(selectors.status).forEach((element) => { element.textContent = message; });
  }

  function clerkHost(auth) {
    if (auth.provider !== "clerk" || typeof auth.publishableKey !== "string" ||
        !/^pk_(?:test|live)_[A-Za-z0-9_-]+$/.test(auth.publishableKey) ||
        typeof auth.frontendApiHost !== "string") return null;
    try {
      const encoded = auth.publishableKey.split("_").slice(2).join("_");
      const decoded = window.atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
      const host = decoded.endsWith("$") ? decoded.slice(0, -1) : "";
      if (host !== auth.frontendApiHost ||
          !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) ||
          host.includes("..")) return null;
      // Clerk development instances or this site's provisioned production FAPI.
      if (!host.endsWith(".clerk.accounts.dev") && host !== "clerk.dailystockdelta.com") return null;
      const url = new URL("https://" + host);
      return url.hostname === host && !url.port ? host : null;
    } catch (_) { return null; }
  }

  function stripeLink(billing) {
    if (billing.provider !== "stripe" || typeof billing.paymentLink !== "string") return null;
    try {
      const url = new URL(billing.paymentLink);
      if (url.protocol !== "https:" || url.hostname !== "buy.stripe.com" ||
          url.username || url.password || url.port || url.hash ||
          !/^\/(?:test_)?[A-Za-z0-9]+$/.test(url.pathname)) return null;
      return url.href;
    } catch (_) { return null; }
  }

  function loadScript(src, publishableKey) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => finish(new Error("Provider timeout")), 15000);
      function finish(error) {
        window.clearTimeout(timeout);
        script.onload = null;
        script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve();
      }
      script.src = src;
      script.async = true;
      script.crossOrigin = "anonymous";
      if (publishableKey) script.setAttribute("data-clerk-publishable-key", publishableKey);
      script.onload = () => finish();
      script.onerror = () => finish(new Error("Provider unavailable"));
      document.head.appendChild(script);
    });
  }

  async function initialize() {
    hideControls();
    status("Free access");
    const config = window.DailyStockDeltaAccessConfig;
    if (!config || config.version !== VERSION) return;

    const billing = config.billing || {};
    if (billing.enabled === true) {
      const link = window.location.protocol === "https:" ? stripeLink(billing) : null;
      state.billing = link ? "ready" : "unavailable";
      if (link) elements(selectors.billing).forEach((element) => {
        if (element.tagName !== "A") return;
        element.href = link;
        element.rel = "noopener noreferrer";
        element.hidden = false;
      });
    }

    const auth = config.auth || {};
    if (auth.enabled !== true) return;
    const host = window.location.protocol === "https:" ? clerkHost(auth) : null;
    if (!host) {
      state.auth = "unavailable";
      status("Account access unavailable. Today's edition remains free.");
      return;
    }

    state.auth = "loading";
    try {
      await loadScript("https://" + host + "/npm/@clerk/ui@1/dist/ui.browser.js");
      await loadScript("https://" + host + "/npm/@clerk/clerk-js@6/dist/clerk.browser.js", auth.publishableKey);
      const clerk = window.Clerk;
      if (!clerk || typeof clerk.load !== "function" || !window.__internal_ClerkUICtor) {
        throw new Error("Provider unavailable");
      }
      await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
      const mounted = new Set();
      const render = () => {
        const signedIn = clerk.isSignedIn === true;
        elements(selectors.signIn).forEach((element) => { element.hidden = signedIn; });
        elements(selectors.user).forEach((element) => {
          element.hidden = !signedIn;
          if (signedIn && !mounted.has(element)) {
            clerk.mountUserButton(element);
            mounted.add(element);
          } else if (!signedIn && mounted.has(element)) {
            clerk.unmountUserButton(element);
            mounted.delete(element);
          }
        });
        status(signedIn ? "Signed in. Today's edition remains free." : "Free access");
      };
      elements(selectors.signIn).forEach((element) => {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          Promise.resolve().then(() => clerk.openSignIn()).catch(() => {
            status("Sign in unavailable. Today's edition remains free.");
          });
        });
      });
      render();
      clerk.addListener(render);
      state.auth = "ready";
    } catch (_) {
      state.auth = "unavailable";
      elements(selectors.signIn).concat(elements(selectors.user)).forEach((element) => {
        element.hidden = true;
      });
      status("Account access unavailable. Today's edition remains free.");
    }
  }

  let start;
  const ready = new Promise((resolve) => { start = () => { initialize().then(resolve); }; });
  window.DailyStockDeltaAccess = Object.freeze({
    version: VERSION,
    ready,
    getStatus: () => Object.freeze({ auth: state.auth, billing: state.billing })
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
