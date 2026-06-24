/**
 * FORECAST OS — POTUS Alert System v1.0
 * ───────────────────────────────────────────────────────────────
 * Drop into ANY terminal with one line before </body>:
 *   <script src="potus-alert.js"></script>
 *
 * THREE ALERT LEVELS:
 *   Level 1 — HEADS UP     (yellow corner popup + countdown)
 *   Level 2 — TAPE BOMB    (orange banner slides from top)
 *   Level 3 — MARKET NUKE  (red full-screen takeover + bobblehead)
 *
 * TRIGGERS:
 *   Auto: Scheduled events fire at configured times
 *   Auto: News scanner checks headlines every 5 minutes
 *   Manual: POTUSAlert.fire(level, message) from console or button
 *
 * MANUAL TRIGGER (from browser console or dashboard):
 *   POTUSAlert.fire(1, "Press conference starting soon")
 *   POTUSAlert.fire(2, "Tariff announcement breaking")
 *   POTUSAlert.fire(3, "EMERGENCY — Fed Chair firing rumored")
 *   POTUSAlert.dismiss()
 */

(function() {
'use strict';

// ── INJECT STYLES ────────────────────────────────────────────────
const css = `
  /* ── POTUS ALERT BASE ── */
  .potus-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    pointer-events: none;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
  }

  /* ── LEVEL 1 — CORNER POPUP ── */
  .potus-l1 {
    position: fixed;
    bottom: 80px;
    right: 24px;
    width: 320px;
    background: #1a1400;
    border: 2px solid #ffb800;
    border-radius: 6px;
    padding: 14px 16px;
    z-index: 99999;
    pointer-events: all;
    animation: slideInRight 0.4s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 0 30px rgba(255,184,0,0.3);
  }
  .potus-l1-hdr {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .potus-l1-icon { font-size: 20px; }
  .potus-l1-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: #ffb800;
    text-transform: uppercase;
    flex: 1;
  }
  .potus-l1-close {
    font-size: 16px;
    color: rgba(255,184,0,0.5);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    line-height: 1;
  }
  .potus-l1-close:hover { color: #ffb800; }
  .potus-l1-msg {
    font-size: 12px;
    color: #e0c060;
    line-height: 1.6;
    margin-bottom: 10px;
  }
  .potus-l1-countdown {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: rgba(255,184,0,0.6);
  }
  .potus-l1-timer {
    font-size: 16px;
    font-weight: 700;
    color: #ffb800;
    font-variant-numeric: tabular-nums;
  }
  .potus-l1-bar {
    flex: 1;
    height: 3px;
    background: rgba(255,184,0,0.15);
    border-radius: 2px;
    overflow: hidden;
  }
  .potus-l1-fill {
    height: 100%;
    background: #ffb800;
    border-radius: 2px;
    transition: width 1s linear;
  }

  /* ── LEVEL 2 — SLIDING BANNER ── */
  .potus-l2 {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #1a0800, #2a1000, #1a0800);
    border-bottom: 3px solid #ff6600;
    padding: 12px 20px;
    z-index: 99999;
    pointer-events: all;
    animation: slideInDown 0.5s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 4px 40px rgba(255,102,0,0.4);
  }
  .potus-l2-inner {
    display: flex;
    align-items: center;
    gap: 14px;
    max-width: 100%;
  }
  .potus-l2-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: #1a0800;
    background: #ff6600;
    padding: 4px 12px;
    border-radius: 3px;
    white-space: nowrap;
    animation: pulseBadge 1.5s ease-in-out infinite;
  }
  .potus-l2-icon { font-size: 22px; flex-shrink: 0; }
  .potus-l2-msg {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: #ffa050;
    letter-spacing: 0.04em;
  }
  .potus-l2-warning {
    font-size: 11px;
    color: rgba(255,160,80,0.7);
    white-space: nowrap;
  }
  .potus-l2-close {
    font-size: 18px;
    color: rgba(255,102,0,0.6);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0 4px;
    flex-shrink: 0;
  }
  .potus-l2-close:hover { color: #ff6600; }
  .potus-l2-ticker {
    overflow: hidden;
    flex: 1;
  }
  .potus-l2-scroll {
    display: inline-flex;
    gap: 40px;
    animation: scrollTicker 20s linear infinite;
    white-space: nowrap;
  }

  /* ── LEVEL 3 — FULL SCREEN NUKE ── */
  .potus-l3 {
    position: fixed;
    inset: 0;
    background: rgba(6, 0, 0, 0.92);
    z-index: 99999;
    pointer-events: all;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: fadeInNuke 0.3s ease;
  }
  .potus-l3-border {
    position: absolute;
    inset: 0;
    border: 4px solid #ff1a00;
    animation: flashBorder 0.6s ease-in-out infinite;
    pointer-events: none;
  }
  .potus-l3-content {
    text-align: center;
    z-index: 1;
    padding: 40px;
    max-width: 700px;
  }
  .potus-l3-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.25em;
    color: #ff1a00;
    background: rgba(255,26,0,0.1);
    border: 2px solid rgba(255,26,0,0.5);
    padding: 6px 20px;
    border-radius: 4px;
    margin-bottom: 24px;
    animation: pulseBadge 1s ease-in-out infinite;
  }
  .potus-l3-bobble {
    font-size: 80px;
    margin-bottom: 16px;
    display: inline-block;
    animation: bobble 0.4s ease-in-out infinite alternate;
    filter: drop-shadow(0 0 20px rgba(255,100,0,0.8));
    transform-origin: bottom center;
  }
  .potus-l3-title {
    font-family: 'Orbitron', 'JetBrains Mono', monospace;
    font-size: clamp(24px, 4vw, 42px);
    font-weight: 900;
    color: #ff1a00;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
    text-shadow: 0 0 30px rgba(255,26,0,0.6);
  }
  .potus-l3-msg {
    font-size: clamp(14px, 2vw, 18px);
    color: #ffa090;
    line-height: 1.7;
    margin-bottom: 28px;
    letter-spacing: 0.03em;
  }
  .potus-l3-warning {
    font-size: 13px;
    color: rgba(255,160,144,0.6);
    margin-bottom: 28px;
    letter-spacing: 0.08em;
  }
  .potus-l3-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .potus-l3-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    padding: 12px 28px;
    border-radius: 4px;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }
  .potus-l3-dismiss {
    background: rgba(255,26,0,0.15);
    color: #ff6650;
    border: 1px solid rgba(255,26,0,0.4) !important;
    border: none;
  }
  .potus-l3-dismiss:hover { background: rgba(255,26,0,0.25); }
  .potus-l3-stay {
    background: rgba(255,184,0,0.12);
    color: #ffb800;
    border: 1px solid rgba(255,184,0,0.35) !important;
    border: none;
  }
  .potus-l3-static {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 99998;
    animation: staticNoise 0.1s steps(1) infinite;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  /* ── ANIMATIONS ── */
  @keyframes slideInRight {
    from { transform: translateX(120%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes slideInDown {
    from { transform: translateY(-100%); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }
  @keyframes fadeInNuke {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes bobble {
    from { transform: rotate(-8deg) scale(1.0); }
    to   { transform: rotate(8deg)  scale(1.1); }
  }
  @keyframes flashBorder {
    0%,100% { opacity: 1; box-shadow: inset 0 0 60px rgba(255,26,0,0.2), 0 0 60px rgba(255,26,0,0.4); }
    50%      { opacity: 0.4; box-shadow: inset 0 0 20px rgba(255,26,0,0.1); }
  }
  @keyframes pulseBadge {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.6; }
  }
  @keyframes scrollTicker {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes staticNoise {
    0%   { opacity: 0.02; }
    50%  { opacity: 0.05; }
    100% { opacity: 0.02; }
  }
  @keyframes slideOutRight {
    to { transform: translateX(120%); opacity: 0; }
  }
  @keyframes slideOutUp {
    to { transform: translateY(-100%); opacity: 0; }
  }
`;

const styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ── SCHEDULED EVENTS ─────────────────────────────────────────────
// Edit this list to add known POTUS events
// Times in CT (Central Time)
const SCHEDULED_EVENTS = [
  // Format: { hour, min, level, message, title }
  // Level 1 = heads up, Level 2 = tape bomb warning, Level 3 = nuke
  {
    hour: 9, min: 0, level: 1,
    title: 'SCHEDULED SPEECH',
    message: 'POTUS scheduled remarks at 10:00 AM ET. Market-moving comments possible. Consider reducing size ahead of open.',
    warnMinsBefore: 30,
  },
  {
    hour: 14, min: 30, level: 1,
    title: 'PRESS CONFERENCE',
    message: 'White House press briefing at 3:30 PM ET. Tariff or trade comments possible. Watch NQ and ES into the hour.',
    warnMinsBefore: 30,
  },
  // Add more as needed — examples:
  // { hour: 10, min: 0, level: 2, title: 'TRADE DEAL SIGNING', message: 'Live ceremony...', warnMinsBefore: 15 },
];

// ── BREAKING NEWS KEYWORDS ────────────────────────────────────────
// If any of these appear in a news headline, alert fires
const NUKE_KEYWORDS   = ['fed chair fired', 'fed chair removed', 'nuclear', 'emergency tariff', 'market circuit breaker', 'trading halt'];
const BOMB_KEYWORDS   = ['tariff', 'truth social', 'trade war', 'sanctions', 'executive order', 'potus says', 'trump says', 'president says'];
const HEADSUP_KEYWORDS= ['press conference', 'speech', 'remarks', 'rally', 'announcement'];

// ── STATE ────────────────────────────────────────────────────────
let activeAlert = null;
let countdownInterval = null;
let scheduledFired = new Set();

// ── PUBLIC API ───────────────────────────────────────────────────
window.POTUSAlert = {
  fire:    (level, message, title) => showAlert(level, message, title),
  dismiss: () => dismissAlert(),
  test:    (level) => testAlert(level),
};

// ── SHOW ALERT ───────────────────────────────────────────────────
function showAlert(level, message, title, countdownMins) {
  dismissAlert(); // clear any existing

  if (level === 1) showLevel1(message, title, countdownMins || 30);
  if (level === 2) showLevel2(message, title);
  if (level === 3) showLevel3(message, title);

  activeAlert = level;
  console.log(`[POTUSAlert] Level ${level} fired: ${message}`);
}

// ── LEVEL 1 — CORNER POPUP ───────────────────────────────────────
function showLevel1(message, title, countdownMins) {
  const el = document.createElement('div');
  el.className = 'potus-l1';
  el.id = 'potus-alert';
  const totalSecs = countdownMins * 60;
  let secs = totalSecs;

  el.innerHTML = `
    <div class="potus-l1-hdr">
      <span class="potus-l1-icon">⚠️</span>
      <span class="potus-l1-title">${title || 'HEADS UP'}</span>
      <button class="potus-l1-close" onclick="POTUSAlert.dismiss()" aria-label="Dismiss alert">✕</button>
    </div>
    <div class="potus-l1-msg">${message}</div>
    <div class="potus-l1-countdown">
      <span>Event in</span>
      <span class="potus-l1-timer" id="potus-timer">${fmtTime(secs)}</span>
      <div class="potus-l1-bar"><div class="potus-l1-fill" id="potus-fill" style="width:100%"></div></div>
    </div>`;

  document.body.appendChild(el);

  countdownInterval = setInterval(() => {
    secs--;
    const timerEl = document.getElementById('potus-timer');
    const fillEl  = document.getElementById('potus-fill');
    if (timerEl) timerEl.textContent = fmtTime(secs);
    if (fillEl)  fillEl.style.width  = (secs / totalSecs * 100) + '%';
    if (secs <= 0) {
      clearInterval(countdownInterval);
      // Escalate to Level 2 when countdown hits zero
      showAlert(2, message, '⚡ EVENT STARTING NOW');
    }
  }, 1000);
}

// ── LEVEL 2 — SLIDING BANNER ─────────────────────────────────────
function showLevel2(message, title) {
  const el = document.createElement('div');
  el.className = 'potus-l2';
  el.id = 'potus-alert';

  const scrollMsg = `${message}  ·  REDUCE POSITION SIZE  ·  WATCH FOR VOLATILITY  ·  ${message}  ·  REDUCE POSITION SIZE  ·  WATCH FOR VOLATILITY  ·  `;

  el.innerHTML = `
    <div class="potus-l2-inner">
      <span class="potus-l2-badge">📡 TAPE BOMB</span>
      <span class="potus-l2-icon">🇺🇸</span>
      <div class="potus-l2-ticker">
        <div class="potus-l2-scroll">${scrollMsg}${scrollMsg}</div>
      </div>
      <span class="potus-l2-warning">⚡ HIGH VOLATILITY RISK</span>
      <button class="potus-l2-close" onclick="POTUSAlert.dismiss()" aria-label="Dismiss alert">✕</button>
    </div>`;

  document.body.appendChild(el);

  // Auto-dismiss after 5 minutes
  setTimeout(() => {
    if (activeAlert === 2) dismissAlert();
  }, 5 * 60 * 1000);
}

// ── LEVEL 3 — FULL SCREEN NUKE ───────────────────────────────────
function showLevel3(message, title) {
  // Static noise layer
  const staticEl = document.createElement('div');
  staticEl.className = 'potus-l3-static';
  document.body.appendChild(staticEl);

  const el = document.createElement('div');
  el.className = 'potus-l3';
  el.id = 'potus-alert';

  el.innerHTML = `
    <div class="potus-l3-border"></div>
    <div class="potus-l3-content">
      <div class="potus-l3-badge">
        <span>🔴</span> MARKET NUKE ALERT <span>🔴</span>
      </div>
      <div class="potus-l3-bobble" role="img" aria-label="Alert bobblehead">🤠</div>
      <div class="potus-l3-title">${title || 'TAPE BOMB INCOMING'}</div>
      <div class="potus-l3-msg">${message}</div>
      <div class="potus-l3-warning">
        ⚠ EXTREME VOLATILITY POSSIBLE · CONSIDER FLAT OR REDUCED SIZE<br>
        FOR ENTERTAINMENT PURPOSES ONLY · NOT FINANCIAL ADVICE
      </div>
      <div class="potus-l3-actions">
        <button class="potus-l3-btn potus-l3-dismiss" onclick="POTUSAlert.dismiss()">
          ACKNOWLEDGE &amp; DISMISS
        </button>
        <button class="potus-l3-btn potus-l3-stay" onclick="POTUSAlert.dismiss()">
          GOT IT — BACK TO TERMINALS
        </button>
      </div>
    </div>`;

  document.body.appendChild(el);
}

// ── DISMISS ──────────────────────────────────────────────────────
function dismissAlert() {
  clearInterval(countdownInterval);
  const existing = document.getElementById('potus-alert');
  if (existing) {
    const cls = activeAlert === 1 ? 'slideOutRight' : activeAlert === 2 ? 'slideOutUp' : '';
    if (cls) {
      existing.style.animation = `${cls} 0.3s ease forwards`;
      setTimeout(() => existing.remove(), 300);
    } else {
      existing.remove();
    }
  }
  // Remove static noise
  document.querySelectorAll('.potus-l3-static').forEach(e => e.remove());
  activeAlert = null;
}

// ── TEST ALERTS ───────────────────────────────────────────────────
function testAlert(level) {
  const tests = {
    1: ['SCHEDULED PRESS CONFERENCE', 'POTUS press conference scheduled in 30 minutes at 10:00 AM ET. Tariff or trade comments possible. Monitor NQ and ES closely heading into the event.', 30],
    2: ['⚡ TAPE BOMB ALERT', 'Breaking: POTUS posted on Truth Social regarding new tariff package. Market reaction expected. NQ and ES futures moving.'],
    3: ['EMERGENCY MARKET ALERT', 'Breaking reports of major unexpected executive action. NQ futures moving sharply. Volatility extreme. Consider flat or minimal exposure until situation clarifies.'],
  };
  const t = tests[level];
  if (!t) return;
  showAlert(level, t[1], t[0], t[2]);
}

// ── SCHEDULED EVENT CHECKER ───────────────────────────────────────
function checkScheduledEvents() {
  const now = new Date();
  const h   = now.getHours();
  const m   = now.getMinutes();
  const tNow = h * 60 + m;

  SCHEDULED_EVENTS.forEach(evt => {
    const tEvent   = evt.hour * 60 + evt.min;
    const tWarn    = tEvent - (evt.warnMinsBefore || 30);
    const eventKey = `${evt.hour}:${evt.min}`;

    if (tNow === tWarn && !scheduledFired.has(eventKey + '-warn')) {
      scheduledFired.add(eventKey + '-warn');
      showAlert(1, evt.message, evt.title, evt.warnMinsBefore);
    }
    if (tNow === tEvent && !scheduledFired.has(eventKey + '-fire')) {
      scheduledFired.add(eventKey + '-fire');
      showAlert(2, evt.message, '⚡ ' + evt.title + ' — NOW LIVE');
    }
  });
}

// ── HELPERS ───────────────────────────────────────────────────────
function fmtTime(secs) {
  const m = String(Math.floor(Math.abs(secs) / 60)).padStart(2,'0');
  const s = String(Math.abs(secs) % 60).padStart(2,'0');
  return `${m}:${s}`;
}

// ── INIT ─────────────────────────────────────────────────────────
// Check scheduled events every minute
setInterval(checkScheduledEvents, 60000);
checkScheduledEvents();

console.log('[POTUSAlert] Loaded ✓ — Test: POTUSAlert.test(1), test(2), test(3)');

})();
