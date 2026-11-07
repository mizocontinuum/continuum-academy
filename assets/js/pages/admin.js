/* ---------- ADMIN BETA PAGE LOGIC ---------- */
/* Thin UI over ContinuumContent: create disciplines, add videos, upload the
   files. Every mutation re-renders from the store, so the page can never
   drift from what the member-facing pages will show. */

(function () {
  "use strict";

  const Content = window.ContinuumContent;
  if (!Content) return;

  const toast = document.getElementById("pageToast");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* The discipline whose videos are being edited */
  let selectedGroupId = null;

  /* ---------- DISCIPLINE LIST ---------- */
  const groupList = document.getElementById("groupList");

  function renderGroups() {
    if (!groupList) return;
    const groups = Content.groups();

    if (!groups.length) {
      groupList.innerHTML =
        '<li class="empty-note">No disciplines yet — add one above, then tap it to add videos.</li>';
      return;
    }

    groupList.innerHTML = groups
      .map(function (group) {
        const count = (group.videos || []).length;
        return (
          '<li class="group-item selectable' +
          (group.id === selectedGroupId ? " selected" : "") +
          '" data-group="' + escapeHtml(group.id) + '">' +
            '<div class="item-text">' +
              '<div class="item-name">' + escapeHtml(group.title) + "</div>" +
              '<div class="item-sub">' +
                (group.goal ? "Goal: " + escapeHtml(group.goal) + " · " : "") +
                count + (count === 1 ? " video" : " videos") +
              "</div>" +
            "</div>" +
            '<div class="item-actions">' +
              '<button type="button" class="admin-btn small danger" data-action="delete-group">Delete</button>' +
            "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  groupList?.addEventListener("click", function (event) {
    const item = event.target.closest(".group-item");
    if (!item) return;
    const groupId = item.dataset.group;

    if (event.target.closest('[data-action="delete-group"]')) {
      const groups = Content.groups();
      const group = groups.find((g) => g.id === groupId);
      const count = group && group.videos ? group.videos.length : 0;
      if (
        !window.confirm(
          "Delete \u201C" + (group ? group.title : "") + "\u201D and its " +
            count + " video row(s), including uploaded files?"
        )
      )
        return;
      const result = Content.removeGroup(groupId);
      if (result.error) return showToast(result.error);
      if (selectedGroupId === groupId) {
        selectedGroupId = null;
        const section = document.getElementById("videoSection");
        if (section) section.hidden = true;
      }
      renderGroups();
      showToast("Discipline deleted");
      return;
    }

    selectGroup(groupId);
  });

  function selectGroup(groupId) {
    selectedGroupId = groupId;
    const section = document.getElementById("videoSection");
    const nameEl = document.getElementById("videoSectionGroup");
    const group = Content.groups().find((g) => g.id === groupId);
    if (nameEl) nameEl.textContent = group ? group.title : "";
    if (section) section.hidden = false;
    renderGroups();
    renderVideos();
  }

  /* ---------- ADD DISCIPLINE ---------- */
  document.getElementById("groupForm")?.addEventListener("submit", function (event) {
    event.preventDefault();
    const result = Content.addGroup({
      title: document.getElementById("groupTitle")?.value,
      goal: document.getElementById("groupGoal")?.value,
      blurb: document.getElementById("groupBlurb")?.value
    });
    if (result.error) return showToast(result.error);
    this.reset();
    renderGroups();
    selectGroup(result.group.id);
    showToast("Discipline \u201C" + result.group.title + "\u201D created");
  });

  /* ---------- THUMBNAIL PROCESSING (Canvas 16:9 Compression) ---------- */
  function processThumbnailFile(file) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_W = 640;
          const MAX_H = 360;
          canvas.width = MAX_W;
          canvas.height = MAX_H;
          const ctx = canvas.getContext("2d");
          const scale = Math.max(MAX_W / img.width, MAX_H / img.height);
          const x = (MAX_W - img.width * scale) / 2;
          const y = (MAX_H - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(null);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  /* Form Thumbnail Picker & Live Preview */
  const thumbInput = document.getElementById("videoThumbnail");
  const thumbPreview = document.getElementById("thumbPreview");
  const thumbPreviewImg = document.getElementById("thumbPreviewImg");
  const clearThumbBtn = document.getElementById("clearThumbBtn");
  let currentThumbnailDataUrl = null;

  function resetThumbPreview() {
    currentThumbnailDataUrl = null;
    if (thumbInput) thumbInput.value = "";
    if (thumbPreview) thumbPreview.hidden = true;
    if (thumbPreviewImg) thumbPreviewImg.src = "";
  }

  thumbInput?.addEventListener("change", async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    const dataUrl = await processThumbnailFile(file);
    if (dataUrl) {
      currentThumbnailDataUrl = dataUrl;
      if (thumbPreviewImg) thumbPreviewImg.src = dataUrl;
      if (thumbPreview) thumbPreview.hidden = false;
    }
  });

  clearThumbBtn?.addEventListener("click", resetThumbPreview);

  /* ---------- VIDEO LIST ---------- */
  const videoList = document.getElementById("videoList");

  function renderVideos() {
    if (!videoList) return;
    const group = Content.groups().find((g) => g.id === selectedGroupId);
    if (!group) {
      videoList.innerHTML = "";
      return;
    }

    const videos = group.videos || [];
    if (!videos.length) {
      videoList.innerHTML = '<li class="empty-note">No videos in this discipline yet.</li>';
      return;
    }

    videoList.innerHTML = videos
      .map(function (video) {
        const chip = video.fileId
          ? '<span class="file-chip has">\u25B6 file uploaded</span>'
          : '<span class="file-chip missing">\u25D0 no file yet \u2014 ready state</span>';

        const thumbImg = video.image
          ? '<img src="' + escapeHtml(video.image) + '" class="video-mini-thumb" alt="Thumbnail">'
          : '<div class="video-mini-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">🎬</div>';

        return (
          '<li class="video-item" data-video="' + escapeHtml(video.id) + '">' +
            thumbImg +
            '<div class="item-text">' +
              '<div class="item-name">' + escapeHtml(video.title) + "</div>" +
              '<div class="item-sub">' +
                escapeHtml(video.speaker || "") +
                (video.minutes ? " \u00B7 " + escapeHtml(video.minutes) + " min" : "") +
              "</div>" +
              chip +
            "</div>" +
            '<div class="item-actions">' +
              '<button type="button" class="admin-btn small" data-action="upload-thumb" title="Upload Thumbnail">Thumb</button>' +
              '<button type="button" class="admin-btn small" data-action="upload" title="Upload Video File">Video</button>' +
              '<button type="button" class="admin-btn small danger" data-action="delete-video">✕</button>' +
            "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  /* Hidden input that powers row Thumbnail uploads */
  const rowThumbInput = document.createElement("input");
  rowThumbInput.type = "file";
  rowThumbInput.accept = "image/png,image/jpeg,image/webp,image/jpg";
  rowThumbInput.style.display = "none";
  document.body.appendChild(rowThumbInput);
  let rowThumbTarget = null;

  rowThumbInput.addEventListener("change", async function () {
    const file = this.files && this.files[0];
    this.value = "";
    if (!file || !rowThumbTarget) return;
    const dataUrl = await processThumbnailFile(file);
    if (dataUrl) {
      Content.updateVideo(selectedGroupId, rowThumbTarget.videoId, { image: dataUrl });
      renderVideos();
      showToast("Thumbnail image updated");
    }
  });

  /* Hidden input that powers row Video uploads */
  const rowFileInput = document.createElement("input");
  rowFileInput.type = "file";
  rowFileInput.accept = "video/mp4,video/webm";
  rowFileInput.style.display = "none";
  document.body.appendChild(rowFileInput);
  let rowTarget = null;

  rowFileInput.addEventListener("change", function () {
    const file = this.files && this.files[0];
    this.value = "";
    if (!file || !rowTarget) return;
    uploadFor(rowTarget.videoId, file);
  });

  function uploadFor(videoId, file) {
    showToast("Uploading\u2026 this stays on this device");
    Content.attachFile(selectedGroupId, videoId, file)
      .then(function () {
        renderVideos();
        showToast("Video file ready to play");
      })
      .catch(function (err) {
        showToast(err && err.message ? err.message : "Upload failed");
      });
  }

  videoList?.addEventListener("click", function (event) {
    const item = event.target.closest(".video-item");
    if (!item) return;
    const videoId = item.dataset.video;

    if (event.target.closest('[data-action="upload-thumb"]')) {
      rowThumbTarget = { videoId: videoId };
      rowThumbInput.click();
      return;
    }

    if (event.target.closest('[data-action="upload"]')) {
      rowTarget = { videoId: videoId };
      rowFileInput.click();
      return;
    }

    if (event.target.closest('[data-action="delete-video"]')) {
      if (!window.confirm("Delete this video and its uploaded files?")) return;
      const result = Content.removeVideo(selectedGroupId, videoId);
      if (result.error) return showToast(result.error);
      renderVideos();
      renderGroups();
      showToast("Video deleted");
    }
  });

  /* ---------- ADD VIDEO (form) ---------- */
  document.getElementById("videoForm")?.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!selectedGroupId) return showToast("Pick a discipline first");

    const fileInput = document.getElementById("videoFile");
    const file = fileInput && fileInput.files && fileInput.files[0];
    const thumbData = currentThumbnailDataUrl;

    const result = Content.addVideo(selectedGroupId, {
      title: document.getElementById("videoTitle")?.value,
      highlight: document.getElementById("videoHighlight")?.value,
      speaker: document.getElementById("videoSpeaker")?.value,
      minutes: document.getElementById("videoMinutes")?.value,
      tag: document.getElementById("videoTag")?.value,
      art: document.getElementById("videoArt")?.value || "bg-slate-b",
      image: thumbData
    });
    if (result.error) return showToast(result.error);

    const done = function () {
      this.reset();
      resetThumbPreview();
      renderGroups();
      renderVideos();
      showToast("Video added");
    }.bind(this);

    if (file) {
      Content.attachFile(selectedGroupId, result.video.id, file)
        .then(done)
        .catch(function (err) {
          done();
          showToast((err && err.message) || "File was too large to store — add it later with Upload");
        });
    } else {
      done();
    }
  });

  /* ---------- WIPE ---------- */
  document.getElementById("wipeContent")?.addEventListener("click", function () {
    if (!window.confirm("Delete ALL disciplines, videos and uploaded files on this device?")) return;
    Content.wipe().then(function () {
      selectedGroupId = null;
      const section = document.getElementById("videoSection");
      if (section) section.hidden = true;
      resetThumbPreview();
      renderGroups();
      renderVideos();
      showToast("All content wiped");
    });
  });

  renderGroups();
})();
