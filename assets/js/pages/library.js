/* ---------- MY LIBRARY PAGE LOGIC ---------- */
/* The dashboard over the catalogue. Every row is an entry from
   assets/js/data/library.js joined to its video in assets/js/data/disciplines.js,
   so artwork, speaker and duration are read from one place. The player modal
   and the delegated row clicks live in assets/js/player.js. */

(function () {
  "use strict";

  const data = window.CONTINUUM_LIBRARY || {};
  /* Admin content wins over the static file through the catalogue layer */
  const catalogue = window.ContinuumData ? ContinuumData.groups() : window.CONTINUUM_DISCIPLINES || [];

  const statMount = document.getElementById("statGrid");
  const tabsMount = document.getElementById("libTabs");
  const listMount = document.getElementById("libraryList");
  const searchInput = document.getElementById("libSearch");
  const filterSelect = document.getElementById("libFilter");
  const emptyBox = document.getElementById("libEmpty");
  const emptyText = document.getElementById("libEmptyText");
  const resetBtn = document.getElementById("libReset");
  const toast = document.getElementById("pageToast");

  /* ---------- ICONS ---------- */
  const CLOCK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"></circle>' +
      '<polyline points="12 7 12 12 15.5 14"></polyline>' +
    "</svg>";

  const PLAY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"></circle>' +
      '<polygon points="10 8.5 16 12 10 15.5" fill="currentColor" stroke="none"></polygon>' +
    "</svg>";

  const CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="5 12.5 10 17.5 19 7"></polyline>' +
    "</svg>";

  const PLAY_GLYPH =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
    "</svg>";

  /* Marks that open each tab, named by the data file */
  const TAB_ICONS = {
    play:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<polygon points="7 4 19 12 7 20 7 4"></polygon>' +
      "</svg>",
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"></circle>' +
        '<polyline points="8 12.5 11 15.5 16 9"></polyline>' +
      "</svg>",
    saved:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4.5-7 4.5v-16a1 1 0 0 1 1-1z"></path>' +
      "</svg>"
  };

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

  function normalize(text) {
    return String(text == null ? "" : text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
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
    const image = video.image
      ? '<img src="' + escapeHtml(video.image) + '" alt="' + escapeHtml(video.title || "") + '" class="thumb-img" onerror="this.remove()">'
      : "";

    return (
      image +
      '<div class="thumb-fallback ' + escapeHtml(video.art || "bg-slate-b") + '">' +
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

  /* ---------- JOIN THE LIBRARY TO THE CATALOGUE ---------- */
  function catalogueIndex() {
    const index = new Map();
    catalogue.forEach(function (group) {
      (group.videos || []).forEach(function (video) {
        index.set(video.title, { video: video, group: group });
      });
    });
    return index;
  }

  const index = catalogueIndex();
  const tabs = Array.isArray(data.tabs) ? data.tabs : [];

  function resolve(entry) {
    const hit = index.get(entry.title);

    /* An entry whose title is missing from the catalogue still renders, with
       neutral artwork, so a typo costs one card and not the whole page. */
    const video = hit
      ? hit.video
      : { title: entry.title, tag: "", art: "bg-slate-a" };

    return {
      title: entry.title,
      state: entry.state,
      position: Number(entry.position) || 0,
      completedOn: entry.completedOn || "",
      savedOn: entry.savedOn || "",
      video: video,
      group: hit ? hit.group : null,
      haystack: normalize(
        [entry.title, video.speaker, video.role, video.tag, hit ? hit.group.title : ""].join(" ")
      )
    };
  }

  const items = (Array.isArray(data.entries) ? data.entries : []).map(resolve);

  /* ---------- MERGE THE MEMBER'S REAL STATE ---------- */
  /* Authored entries describe the demo member. What the signed-in member
     actually watched and saved lives in ContinuumStore — fold it in by
     title, skipping anything the authored rows already cover. */
  (function () {
    const store = window.ContinuumStore;
    if (!store) return;

    const seen = new Set(items.map(function (item) { return item.title; }));

    store.progressRecords().forEach(function (record) {
      if (seen.has(record.title)) return;
      seen.add(record.title);
      items.push(resolve({
        title: record.title,
        state: record.completed ? "completed" : "watching",
        position: Math.round(record.position || 0)
      }));
    });

    store.savedTitles().forEach(function (title) {
      if (seen.has(title)) return;
      seen.add(title);
      items.push(resolve({ title: title, state: "saved" }));
    });
  })();

  let activeState = tabs.length ? tabs[0].state : "watching";

  /* ---------- ROW FIGURES ---------- */
  function progressOf(item) {
    const total = item.video.minutes;
    if (item.state !== "watching" || !total) return 0;
    return Math.min(100, Math.round((item.position / total) * 100));
  }

  function statusOf(item) {
    if (item.state === "watching") {
      const total = item.video.minutes;
      if (!total) return "In progress";
      return Math.max(total - item.position, 1) + " min left";
    }
    if (item.state === "completed") {
      return item.completedOn ? "Completed · " + item.completedOn : "Completed";
    }
    return item.savedOn ? "Saved · " + item.savedOn : "Saved";
  }

  function disciplineOf(item) {
    if (item.video.tag) return item.video.tag;
    return item.group ? item.group.title : "Continuum Library";
  }

  /* ---------- MARKUP ---------- */
  function statCard(label, value, caption, icon) {
    return (
      '<div class="stat-card">' +
        '<div class="stat-head">' +
          '<span class="stat-label">' + escapeHtml(label) + "</span>" +
          '<span class="stat-icon">' + icon + "</span>" +
        "</div>" +
        '<p class="stat-value">' +
          "<b>" + escapeHtml(value) + "</b>" +
          "<span>" + escapeHtml(caption) + "</span>" +
        "</p>" +
      "</div>"
    );
  }

  function renderStats() {
    if (!statMount) return;

    const minutes = Number(data.watchMinutes) || 0;
    const hours = Math.round(minutes / 60);
    const ongoing = items.filter(function (item) {
      return item.state === "watching";
    }).length;

    statMount.innerHTML =
      statCard("Total Watch Time", String(hours), "Hours Streamed", CLOCK_ICON) +
      statCard("In-Progress", String(ongoing), "Topics Ongoing", PLAY_ICON);
  }

  function renderTabs() {
    if (!tabsMount) return;

    tabsMount.innerHTML = tabs
      .map(function (tab) {
        const count = items.filter(function (item) {
          return item.state === tab.state;
        }).length;

        return (
          '<button class="lib-tab" type="button" role="tab"' +
            ' data-state="' + escapeHtml(tab.state) + '"' +
            ' aria-selected="' + (tab.state === activeState) + '">' +
            (TAB_ICONS[tab.icon] || "") +
            escapeHtml(tab.label) +
            '<span class="tab-count">' + count + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderFilter() {
    if (!filterSelect) return;

    filterSelect.innerHTML =
      '<option value="">All Disciplines</option>' +
      catalogue
        .map(function (group) {
          return (
            '<option value="' + escapeHtml(group.id) + '">' +
              escapeHtml(group.title) +
            "</option>"
          );
        })
        .join("");
  }

  function rowMarkup(item) {
    const video = item.video;
    const progress = progressOf(item);
    const speaker = video.role ? video.speaker + " · " + video.role : video.speaker || "";

    const progressBar = progress
      ? '<div class="lib-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"' +
        ' aria-valuenow="' + progress + '"><i style="width:' + progress + '%"></i></div>'
      : "";

    const doneBadge = item.state === "completed"
      ? '<span class="lib-done">' + CHECK_ICON + "</span>"
      : "";

    return (
      '<article class="library-row" role="button" tabindex="0"' +
        ' data-title="' + escapeHtml(item.title) + '"' +
        ' data-speaker="' + escapeHtml(speaker) + '"' +
        (video.video ? ' data-video="' + escapeHtml(video.video) + '"' : "") +
      ">" +
        '<div class="lib-thumb">' +
          artworkMarkup(video) +
          progressBar +
          doneBadge +
        "</div>" +
        '<div class="lib-body">' +
          '<p class="lib-title">' + escapeHtml(item.title) + "</p>" +
          '<p class="lib-meta">' + escapeHtml(disciplineOf(item)) + "</p>" +
          '<p class="lib-status' + (item.state === "watching" ? " ongoing" : "") + '">' +
            escapeHtml(statusOf(item)) +
          "</p>" +
        "</div>" +
        '<span class="lib-play">' + PLAY_GLYPH + "</span>" +
      "</article>"
    );
  }

  /* ---------- FILTERED VIEW ---------- */
  function currentTab() {
    return tabs.filter(function (tab) {
      return tab.state === activeState;
    })[0] || { state: activeState, label: "Library" };
  }

  function emptyMessage(isFiltered) {
    const label = currentTab().label.toLowerCase();

    if (isFiltered) return "Nothing in " + label + " matches these filters.";

    if (activeState === "watching") {
      return "Nothing in progress yet. Open a video from Disciplines and it will appear here.";
    }
    if (activeState === "completed") {
      return "No completed topics yet. Finish a video and it moves here.";
    }
    return "Nothing saved yet. Add a video to My List and it will wait here.";
  }

  function renderList() {
    if (!listMount) return;

    const query = normalize(searchInput ? searchInput.value.trim() : "");
    const disciplineId = filterSelect ? filterSelect.value : "";
    const tokens = query.split(/\s+/).filter(Boolean);

    const rows = items
      .filter(function (item) {
        return item.state === activeState;
      })
      .filter(function (item) {
        if (!disciplineId) return true;
        return Boolean(item.group) && item.group.id === disciplineId;
      })
      .filter(function (item) {
        return tokens.every(function (token) {
          return item.haystack.indexOf(token) !== -1;
        });
      });

    listMount.innerHTML = rows.map(rowMarkup).join("");

    const isFiltered = Boolean(query || disciplineId);
    if (emptyBox) emptyBox.hidden = rows.length > 0;
    if (emptyText) emptyText.textContent = emptyMessage(isFiltered);
    if (resetBtn) resetBtn.hidden = !isFiltered;
  }

  function selectTab(state) {
    if (state === activeState) return;
    activeState = state;
    renderTabs();
    renderList();

    // Keep the chosen filter visible after the row scrolls sideways
    const chosen = tabsMount && tabsMount.querySelector('[aria-selected="true"]');
    if (chosen && chosen.scrollIntoView) {
      chosen.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  /* ---------- FIRST PAINT ---------- */
  renderStats();
  renderTabs();
  renderFilter();
  renderList();

  /* ---------- EVENTS ---------- */
  if (tabsMount) {
    tabsMount.addEventListener("click", function (event) {
      const tab = event.target.closest(".lib-tab");
      if (tab) selectTab(tab.dataset.state);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderList);
    // Safari's clear affordance fires "search", not always "input"
    searchInput.addEventListener("search", renderList);
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", renderList);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      if (filterSelect) filterSelect.value = "";
      renderList();
    });
  }

  // Keyboard activation for the generated rows
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const row = event.target.closest(".library-row");
    if (!row || !window.ContinuumPlayer) return;

    event.preventDefault();
    window.ContinuumPlayer.open(row.dataset.title, row.dataset.speaker, row.dataset.video);
  });

  /* ---------- TOP BAR / BOTTOM NAV ---------- */
  const bellBtn = document.getElementById("bellBtn");
  if (bellBtn) {
    bellBtn.addEventListener("click", function () {
      showToast("No new notifications right now");
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
