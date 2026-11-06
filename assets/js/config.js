/* ---------- CONTINUUM ACADEMY — RUNTIME CONFIGURATION ---------- */
/* One place that decides whether the app runs on the local demo session or on
   real accounts. Nothing else in the project reads a key or a URL directly.

   Pages are one folder deep, so paths are written from there ("../login/").
   The root index.html overrides them before this file loads.

   Switching to real accounts later:
     1. Vendor the supabase-js bundle into assets/js/vendor/ (a pinned, reviewed
        copy served from this origin) and load it on the auth pages. A CDN tag
        without an integrity hash lets an upstream compromise run code here.
     2. Fill supabaseUrl + supabaseAnonKey below.
     3. Set mode to "supabase".
   The anon key is safe in the browser only because every table is guarded by
   the row level security policies in supabase/migrations/0001_init.sql. */

window.CONTINUUM_CONFIG = Object.assign(
  {
    /* "demo" = local session, no passwords stored. "supabase" = real accounts. */
    mode: "demo",

    supabaseUrl: "",
    supabaseAnonKey: "",

    /* Where the app sends people when they are signed out, and back to */
    loginPath: "../login/",
    homePath: "../home/",
    profilePath: "../profile/",

    /* Session lifetime before the guard asks for a password again */
    sessionTtlDays: 7,

    /* Shortest password the forms will accept */
    minPasswordLength: 8
  },
  window.CONTINUUM_CONFIG || {}
);
