/* ---------- CONTINUUM ACADEMY — CATALOGUE ACCESS ---------- */
/* The only place pages should read content from.

   Today that is the two authored files in this folder:
     disciplines.js  the catalogue, grouped by discipline
     library.js      the member's rows, joined to the catalogue by title

   When the catalogue moves into Postgres, replace the bodies here with the
   Supabase queries. Pages keep calling ContinuumData and never learn the
   difference. Load order matters: this file after the data it reads.

   Every method tolerates a missing data file, so a page can include this
   without also including disciplines.js. */

window.ContinuumData = (function () {
  "use strict";

  function groups() {
    /* Content authored in /admin/ wins over the static file: once the beta
       store has anything, the app shows the real catalogue, not the demo. */
    if (window.ContinuumContent && ContinuumContent.isConfigured()) {
      return ContinuumContent.groups();
    }
    return Array.isArray(window.CONTINUUM_DISCIPLINES) ? window.CONTINUUM_DISCIPLINES : [];
  }

  /* Flat list of videos, each carrying the discipline it was curated into.
     That is the shape search, the player and the library all want. */
  function videos() {
    return groups().reduce((list, group) => {
      (group.videos || []).forEach((video) => {
        list.push(
          Object.assign({}, video, {
            groupId: group.id,
            groupTitle: group.title,
            goal: group.goal
          })
        );
      });
      return list;
    }, []);
  }

  function findVideo(title) {
    if (!title) return null;
    return videos().find((video) => video.title === title) || null;
  }

  function findGroup(id) {
    if (!id) return null;
    return groups().find((group) => group.id === id) || null;
  }

  function library() {
    const data = window.CONTINUUM_LIBRARY;
    if (!data) return { watchMinutes: 0, tabs: [], entries: [] };
    return {
      watchMinutes: data.watchMinutes || 0,
      tabs: data.tabs || [],
      entries: data.entries || []
    };
  }

  /* Library rows joined to the catalogue, skipping any title that no longer
     exists there instead of rendering a blank card. */
  function libraryEntries(state) {
    return library()
      .entries.filter((entry) => !state || entry.state === state)
      .map((entry) => {
        const video = findVideo(entry.title);
        return video ? Object.assign({}, entry, { video: video }) : null;
      })
      .filter(Boolean);
  }

  /* Case-insensitive match over title, speaker, tag and discipline. */
  function search(term) {
    const needle = String(term || "").trim().toLowerCase();
    if (!needle) return [];
    return videos().filter((video) => {
      const haystack = [video.title, video.speaker, video.tag, video.groupTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.indexOf(needle) !== -1;
    });
  }

  return {
    groups: groups,
    videos: videos,
    findVideo: findVideo,
    findGroup: findGroup,
    library: library,
    libraryEntries: libraryEntries,
    search: search
  };
})();
