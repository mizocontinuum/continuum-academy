/* ---------- HOME PAGE LOGIC & INTERACTIONS ---------- */
/* Everything below the top bar is rendered from data:
     hero carousel   the first six videos of the catalogue
     Continue Watching  unfinished progress from ContinuumStore
     discipline rows  one per group, via the catalogue layer
   No card is authored in HTML anymore. With no content yet (fresh device,
   admin untouched) the empty state points at /admin/. */

(function () {
  "use strict";

  /* Ambient scrims cycle across slides — presentation only, never content */
  var BACKDROPS = [
    "radial-gradient(circle at 85% 20%, rgba(11, 17, 23, 0.6) 0%, transparent 55%), linear-gradient(180deg, rgba(11, 17, 23, 0.4) 0%, rgba(11, 17, 23, 0.6) 50%, rgba(11, 17, 23, 0.78) 100%)",
    "radial-gradient(circle at 20% 30%, rgba(11, 17, 23, 0.6) 0%, transparent 55%), linear-gradient(180deg, rgba(11, 17, 23, 0.4) 0%, rgba(11, 17, 23, 0.6) 55%, rgba(11, 17, 23, 0.78) 100%)",
    "radial-gradient(circle at 15% 35%, rgba(11, 17, 23, 0.6) 0%, transparent 50%), linear-gradient(180deg, rgba(11, 17, 23, 0.4) 0%, rgba(11, 17, 23, 0.6) 50%, rgba(11, 17, 23, 0.78) 100%)",
    "radial-gradient(circle at 80% 30%, rgba(11, 17, 23, 0.6) 0%, transparent 50%), linear-gradient(180deg, rgba(11, 17, 23, 0.4) 0%, rgba(11, 17, 23, 0.6) 55%, rgba(11, 17, 23, 0.78) 100%)",
    "radial-gradient(circle at 20% 20%, rgba(11, 17, 23, 0.6) 0%, transparent 50%), linear-gradient(180deg, rgba(11, 17, 23, 0.4) 0%, rgba(11, 17, 23, 0.6) 50%, rgba(11, 17, 23, 0.78) 100%)",
    "radial-gradient(circle at 75% 25%, rgba(11, 17, 23, 0.6) 0%, transparent 50%), linear-gradient(180deg, rgba(11, 17, 23, 0.4) 0%, rgba(11, 17, 23, 0.6) 50%, rgba(11, 17, 23, 0.78) 100%)"
  ];

  var heroTitle = document.getElementById("heroTitle");
  var heroBackdrop = document.getElementById("heroBackdrop");
  var indicatorsContainer = document.getElementById("carouselIndicators");
  var toast = document.getElementById("homeToast");

  /* ---------- DATA ---------- */
  function catalogueVideos() {
    return window.ContinuumData ? ContinuumData.videos() : [];
  }

  function findRow(title) {
    if (!window.ContinuumData) return null;
    return ContinuumData.findVideo(title);
  }

  /* Hero features the first six videos of the catalogue */
  var slides = catalogueVideos().slice(0, 6);
  var currentSlide = 0;

  function slideTitle() {
    return slides.length ? slides[currentSlide].title : "";
  }

  function speakerLine(video) {
    if (!video) return "Continuum Academy";
    if (video.role) return (video.speaker || "Continuum Academy") + " · " + video.role;
    return video.speaker || "Continuum Academy";
  }

  /* Uploaded files resolve to an object URL asynchronously; authored paths
     are already playable. null means "open the player in its ready state". */
  function resolveSrc(video, then) {
    if (!video) return then(null);
    if (video.video) return then(video.video);
    if (video.fileId && window.ContinuumContent) {
      ContinuumContent.videoURL(video).then(then, function () {
        then(null);
      });
      return;
    }
    then(null);
  }

  /* ---------- TOAST ---------- */
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.classList.remove("show");
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlightTitle(title, phrase) {
    var safeTitle = escapeHtml(title);
    if (!phrase) return safeTitle;
    var safePhrase = escapeHtml(phrase);
    var at = safeTitle.indexOf(safePhrase);
    if (at === -1) return safeTitle;
    return (
      safeTitle.slice(0, at) +
      '<span class="hl-cyan">' + safePhrase + "</span>" +
      safeTitle.slice(at + safePhrase.length)
    );
  }

  /* ---------- HERO CAROUSEL ---------- */
  var heroSection = document.getElementById("heroSection");
  var heroVideo = document.getElementById("heroVideo");
  var heroVideoSource = document.getElementById("heroVideoSource");

  // Remembers whether the trailer was running when the full player took over
  var heroWasPlaying = false;

  function setHeroVideoEnabled(enabled) {
    if (heroSection) heroSection.classList.toggle("hero-video-off", !enabled);
  }

  function playHeroVideo() {
    if (!heroVideo) return;
    setHeroVideoEnabled(true);
    var attempt = heroVideo.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function (error) {
        // AbortError happens when user switches tabs or pause interrupts play.
        // NotAllowedError happens if autoplay was blocked.
        // Do NOT permanently disable the video for tab-switch aborts!
        if (error && (error.name === "AbortError" || error.name === "NotAllowedError")) {
          return;
        }
        setHeroVideoEnabled(false);
      });
    }
  }

  function renderIndicators() {
    if (!indicatorsContainer) return;
    if (slides.length < 2) {
      indicatorsContainer.innerHTML = "";
      return;
    }
    indicatorsContainer.innerHTML = slides
      .map(function (_, i) {
        return '<span class="dash' + (i === currentSlide ? " active" : "") + '"></span>';
      })
      .join("");
    Array.prototype.forEach.call(indicatorsContainer.querySelectorAll(".dash"), function (dash, idx) {
      dash.style.cursor = "pointer";
      dash.addEventListener("click", function () {
        renderSlide(idx);
      });
    });
  }

  // Draws the hero buttons from what the member already did
  function syncHeroActions() {
    var myListBtn = document.getElementById("myListBtn");
    var likeBtn = document.getElementById("likeBtn");
    var title = slideTitle();
    if (!title) return;

    if (myListBtn) {
      var saved = window.ContinuumStore ? ContinuumStore.isSaved(title) : false;
      myListBtn.innerHTML = saved
        ? "<span>✓</span> In My List"
        : '<span class="plus-icon">＋</span> My List';
      myListBtn.style.borderColor = saved ? "var(--accent)" : "var(--btn-secondary-border)";
    }

    if (likeBtn && window.ContinuumStore) {
      likeBtn.classList.toggle("active", ContinuumStore.isLiked(title));
    }
  }

  function renderSlide(index) {
    if (!slides.length) return;
    currentSlide = (index + slides.length) % slides.length;
    var slide = slides[currentSlide];

    heroTitle.textContent = slide.title;
    heroBackdrop.style.background = BACKDROPS[currentSlide % BACKDROPS.length];

    var dashes = indicatorsContainer ? indicatorsContainer.querySelectorAll(".dash") : [];
    Array.prototype.forEach.call(dashes, function (d, i) {
      d.classList.toggle("active", i === currentSlide);
    });

    syncHeroActions();
  }

  /* The muted ambient trailer plays the first featured video that has a file,
     falling back to the gradient when nothing is uploaded or autoplay is
     blocked. */
  function setupHeroTrailer() {
    if (!heroVideo || !heroVideoSource) {
      setHeroVideoEnabled(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHeroVideoEnabled(false);
      return;
    }

    var candidate = null;
    for (var i = 0; i < slides.length; i += 1) {
      if (slides[i].video || slides[i].fileId) {
        candidate = slides[i];
        break;
      }
    }
    if (!candidate) {
      setHeroVideoEnabled(false);
      return;
    }

    resolveSrc(candidate, function (url) {
      if (!url) {
        setHeroVideoEnabled(false);
        return;
      }
      heroVideoSource.src = url;
      heroVideo.load();
      playHeroVideo();
    });
  }

  document.getElementById("prevHero") &&
    document.getElementById("prevHero").addEventListener("click", function () {
      renderSlide(currentSlide - 1);
    });

  document.getElementById("nextHero") &&
    document.getElementById("nextHero").addEventListener("click", function () {
      renderSlide(currentSlide + 1);
    });

  function isMobileDevice() {
    return (
      window.innerWidth <= 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      ("ontouchstart" in window && window.innerWidth <= 1024)
    );
  }

  document.getElementById("playBtn") &&
    document.getElementById("playBtn").addEventListener("click", function () {
      if (!slides.length) {
        showToast("Nothing to play yet — add videos in the admin beta");
        return;
      }
      var slide = slides[currentSlide];
      resolveSrc(slide, function (url) {
        if (isMobileDevice()) {
          openLandscapePlayer(slide.title, speakerLine(slide), url, slide.groupTitle || slide.tag);
        } else {
          openVideoModal(slide.title, speakerLine(slide), url);
        }
      });
    });

  // More Info Button — opens the executive detail sheet (Picture 2)
  document.getElementById("moreInfoBtn") &&
    document.getElementById("moreInfoBtn").addEventListener("click", function () {
      if (!slides.length) {
        showToast("Pick a video first");
        return;
      }
      var slide = slides[currentSlide];
      resolveSrc(slide, function (url) {
        openVideoModal(slide.title, speakerLine(slide), url);
      });
    });

  // My List & Like — both survive a reload through ContinuumStore
  var myListBtn = document.getElementById("myListBtn");
  var likeBtn = document.getElementById("likeBtn");

  myListBtn &&
    myListBtn.addEventListener("click", function () {
      var title = slideTitle();
      if (!title) return showToast("Pick a video first");
      var saved = window.ContinuumStore
        ? ContinuumStore.toggleSaved(title)
        : !myListBtn.classList.contains("active");
      syncHeroActions();
      showToast(saved ? "Saved to My List" : "Removed from My List");
    });

  likeBtn &&
    likeBtn.addEventListener("click", function () {
      var title = slideTitle();
      if (!title) return showToast("Pick a video first");
      var liked = window.ContinuumStore
        ? ContinuumStore.toggleLike(title)
        : !likeBtn.classList.contains("active");
      syncHeroActions();
      showToast(liked ? "Liked this video" : "Removed like");
    });

  /* ---------- HERO TRAILER CONTROLS ---------- */
  var soundBtn = document.getElementById("soundBtn");
  var isMuted = true;
  soundBtn &&
    soundBtn.addEventListener("click", function () {
      isMuted = !isMuted;
      if (heroVideo) {
        heroVideo.muted = isMuted;
        if (!isMuted && heroVideo.paused) playHeroVideo();
      }
      soundBtn.classList.toggle("active", !isMuted);
      if (isMuted) {
        soundBtn.innerHTML =
          '<svg class="sound-icon-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
        showToast("Sound muted");
      } else {
        soundBtn.innerHTML =
          '<svg class="sound-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
        showToast("Sound enabled");
      }
    });

  var pauseBtn = document.getElementById("pauseBtn");

  var ICON_PLAY =
    '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  var ICON_PAUSE =
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>';

  function syncPauseButton() {
    if (!pauseBtn || !heroVideo) return;
    var paused = heroVideo.paused;
    pauseBtn.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    pauseBtn.classList.toggle("active", paused);
    pauseBtn.setAttribute("aria-label", paused ? "Play trailer" : "Pause trailer");
  }

  pauseBtn &&
    pauseBtn.addEventListener("click", function () {
      if (!heroVideo) return;
      if (heroVideo.paused) {
        playHeroVideo();
        showToast("Trailer playing");
      } else {
        heroVideo.pause();
        showToast("Trailer paused");
      }
      syncPauseButton();
    });

  heroVideo && heroVideo.addEventListener("play", syncPauseButton);
  heroVideo && heroVideo.addEventListener("pause", syncPauseButton);
  heroVideo && heroVideo.addEventListener("error", function () {
    // Only disable if genuine network/source error on active tab
    if (!document.hidden) {
      setHeroVideoEnabled(false);
    }
  });

  /* ---------- 1-MINUTE HIGHLIGHT CLIP TRAILER ---------- */
  var HERO_CLIP_DURATION = 60; // 1 minute (60 seconds) highlight clip
  if (heroVideo) {
    heroVideo.addEventListener("timeupdate", function () {
      if (document.hidden) return; // Do not seek or trigger play while backgrounded
      // Loop back to 0 once 1 minute is reached so it remains a concise highlights clip
      if (heroVideo.currentTime >= HERO_CLIP_DURATION) {
        heroVideo.currentTime = 0;
        playHeroVideo();
      }
    });
    heroVideo.addEventListener("loadedmetadata", function () {
      heroVideo.currentTime = 0;
    });
  }

  /* ---------- TAB VISIBILITY: NO BLACK SCREEN ON TAB SWITCH ---------- */
  document.addEventListener("visibilitychange", function () {
    if (!heroVideo || !heroVideoSource || !heroVideoSource.src) return;

    if (document.hidden) {
      // User switched to another tab: pause cleanly so browser doesn't throw AbortError
      if (!heroVideo.paused) {
        heroWasPlaying = true;
        heroVideo.pause();
      }
    } else {
      // User came back to Continuum tab: ensure video is visible & resume playback
      setHeroVideoEnabled(true);
      var isUserPaused = pauseBtn && pauseBtn.classList.contains("active");
      if ((heroWasPlaying || !isUserPaused) && heroVideo.paused) {
        heroWasPlaying = false;
        playHeroVideo();
      }
    }
  });

  /* ---------- CHROME ---------- */
  var topBar = document.querySelector(".top-bar");
  if (topBar) {
    var handleScroll = function () {
      if (window.scrollY > 12) {
        topBar.classList.add("scrolled");
      } else {
        topBar.classList.remove("scrolled");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
  }

  var navTabs = document.querySelectorAll(".nav-tab");
  Array.prototype.forEach.call(navTabs, function (tab) {
    tab.addEventListener("click", function () {
      // Tabs that map to a real page navigate instead of showing a placeholder
      if (tab.dataset.href) {
        window.location.href = tab.dataset.href;
        return;
      }
      Array.prototype.forEach.call(navTabs, function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      var label = tab.querySelector(".nav-label")
        ? tab.querySelector(".nav-label").textContent
        : "Tab";
      showToast(label === "Home" ? "Home" : label + " section");
    });
  });

  /* ---------- CARD MARKUP ---------- */
  /* badge overrides the minutes chip — Continue Watching uses it to show
     how much is left of a video. */
  function cardMarkup(video, badge) {
    var title = video.title || "Executive Video";

    var image = video.image
      ? '<img src="' + escapeHtml(video.image) + '" alt="' + escapeHtml(title) +
        '" class="thumb-img" onerror="this.remove()">'
      : "";

    var durationText = badge != null
      ? badge
      : video.minutes
        ? escapeHtml(video.minutes) + " min"
        : "";
    var duration = durationText
      ? '<div class="duration-badge">' + durationText + "</div>"
      : "";

    return (
      '<article class="video-card"' +
        ' data-title="' + escapeHtml(title) + '"' +
        ' data-speaker="' + escapeHtml(speakerLine(video)) + '"' +
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

  /* Ranked Card (Top 10) with large numeral in the back */
  function rankedCardMarkup(video, rank) {
    var title = video.title || "Executive Video";

    var image = video.image
      ? '<img src="' + escapeHtml(video.image) + '" alt="' + escapeHtml(title) +
        '" class="thumb-img" onerror="this.remove()">'
      : "";

    var durationText = video.minutes
      ? escapeHtml(video.minutes) + " min"
      : "";
    var duration = durationText
      ? '<div class="duration-badge">' + durationText + "</div>"
      : "";

    return (
      '<article class="ranked-video-card"' +
        ' data-title="' + escapeHtml(title) + '"' +
        ' data-speaker="' + escapeHtml(speakerLine(video)) + '"' +
        (video.video ? ' data-video="' + escapeHtml(video.video) + '"' : "") +
      ">" +
        '<div class="rank-number-wrap">' +
          '<span class="rank-num">' + rank + "</span>" +
        "</div>" +
        '<div class="ranked-body">' +
          '<div class="thumb-container">' +
            image +
            '<div class="thumb-fallback ' + escapeHtml(video.art || "bg-slate-b") + '">' +
              '<div class="thumb-top-logos">' +
                '<span class="thumb-mansmith">MANSMITH</span>' +
                '<span class="thumb-continuum">CONTINUUM</span>' +
              "</div>" +
              '<div class="thumb-headline-ranked">' + highlightTitle(title, video.highlight) + "</div>" +
              '<div class="thumb-speaker-info">' +
                "<b>" + escapeHtml(video.speaker || "Executive Faculty") + "</b>" +
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
            '<span class="discipline-tag">' + escapeHtml(video.tag || video.groupTitle || "") + "</span>" +
            '<h3 class="card-caption">' + escapeHtml(title) + "</h3>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  /* ---------- CONTENT ROWS ---------- */
  function renderContinueWatching() {
    var section = document.getElementById("continueWatchingSection");
    var row = document.getElementById("continueWatchingRow");
    if (!section || !row) return;

    var records = window.ContinuumStore ? ContinuumStore.inProgress() : [];
    var cards = [];
    records.forEach(function (record) {
      var video = findRow(record.title);
      if (!video) return;
      var left = Math.max(1, Math.round((record.duration || 0) - (record.position || 0)));
      cards.push(cardMarkup(video, record.duration ? left + " min left" : "Resume"));
    });

    if (!cards.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    row.innerHTML = cards.join("");
  }

  function renderTopRanked() {
    var section = document.getElementById("topRankedSection");
    var row = document.getElementById("topRankedRow");
    if (!section || !row) return;

    var allVideos = window.ContinuumData ? ContinuumData.videos() : [];

    if (!allVideos.length) {
      row.className = "cards-carousel ranked-carousel cards-carousel--empty";
      row.innerHTML =
        '<div class="discipline-empty-row">' +
          '<span class="discipline-empty-icon">🏆</span>' +
          '<p class="discipline-empty-label">No ranked masterclasses yet</p>' +
        '</div>';
      return;
    }

    row.className = "cards-carousel ranked-carousel";
    var top10 = allVideos.slice(0, 10);
    row.innerHTML = top10
      .map(function (video, index) {
        return rankedCardMarkup(video, index + 1);
      })
      .join("");
  }

  function renderDisciplineRows() {
    var mount = document.getElementById("disciplineRows");
    var empty = document.getElementById("homeEmptyState");
    if (!mount) return;

    var groups = window.ContinuumData ? ContinuumData.groups() : [];

    // Show empty state only when there are NO disciplines at all
    if (!groups.length) {
      mount.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    // Render ALL disciplines — even those with 0 videos show the title + placeholder
    mount.innerHTML = groups
      .map(function (group) {
        var hasVideos = group.videos && group.videos.length;
        var carouselContent = hasVideos
          ? group.videos.map(function (video) { return cardMarkup(video); }).join("")
          : '<div class="discipline-empty-row">' +
              '<span class="discipline-empty-icon">🎬</span>' +
              '<p class="discipline-empty-label">No videos added yet</p>' +
            '</div>';
        return (
          '<section class="content-row-section" id="row-' + escapeHtml(group.id) + '">' +
            '<div class="section-header">' +
              '<h2 class="section-title">' + escapeHtml(group.title) + "</h2>" +
              '<p class="section-subtitle">' +
                (group.goal ? "Goal: " + escapeHtml(group.goal) : "Executive masterclasses") +
              "</p>" +
            "</div>" +
            '<div class="' + (hasVideos ? "cards-carousel" : "cards-carousel cards-carousel--empty") + '">' +
              carouselContent +
            "</div>" +
          "</section>"
        );
      })
      .join("");
  }

  /* ---------- VIDEO PLAYER MODAL ---------- */
  var videoModal = document.getElementById("videoModal");
  var videoModalBackdrop = document.getElementById("videoModalBackdrop");
  var closeVideoBtn = document.getElementById("closeVideoBtn");
  var videoModalTitle = document.getElementById("videoModalTitle");
  var videoModalSpeaker = document.getElementById("videoModalSpeaker");
  var mainVideoPlayer = document.getElementById("mainVideoPlayer");
  var videoSource = document.getElementById("videoSource");
  var videoFallbackPrompt = document.getElementById("videoFallbackPrompt");
  var playTrailerClipBtn = document.getElementById("playTrailerClipBtn");

  // Portrait clips would be cropped by the default 16:9 frame, so the wrapper
  // adopts the clip's real ratio once its metadata arrives.
  var DEFAULT_FRAME_RATIO = "16 / 9";

  // Where the player should jump to once metadata makes seeking possible
  var resumeAtSeconds = 0;
  var lastSavedSecond = -1;

  // Writes the current position, so the next visit resumes here
  function saveCurrentProgress() {
    if (!mainVideoPlayer || !mainVideoPlayer.duration || !window.ContinuumStore) return;
    ContinuumStore.saveProgress(
      videoModalTitle.textContent,
      mainVideoPlayer.currentTime / 60,
      mainVideoPlayer.duration / 60
    );
  }

  function fitFrameToVideo(video) {
    var wrap = video && video.closest ? video.closest(".video-frame-wrap") : null;
    if (!wrap || !video.videoWidth || !video.videoHeight) return;
    wrap.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
    video.style.objectFit = "contain";
  }

  function resetFrameRatio() {
    var wrap = mainVideoPlayer && mainVideoPlayer.closest
      ? mainVideoPlayer.closest(".video-frame-wrap")
      : null;
    if (!wrap) return;
    wrap.style.aspectRatio = DEFAULT_FRAME_RATIO;
    mainVideoPlayer.style.objectFit = "";
  }

  // Only shown when the file genuinely cannot load — not when autoplay is blocked.
  function showVideoFallback() {
    if (!mainVideoPlayer) return;
    mainVideoPlayer.style.display = "none";
    if (videoFallbackPrompt) videoFallbackPrompt.style.display = "flex";
  }

  function openVideoModal(title, speaker, videoUrl) {
    if (!videoModal) return;

    var videoTitle = title || "Executive Masterclass";
    var row = findRow(videoTitle);

    var videoModalTitle = document.getElementById("videoModalTitle");
    var videoModalSpeaker = document.getElementById("videoModalSpeaker");
    var sheetSubhead = document.getElementById("sheetSubhead");
    var modalTag = document.getElementById("modalTag");
    var modalCategory = document.getElementById("modalCategory");
    var modalDuration = document.getElementById("modalDuration");
    var sheetDisciplineName = document.getElementById("sheetDisciplineName");
    var sheetTargetOutcome = document.getElementById("sheetTargetOutcome");
    var sheetDesc = document.getElementById("sheetDesc");
    var modalMatch = document.getElementById("modalMatch");
    var sheetCtaText = document.getElementById("sheetCtaText");

    if (videoModalTitle) videoModalTitle.textContent = videoTitle;
    if (sheetSubhead) sheetSubhead.textContent = videoTitle;
    if (videoModalSpeaker) videoModalSpeaker.textContent = speaker || (row && row.speaker) || "Chiqui Escareal-Go";
    if (modalTag) modalTag.textContent = row ? (row.groupTitle || row.tag || "Executive Discipline") : "Marketing Discipline";
    if (modalCategory) modalCategory.textContent = (row && (row.tag || row.groupTitle)) || "Entrepreneurship";
    if (modalDuration) modalDuration.textContent = (row && row.minutes) ? row.minutes + "m" : "27m";
    if (sheetDisciplineName) sheetDisciplineName.textContent = (row && row.groupTitle) ? row.groupTitle + " Discipline" : "Marketing Discipline";
    if (sheetTargetOutcome) sheetTargetOutcome.textContent = (row && row.goal) ? row.goal : "Grow ventures & accelerate leadership";
    if (sheetDesc) sheetDesc.textContent = (row && row.blurb) ? row.blurb : "Learn how to preserve entrepreneurial agility and overcome internal bottlenecks as your business scales. Discover key strategies to close the action gap and maintain a founder's mindset through rapid growth.";

    // Deterministic match percentage
    if (modalMatch) {
      var hash = 0;
      for (var i = 0; i < videoTitle.length; i++) hash = (hash * 31 + videoTitle.charCodeAt(i)) & 0xff;
      var matchPct = 88 + (hash % 10);
      modalMatch.textContent = matchPct + "% Match";
    }

    if (sheetCtaText) {
      sheetCtaText.textContent = videoUrl ? "Play Masterclass" : "Unlock Video Access";
    }

    // Restore this title's saved state
    var modalList = document.getElementById("modalListAction");
    if (modalList) {
      var isSaved = window.ContinuumStore ? ContinuumStore.isSaved(videoTitle) : false;
      modalList.classList.toggle("active", isSaved);
      var labelEl = modalList.querySelector(".sheet-act-label");
      if (labelEl) labelEl.textContent = isSaved ? "✓ In List" : "My List";
    }

    var resume = window.ContinuumStore ? ContinuumStore.progressOf(videoTitle) : null;
    resumeAtSeconds = resume && !resume.completed ? resume.position * 60 : 0;

    // Only one clip plays at a time: park the ambient trailer while the player is open
    if (heroVideo && !heroVideo.paused) {
      heroWasPlaying = true;
      heroVideo.pause();
    }

    // Set video source if specified
    if (videoUrl && mainVideoPlayer && videoSource) {
      resetFrameRatio();
      videoSource.src = videoUrl;
      mainVideoPlayer.style.display = "block";
      if (videoFallbackPrompt) videoFallbackPrompt.style.display = "none";
      mainVideoPlayer.load();

      var attempt = mainVideoPlayer.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(function (err) {
          // NotAllowedError means the browser blocked autoplay with sound;
          // the file is fine, so keep the player visible for a manual tap.
          if (err && err.name === "NotAllowedError") return;
          showVideoFallback();
        });
      }
    } else {
      showVideoFallback();
    }

    videoModal.classList.add("open");
    videoModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeVideoModal() {
    if (!videoModal) return;
    saveCurrentProgress();
    // Focus inside the sheet would be hidden from screen readers by the
    // aria-hidden flip, so release it first
    if (document.activeElement && videoModal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    videoModal.classList.remove("open");
    videoModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (mainVideoPlayer) {
      mainVideoPlayer.pause();
    }
    if (heroWasPlaying && heroVideo) {
      heroWasPlaying = false;
      playHeroVideo();
    }
    // The member may have finished or resumed something just now
    renderContinueWatching();
  }

  if (mainVideoPlayer) {
    mainVideoPlayer.addEventListener("loadedmetadata", function () {
      fitFrameToVideo(mainVideoPlayer);

      // Resume where the member stopped, but never seek into the last seconds
      if (resumeAtSeconds > 2 && resumeAtSeconds < mainVideoPlayer.duration - 3) {
        mainVideoPlayer.currentTime = resumeAtSeconds;
      }
      resumeAtSeconds = 0;
    });
    mainVideoPlayer.addEventListener("error", showVideoFallback);

    // Progress is written every few seconds, not on every frame
    mainVideoPlayer.addEventListener("timeupdate", function () {
      var second = Math.floor(mainVideoPlayer.currentTime);
      if (second === lastSavedSecond || second % 5 !== 0) return;
      lastSavedSecond = second;
      saveCurrentProgress();
    });
    mainVideoPlayer.addEventListener("pause", saveCurrentProgress);
  }

  /* Cards are rendered, not authored — one delegated listener covers every
     row. Upload-backed rows resolve their blob URL just in time. */
  document.addEventListener("click", function (event) {
    var card = event.target.closest
      ? event.target.closest(".video-card, .ranked-video-card")
      : null;
    if (!card || (videoModal && videoModal.contains(card))) return;

    var title = card.dataset.title;
    var speaker = card.dataset.speaker;
    var direct = card.dataset.video;
    if (direct) {
      openVideoModal(title, speaker, direct);
      return;
    }

    var row = findRow(title);
    if (row) {
      resolveSrc(row, function (url) {
        openVideoModal(title, speaker, url);
      });
    } else {
      openVideoModal(title, speaker, null);
    }
  });

  // Modal navigation & back buttons
  var frameBackBtn = document.getElementById("frameBackBtn");
  frameBackBtn && frameBackBtn.addEventListener("click", closeVideoModal);
  closeVideoBtn && closeVideoBtn.addEventListener("click", closeVideoModal);
  videoModalBackdrop && videoModalBackdrop.addEventListener("click", closeVideoModal);

  // Primary Action Button (Unlock Video Access / Play Video)
  var sheetPrimaryCta = document.getElementById("sheetPrimaryCta");
  sheetPrimaryCta &&
    sheetPrimaryCta.addEventListener("click", function () {
      var currentTitle = videoModalTitle ? videoModalTitle.textContent : "";
      var currentSpeaker = videoModalSpeaker ? videoModalSpeaker.textContent : "";
      var currentDiscipline = sheetDisciplineName ? sheetDisciplineName.textContent : "";
      var currentUrl = (videoSource && videoSource.src) ? videoSource.src : "";

      // On mobile: automatically transition to landscape cinema player (Image 2)
      if (isMobileDevice()) {
        closeVideoModal();
        openLandscapePlayer(currentTitle, currentSpeaker, currentUrl, currentDiscipline);
        return;
      }

      if (!mainVideoPlayer || mainVideoPlayer.style.display === "none") {
        showToast("Starting masterclass stream…");
        return;
      }
      var ctaText = document.getElementById("sheetCtaText");
      if (mainVideoPlayer.paused) {
        mainVideoPlayer.play();
        if (ctaText) ctaText.textContent = "Pause Masterclass";
      } else {
        mainVideoPlayer.pause();
        if (ctaText) ctaText.textContent = "Play Masterclass";
      }
    });

  /* ========================================================
     LANDSCAPE FULLSCREEN PLAYER (MOBILE ONLY - MATCHING IMAGE 2)
     ======================================================== */
  var landscapeModal = document.getElementById("landscapePlayerModal");
  var landscapeVideo = document.getElementById("landscapeVideo");
  var lsDisciplineName = document.getElementById("lsDisciplineName");
  var lsVideoTitle = document.getElementById("lsVideoTitle");
  var lsPlayPauseBtn = document.getElementById("lsPlayPauseBtn");
  var lsTimeDisplay = document.getElementById("lsTimeDisplay");
  var lsScrubberFill = document.getElementById("lsScrubberFill");
  var lsScrubberDot = document.getElementById("lsScrubberDot");
  var lsControlsOverlay = document.getElementById("lsControlsOverlay");
  var lsControlsTimer = null;
  var isControlsLocked = false;

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  function resetLsControlsTimer() {
    if (isControlsLocked) return;
    if (lsControlsOverlay) lsControlsOverlay.classList.remove("idle-hidden");
    clearTimeout(lsControlsTimer);
    lsControlsTimer = setTimeout(function () {
      if (landscapeVideo && !landscapeVideo.paused && !isControlsLocked && lsControlsOverlay) {
        lsControlsOverlay.classList.add("idle-hidden");
      }
    }, 3500);
  }

  function openLandscapePlayer(title, speaker, videoUrl, discipline) {
    if (!landscapeModal || !landscapeVideo) return;

    var videoTitle = title || "Executive Masterclass";
    var row = findRow(videoTitle);

    if (lsVideoTitle) lsVideoTitle.textContent = '"' + videoTitle + '"';
    if (lsDisciplineName) {
      lsDisciplineName.textContent = discipline || (row && row.groupTitle ? row.groupTitle + " Discipline" : "Business Model Discipline");
    }

    // Stop ambient hero trailer while landscape player is open
    if (heroVideo && !heroVideo.paused) {
      heroWasPlaying = true;
      heroVideo.pause();
    }

    // Set video source
    if (videoUrl) {
      landscapeVideo.src = videoUrl;
      landscapeVideo.load();
      landscapeVideo.play().catch(function () {});
    }

    landscapeModal.classList.add("open");
    landscapeModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Request native landscape orientation where supported
    if (landscapeModal.requestFullscreen) {
      landscapeModal.requestFullscreen().catch(function () {});
    }
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(function () {});
    }

    resetLsControlsTimer();
  }

  function closeLandscapePlayer() {
    if (!landscapeModal || !landscapeVideo) return;
    clearTimeout(lsControlsTimer);
    landscapeVideo.pause();
    landscapeModal.classList.remove("open");
    landscapeModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }

    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }

    if (heroWasPlaying && heroVideo) {
      heroWasPlaying = false;
      playHeroVideo();
    }
  }

  // Landscape back button
  var lsBackBtn = document.getElementById("lsBackBtn");
  lsBackBtn && lsBackBtn.addEventListener("click", closeLandscapePlayer);

  // Landscape play/pause toggle
  if (lsPlayPauseBtn && landscapeVideo) {
    lsPlayPauseBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (landscapeVideo.paused) {
        landscapeVideo.play();
        lsPlayPauseBtn.classList.add("playing");
      } else {
        landscapeVideo.pause();
        lsPlayPauseBtn.classList.remove("playing");
      }
      resetLsControlsTimer();
    });

    landscapeVideo.addEventListener("play", function () {
      lsPlayPauseBtn.classList.add("playing");
      resetLsControlsTimer();
    });

    landscapeVideo.addEventListener("pause", function () {
      lsPlayPauseBtn.classList.remove("playing");
      if (lsControlsOverlay) lsControlsOverlay.classList.remove("idle-hidden");
    });

    landscapeVideo.addEventListener("timeupdate", function () {
      if (!landscapeVideo.duration) return;
      var cur = landscapeVideo.currentTime;
      var dur = landscapeVideo.duration;
      var pct = (cur / dur) * 100;
      if (lsScrubberFill) lsScrubberFill.style.width = pct + "%";
      if (lsScrubberDot) lsScrubberDot.style.left = pct + "%";
      if (lsTimeDisplay) lsTimeDisplay.textContent = formatTime(cur) + " / " + formatTime(dur);
    });
  }

  // Rewind 10s & Forward 10s
  var lsRewindBtn = document.getElementById("lsRewindBtn");
  lsRewindBtn &&
    lsRewindBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (landscapeVideo) landscapeVideo.currentTime = Math.max(0, landscapeVideo.currentTime - 10);
      resetLsControlsTimer();
      showToast("Rewind 10s");
    });

  var lsForwardBtn = document.getElementById("lsForwardBtn");
  lsForwardBtn &&
    lsForwardBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (landscapeVideo) landscapeVideo.currentTime = Math.min(landscapeVideo.duration || 0, landscapeVideo.currentTime + 10);
      resetLsControlsTimer();
      showToast("Forward 10s");
    });

  // Scrubber seeking
  var lsScrubberTrack = document.getElementById("lsScrubberTrack");
  lsScrubberTrack &&
    lsScrubberTrack.addEventListener("click", function (e) {
      e.stopPropagation();
      var rect = lsScrubberTrack.getBoundingClientRect();
      var clickPos = (e.clientX - rect.left) / rect.width;
      if (landscapeVideo && landscapeVideo.duration) {
        landscapeVideo.currentTime = Math.max(0, Math.min(landscapeVideo.duration, clickPos * landscapeVideo.duration));
      }
      resetLsControlsTimer();
    });

  // Screen Lock button
  var lsLockBtn = document.getElementById("lsLockBtn");
  lsLockBtn &&
    lsLockBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      isControlsLocked = !isControlsLocked;
      lsLockBtn.classList.toggle("locked", isControlsLocked);
      showToast(isControlsLocked ? "Screen controls locked" : "Screen controls unlocked");
      if (isControlsLocked && lsControlsOverlay) {
        lsControlsOverlay.classList.add("idle-hidden");
      }
    });

  // Playback speed cycle (1x -> 1.25x -> 1.5x -> 2x -> 1x)
  var lsSpeedBtn = document.getElementById("lsSpeedBtn");
  var SPEEDS = [1, 1.25, 1.5, 2];
  var currentSpeedIdx = 0;
  lsSpeedBtn &&
    lsSpeedBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
      var spd = SPEEDS[currentSpeedIdx];
      if (landscapeVideo) landscapeVideo.playbackRate = spd;
      var txt = document.getElementById("lsSpeedText");
      if (txt) txt.textContent = "Speed (" + spd + "x)";
      showToast("Playback speed: " + spd + "x");
      resetLsControlsTimer();
    });

  // Reaction buttons
  var lsDislikeBtn = document.getElementById("lsDislikeBtn");
  lsDislikeBtn &&
    lsDislikeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      this.classList.toggle("active");
      if (lsLikeBtn) lsLikeBtn.classList.remove("active");
      if (lsLoveBtn) lsLoveBtn.classList.remove("active");
      showToast("Feedback recorded");
      resetLsControlsTimer();
    });

  var lsLikeBtn = document.getElementById("lsLikeBtn");
  lsLikeBtn &&
    lsLikeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      this.classList.toggle("active");
      if (lsDislikeBtn) lsDislikeBtn.classList.remove("active");
      if (lsLoveBtn) lsLoveBtn.classList.remove("active");
      showToast(this.classList.contains("active") ? "Liked masterclass" : "Removed like");
      resetLsControlsTimer();
    });

  var lsLoveBtn = document.getElementById("lsLoveBtn");
  lsLoveBtn &&
    lsLoveBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      this.classList.toggle("active");
      if (lsDislikeBtn) lsDislikeBtn.classList.remove("active");
      if (lsLikeBtn) lsLikeBtn.classList.remove("active");
      showToast(this.classList.contains("active") ? "Loved this masterclass!" : "Rating removed");
      resetLsControlsTimer();
    });

  // Next Video button
  var lsNextVideoBtn = document.getElementById("lsNextVideoBtn");
  lsNextVideoBtn &&
    lsNextVideoBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var allVids = window.ContinuumData ? ContinuumData.videos() : [];
      if (allVids.length > 1) {
        var nextIdx = (currentSlide + 1) % allVids.length;
        var nextVid = allVids[nextIdx];
        resolveSrc(nextVid, function (url) {
          openLandscapePlayer(nextVid.title, speakerLine(nextVid), url, nextVid.groupTitle);
          showToast("Next: " + nextVid.title);
        });
      } else {
        showToast("No next video in catalogue");
      }
      resetLsControlsTimer();
    });

  // Tap screen to toggle overlay controls
  landscapeModal &&
    landscapeModal.addEventListener("click", function () {
      if (isControlsLocked) {
        isControlsLocked = false;
        if (lsLockBtn) lsLockBtn.classList.remove("locked");
        showToast("Controls unlocked");
      }
      if (lsControlsOverlay) {
        var isHidden = lsControlsOverlay.classList.contains("idle-hidden");
        if (isHidden) {
          resetLsControlsTimer();
        } else {
          lsControlsOverlay.classList.add("idle-hidden");
        }
      }
    });

  // Reminder button
  var modalReminderBtn = document.getElementById("modalReminderBtn");
  modalReminderBtn &&
    modalReminderBtn.addEventListener("click", function () {
      this.classList.toggle("active");
      var active = this.classList.contains("active");
      showToast(active ? "Reminder set for this masterclass" : "Reminder removed");
    });

  // Rating button
  var modalRateBtn = document.getElementById("modalRateBtn");
  modalRateBtn &&
    modalRateBtn.addEventListener("click", function () {
      this.classList.toggle("active");
      var active = this.classList.contains("active");
      showToast(active ? "Rated 5 stars! Thank you." : "Rating removed");
    });

  // Sample Trailer Clip button inside modal
  playTrailerClipBtn &&
    playTrailerClipBtn.addEventListener("click", function () {
      closeVideoModal();
      showToast("Launching video trailer…");
      setTimeout(function () {
        window.location.href = "../clips/";
      }, 600);
    });

  // Modal My List Action — read and written through ContinuumStore
  var modalListAction = document.getElementById("modalListAction");
  modalListAction &&
    modalListAction.addEventListener("click", function () {
      var currentTitle = videoModalTitle ? videoModalTitle.textContent : "";
      var saved = window.ContinuumStore
        ? ContinuumStore.toggleSaved(currentTitle)
        : !this.classList.contains("active");
      this.classList.toggle("active", saved);
      var labelEl = this.querySelector(".sheet-act-label");
      if (labelEl) labelEl.textContent = saved ? "✓ In List" : "My List";
      syncHeroActions();
      showToast(saved ? "Added to My List" : "Removed from My List");
    });

  // Modal Share Action
  var modalShare = document.getElementById("modalShareAction");
  modalShare &&
    modalShare.addEventListener("click", function () {
      var currentTitle = videoModalTitle ? videoModalTitle.textContent : "Continuum Masterclass";
      if (navigator.share) {
        navigator
          .share({
            title: currentTitle,
            text: "Watch " + currentTitle + " on Continuum Academy",
            url: window.location.href
          })
          .catch(function () {});
      } else {
        showToast("Share link copied to clipboard");
      }
    });

  // Tabs: Related Videos | Trailer & More
  var tabRelatedBtn = document.getElementById("tabRelatedBtn");
  var tabTrailerBtn = document.getElementById("tabTrailerBtn");
  var sheetModulesList = document.getElementById("sheetModulesList");

  if (tabRelatedBtn && tabTrailerBtn && sheetModulesList) {
    tabRelatedBtn.addEventListener("click", function () {
      tabRelatedBtn.classList.add("active");
      tabTrailerBtn.classList.remove("active");
      sheetModulesList.innerHTML =
        '<div class="sheet-module-card"><div class="sheet-module-num">1</div><div class="sheet-module-content"><h5>The growth paradox</h5><p>The bigger the business gets, the harder it is to move fast.</p></div></div>' +
        '<div class="sheet-module-card"><div class="sheet-module-num">3</div><div class="sheet-module-content"><h5>Three crises of scaling</h5><p>The points where growth stalls decisive action.</p></div></div>' +
        '<div class="sheet-module-card"><div class="sheet-module-num">!</div><div class="sheet-module-content"><h5>Bureaucracy and analysis paralysis</h5><p>How both stifle organizational agility.</p></div></div>';
    });

    tabTrailerBtn.addEventListener("click", function () {
      tabTrailerBtn.classList.add("active");
      tabRelatedBtn.classList.remove("active");
      sheetModulesList.innerHTML =
        '<div class="sheet-module-card"><div class="sheet-module-num">▶</div><div class="sheet-module-content"><h5>Executive Trailer</h5><p>Official 60-second teaser and faculty key takeaways.</p></div></div>' +
        '<div class="sheet-module-card"><div class="sheet-module-num">★</div><div class="sheet-module-content"><h5>Behind the Masterclass</h5><p>Facilitator framework and case study overview.</p></div></div>';
    });
  }

  /* ---------- BOOT ---------- */
  heroTitle.textContent = slides.length ? slides[0].title : "Your executive learning cockpit starts here";
  heroBackdrop.style.background = BACKDROPS[0];
  renderIndicators();
  renderContinueWatching();
  renderTopRanked();
  renderDisciplineRows();
  setupHeroTrailer();
  syncHeroActions();
})();
