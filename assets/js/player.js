/* ---------- SHARED VIDEO PLAYER MODAL ---------- */
/* One implementation for every page that opens a card. Disciplines and Search
   both load this file. Home keeps its own copy because its player also has to
   pause the ambient trailer running behind the hero. */

(function () {
  "use strict";

  const modal = document.getElementById("videoModal");
  if (!modal) return;

  const backdrop = document.getElementById("videoModalBackdrop");
  const closeBtn = document.getElementById("closeVideoBtn");
  const titleEl = document.getElementById("videoModalTitle");
  const speakerEl = document.getElementById("videoModalSpeaker");
  const player = document.getElementById("mainVideoPlayer");
  const source = document.getElementById("videoSource");
  const fallback = document.getElementById("videoFallbackPrompt");
  const trailerBtn = document.getElementById("playTrailerClipBtn");
  const likeBtn = document.getElementById("modalLikeAction");
  const listBtn = document.getElementById("modalListAction");
  const shareBtn = document.getElementById("modalShareAction");
  const toast = document.querySelector(".toast-msg");

  // Portrait clips would be cropped by a fixed 16:9 frame, so the wrapper
  // adopts the clip's real ratio once its metadata arrives.
  const DEFAULT_FRAME_RATIO = "16 / 9";

  // Watch state, mirroring the Home player: likes and saves live in
  // ContinuumStore and playback resumes where the member left off.
  let currentTitle = "";
  let resumeAtSeconds = 0;
  let lastSavedSecond = -1;

  function saveCurrentProgress() {
    if (!player || !player.duration || !window.ContinuumStore || !currentTitle) return;
    ContinuumStore.saveProgress(
      currentTitle,
      player.currentTime / 60,
      player.duration / 60
    );
  }

  // Draws the modal buttons from what the member already did
  function syncModalActions() {
    if (likeBtn) {
      likeBtn.classList.toggle(
        "active",
        window.ContinuumStore ? ContinuumStore.isLiked(currentTitle) : false
      );
    }
    if (listBtn) {
      const saved = window.ContinuumStore ? ContinuumStore.isSaved(currentTitle) : false;
      listBtn.classList.toggle("active", saved);
      listBtn.textContent = saved ? "✓ In My List" : "＋ My List";
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  function fitFrameToVideo(video) {
    const wrap = video.closest(".video-frame-wrap");
    if (!wrap || !video.videoWidth || !video.videoHeight) return;
    wrap.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
    video.style.objectFit = "contain";
  }

  function resetFrameRatio() {
    if (!player) return;
    const wrap = player.closest(".video-frame-wrap");
    if (!wrap) return;
    wrap.style.aspectRatio = DEFAULT_FRAME_RATIO;
    player.style.objectFit = "";
  }

  // Only shown when the file genuinely cannot load — not when autoplay is blocked.
  function showFallback() {
    if (!player) return;
    player.style.display = "none";
    if (fallback) fallback.style.display = "flex";
  }

  function open(title, speaker, videoUrl) {
    if (titleEl) titleEl.textContent = title || "Executive Video";
    if (speakerEl) speakerEl.textContent = speaker || "Continuum Academy";

    // The store keys everything by title, so the modal's own caption is it
    currentTitle = titleEl.textContent;
    const resume = window.ContinuumStore ? ContinuumStore.progressOf(currentTitle) : null;
    resumeAtSeconds = resume && !resume.completed ? resume.position * 60 : 0;
    syncModalActions();

    if (videoUrl && player && source) {
      resetFrameRatio();
      source.src = videoUrl;
      player.style.display = "block";
      if (fallback) fallback.style.display = "none";
      player.load();

      const attempt = player.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(error => {
          // NotAllowedError = autoplay with sound was blocked. The file is
          // fine, so leave the player up for a manual tap.
          if (error && error.name === "NotAllowedError") return;
          showFallback();
        });
      }
    } else {
      showFallback();
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    saveCurrentProgress();
    /* Focus inside the sheet would be hidden from screen readers by the
       aria-hidden flip, so release it first. */
    if (document.activeElement && modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (player) player.pause();
  }

  if (player) {
    player.addEventListener("loadedmetadata", () => {
      fitFrameToVideo(player);

      // Resume where the member stopped, but never seek into the last seconds
      if (resumeAtSeconds > 2 && resumeAtSeconds < player.duration - 3) {
        player.currentTime = resumeAtSeconds;
      }
      resumeAtSeconds = 0;
    });
    player.addEventListener("error", showFallback);

    // Progress is written every few seconds, not on every frame
    player.addEventListener("timeupdate", () => {
      const second = Math.floor(player.currentTime);
      if (second === lastSavedSecond || second % 5 !== 0) return;
      lastSavedSecond = second;
      saveCurrentProgress();
    });
    player.addEventListener("pause", saveCurrentProgress);
  }

  // Delegated: covers every card a page renders, whenever it renders it
  document.addEventListener("click", event => {
    const card = event.target.closest(".video-card, .ranked-video-card, .result-row, .grid-card, .library-row, .exp-card, .disc-card");
    if (!card || modal.contains(card)) return;

    const title = card.dataset.title;
    const speaker = card.dataset.speaker;
    const videoUrl = card.dataset.video;

    /* No authored path: an admin-uploaded file is looked up by title and
       served from IndexedDB as an object URL. */
    if (!videoUrl && window.ContinuumContent) {
      const row = ContinuumContent.videoByTitle(title);
      if (row) {
        ContinuumContent.videoURL(row).then(url => open(title, speaker, url));
        return;
      }
    }
    open(title, speaker, videoUrl);
  });

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);

  if (trailerBtn) {
    trailerBtn.addEventListener("click", () => {
      close();
      showToast("Launching video trailer…");
      setTimeout(() => {
        window.location.href = "../clips/";
      }, 600);
    });
  }

  if (likeBtn) {
    likeBtn.addEventListener("click", function () {
      const liked = window.ContinuumStore
        ? ContinuumStore.toggleLike(currentTitle)
        : !this.classList.contains("active");

      this.classList.toggle("active", liked);
      showToast(liked ? "Liked this video" : "Removed like");
    });
  }

  if (listBtn) {
    listBtn.addEventListener("click", function () {
      const saved = window.ContinuumStore
        ? ContinuumStore.toggleSaved(currentTitle)
        : !this.classList.contains("active");

      this.classList.toggle("active", saved);
      this.textContent = saved ? "✓ In My List" : "＋ My List";
      showToast(saved ? "Added to My List" : "Removed from My List");
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const title = titleEl ? titleEl.textContent : "Continuum Academy";
      if (navigator.share) {
        navigator
          .share({ title: title, text: "Watch " + title + " on Continuum Academy", url: window.location.href })
          .catch(() => {});
      } else {
        showToast("Share link copied to clipboard");
      }
    });
  }

  window.ContinuumPlayer = { open: open, close: close };
})();
