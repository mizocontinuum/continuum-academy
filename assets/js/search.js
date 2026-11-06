/* ---------- SEARCH PAGE LOGIC ---------- */
/* Two presentations of the same catalogue, from assets/js/data/disciplines.js:
   rows with a play button while the field is empty, a two-column grid of
   matches once the visitor types. The player modal comes from player.js. */

(function () {
  "use strict";

  const input = document.getElementById("searchInput");
  const rowsMount = document.getElementById("resultList");
  const gridMount = document.getElementById("resultsGrid");
  const recommendedBlock = document.getElementById("recommendedBlock");
  const resultsBlock = document.getElementById("resultsBlock");
  const resultsTitle = document.getElementById("resultsTitle");
  const emptyState = document.getElementById("emptyState");
  const micBtn = document.getElementById("micBtn");
  const toast = document.getElementById("pageToast");

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

  /* Case and accent insensitive, so "Filipino" also matches "Filipino" typed flat */
  function normalize(text) {
    return String(text == null ? "" : text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

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

  /* ---------- CATALOGUE ---------- */
  function flattenLibrary() {
    const groups = window.ContinuumData ? ContinuumData.groups() : window.CONTINUUM_DISCIPLINES || [];
    const items = [];

    groups.forEach(function (group) {
      (group.videos || []).forEach(function (video) {
        items.push({
          video: video,
          group: group.title,
          haystack: normalize(
            [video.title, video.speaker, video.role, video.tag, group.title].join(" ")
          )
        });
      });
    });

    return items;
  }

  const library = flattenLibrary();

  /* ---------- MARKUP ---------- */
  function dataAttrs(video) {
    const speaker = video.role ? video.speaker + " · " + video.role : video.speaker || "";
    return (
      ' data-title="' + escapeHtml(video.title) + '"' +
      ' data-speaker="' + escapeHtml(speaker) + '"' +
      (video.video ? ' data-video="' + escapeHtml(video.video) + '"' : "")
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
          "<b>" + escapeHtml(video.speaker) + "</b>" +
          (video.role ? "<span>" + escapeHtml(video.role) + "</span>" : "") +
        "</div>" +
        '<div class="speaker-avatar-wrap">' +
          '<div class="speaker-avatar-placeholder">' + escapeHtml(video.avatar || "🎬") + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function rowMarkup(entry) {
    return (
      '<div class="result-row" role="button" tabindex="0"' + dataAttrs(entry.video) + ">" +
        '<div class="result-thumb">' + artworkMarkup(entry.video) + "</div>" +
        '<p class="result-title">' + escapeHtml(entry.video.title) + "</p>" +
        '<span class="result-play" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>' +
        "</span>" +
      "</div>"
    );
  }

  function gridMarkup(entry) {
    return (
      '<div class="grid-card" role="button" tabindex="0"' + dataAttrs(entry.video) + ">" +
        '<div class="grid-thumb">' + artworkMarkup(entry.video) + "</div>" +
        '<p class="grid-caption">' + escapeHtml(entry.video.title) + "</p>" +
      "</div>"
    );
  }

  /* ---------- STATES ---------- */
  function showRecommended() {
    if (recommendedBlock) recommendedBlock.hidden = false;
    if (resultsBlock) resultsBlock.hidden = true;
  }

  function showResults(matches, query) {
    if (recommendedBlock) recommendedBlock.hidden = true;
    if (resultsBlock) resultsBlock.hidden = false;

    if (gridMount) gridMount.innerHTML = matches.map(gridMarkup).join("");

    const count = matches.length;
    if (resultsTitle) {
      resultsTitle.textContent =
        count + (count === 1 ? " result" : " results") + ' for "' + query + '"';
    }

    if (emptyState) {
      emptyState.hidden = count > 0;
      emptyState.textContent = 'No results for "' + query + '". Try a speaker or a discipline name.';
    }
  }

  function applyFilter() {
    const query = input ? input.value.trim() : "";

    if (!query) {
      showRecommended();
      return;
    }

    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    const wholeQuery = normalize(query);

    const matches = library
      .filter(function (entry) {
        return tokens.every(function (token) {
          return entry.haystack.indexOf(token) !== -1;
        });
      })
      // Titles that contain the full phrase lead, the rest keep library order
      .sort(function (a, b) {
        const aHit = normalize(a.video.title).indexOf(wholeQuery) !== -1 ? 0 : 1;
        const bHit = normalize(b.video.title).indexOf(wholeQuery) !== -1 ? 0 : 1;
        return aHit - bHit;
      });

    showResults(matches, query);
  }

  /* ---------- FIRST PAINT ---------- */
  if (rowsMount) rowsMount.innerHTML = library.map(rowMarkup).join("");
  showRecommended();

  /* ---------- EVENTS ---------- */
  if (input) {
    input.addEventListener("input", applyFilter);
    // Safari's clear affordance fires "search", not always "input"
    input.addEventListener("search", applyFilter);

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
  }

  // Keyboard activation for the generated rows and tiles
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const item = event.target.closest(".result-row, .grid-card");
    if (!item || !window.ContinuumPlayer) return;

    event.preventDefault();
    window.ContinuumPlayer.open(item.dataset.title, item.dataset.speaker, item.dataset.video);
  });

  /* ---------- VOICE SEARCH ---------- */
  if (micBtn) {
    micBtn.addEventListener("click", function () {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!Recognition) {
        showToast("Voice search needs a supported browser");
        return;
      }

      if (micBtn.classList.contains("listening")) return;

      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = function () {
        micBtn.classList.add("listening");
      };

      recognition.onend = function () {
        micBtn.classList.remove("listening");
      };

      recognition.onerror = function () {
        micBtn.classList.remove("listening");
        showToast("Voice search unavailable");
      };

      recognition.onresult = function (event) {
        const said = event.results[0][0].transcript;
        if (input) {
          input.value = said;
          applyFilter();
        }
      };

      try {
        recognition.start();
      } catch (error) {
        micBtn.classList.remove("listening");
        showToast("Voice search unavailable");
      }
    });
  }

  /* ---------- BOTTOM NAV ---------- */
  document.querySelectorAll(".nav-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      if (tab.dataset.href) {
        window.location.href = tab.dataset.href;
        return;
      }
      if (tab.classList.contains("active")) return;
      showToast((tab.querySelector(".nav-label").textContent || "Section") + " section");
    });
  });
})();
