/* ---------- CONTINUUM ACADEMY — MEMBER STATE ---------- */
/* Everything the app remembers about a signed-in member: how far they got in a
   video, what they saved, what they liked.

   Keyed by the session id from ContinuumAuth, so two accounts on the same
   device never see each other's progress. A signed-out page simply gets empty
   results instead of throwing.

   This is the seam where the backend arrives. Swap the bodies of the methods
   for the watch_progress / saved_videos queries in
   supabase/migrations/0001_init.sql and every page keeps working. */

window.ContinuumStore = (function () {
  "use strict";

  const KEY = "continuum.userstate.v1";

  function readAll() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function writeAll(all) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(all));
      return true;
    } catch (err) {
      return false;
    }
  }

  function currentUserId() {
    const auth = window.ContinuumAuth;
    const session = auth ? auth.getSession() : null;
    return session ? session.id : null;
  }

  function bucket(create) {
    const userId = currentUserId();
    if (!userId) return null;

    const all = readAll();
    if (!all[userId]) {
      if (!create) return null;
      all[userId] = { progress: {}, saved: {}, liked: {} };
    }
    const entry = all[userId];
    entry.progress = entry.progress || {};
    entry.saved = entry.saved || {};
    entry.liked = entry.liked || {};
    return { all: all, entry: entry, userId: userId };
  }

  function save(bucketRef) {
    return writeAll(bucketRef.all);
  }

  /* ---------- PLAYBACK PROGRESS ---------- */

  /* Returns { position, duration, completed, updatedAt } or null. */
  function progressOf(title) {
    const ref = bucket(false);
    if (!ref || !title) return null;
    return ref.entry.progress[title] || null;
  }

  /* Position is in minutes, matching the authored data in the catalogue. */
  function saveProgress(title, position, duration) {
    if (!title) return null;
    const ref = bucket(true);
    if (!ref) return null;

    const record = {
      position: Math.max(0, Number(position) || 0),
      duration: Number(duration) || null,
      completed: false,
      updatedAt: new Date().toISOString()
    };
    if (record.duration && record.position >= record.duration * 0.95) {
      record.completed = true;
      record.position = record.duration;
    }

    ref.entry.progress[title] = record;
    save(ref);
    return record;
  }

  /* ---------- SAVED LIST ---------- */
  function isSaved(title) {
    const ref = bucket(false);
    return Boolean(ref && title && ref.entry.saved[title]);
  }

  function toggleSaved(title) {
    if (!title) return false;
    const ref = bucket(true);
    if (!ref) return false;

    if (ref.entry.saved[title]) {
      delete ref.entry.saved[title];
    } else {
      ref.entry.saved[title] = new Date().toISOString();
    }
    save(ref);
    return Boolean(ref.entry.saved[title]);
  }

  function savedTitles() {
    const ref = bucket(false);
    return ref ? Object.keys(ref.entry.saved) : [];
  }

  /* ---------- LIKES ---------- */
  function isLiked(title) {
    const ref = bucket(false);
    return Boolean(ref && title && ref.entry.liked[title]);
  }

  function toggleLike(title) {
    if (!title) return false;
    const ref = bucket(true);
    if (!ref) return false;

    if (ref.entry.liked[title]) {
      delete ref.entry.liked[title];
    } else {
      ref.entry.liked[title] = new Date().toISOString();
    }
    save(ref);
    return Boolean(ref.entry.liked[title]);
  }

  /* Unfinished progress records, most recent first — Home's
     "Continue Watching" row reads this instead of authored cards. */
  function inProgress() {
    const ref = bucket(false);
    if (!ref) return [];
    return Object.keys(ref.entry.progress)
      .map(function (title) {
        const record = ref.entry.progress[title];
        return record && !record.completed && (record.position || 0) > 0.05
          ? Object.assign({ title: title }, record)
          : null;
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }

  /* Every progress record with its title — My Library folds these into its
     rows so watched videos appear without any authored data. */
  function progressRecords() {
    const ref = bucket(false);
    if (!ref) return [];
    return Object.keys(ref.entry.progress).map(function (title) {
      return Object.assign({ title: title }, ref.entry.progress[title]);
    });
  }

  /* ---------- SUMMARY ---------- */
  /* Feeds the "watchMinutes" line on My Library once Home is data-driven. */
  function summary() {
    const ref = bucket(false);
    if (!ref) return { watched: 0, completed: 0, saved: 0, liked: 0 };

    const records = Object.keys(ref.entry.progress).map((title) => ref.entry.progress[title]);
    return {
      watched: records.reduce((total, record) => total + (record.completed ? record.duration || 0 : record.position || 0), 0),
      completed: records.filter((record) => record.completed).length,
      saved: Object.keys(ref.entry.saved).length,
      liked: Object.keys(ref.entry.liked).length
    };
  }

  function clear() {
    const userId = currentUserId();
    if (!userId) return;
    const all = readAll();
    delete all[userId];
    writeAll(all);
  }

  return {
    progressOf: progressOf,
    saveProgress: saveProgress,
    inProgress: inProgress,
    progressRecords: progressRecords,
    isSaved: isSaved,
    toggleSaved: toggleSaved,
    savedTitles: savedTitles,
    isLiked: isLiked,
    toggleLike: toggleLike,
    summary: summary,
    clear: clear
  };
})();
