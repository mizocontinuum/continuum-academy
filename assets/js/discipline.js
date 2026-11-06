/* ---------- ONE DISCIPLINE PAGE LOGIC ---------- */
/* One file serves every discipline: the group is chosen by ?id=<group id>
   against assets/js/data/disciplines.js, so the hero copy, the counts and the
   video grid all come from the catalogue. Unknown ids fall back to a message
   instead of an empty page. The player modal lives in assets/js/player.js. */

(function () {
  "use strict";

  /* Admin content wins over the static file through the catalogue layer */
  const catalogue = window.ContinuumData ? ContinuumData.groups() : window.CONTINUUM_DISCIPLINES || [];
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("id") || "";

  const group = catalogue.filter(function (entry) {
    return entry.id === wanted;
  })[0] || null;

  const bodyMount = document.getElementById("disciplineBody");
  const missingMount = document.getElementById("disciplineMissing");
  const toast = document.getElementById("pageToast");

  /* ---------- ICONS ---------- */
  const LAYERS_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polygon points="12 3 22 8 12 13 2 8"></polygon>' +
      '<polyline points="2 16 12 21 22 16"></polyline>' +
    "</svg>";

  const GRID_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect>' +
      '<rect x="14" y="3" width="7" height="7" rx="1.5"></rect>' +
      '<rect x="14" y="14" width="7" height="7" rx="1.5"></rect>' +
      '<rect x="3" y="14" width="7" height="7" rx="1.5"></rect>' +
    "</svg>";

  const CLOCK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"></circle>' +
      '<polyline points="12 7 12 12 15.5 14"></polyline>' +
    "</svg>";

  const PLAY_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
    "</svg>";

  /* ---------- HELPERS ---------- */
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

  function speakerLine(video) {
    return video.role ? video.speaker + " · " + video.role : video.speaker || "";
  }

  /* "43 min" below an hour, "1h 7m" above it */
  function runtimeLabel(minutes) {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return rest + " min";
    return hours + "h" + (rest ? " " + rest + "m" : "");
  }

  /* ---------- MARKUP ---------- */
  const PLAYER_SQUARE =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<polygon points="6 4 20 12 6 20 6 4"></polygon>' +
    "</svg>";

  /* The rendered artwork doubles as the thumbnail until real posters are added */
  function artworkMarkup(video) {
    return (
      '<div class="thumb-fallback ' + escapeHtml(video.art || "bg-slate-a") + '">' +
        '<div class="thumb-top-logos">' +
          '<span class="thumb-mansmith">MANSMITH</span>' +
          '<span class="thumb-continuum">CONTINUUM</span>' +
        "</div>" +
        '<div class="thumb-headline">' +
          highlightTitle(video.title, video.highlight) +
        "</div>" +
        '<div class="thumb-speaker-info">' +
          "<b>" + escapeHtml(video.speaker || "") + "</b>" +
          (video.role ? "<span>" + escapeHtml(video.role) + "</span>" : "") +
        "</div>" +
        '<div class="speaker-avatar-wrap">' +
          '<div class="speaker-avatar-placeholder">' + escapeHtml(video.avatar || "🎬") + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function cardMarkup(video) {
    const title = video.title || "Executive Video";
    const duration = video.minutes
      ? '<div class="duration-badge">' + escapeHtml(video.minutes) + " min</div>"
      : "";

    return (
      '<article class="disc-card" role="button" tabindex="0"' +
        ' data-title="' + escapeHtml(title) + '"' +
        ' data-speaker="' + escapeHtml(speakerLine(video)) + '"' +
        (video.video ? ' data-video="' + escapeHtml(video.video) + '"' : "") +
      ">" +
        '<div class="disc-thumb">' + artworkMarkup(video) + duration + "</div>" +
        '<p class="disc-card-tag">' + escapeHtml(video.tag || "") + "</p>" +
        '<h3 class="disc-card-title">' + escapeHtml(title) + "</h3>" +
        (video.speaker
          ? '<p class="disc-card-speaker">' + escapeHtml(video.speaker) + "</p>"
          : "") +
      "</article>"
    );
  }

  function statsMarkup(videos) {
    const minutes = videos.reduce(function (sum, video) {
      return sum + (Number(video.minutes) || 0);
    }, 0);

    return (
      '<div class="disc-stats">' +
        '<span class="disc-stat">' + GRID_ICON + "<b>" + videos.length + "</b> videos</span>" +
        (minutes
          ? '<span class="disc-stat">' + CLOCK_ICON + "<b>" + runtimeLabel(minutes) +
            "</b> total</span>"
          : "") +
      "</div>"
    );
  }

  function heroMarkup(videos) {
    return (
      '<section class="disc-hero">' +
        '<span class="disc-badge">' + LAYERS_ICON + "Curriculum Track</span>" +
        '<h1 class="disc-name">' + escapeHtml(group.title) + "</h1>" +
        (group.goal
          ? '<p class="disc-goal">' + escapeHtml(group.goal) + "</p>"
          : "") +
        (group.blurb
          ? '<p class="disc-blurb">' + escapeHtml(group.blurb) + "</p>"
          : "") +
        statsMarkup(videos) +
        (videos.length
          ? '<button class="disc-start" type="button" id="startWatching">' +
            PLAYER_SQUARE + "Start Watching</button>"
          : "") +
      "</section>"
    );
  }

  function videosMarkup(videos) {
    return (
      '<section aria-labelledby="disciplineVideosTitle">' +
        '<div class="disc-videos-head">' +
          '<h2 class="disc-videos-title" id="disciplineVideosTitle">Executive Business Videos</h2>' +
          '<span class="disc-videos-count">(' + videos.length + ")</span>" +
        "</div>" +
        '<div class="disc-grid">' + videos.map(cardMarkup).join("") + "</div>" +
      "</section>"
    );
  }

  /* ---------- RENDER ---------- */
  function render() {
    const videos = group && Array.isArray(group.videos) ? group.videos : [];

    if (!group || !videos.length) {
      if (bodyMount) bodyMount.hidden = true;
      if (missingMount) missingMount.hidden = false;
      return;
    }

    document.title = "Continuum Academy - " + group.title;

    if (bodyMount) bodyMount.innerHTML = heroMarkup(videos) + videosMarkup(videos);

    const startBtn = document.getElementById("startWatching");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        if (!window.ContinuumPlayer) return;
        const first = videos[0];
        window.ContinuumPlayer.open(first.title, speakerLine(first), first.video);
      });
    }
  }

  render();

  /* ---------- EVENTS ---------- */
  // Keyboard activation for the generated cards
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest(".disc-card");
    if (!card || !window.ContinuumPlayer) return;

    event.preventDefault();
    window.ContinuumPlayer.open(card.dataset.title, card.dataset.speaker, card.dataset.video);
  });

  /* ---------- TOP BAR / BOTTOM NAV ---------- */
  const bellBtn = document.getElementById("bellBtn");
  if (bellBtn) {
    bellBtn.addEventListener("click", function () {
      showToast("No new notifications right now");
    });
  }

  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) {
    profileBtn.addEventListener("click", function () {
      showToast("Signed in as Mansmith Executive");
    });
  }

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
