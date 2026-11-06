/* ---------- CONTINUUM ACADEMY — THEME PREFERENCE ---------- */
/* Loads in <head> before first paint so a light-mode member never sees a
   dark flash. The choice lives in localStorage; the mode itself is one
   attribute on <html> that assets/css/theme.css keys off. */

window.ContinuumTheme = (function () {
  "use strict";

  const KEY = "continuum.theme.v1";

  function read() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw === "light" ? "light" : "dark";
    } catch (err) {
      return "dark";
    }
  }

  function apply(mode) {
    document.documentElement.setAttribute("data-theme", mode);
  }

  function current() {
    return read();
  }

  /* Returns the mode that is now active. */
  function toggle() {
    const next = read() === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(KEY, next);
    } catch (err) {
      /* private mode: the switch still works for this visit */
    }
    apply(next);
    return next;
  }

  /* Runs immediately — this file is loaded before any stylesheet paints. */
  apply(read());

  return { current: current, toggle: toggle, apply: apply };
})();
