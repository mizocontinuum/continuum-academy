/* ---------- CONTINUUM ACADEMY — RUNTIME CONFIGURATION ---------- */
/* Client-side configuration. Pages are one folder deep, so paths are written
   relative to that level ("../login/"). The root index.html overrides them. */

window.CONTINUUM_CONFIG = Object.assign(
  {
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
