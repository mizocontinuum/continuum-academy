/* ============ 1. DATA: edit this list to change the clips ============ */
const clips = [
  { ev:"Entrep Summit", t:"Insight Without Action Fails", m:"89%", d:"27m", c:"Entrepreneurship",
    g:"linear-gradient(160deg, var(--surface-raised), var(--surface) 60%, var(--bg-page))", k:"IA" },
  { ev:"Marketing Discipline", t:"The Filipino Trust Economy: Growing from Our Roots", m:"94%", d:"32m", c:"Marketing",
    g:"linear-gradient(160deg, var(--surface), var(--bg-page) 60%, var(--surface-raised))", k:"FT" },
  { ev:"Business Model Discipline", t:"Building Block 9: The Complementors", m:"91%", d:"1h", c:"Business Model",
    g:"linear-gradient(160deg, var(--surface-raised), var(--bg-page) 58%)", k:"BB" },
  { ev:"Digital Discipline", t:"Digital Where-to-Plays and How-to-Wins", m:"87%", d:"26m", c:"Digital",
    g:"linear-gradient(160deg, var(--surface), var(--surface-raised) 55%, var(--bg-page))", k:"DW" }
];

const DUR = 15000;                         // how long each trailer plays (ms) = 15 seconds
const feed  = document.getElementById('feed');
const toast = document.getElementById('toast');
let muted  = true;                         // sound state (starts muted, like TikTok)
let timers = new Map();                    // remembers the playback state of each clip

/* ============ 2. BUILD THE SCREENS from the data ============ */
feed.innerHTML = clips.map(c => `
<section class="clip">
  <div class="art" style="--g:${c.g}"><i>${c.k}</i></div>
  <div class="shade"></div>
  <div class="bars"><span></span></div>
  <div class="top"><b>Clips</b><span class="tag">Trailer</span></div>
  <div class="pause" aria-hidden="true">❚❚</div>

  <div class="rail">
    <button data-a="like"  aria-label="Like"><em>♥</em>Like</button>
    <button data-a="list"  aria-label="Add to My List"><em>＋</em>My List</button>
    <button data-a="mute"  aria-label="Toggle sound"><em class="mu">🔇</em>Sound</button>
    <button data-a="share" aria-label="Share"><em>↗</em>Share</button>
  </div>

  <div class="info">
    <div class="eyebrow">${c.ev}</div>
    <h2>${c.t}</h2>
    <div class="meta"><b>${c.m} Match</b><u>HD</u>${c.d} · ${c.c}</div>
    <button class="cta" data-a="full">▶ Play Full Video</button>
    <div class="sub">Opens in landscape</div>
  </div>
</section>`).join('');

/* ============ 3. TOAST: small message at the top ============ */
function say(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(say.t);
  say.t = setTimeout(() => toast.classList.remove('show'), 2200);   // hides after 2.2 seconds
}

/* ============ 4. PLAYBACK: runs the progress bar and auto-advance ============ */
function run(clip){
  stop(clip);                                           // reset first
  const bar = clip.querySelector('.bars span');
  const st = { paused:false, raf:0, last:performance.now(), elapsed:0 };

  const tick = now => {                                 // runs every frame (~60 times a second)
    if(!st.paused){
      st.elapsed += now - st.last;                      // add the time since the last frame
      bar.style.width = Math.min(100, st.elapsed / DUR * 100) + '%';   // fill the bar
      if(st.elapsed >= DUR){                            // trailer finished
        const next = clip.nextElementSibling;
        if(next) next.scrollIntoView({behavior:'smooth'});            // go to the next clip
        else feed.scrollTo({top:0, behavior:'smooth'});               // last clip: back to the first
        return;
      }
    }
    st.last = now;
    st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
  timers.set(clip, st);
}

function stop(clip){                                    // cancel and reset a clip
  const s = timers.get(clip);
  if(s){ cancelAnimationFrame(s.raf); timers.delete(clip); }
  clip.classList.remove('paused');
  clip.querySelector('.bars span').style.width = '0';
}

/* ============ 5. DETECT WHICH CLIP IS ON SCREEN ============ */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => e.isIntersecting ? run(e.target) : stop(e.target));
}, { root:feed, threshold:.7 });                        // "on screen" = 70% visible
document.querySelectorAll('.clip').forEach(c => io.observe(c));

/* ============ 6. TAPS AND BUTTONS ============ */
feed.addEventListener('click', e => {
  const clip = e.target.closest('.clip');
  if(!clip) return;
  const b = e.target.closest('button');

  if(!b){                                               // tapped the video itself: pause / resume
    const s = timers.get(clip);
    if(s){ s.paused = !s.paused; clip.classList.toggle('paused', s.paused); }
    return;
  }

  const a = b.dataset.a;                                // which button was tapped
  if(a === 'like'){ b.classList.toggle('on'); }
  if(a === 'list'){
    b.classList.toggle('on');
    say(b.classList.contains('on') ? 'Added to My List' : 'Removed from My List');
  }
  if(a === 'mute'){
    muted = !muted;
    document.querySelectorAll('.mu').forEach(m => m.textContent = muted ? '🔇' : '🔊');
    say(muted ? 'Sound off' : 'Sound on');
  }
  if(a === 'share'){ say('Share sheet opens here'); }
  if(a === 'full'){  say('Switching to landscape and opening the full video…'); }
});

/* ============ 7. BOTTOM NAVIGATION BAR TABS ============ */
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
  item.addEventListener('click', () => {
    if (item.dataset.nav === 'home') {
      window.location.href = '../home/';
      return;
    }
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    const label = item.querySelector('.nav-label')?.textContent || 'Tab';
    say(`${label} tab selected`);
  });
});
