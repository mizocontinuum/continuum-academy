/* ---------- EXPLORE FREE DISCIPLINE PAGE LOGIC ---------- */
/* Renders the free-access catalogue from assets/js/data/disciplines.js: one
   filter per discipline and a two-column grid per section. The player modal
   and the delegated card clicks live in assets/js/player.js. */

(function () {
  "use strict";

  /* Admin content wins over the static file through the catalogue layer */
  const catalogue = window.ContinuumData ? ContinuumData.groups() : window.CONTINUUM_DISCIPLINES || [];
  const filterMount = document.getElementById("trackFilter");
  const sectionMount = document.getElementById("trackSections");
  const trackCount = document.getElementById("trackCount");
  const emptyNote = document.getElementById("exploreEmpty");
  const toast = document.getElementById("pageToast");

  /* "" means every free discipline is listed */
  let activeId = "";

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

  /* ---------- MARKUP ---------- */
  function cardMarkup(video) {
    const title = video.title || "Executive Video";
    const speakerLine = video.role
      ? video.speaker + " · " + video.role
      : video.speaker || "";

    const duration = video.minutes
      ? '<div class="duration-badge">' + escapeHtml(video.minutes) + " min</div>"
      : "";

    return (
      '<article class="exp-card" role="button" tabindex="0"' +
        ' data-title="' + escapeHtml(title) + '"' +
        ' data-speaker="' + escapeHtml(speakerLine) + '"' +
        (video.video ? ' data-video="' + escapeHtml(video.video) + '"' : "") +
      ">" +
        '<div class="exp-thumb">' + artworkMarkup(video) + duration + "</div>" +
        '<p class="exp-tag">' + escapeHtml(video.tag || "") + "</p>" +
        '<h3 class="exp-title">' + escapeHtml(title) + "</h3>" +
      "</article>"
    );
  }

  function sectionMarkup(group) {
    const videos = Array.isArray(group.videos) ? group.videos : [];
    if (!videos.length) return "";

    const headingId = "track-" + group.id;

    return (
      '<section class="track" aria-labelledby="' + escapeHtml(headingId) + '">' +
        '<div class="track-head">' +
          '<h2 class="track-title" id="' + escapeHtml(headingId) + '">' +
            escapeHtml(group.title) +
          "</h2>" +
          (group.goal
            ? '<p class="track-goal">Goal: ' + escapeHtml(group.goal) + "</p>"
            : "") +
          '<a class="track-link" href="../discipline/?id=' + escapeHtml(group.id) + '">' +
            "View Discipline Videos →" +
          "</a>" +
        "</div>" +
        '<div class="track-grid">' + videos.map(cardMarkup).join("") + "</div>" +
      "</section>"
    );
  }

  function filterMarkup() {
    const pills = [{ id: "", label: "All Free Disciplines" }].concat(
      catalogue.map(function (group) {
        return { id: group.id, label: group.title };
      })
    );

    return pills
      .map(function (pill) {
        return (
          '<button class="filter-pill" type="button" role="tab"' +
            ' data-id="' + escapeHtml(pill.id) + '"' +
            ' aria-selected="' + (pill.id === activeId) + '">' +
            escapeHtml(pill.label) +
          "</button>"
        );
      })
      .join("");
  }

  /* ---------- RENDER ---------- */
  function syncFilter() {
    if (!filterMount) return;
    filterMount.querySelectorAll(".filter-pill").forEach(function (pill) {
      pill.setAttribute("aria-selected", String(pill.dataset.id === activeId));
    });
  }

  function renderSections() {
    if (!sectionMount) return;

    const groups = catalogue.filter(function (group) {
      return !activeId || group.id === activeId;
    });

    sectionMount.innerHTML = groups.map(sectionMarkup).join("");
    if (emptyNote) emptyNote.hidden = groups.length > 0;
  }

  if (trackCount) trackCount.textContent = String(catalogue.length);
  if (filterMount) filterMount.innerHTML = filterMarkup();
  renderSections();

  /* ---------- EVENTS ---------- */
  if (filterMount) {
    filterMount.addEventListener("click", function (event) {
      const pill = event.target.closest(".filter-pill");
      if (!pill || pill.dataset.id === activeId) return;

      activeId = pill.dataset.id || "";
      syncFilter();
      renderSections();

      // Keep the chosen filter in view after the row scrolls sideways
      if (pill.scrollIntoView) {
        pill.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  }

  // Keyboard activation for the generated cards
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const card = event.target.closest(".exp-card");
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
