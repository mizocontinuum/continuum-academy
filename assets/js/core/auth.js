/* ---------- CONTINUUM ACADEMY — AUTH & SESSION LAYER ---------- */
/* Pure client-side authentication. Pages call ContinuumAuth and render the
   result; they never touch storage, tokens, or redirects themselves.
   Sessions live in localStorage so the whole flow can be walked offline.

   Protected pages mark themselves with data-requires-auth on <html>. The guard
   runs while <head> is still parsing, so a signed-out visitor is redirected
   before any member content paints. */

(function () {
  "use strict";

  const CONFIG = Object.assign(
    {
      loginPath: "../login/",
      homePath: "../home/",
      profilePath: "../profile/",
      sessionTtlDays: 7,
      minPasswordLength: 8
    },
    window.CONTINUUM_CONFIG || {}
  );
  window.CONTINUUM_CONFIG = CONFIG;

  const SESSION_KEY = "continuum.session.v1";
  const USERS_KEY = "continuum.users.v1";
  const TTL_MS = CONFIG.sessionTtlDays * 24 * 60 * 60 * 1000;
  const MIN_PASSWORD = CONFIG.minPasswordLength;

  const listeners = new Set();

  /* ---------- ERRORS ---------- */
  class AuthError extends Error {
    constructor(message, field) {
      super(message);
      this.name = "AuthError";
      this.field = field || "form";
    }
  }

  /* ---------- STORAGE HELPERS ---------- */
  function readJSON(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeKey(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ---------- SESSION ---------- */
  function getSession() {
    const raw = readJSON(SESSION_KEY);
    if (!raw) return null;
    if (Date.now() - raw.createdAt > TTL_MS) {
      removeKey(SESSION_KEY);
      return null;
    }
    return raw;
  }

  function buildSession(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name || nameFromEmail(user.email),
      provider: "local",
      createdAt: Date.now()
    };
  }

  function persist(session) {
    writeJSON(SESSION_KEY, session);
    emit(session);
    return session;
  }

  function emit(session) {
    listeners.forEach((fn) => {
      try {
        fn(session);
      } catch (err) {
        /* subscriber failures don't stop auth */
      }
    });
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /* ---------- LOCAL USER REGISTRY ---------- */
  function loadDemoUsers() {
    return readJSON(USERS_KEY) || [];
  }

  function findDemoUser(email) {
    const target = normaliseEmail(email);
    return loadDemoUsers().find((u) => normaliseEmail(u.email) === target) || null;
  }

  function demoId(email) {
    let hash = 0;
    const str = normaliseEmail(email);
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return "usr-" + Math.abs(hash).toString(36);
  }

  function rememberDemoUser(email, name) {
    const users = loadDemoUsers();
    const address = normaliseEmail(email);
    const existing = users.find((u) => normaliseEmail(u.email) === address);
    if (existing) {
      existing.name = name || existing.name;
      writeJSON(USERS_KEY, users);
      return existing;
    }
    const fresh = {
      id: demoId(address),
      email: address,
      name: name || nameFromEmail(address),
      createdAt: Date.now()
    };
    users.push(fresh);
    writeJSON(USERS_KEY, users);
    return fresh;
  }

  /* ---------- HELPERS ---------- */
  function normaliseEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(email));
  }

  function nameFromEmail(email) {
    const head = normaliseEmail(email).split("@")[0] || "Member";
    return head
      .split(/[._-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function initialOf(name, fallback) {
    const clean = String(name || "").trim();
    if (clean) return clean.charAt(0).toUpperCase();
    return fallback || "M";
  }

  function safeNext(nextParam) {
    if (!nextParam) return null;
    try {
      const parsed = new URL(nextParam, window.location.origin);
      if (parsed.origin !== window.location.origin) return null;
      return parsed.pathname + parsed.search;
    } catch (e) {
      return null;
    }
  }

  function redirectToLogin() {
    const target = new URL(CONFIG.loginPath, window.location.href);
    target.searchParams.set("next", window.location.pathname + window.location.search);
    window.location.replace(target.href);
  }

  function requireSession() {
    const session = getSession();
    if (!session) {
      redirectToLogin();
      return null;
    }
    return session;
  }

  /* ---------- PUBLIC API ---------- */

  async function signIn(email, password) {
    const address = normaliseEmail(email);
    const secret = String(password || "");

    if (!isValidEmail(address)) throw new AuthError("That email address doesn't look right.", "email");
    if (secret.length < MIN_PASSWORD) {
      throw new AuthError("Passwords are at least " + MIN_PASSWORD + " characters.", "password");
    }

    const user = findDemoUser(address) || rememberDemoUser(address, nameFromEmail(address));
    return persist(buildSession({ id: user.id, email: address, name: user.name }));
  }

  async function signUp(parts) {
    const name = String((parts && parts.name) || "").trim();
    const address = normaliseEmail(parts && parts.email);
    const secret = String((parts && parts.password) || "");
    const confirm = parts ? parts.confirm : undefined;

    if (name.length < 2) throw new AuthError("Tell us what to call you.", "name");
    if (!isValidEmail(address)) throw new AuthError("That email address doesn't look right.", "email");
    if (secret.length < MIN_PASSWORD) {
      throw new AuthError("Use at least " + MIN_PASSWORD + " characters.", "password");
    }
    if (confirm !== undefined && secret !== String(confirm)) {
      throw new AuthError("The two passwords don't match.", "confirm");
    }

    const user = rememberDemoUser(address, name);
    return persist(buildSession({ id: user.id, email: address, name: user.name }));
  }

  async function signOut(options) {
    const settings = options || {};
    removeKey(SESSION_KEY);
    emit(null);
    if (settings.redirect !== false) window.location.replace(CONFIG.loginPath);
  }

  async function requestPasswordReset(email) {
    const address = normaliseEmail(email);
    if (!isValidEmail(address)) throw new AuthError("That email address doesn't look right.", "email");
    return { sent: true, email: address, demoToken: demoId(address) };
  }

  async function updatePassword(password, confirm) {
    const secret = String(password || "");
    if (secret.length < MIN_PASSWORD) {
      throw new AuthError("Use at least " + MIN_PASSWORD + " characters.", "password");
    }
    if (confirm !== undefined && secret !== String(confirm)) {
      throw new AuthError("The two passwords don't match.", "confirm");
    }
    return { updated: true };
  }

  async function updateProfile(patch) {
    const session = getSession();
    if (!session) throw new AuthError("Your session expired. Sign in again.", "form");

    const next = Object.assign({}, session);
    if (patch && patch.name) next.name = String(patch.name).trim();
    if (!next.name) throw new AuthError("Your name can't be empty.", "name");

    writeJSON(SESSION_KEY, next);
    rememberDemoUser(next.email, next.name);
    emit(next);
    return next;
  }

  /* ---------- DOM CHROME BINDING ---------- */
  function renderChrome(session) {
    const name = session ? session.name : "";
    const letter = initialOf(name);

    document.querySelectorAll("[data-session-name]").forEach((el) => {
      el.textContent = name;
    });
    document.querySelectorAll("[data-session-initial]").forEach((el) => {
      el.textContent = letter;
    });
    document.querySelectorAll("[data-session-email]").forEach((el) => {
      el.textContent = session ? session.email : "";
    });
  }

  function bindChrome() {
    renderChrome(getSession());
    onChange(renderChrome);

    document.querySelectorAll("[data-logout]").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        signOut();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindChrome);
  } else {
    bindChrome();
  }

  /* ---------- SERVICE WORKER ---------- */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      try {
        const swUrl = new URL("../sw.js", document.baseURI).href;
        const scope = new URL("../", document.baseURI).pathname;
        navigator.serviceWorker.register(swUrl, { scope: scope }).catch((err) => {
          console.warn("[ContinuumAuth] service worker not registered:", err && err.message ? err.message : err);
        });
      } catch (err) {
        console.warn("[ContinuumAuth] service worker registration threw:", err && err.message ? err.message : err);
      }
    });
  }

  /* ---------- BOOT ---------- */
  if (document.documentElement.hasAttribute("data-requires-auth") && !getSession()) {
    redirectToLogin();
  }

  registerServiceWorker();

  window.ContinuumAuth = {
    config: CONFIG,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    requestPasswordReset: requestPasswordReset,
    updatePassword: updatePassword,
    updateProfile: updateProfile,
    getSession: getSession,
    getUser: getSession,
    onChange: onChange,
    requireSession: requireSession,
    safeNext: safeNext,
    initialOf: initialOf,
    isValidEmail: isValidEmail,
    normaliseEmail: normaliseEmail,
    isDemo: () => true
  };
})();
