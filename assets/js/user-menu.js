/* ---------- CONTINUUM ACADEMY — USER MENU ---------- */
/* The profile dropdown for the navbar avatar. Plain-JS equivalent of a
   React <UserMenu/>: it builds its panel from the live session, so nothing
   is hard-coded, and any page gets it with two tags —
     <link rel="stylesheet" href="../assets/css/user-menu.css">
     <script src="../assets/js/user-menu.js" defer></script>
   The trigger is the existing #profileBtn (class avatar-btn). When this
   module is present, auth.js stops redirecting that button to /profile/
   and the menu owns it instead.

   Behaviour per spec:
   - click avatar toggles; outside click and Esc close
   - keyboard: Enter/Space open, ArrowUp/ArrowDown walk items, Home/End,
     Esc closes and returns focus to the avatar
   - Theme item toggles light/dark, relabels itself, and does NOT close
   - Log Out uses ContinuumAuth.signOut(), which redirects to /login/ */

(function () {
  "use strict";

  const trigger = document.getElementById("profileBtn");
  if (!trigger) return;

  const CONFIG = window.CONTINUUM_CONFIG || {};
  const auth = window.ContinuumAuth || null;

  /* Marks itself for auth.js: with this set, the avatar is not a link
     to the profile page anymore — it is a menu. */
  window.ContinuumUserMenu = true;

  /* ---------- ICONS (lucide-equivalent inline SVG) ---------- */
  const ICONS = {
    user:
      '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    book:
      '<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
    card:
      '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    admin:
      '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    sun:
      '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/>',
    moon:
      '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    logout:
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
  };

  function iconSvg(name) {
    return (
      '<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICONS[name] + "</svg>"
    );
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- SESSION ---------- */
  function session() {
    return auth ? auth.getSession() : null;
  }

  /* ---------- ITEMS ---------- */
  function menuItems() {
    return [
      {
        label: "My Profile",
        icon: "user",
        tint: "teal",
        href: CONFIG.profilePath || "../profile/"
      },
      {
        label: "My Saved List",
        icon: "book",
        tint: "yellow",
        href: "../library/"
      },
      {
        label: "Open Admin Beta",
        icon: "admin",
        tint: "purple",
        href: "../admin/"
      },
      {
        label: "Theme",
        icon: "theme",
        tint: "theme",
        action: toggleTheme,
        stayOpen: true
      },
      {
        label: "Log Out",
        icon: "logout",
        tint: "red",
        divider: true,
        action: function () {
          if (auth) {
            auth.signOut(); /* redirects to the login page */
          } else {
            window.location.href = CONFIG.loginPath || "../login/";
          }
        }
      }
    ];
  }

  /* ---------- THEME ITEM STATE ---------- */
  function themeMode() {
    return window.ContinuumTheme ? ContinuumTheme.current() : "dark";
  }

  function toggleTheme() {
    if (!window.ContinuumTheme) return;
    ContinuumTheme.toggle();
    refreshThemeItem();
    toast(themeMode() === "light" ? "Light mode on" : "Dark mode on");
  }

  /* The label names the mode a click will switch TO, like the sun icon in
     dark mode and the moon icon in light mode. */
  function themeLabel() {
    return themeMode() === "dark" ? "Theme: Light Mode" : "Theme: Dark Mode";
  }

  function themeIcon() {
    return themeMode() === "dark" ? "sun" : "moon";
  }

  function refreshThemeItem() {
    if (!panel) return;
    const item = panel.querySelector('[data-action-index="3"]');
    if (!item) return;
    /* Replace the paths inside the existing <svg> rather than the node itself,
       which keeps its class, viewBox and stroke attributes. Either way the click
       that triggered this rebuild may still be bubbling and its target may be one
       of the shapes being discarded — the outside-click guard below accounts for
       that, so stayOpen survives. */
    const svg = item.querySelector(".menu-icon");
    if (svg) svg.innerHTML = ICONS[themeIcon()];
    const label = item.querySelector(".menu-label");
    if (label) label.textContent = themeLabel();
  }

  /* ---------- TOAST (page toast if present, else quiet) ---------- */
  function toast(message) {
    const el = document.getElementById("homeToast") || document.getElementById("pageToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      el.classList.remove("show");
    }, 2000);
  }

  /* ---------- PANEL ---------- */
  const panel = document.createElement("div");
  panel.className = "user-menu-panel";
  panel.id = "userMenuPanel";
  panel.setAttribute("role", "menu");
  panel.setAttribute("aria-labelledby", "profileBtn");

  function buildPanel() {
    const user = session();
    const name = (user && user.name) || "Member";
    const email = (user && user.email) || "No email on this session";

    const items = menuItems();
    const rows = items.map(function (item, i) {
      const tag = item.href ? "a" : "button";
      const linkAttrs = item.href
        ? 'href="' + escapeHtml(item.href) + '"'
        : 'type="button"';
      const divider = item.divider ? " user-menu-divider" : "";
      return (
        "<" + tag + ' class="user-menu-item tint-' + item.tint + divider + '"' +
          " " + linkAttrs +
          ' role="menuitem" tabindex="-1"' +
          ' data-action-index="' + i + '">' +
          iconSvg(item.icon === "theme" ? themeIcon() : item.icon) +
          '<span class="menu-label">' +
            escapeHtml(item.icon === "theme" ? themeLabel() : item.label) +
          "</span>" +
        "</" + tag + ">"
      );
    });

    panel.innerHTML =
      '<div class="user-menu-header">' +
        '<div class="user-menu-name">' + escapeHtml(name) + "</div>" +
        '<div class="user-menu-email">' + escapeHtml(email) + "</div>" +
      "</div>" +
      '<div class="user-menu-list">' + rows.join("") + "</div>";
  }

  /* ---------- OPEN / CLOSE ---------- */
  let open = false;

  function items() {
    return Array.prototype.slice.call(panel.querySelectorAll('[role="menuitem"]'));
  }

  function setOpen(value, focusFirst) {
    open = value;
    panel.classList.toggle("open", value);
    panel.setAttribute("aria-hidden", value ? "false" : "true");
    trigger.setAttribute("aria-expanded", value ? "true" : "false");
    trigger.classList.toggle("menu-active", value);

    if (value) {
      buildPanel();
      if (focusFirst !== false) {
        const first = items()[0];
        if (first) first.focus();
      }
    } else if (panel.contains(document.activeElement)) {
      /* Closing hides the panel from assistive tech with aria-hidden, so focus
         has to leave it first — otherwise it parks inside a hidden subtree. */
      trigger.focus();
    }
  }

  function closeMenu(refocus) {
    if (!open) return;
    setOpen(false);
    if (refocus) trigger.focus();
  }

  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "userMenuPanel");

  trigger.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!open);
  });

  /* Enter/Space already fire click on <button>; make ArrowDown open too */
  trigger.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  });

  document.addEventListener("click", function (event) {
    if (!open) return;
    /* An item that rebuilds itself on click (the Theme icon) can discard the very
       node that was hit while this click is still bubbling to us, which leaves
       event.target detached and panel.contains() false for a click that plainly
       happened inside the menu. composedPath() is snapshotted when the event is
       dispatched, so it still names the panel. */
    const path = typeof event.composedPath === "function" ? event.composedPath() : null;
    if (path) {
      if (path.indexOf(panel) !== -1 || path.indexOf(trigger) !== -1) return;
    } else if (panel.contains(event.target) || trigger.contains(event.target)) {
      return;
    }
    setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    const list = items();
    const at = list.indexOf(document.activeElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp" ||
        event.key === "Home" || event.key === "End") {
      event.preventDefault();
      let next = at;
      if (event.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % list.length;
      if (event.key === "ArrowUp") next = at <= 0 ? list.length - 1 : (at - 1) % list.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = list.length - 1;
      if (list[next]) list[next].focus();
    }
  });

  /* Item activation */
  panel.addEventListener("click", function (event) {
    const item = event.target.closest(".user-menu-item");
    if (!item) return;

    const config = menuItems()[Number(item.dataset.actionIndex)];
    if (!config) return;

    if (config.action) {
      event.preventDefault();
      config.action();
      /* Theme toggles in place; everything else dismisses the menu */
      if (!config.stayOpen) closeMenu(false);
    } else {
      closeMenu(false); /* links navigate on their own */
    }
  });

  /* Keep the panel inside the viewport on small screens */
  window.addEventListener("resize", function () {
    closeMenu(false);
  });

  /* ---------- BOOT ---------- */
  const mount = trigger.closest(".top-actions") || trigger.parentElement;
  if (mount) mount.classList.add("has-user-menu");
  (mount || document.body).appendChild(panel);
})();
