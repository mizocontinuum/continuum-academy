/* ---------- CONTINUUM ACADEMY — MY LIBRARY DATA ---------- */
/* EMPTY ON PURPOSE. Every row pointed at a catalogue title, and the catalogue
   was cleared, so the rows would have nothing to join to.

   The library is a progress map over assets/js/data/disciplines.js.
   An entry names a catalogue title and records what the member did with it,
   so artwork, speaker and duration are never repeated here: the page looks
   them up. Rename a title in the catalogue and the row follows.

   Entry fields
     title       Must match a title in the catalogue. That is the join key.
     state       "watching" | "completed" | "saved". Decides which tab holds it.
     position    Minutes already watched. Together with the catalogue duration
                 it produces the progress bar and the "x min left" line.
     completedOn Date label on a completed row. Free text, shown as typed.
     savedOn     Date label on a saved row. Free text, shown as typed.

   Lifetime figure (authored, not derived)
     watchMinutes  Minutes streamed on the account. Shown as whole hours, so it
                   is deliberately larger than the run time of the rows below.

   Tab order
     The tabs are declared here so the page shell holds no copy of its own.
     icon names a mark in the page script: "play", "check" or "saved". */

window.CONTINUUM_LIBRARY = {
  watchMinutes: 0,

  tabs: [
    { state: "watching", label: "Continue Watching", icon: "play" },
    { state: "completed", label: "Completed", icon: "check" },
    { state: "saved", label: "Saved", icon: "saved" }
  ],

  entries: []
};
