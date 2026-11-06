/* ---------- CONTINUUM ACADEMY — DISCIPLINES LIBRARY DATA ---------- */
/* EMPTY ON PURPOSE. The catalogue was cleared so a new dataset can be dropped
   in whole. Nothing renders until objects are added below.

   Structure: groups (the curated sections, in display order) -> videos.

   Group fields
     id      Anchor key. The Disciplines page posts #disc-<id>, Explore links to it.
     title   Section heading, and the page title on the discipline page.
     goal    One line under the heading on Explore ("Goal: Build demand").
     blurb   One sentence under the goal on the discipline page.
     videos  The group's videos, in display order.

   Video fields
     title     Full title. The card caption ellipses it, the modal shows it whole.
     highlight Substring of `title` painted in accent inside the card artwork.
     speaker   Name shown on the art and in the player.
     role      Title/company under the name. Omit for panels and fellows.
     avatar    Emoji used by the fallback artwork.
     minutes   Number only ("min" is added by the card). null hides the badge.
     tag       Disciplinary label printed under the card. This is the video's
               own label and can differ from the group it is curated into.
     art       Background variant for the rendered artwork (see home.css).
     image     Optional thumbnail path. When set it paints over the artwork;
               when omitted the rendered artwork is the card face (no 404s).
     video     Optional path; without it the player opens its "ready" state.

   Adding a discipline = add an object here. No markup changes needed.

   Note: the Home page still authors its own row markup in home/index.html.
   This file is the library view of the catalogue, so a title changed in both
   places must be changed in both places until Home is data-driven. */

window.CONTINUUM_DISCIPLINES = [];
