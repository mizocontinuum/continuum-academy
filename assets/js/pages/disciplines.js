/* ---------- DISCIPLINES PAGE LOGIC ---------- */
/* Renders the library from assets/js/data/disciplines.js. The player modal,
   toast and delegated card clicks live in assets/js/player.js, which every
   browsing page shares. */

(function () {
  "use strict";

  /* ---------- HELPERS ---------- */
  const toast = document.getElementById("pageToast");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* Paints one phrase of the title in the accent, like the Home artwork */
  function highlightTitle(title, phrase) {
    const safeTitle = escapeHtml(title);
    if (!phrase) return safeTitle;
    const safePhrase = escapeHtml(phrase);
    const at = safeTitle.indexOf(safePhrase);
    if (at === -1) return safeTitle;
    return (
      safeTitle.slice(0, at) +
      '<span class="hl-cyan">' + safePhrase + "</span>" +
      safeTitle.slice(at + safePhrase.length)
    );
  }

  /* ---------- CARD MARKUP ---------- */
  function cardMarkup(video) {
    const title = video.title || "Executive Video";
    const speakerLine = video.role
      ? video.speaker + " · " + video.role
      : video.speaker || "Continuum Academy";

    const image = video.image
      ? '<img src="' + escapeHtml(video.image) + '" alt="' + escapeHtml(title) +
        '" class="thumb-img" onerror="this.remove()">'
      : "";

    const duration = video.minutes
      ? '<div class="duration-badge">' + escapeHtml(video.minutes) + " min</div>"
      : "";

    return (
      '<article class="video-card"' +
        ' data-title="' + escapeHtml(title) + '"' +
        ' data-speaker="' + escapeHtml(speakerLine) + '"' +
        (video.video ? ' data-video="' + escapeHtml(video.video) + '"' : "") +
      ">" +
        '<div class="thumb-container">' +
          image +
          '<div class="thumb-fallback ' + escapeHtml(video.art || "bg-slate-a") + '">' +
            '<div class="thumb-top-logos">' +
              '<span class="thumb-mansmith">MANSMITH</span>' +
              '<span class="thumb-continuum">CONTINUUM</span>' +
            "</div>" +
            '<div class="thumb-headline">' + highlightTitle(title, video.highlight) + "</div>" +
            '<div class="thumb-speaker-info">' +
              "<b>" + escapeHtml(video.speaker) + "</b>" +
              (video.role ? "<span>" + escapeHtml(video.role) + "</span>" : "") +
            "</div>" +
            '<div class="speaker-avatar-wrap">' +
              '<div class="speaker-avatar-placeholder">' + escapeHtml(video.avatar || "🎬") + "</div>" +
            "</div>" +
          "</div>" +
          '<div class="thumb-play-overlay"><span class="play-pill-icon">▶</span></div>' +
          duration +
        "</div>" +
        '<div class="card-meta">' +
          '<span class="discipline-tag">' + escapeHtml(video.tag || "") + "</span>" +
          '<h3 class="card-caption">' + escapeHtml(title) + "</h3>" +
        "</div>" +
      "</article>"
    );
  }

  /* ---------- GROUP MARKUP ---------- */
  function groupMarkup(group) {
    const videos = Array.isArray(group.videos) ? group.videos : [];
    if (!videos.length) return "";

    return (
      '<section class="discipline-group" aria-labelledby="disc-' + escapeHtml(group.id) + '">' +
        '<h2 class="section-title" id="disc-' + escapeHtml(group.id) + '">' +
          escapeHtml(group.title) +
        "</h2>" +
        '<div class="cards-carousel">' + videos.map(cardMarkup).join("") + "</div>" +
      "</section>"
    );
  }

  function renderLibrary() {
    const mount = document.getElementById("disciplineList");
    if (!mount) return;

    /* Admin content wins over the static file through the catalogue layer */
    const groups = window.ContinuumData ? ContinuumData.groups() : window.CONTINUUM_DISCIPLINES || [];
    const markup = groups.map(groupMarkup).join("");

    mount.innerHTML = markup ||
      '<p class="library-empty">No disciplines available yet.</p>';
  }

  renderLibrary();

  /* ---------- TOP BAR / BOTTOM NAV ---------- */
  document.getElementById("bellBtn") &&
    document.getElementById("bellBtn").addEventListener("click", function () {
      showToast("No new notifications right now");
    });

  document.getElementById("profileBtn") &&
    document.getElementById("profileBtn").addEventListener("click", function () {
      showToast("Signed in as Mansmith Executive");
    });

  document.querySelectorAll(".nav-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      // Tabs that map to a page navigate; the rest are placeholders for now
      if (tab.dataset.href) {
        window.location.href = tab.dataset.href;
        return;
      }
      if (tab.classList.contains("active")) return;
      showToast((tab.querySelector(".nav-label").textContent || "Section") + " section");
    });
  });
})();
