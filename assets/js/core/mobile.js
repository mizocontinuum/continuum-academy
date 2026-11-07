/* ---------- CONTINUUM ACADEMY — MOBILE & CAPACITOR BRIDGE ---------- */
/* Provides native platform bridge, haptic feedback, status bar management,
   and hardware back-button routing when running inside Capacitor (iOS / Android),
   with graceful no-op fallbacks when running in a standard mobile web browser. */

window.ContinuumMobile = (function () {
  "use strict";

  const isNative = Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const rawPlatform = (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "web";
  const platform = isNative ? rawPlatform : (/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : (/android/i.test(navigator.userAgent) ? "android" : "web"));

  /* Tag <html> with platform indicators for CSS safe areas and notch handling */
  const doc = document.documentElement;
  doc.classList.add("platform-" + platform);
  if (isNative) {
    doc.classList.add("is-native-app");
  }

  /* ---------- HAPTICS ---------- */
  function haptic(type) {
    const Haptics = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (Haptics) {
      try {
        if (type === "success" || type === "error" || type === "warning") {
          Haptics.notification({ type: type.toUpperCase() });
        } else if (type === "medium" || type === "heavy") {
          Haptics.impact({ style: type.toUpperCase() });
        } else {
          Haptics.impact({ style: "LIGHT" });
        }
        return;
      } catch (e) {
        /* ignore plugin call failures */
      }
    }

    /* Fallback for web browsers that support navigator.vibrate */
    if (navigator.vibrate) {
      try {
        if (type === "success") navigator.vibrate([10, 30, 20]);
        else if (type === "heavy") navigator.vibrate(25);
        else navigator.vibrate(10);
      } catch (e) {
        /* vibrate blocked */
      }
    }
  }

  /* ---------- STATUS BAR ---------- */
  function configureStatusBar() {
    const StatusBar = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
    if (!StatusBar) return;

    try {
      StatusBar.setStyle({ style: "DARK" });
      StatusBar.setBackgroundColor({ color: "#0b1117" });
      if (platform === "android") {
        StatusBar.setOverlaysWebView({ overlay: false });
      }
    } catch (e) {
      console.warn("[ContinuumMobile] StatusBar config threw:", e);
    }
  }

  /* ---------- MODAL CLOSING & BACK BUTTON ---------- */
  function closeActiveModals() {
    let handled = false;

    // 1. Video modal (Home, Disciplines, Explore, Library, Search)
    const videoModal = document.getElementById("videoModal");
    if (videoModal && (videoModal.classList.contains("open") || videoModal.getAttribute("aria-hidden") === "false")) {
      const closeBtn = document.getElementById("closeVideoBtn");
      if (closeBtn) {
        closeBtn.click();
        handled = true;
      }
    }

    // 2. User avatar menu
    const userMenuPanel = document.getElementById("userMenuPanel");
    if (userMenuPanel && (userMenuPanel.classList.contains("open") || userMenuPanel.getAttribute("aria-hidden") === "false")) {
      const avatarBtn = document.getElementById("userMenuBtn");
      if (avatarBtn) {
        avatarBtn.click();
        handled = true;
      }
    }

    return handled;
  }

  function wireBackButton() {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App) return;

    App.addListener("backButton", function (data) {
      if (closeActiveModals()) {
        haptic("light");
        return;
      }

      if (data.canGoBack || window.history.length > 1) {
        haptic("light");
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  }

  /* ---------- DELEGATED TOUCH HAPTICS ---------- */
  function wireTouchFeedback() {
    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!target) return;

      const interactive = target.closest(
        'button, .nav-tab, .card, .btn-action, .like-btn, .pill, a[href]'
      );
      if (interactive) {
        haptic("light");
      }
    }, { passive: true });
  }

  /* ---------- INITIALIZATION ---------- */
  function init() {
    configureStatusBar();
    wireBackButton();
    wireTouchFeedback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  return {
    isNative: isNative,
    platform: platform,
    haptic: haptic,
    closeActiveModals: closeActiveModals
  };
})();

