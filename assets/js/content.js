/* ---------- CONTINUUM ACADEMY — DYNAMIC CONTENT (ADMIN BETA) ---------- */
/* The catalogue the member actually sees, created in /admin/: disciplines and
   videos live in localStorage, uploaded video files live in IndexedDB (a
   browser database that holds large blobs — localStorage would burst at a
   few MB).

   Shape matches assets/js/data/disciplines.js exactly, with two extra fields:
     id       on each video, so an upload can be found and replaced
     fileId   present when a video file has been uploaded for that row

   Data lives on this device only. Clearing site data removes it, which is
   exactly what a beta should do — no orphan rows anywhere. */

window.ContinuumContent = (function () {
  "use strict";

  const KEY = "continuum.content.v1";
  const DB_NAME = "continuum-media";
  const DB_STORE = "files";

  /* Object URLs are created once per video and reused while the tab lives. */
  const urlCache = Object.create(null);

  /* ---------- CATALOGUE (localStorage) ---------- */
  function readGroups() {
    try {
      const raw = window.localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeGroups(groups) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(groups));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* True once the admin has authored anything. The catalogue layer reads
     this to decide between the dynamic content and the static data file. */
  function isConfigured() {
    return readGroups().length > 0;
  }

  /* Groups in the exact shape pages already render, plus fileId on rows. */
  function groups() {
    return readGroups();
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "discipline";
  }

  function uniqueId(base) {
    return base + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- GROUP CRUD ---------- */
  function addGroup(parts) {
    const title = String((parts && parts.title) || "").trim();
    if (title.length < 2) return { error: "Give the discipline a name first." };

    const groups = readGroups();
    const base = slugify(title);
    let id = base;
    let n = 2;
    while (groups.some((g) => g.id === id)) id = base + "-" + n++;

    const group = {
      id: id,
      title: title,
      goal: String(parts.goal || "").trim(),
      blurb: String(parts.blurb || "").trim(),
      videos: []
    };
    groups.push(group);
    return writeGroups(groups) ? { group: group } : { error: "Storage is full." };
  }

  function updateGroup(id, patch) {
    const groups = readGroups();
    const group = groups.find((g) => g.id === id);
    if (!group) return { error: "Discipline not found." };
    if (patch.title) group.title = String(patch.title).trim();
    if (patch.goal !== undefined) group.goal = String(patch.goal).trim();
    if (patch.blurb !== undefined) group.blurb = String(patch.blurb).trim();
    return writeGroups(groups) ? { group: group } : { error: "Storage is full." };
  }

  function removeGroup(id) {
    const groups = readGroups();
    const group = groups.find((g) => g.id === id);
    if (!group) return { error: "Discipline not found." };
    (group.videos || []).forEach((video) => {
      if (video.fileId) deleteFile(video.fileId);
    });
    return writeGroups(groups.filter((g) => g.id !== id)) ? { removed: id } : { error: "Storage is full." };
  }

  /* ---------- VIDEO CRUD ---------- */
  function addVideo(groupId, meta) {
    const groups = readGroups();
    const group = groups.find((g) => g.id === groupId);
    if (!group) return { error: "Discipline not found." };

    const title = String(meta.title || "").trim();
    if (title.length < 2) return { error: "Give the video a title first." };

    const video = {
      id: uniqueId(slugify(title)),
      title: title,
      highlight: String(meta.highlight || "").trim() || title,
      speaker: String(meta.speaker || "").trim() || "Continuum Academy",
      role: String(meta.role || "").trim(),
      avatar: String(meta.avatar || "").trim() || "🎬",
      minutes: meta.minutes ? Number(meta.minutes) || null : null,
      tag: String(meta.tag || "").trim() || group.title.toUpperCase(),
      art: String(meta.art || "").trim() || "bg-slate-a",
      image: null,
      video: null,
      fileId: null
    };
    group.videos.push(video);
    return writeGroups(groups) ? { video: video } : { error: "Storage is full." };
  }

  function updateVideo(groupId, videoId, patch) {
    const groups = readGroups();
    const group = groups.find((g) => g.id === groupId);
    const video = group && group.videos.find((v) => v.id === videoId);
    if (!video) return { error: "Video not found." };

    [
      "title", "highlight", "speaker", "role", "avatar", "tag", "art",
      "minutes"
    ].forEach((field) => {
      if (patch[field] !== undefined) video[field] = patch[field];
    });
    if (video.minutes === "") video.minutes = null;

    return writeGroups(groups) ? { video: video } : { error: "Storage is full." };
  }

  function removeVideo(groupId, videoId) {
    const groups = readGroups();
    const group = groups.find((g) => g.id === groupId);
    if (!group) return { error: "Discipline not found." };
    const video = group.videos.find((v) => v.id === videoId);
    if (!video) return { error: "Video not found." };

    if (video.fileId) deleteFile(video.fileId);
    group.videos = group.videos.filter((v) => v.id !== videoId);
    return writeGroups(groups) ? { removed: videoId } : { error: "Storage is full." };
  }

  /* ---------- INDEXEDDB (video files) ---------- */
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) {
          request.result.createObjectStore(DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
    });
    return dbPromise;
  }

  function putFile(fileId, file) {
    return openDB().then((db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(file, fileId);
        tx.oncomplete = () => resolve(fileId);
        tx.onerror = () => reject(tx.error);
      })
    );
  }

  function deleteFile(fileId) {
    /* Fire-and-forget: the catalogue row is already rewritten without it. */
    return openDB()
      .then((db) =>
        new Promise((resolve) => {
          const tx = db.transaction(DB_STORE, "readwrite");
          tx.objectStore(DB_STORE).delete(fileId);
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        })
      )
      .catch(() => undefined);
  }

  function getFile(fileId) {
    return openDB().then((db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const request = tx.objectStore(DB_STORE).get(fileId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      })
    );
  }

  /* Attach an uploaded file to a catalogue row. Replaces any older file. */
  function attachFile(groupId, videoId, file) {
    const groups = readGroups();
    const group = groups.find((g) => g.id === groupId);
    const video = group && group.videos.find((v) => v.id === videoId);
    if (!video) return Promise.reject(new Error("Video not found."));
    if (!file || !file.type || file.type.indexOf("video/") !== 0) {
      return Promise.reject(new Error("Pick a video file (.mp4 or .webm)."));
    }

    const previous = video.fileId;
    video.fileId = videoId;

    return putFile(videoId, file)
      .then(() => {
        if (!writeGroups(groups)) throw new Error("Storage is full.");
        if (previous && previous !== videoId) deleteFile(previous);
        if (urlCache[videoId]) {
          URL.revokeObjectURL(urlCache[videoId]);
          delete urlCache[videoId];
        }
        return video;
      });
  }

  /* Resolve a playable URL for a catalogue row: an authored path first, then
     an uploaded blob. Returns null when the row has no file yet, which pages
     treat as "open the player in its ready state". */
  function videoURL(video) {
    if (!video) return Promise.resolve(null);
    if (video.video) return Promise.resolve(video.video);
    if (!video.fileId) return Promise.resolve(null);
    if (urlCache[video.fileId]) return Promise.resolve(urlCache[video.fileId]);

    return getFile(video.fileId)
      .then((blob) => {
        if (!blob) return null;
        urlCache[video.fileId] = URL.createObjectURL(blob);
        return urlCache[video.fileId];
      })
      .catch(() => null);
  }

  /* By title, the way the rest of the app already identifies videos. */
  function videoByTitle(title) {
    if (!title) return null;
    const needle = String(title).toLowerCase();
    for (const group of readGroups()) {
      for (const video of group.videos || []) {
        if (String(video.title).toLowerCase() === needle) return video;
      }
    }
    return null;
  }

  /* Beta reset: the catalogue JSON and every uploaded file in one go. */
  function wipe() {
    removeKeyLocal();
    Object.keys(urlCache).forEach((fileId) => {
      URL.revokeObjectURL(urlCache[fileId]);
      delete urlCache[fileId];
    });
    return openDB()
      .then((db) =>
        new Promise((resolve) => {
          const tx = db.transaction(DB_STORE, "readwrite");
          tx.objectStore(DB_STORE).clear();
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        })
      )
      .catch(() => undefined);
  }

  function removeKeyLocal() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (err) {
      /* nothing to clean up */
    }
  }

  return {
    isConfigured: isConfigured,
    groups: groups,
    addGroup: addGroup,
    updateGroup: updateGroup,
    removeGroup: removeGroup,
    addVideo: addVideo,
    updateVideo: updateVideo,
    removeVideo: removeVideo,
    attachFile: attachFile,
    videoURL: videoURL,
    videoByTitle: videoByTitle,
    wipe: wipe
  };
})();
