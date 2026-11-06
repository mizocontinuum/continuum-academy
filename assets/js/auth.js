/* ---------- CONTINUUM ACADEMY — AUTH & SESSION LAYER ---------- */
/* One module for every page. Pages call ContinuumAuth and render the result;
   they never touch storage, tokens or redirects themselves.

   Two modes, chosen in assets/js/config.js:
     "demo"      A local session only. No password is ever written to storage,
                 so the whole flow can be walked on a laptop or a phone.
     "supabase"  Real accounts. Needs the supabase-js bundle plus a project URL
                 and anon key in config.js.

   IMPORTANT: demo mode is a UI scaffold, not a security boundary — a visitor
   can write the session key by hand. Before this serves real members, switch
   to "supabase" and apply supabase/migrations/0001_init.sql so the database
   enforces who may read and write what.

   Protected pages mark themselves with data-requires-auth on <html>. The guard
   below runs while <head> is still parsing, so a signed-out visitor is
   redirected before any member content paints. */

(function () {
  "use strict";

  const CONFIG = Object.assign(
    {
      mode: "demo",
      supabaseUrl: "",
      supabaseAnonKey: "",
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
  /* field names the input that caused it so forms can highlight the right box */
  class AuthError extends Error {
    constructor(message, field) {
      super(message);
      this.name = "AuthError";
      this.field = field || "form";
    }
  }

  /* ---------- STORAGE ---------- */
  /* Every access fails soft: Safari private mode and exhausted quotas throw. */
  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeKey(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* nothing to clean up */
    }
  }

  /* ---------- HELPERS ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function normaliseEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isValidEmail(value) {
    return EMAIL_RE.test(normaliseEmail(value));
  }

  /* Stable id so a demo member keeps the same library across reloads.
     Not a security primitive — the Supabase mode uses the real user id. */
  function demoId(email) {
    let hash = 2166136261;
    for (let i = 0; i < email.length; i += 1) {
      hash ^= email.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "local-" + (hash >>> 0).toString(16);
  }

  function nameFromEmail(email) {
    const local = (email.split("@")[0] || "Member").replace(/[._-]+/g, " ").trim();
    return local.replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Member";
  }

  function initialOf(session) {
    const source = (session && (session.name || session.email)) || "";
    return source.trim().charAt(0).toUpperCase() || "M";
  }

  /* ---------- DEMO USER REGISTRY ---------- */
  /* Email and display name only. The demo accepts any password of a valid
     length, so the flow can be re-walked without a reset. */
  function demoUsers() {
    return readJSON(USERS_KEY, {});
  }

  function findDemoUser(email) {
    const registry = demoUsers();
    return registry[email] || null;
  }

  function rememberDemoUser(email, name) {
    const registry = demoUsers();
    const existing = registry[email];
    registry[email] = {
      id: (existing && existing.id) || demoId(email),
      email: email,
      name: name || (existing && existing.name) || nameFromEmail(email),
      createdAt: (existing && existing.createdAt) || new Date().toISOString()
    };
    writeJSON(USERS_KEY, registry);
    return registry[email];
  }

  /* ---------- SESSION ---------- */
  function buildSession(parts) {
    const now = Date.now();
    return {
      id: parts.id,
      email: parts.email,
      name: parts.name,
      provider: parts.provider,
      issuedAt: now,
      expiresAt: now + TTL_MS
    };
  }

  function emit(session) {
    listeners.forEach((fn) => {
      try {
        fn(session);
      } catch (err) {
        /* a broken listener must not break sign-in */
      }
    });
  }

  function persist(session) {
    writeJSON(SESSION_KEY, session);
    emit(session);
    return session;
  }

  function getSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session || !session.expiresAt) return null;
    if (Date.now() > session.expiresAt) {
      removeKey(SESSION_KEY);
      return null;
    }
    return session;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /* ---------- REDIRECTS ---------- */
  /* Only same-origin paths are accepted, so ?next= cannot bounce a freshly
     signed-in member to another site. */
  function safeNext(raw) {
    if (!raw) return null;
    try {
      const url = new URL(raw, window.location.href);
      if (url.origin !== window.location.origin) return null;
      return url.pathname + url.search + url.hash;
    } catch (err) {
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

  /* ---------- SUPABASE ADAPTER ---------- */
  /* Returns null unless the app is configured for real accounts, which keeps
     every call site identical in both modes. */
  let supabaseClient = null;

  /* A supabase mode that cannot reach Supabase is a misconfiguration, not a
     preference. The fallback used to be invisible: sign-in kept "working"
     against the local registry, so a launch could ship believing it had real
     accounts while every password was decorative. Report each reason once,
     then still return null — the pages have to keep working either way. */
  const reportedFaults = new Set();

  function misconfigured(reason) {
    if (reportedFaults.has(reason)) return;
    reportedFaults.add(reason);
    console.error(
      '[ContinuumAuth] config.js says mode "supabase" but ' + reason +
      ". Falling back to the local demo registry: no real accounts are in use."
    );
  }

  function remote() {
    if (CONFIG.mode !== "supabase") return null;
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
      misconfigured("supabaseUrl and supabaseAnonKey are both empty");
      return null;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      misconfigured("supabase-js is not loaded on this page (there is no assets/js/vendor/ bundle)");
      return null;
    }
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return supabaseClient;
  }

  /* ---------- PUBLIC API ---------- */

  async function signIn(email, password) {
    const address = normaliseEmail(email);
    const secret = String(password || "");

    if (!isValidEmail(address)) throw new AuthError("That email address doesn't look right.", "email");
    if (secret.length < MIN_PASSWORD) {
      throw new AuthError("Passwords are at least " + MIN_PASSWORD + " characters.", "password");
    }

    const client = remote();
    if (client) {
      const result = await client.auth.signInWithPassword({ email: address, password: secret });
      if (result.error) throw new AuthError(result.error.message, "form");
      const user = result.data.user;
      return persist(
        buildSession({
          id: user.id,
          email: address,
          name: (user.user_metadata && user.user_metadata.full_name) || nameFromEmail(address),
          provider: "supabase"
        })
      );
    }

    const user = findDemoUser(address) || rememberDemoUser(address, nameFromEmail(address));
    return persist(buildSession({ id: user.id, email: address, name: user.name, provider: "demo" }));
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

    const client = remote();
    if (client) {
      const result = await client.auth.signUp({
        email: address,
        password: secret,
        options: { data: { full_name: name } }
      });
      if (result.error) throw new AuthError(result.error.message, "form");
      /* Email confirmation is on by default: no session until the link opens. */
      if (!result.data.session) return { pending: true, email: address };
      return persist(
        buildSession({ id: result.data.user.id, email: address, name: name, provider: "supabase" })
      );
    }

    if (findDemoUser(address)) {
      throw new AuthError("An account with that email already exists.", "email");
    }
    const user = rememberDemoUser(address, name);
    return persist(buildSession({ id: user.id, email: address, name: user.name, provider: "demo" }));
  }

  async function signOut(options) {
    const settings = options || {};
    const client = remote();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        /* the local session still has to go */
      }
    }
    removeKey(SESSION_KEY);
    emit(null);
    if (settings.redirect !== false) window.location.replace(CONFIG.loginPath);
  }

  async function requestPasswordReset(email) {
    const address = normaliseEmail(email);
    if (!isValidEmail(address)) throw new AuthError("That email address doesn't look right.", "email");

    const client = remote();
    if (client) {
      const result = await client.auth.resetPasswordForEmail(address, {
        redirectTo: new URL("../reset-password/", window.location.href).href
      });
      if (result.error) throw new AuthError(result.error.message, "form");
      return { sent: true, email: address };
    }

    /* Demo: no mail leaves the machine, the page offers the reset screen. */
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

    const client = remote();
    if (client) {
      const result = await client.auth.updateUser({ password: secret });
      if (result.error) throw new AuthError(result.error.message, "form");
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
    const registry = demoUsers();
    if (registry[session.email]) {
      registry[session.email].name = next.name;
      writeJSON(USERS_KEY, registry);
    }

    const client = remote();
    if (client) {
      try {
        await client.auth.updateUser({ data: { full_name: next.name } });
      } catch (err) {
        /* the local name is already updated */
      }
    }
    return persist(next);
  }

  /* ---------- PAGE CHROME ---------- */
  /* Fills every placeholder the pages expose, so no page hardcodes a user. */
  function renderChrome(session) {
    document.querySelectorAll("[data-session-initial]").forEach((el) => {
      el.textContent = session ? initialOf(session) : "?";
    });
    document.querySelectorAll("[data-session-name]").forEach((el) => {
      el.textContent = session ? session.name : "";
    });
    document.querySelectorAll("[data-session-email]").forEach((el) => {
      el.textContent = session ? session.email : "";
    });
    document.querySelectorAll("[data-demo-chip]").forEach((el) => {
      el.hidden = CONFIG.mode === "supabase";
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

    /* Capture phase: the avatar stops being a toast so it can open the account
       page, without editing the handler inside each page script. Pages with
       the navbar user menu own the avatar themselves — see user-menu.js. */
    const profileBtn = document.getElementById("profileBtn");
    if (profileBtn && CONFIG.profilePath && !window.ContinuumUserMenu) {
      profileBtn.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.location.href = CONFIG.profilePath;
        },
        true
      );
    }
  }

  /* ---------- SERVICE WORKER ---------- */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
    window.addEventListener("load", () => {
      try {
        const swUrl = new URL("../sw.js", document.baseURI).href;
        const scope = new URL("../", document.baseURI).pathname;
        navigator.serviceWorker.register(swUrl, { scope: scope }).catch((err) => {
          /* Still never a blocker — but say why. An install that fails
             silently is indistinguishable from an app that never offered one,
             which is exactly how a broken sw.js reaches production. */
          console.warn("[ContinuumAuth] service worker not registered:", err && err.message ? err.message : err);
        });
      } catch (err) {
        console.warn("[ContinuumAuth] service worker registration threw:", err && err.message ? err.message : err);
      }
    });
  }

  /* ---------- INSTALL PROMPT ---------- */
  /* The browser decides when an install may be offered and says so with
     beforeinstallprompt. Until that fires there is nothing to suggest, so the
     pill is built on demand instead of sitting in every page's markup.

     It lives here because this is the one script all fourteen pages load: a
     page added later gets the offer without anyone remembering to wire it up.
     The stylesheet rides in on an injected <link> — style-src 'self' allows a
     same-origin file, so no 'unsafe-inline' is needed to style this. */

  const INSTALL_DISMISSED = "continuum.install.dismissed";
  let installPrompt = null;

  /* Already running as an installed app: offering to install it again is noise. */
  function isStandalone() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    return Boolean(window.navigator.standalone); /* iOS before it read display-mode */
  }

  function installDismissed() {
    try {
      return sessionStorage.getItem(INSTALL_DISMISSED) === "1";
    } catch (error) {
      return false; /* private mode blocks storage; showing the pill is harmless */
    }
  }

  function rememberInstallDismissed() {
    try {
      sessionStorage.setItem(INSTALL_DISMISSED, "1");
    } catch (error) {
      /* same */
    }
  }

  function showInstallPrompt() {
    if (document.getElementById("installPrompt") || installDismissed()) return;

    if (!document.getElementById("installStyles")) {
      const link = document.createElement("link");
      link.id = "installStyles";
      link.rel = "stylesheet";
      /* Same relative trick the worker registration uses: pages sit one level
         below the root, the root page clamps at itself, so both resolve. */
      link.href = new URL("../assets/css/install.css", document.baseURI).href;
      document.head.appendChild(link);
    }

    const pill = document.createElement("div");
    pill.id = "installPrompt";
    pill.className = "install-prompt";

    const cta = document.createElement("button");
    cta.type = "button";
    cta.className = "install-cta";
    cta.innerHTML =
      '<svg class="install-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M4 20h16"/></svg>' +
      "<span>Install app</span>";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "install-close";
    close.setAttribute("aria-label", "Hide the install suggestion");
    close.innerHTML =
      '<svg class="install-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

    cta.addEventListener("click", () => {
      if (!installPrompt) return;
      const deferred = installPrompt;
      /* One prompt per event: the browser will not hand out a second chance. */
      installPrompt = null;
      deferred.prompt();
      deferred.userChoice
        .then((choice) => {
          /* Accepting ends with appinstalled, which hides the pill; a refusal is
             final for a while, so stop asking for the rest of this session. */
          if (!choice || choice.outcome !== "accepted") rememberInstallDismissed();
          hideInstallPrompt();
        })
        .catch(() => hideInstallPrompt());
    });

    close.addEventListener("click", () => {
      rememberInstallDismissed();
      hideInstallPrompt();
    });

    pill.appendChild(cta);
    pill.appendChild(close);
    document.body.appendChild(pill);
  }

  function hideInstallPrompt() {
    const pill = document.getElementById("installPrompt");
    if (pill) pill.hidden = true;
  }

  function wireInstallPrompt() {
    if (isStandalone()) return;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      /* auth.js runs while <head> is still parsing, so the body may not exist. */
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showInstallPrompt, { once: true });
      } else {
        showInstallPrompt();
      }
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      hideInstallPrompt();
    });
  }

  /* ---------- BOOT ---------- */
  /* Runs while <head> is parsing: signed-out visitors never see member content. */
  if (document.documentElement.hasAttribute("data-requires-auth") && !getSession()) {
    redirectToLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindChrome);
  } else {
    bindChrome();
  }

  registerServiceWorker();
  wireInstallPrompt();

  window.ContinuumAuth = {
    config: CONFIG,
    AuthError: AuthError,
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
    isDemo: () => CONFIG.mode !== "supabase"
  };
})();
