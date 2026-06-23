/**
 * FORECAST OS — Terminal Data Client v1.0
 * ─────────────────────────────────────────
 * Drop this <script> tag into any terminal HTML file:
 *
 *   <script src="data-client.js"></script>
 *
 * Then set your VPS IP once at the top of your terminal's
 * <script> block:
 *
 *   window.FORECAST_OS_BRIDGE = 'ws://74.208.136.23:3001';
 *
 * That's it. The client connects, receives real prices,
 * and updates the terminal UI automatically.
 * Falls back to simulated data if bridge is unreachable.
 */

(function() {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────
  const BRIDGE_WS   = window.FORECAST_OS_BRIDGE || 'ws://74.208.136.23:3001';
  const BRIDGE_REST = BRIDGE_WS.replace('ws://', 'http://').replace('wss://', 'https://');
  const RECONNECT_MS = 5000;
  const STALE_MS     = 120000; // 2 min — mark data stale if no update

  // ── STATE ─────────────────────────────────────────────────────
  let ws            = null;
  let connected     = false;
  let reconnectTimer = null;
  let staleTimers   = {};
  const liveData    = {};
  const listeners   = {};

  // ── PUBLIC API ────────────────────────────────────────────────
  window.ForecastOSData = {

    // Register a callback for when a symbol updates
    // Usage: ForecastOSData.on('NQ1', (data) => { ... })
    on(sym, callback) {
      if (!listeners[sym]) listeners[sym] = [];
      listeners[sym].push(callback);
      // Fire immediately if we already have data
      if (liveData[sym]) callback(liveData[sym]);
    },

    // Get latest data for a symbol (sync)
    get(sym) {
      return liveData[sym] || null;
    },

    // Is the bridge connected?
    isConnected() { return connected; },

    // Is data live (not stale)?
    isLive(sym) {
      const d = liveData[sym];
      if (!d) return false;
      return (Date.now() - d.receivedTs) < STALE_MS;
    },
  };

  // ── EMIT TO LISTENERS ─────────────────────────────────────────
  function emit(sym, data) {
    liveData[sym] = data;
    if (listeners[sym]) {
      listeners[sym].forEach(cb => { try { cb(data); } catch(e) {} });
    }
    // Also emit to wildcard listeners
    if (listeners['*']) {
      listeners['*'].forEach(cb => { try { cb(sym, data); } catch(e) {} });
    }
    updateStatusIndicator(true, sym);

    // Stale timer — mark stale if no update within STALE_MS
    clearTimeout(staleTimers[sym]);
    staleTimers[sym] = setTimeout(() => {
      updateStatusIndicator(false, sym, 'stale');
    }, STALE_MS);
  }

  // ── STATUS INDICATOR ──────────────────────────────────────────
  // Updates the live dot and timestamp in the terminal header
  function updateStatusIndicator(isLive, sym, reason) {
    // Timestamp
    const tsEl = document.getElementById('timestamp');
    if (tsEl && isLive) {
      const d = liveData[sym];
      if (d) {
        const t = new Date(d.receivedTs);
        tsEl.textContent = t.toLocaleTimeString('en-US', {
          hour:'2-digit', minute:'2-digit', second:'2-digit'
        }) + '  CT  |  LIVE';
      }
    }

    // Live dot color
    const dot = document.querySelector('.live-dot');
    if (dot) {
      dot.style.background = isLive
        ? (reason === 'stale' ? 'var(--amber)' : 'var(--bull)')
        : 'var(--bear)';
    }

    // Data source badge
    const disc = document.getElementById('disclaimer');
    if (disc && isLive && reason !== 'stale') {
      disc.textContent = `LIVE CME DATA VIA TRADINGVIEW · FORECAST OS v1.0 · NOT FINANCIAL ADVICE`;
      disc.style.color = 'rgba(0,255,148,0.4)';
    }
  }

  // ── APPLY PRICE DATA TO TERMINAL UI ──────────────────────────
  // Called when we receive a price update for the currently displayed symbol
  function applyToTerminal(data) {
    if (!data) return;

    const dec = (data.sym === 'MCL1' || data.sym === 'SI1') ? 3 : 2;
    const fmt = (n, d) => parseFloat(n).toLocaleString('en-US', {
      minimumFractionDigits: d || dec,
      maximumFractionDigits: d || dec
    });

    // Header price + change
    const pxEl  = document.getElementById('priceDisplay');
    const chgEl = document.getElementById('chgBadge');
    if (pxEl)  pxEl.textContent = fmt(data.px);
    if (chgEl) {
      const pct   = parseFloat(data.chgPct);
      const isUp  = pct >= 0;
      chgEl.textContent = (isUp ? '+' : '') + pct.toFixed(2) + '%';
      chgEl.className   = 'chg-badge ' + (isUp ? 'chg-up' : 'chg-down');
    }

    // Metrics strip
    safe('fcHi',  fmt(parseFloat(data.px) + parseFloat(data.atr) * 1.28));
    safe('fcLo',  fmt(parseFloat(data.px) - parseFloat(data.atr) * 1.28));
    safe('rng',   fmt(parseFloat(data.atr) * 2.56) + ' pts');
    safe('atrVal', fmt(data.atr) + ' pts');

    // Volume signal
    const volEl = document.getElementById('volSig');
    if (volEl) {
      const ratio = parseFloat(data.volRatio);
      volEl.textContent = ratio > 1.2
        ? 'HIGH +' + Math.round((ratio - 1) * 100) + '%'
        : ratio < 0.8 ? 'LOW ' + Math.round((1 - ratio) * 100) + '%'
        : 'NORMAL';
      volEl.style.color = ratio > 1.2 ? 'var(--amber)' : 'var(--bull)';
    }

    // Bias score
    const biasEl = document.getElementById('biasScore');
    if (biasEl) {
      biasEl.textContent = data.bias;
      biasEl.style.color = data.bias === 'BULLISH' ? 'var(--bull)'
                         : data.bias === 'BEARISH' ? 'var(--bear)'
                         : 'var(--amber)';
    }

    // Bias bars
    const bull = parseInt(data.bullPct) || 50;
    const bear = parseInt(data.bearPct) || 30;
    const neu  = Math.max(0, 100 - bull - bear);
    setBar('bullBar', 'bullPct', bull, bull + '%');
    setBar('bearBar', 'bearPct', bear, bear + '%');
    setBar('neuBar',  'neuPct',  neu,  neu  + '%');

    // Key levels from real pivot data
    const levelsEl = document.getElementById('levelsPanel');
    if (levelsEl && data.pivot) {
      const levels = [
        { tag:'R3', val: data.r3, cls:'lv-res' },
        { tag:'R2', val: data.r2, cls:'lv-res' },
        { tag:'R1', val: data.r1, cls:'lv-res' },
        { tag:'POC',val: data.vwap, cls:'lv-poc' },
        { tag:'PVT',val: data.pivot, cls:'lv-pvt' },
        { tag:'S1', val: data.s1, cls:'lv-sup' },
        { tag:'S2', val: data.s2, cls:'lv-sup' },
        { tag:'S3', val: data.s3, cls:'lv-sup' },
      ];
      levelsEl.innerHTML = levels.map(l =>
        `<div class="level-row">
          <span class="lv-tag">${l.tag}</span>
          <span class="${l.cls}">${fmt(l.val)}</span>
        </div>`
      ).join('');
    }

    // Confluence checklist — real signals
    const confEl = document.getElementById('confPanel');
    if (confEl) {
      const px   = parseFloat(data.px);
      const items = [
        { txt: `Price ${px > data.vwap ? 'above' : 'below'} VWAP (${fmt(data.vwap)})`, bull: px > parseFloat(data.vwap) },
        { txt: `${data.ma20 > data.ma50 ? '20MA > 50MA (bull cross)' : '50MA > 20MA (bear cross)'}`, bull: parseFloat(data.ma20) > parseFloat(data.ma50) },
        { txt: `RSI 14: ${parseFloat(data.rsi).toFixed(1)} ${parseFloat(data.rsi) > 70 ? '— Overbought' : parseFloat(data.rsi) < 30 ? '— Oversold' : '— Neutral'}`, bull: parseFloat(data.rsi) > 50 && parseFloat(data.rsi) < 70 },
        { txt: `Volume ratio: ${parseFloat(data.volRatio).toFixed(2)}x 20D avg`, bull: parseFloat(data.volRatio) > 1.0 },
        { txt: `Price ${px > parseFloat(data.ma200) ? 'above' : 'below'} 200MA (${fmt(data.ma200)})`, bull: px > parseFloat(data.ma200) },
        { txt: `MACD ${parseFloat(data.macd) > 0 ? 'positive — momentum up' : 'negative — momentum down'}`, bull: parseFloat(data.macd) > 0 },
      ];
      confEl.innerHTML = items.map(i =>
        `<div class="conf-line ${i.bull ? 'conf-bull' : 'conf-bear'}">${i.bull ? '▲' : '▼'} ${i.txt}</div>`
      ).join('');
    }

    // TF cards — real signals
    const isUp = parseFloat(data.chgPct) >= 0;
    const tfUpdates = [
      { sig: data.bias,    cls: clsFor(data.bias),     detail: `Open ${isUp ? 'gap up' : 'gap down'}` },
      { sig: parseFloat(data.px) > parseFloat(data.vwap) ? 'LONG BIAS' : 'SHORT BIAS',
        cls: parseFloat(data.px) > parseFloat(data.vwap) ? 'sig-bull' : 'sig-bear',
        detail: `VWAP ${parseFloat(data.px) > parseFloat(data.vwap) ? 'reclaim' : 'rejection'}` },
      { sig: parseFloat(data.ma20) > parseFloat(data.ma50) ? 'BULLISH' : 'BEARISH',
        cls: parseFloat(data.ma20) > parseFloat(data.ma50) ? 'sig-bull' : 'sig-bear',
        detail: 'MA trend direction' },
      { sig: parseFloat(data.px) > parseFloat(data.ma200) ? 'BULLISH' : 'BEARISH',
        cls: parseFloat(data.px) > parseFloat(data.ma200) ? 'sig-bull' : 'sig-bear',
        detail: `${parseFloat(data.px) > parseFloat(data.ma200) ? 'Above' : 'Below'} 200MA` },
      { sig: parseFloat(data.rsi) > 70 ? 'CAUTION' : parseFloat(data.rsi) < 30 ? 'OVERSOLD' : data.bias,
        cls: parseFloat(data.rsi) > 70 || parseFloat(data.rsi) < 30 ? 'sig-neu' : clsFor(data.bias),
        detail: `RSI ${parseFloat(data.rsi).toFixed(0)}` },
      { sig: 'MACRO',    cls: 'sig-neu', detail: 'See morning briefing' },
    ];
    tfUpdates.forEach((t, i) => {
      const el = document.getElementById('tf' + i);
      if (el) { el.textContent = t.sig; el.className = 'tf-signal ' + t.cls; }
      const dd = document.getElementById('tf' + i + 'd');
      if (dd) dd.textContent = t.detail;
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────
  function safe(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  function setBar(barId, pctId, pct, label) {
    const bar = document.getElementById(barId);
    const lbl = document.getElementById(pctId);
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = label;
  }
  function clsFor(bias) {
    return bias === 'BULLISH' ? 'sig-bull' : bias === 'BEARISH' ? 'sig-bear' : 'sig-neu';
  }

  // ── WEBSOCKET CONNECTION ───────────────────────────────────────
  function connect() {
    if (ws && ws.readyState === WebSocket.CONNECTING) return;

    console.log('[ForecastOS] Connecting to bridge:', BRIDGE_WS);
    ws = new WebSocket(BRIDGE_WS);

    ws.onopen = () => {
      connected = true;
      clearTimeout(reconnectTimer);
      console.log('[ForecastOS] Bridge connected ✓');
      updateStatusIndicator(true);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'snapshot') {
          // Initial snapshot — load all symbols
          Object.entries(msg.data).forEach(([sym, data]) => {
            if (data) emit(sym, data);
          });
        } else if (msg.type === 'price_update') {
          emit(msg.sym, msg.data);
          // If this symbol matches what's currently displayed, apply it
          if (window.currentSymbol && msg.sym.startsWith(window.currentSymbol)) {
            applyToTerminal(msg.data);
          }
        }
      } catch(err) {
        console.error('[ForecastOS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      connected = false;
      console.warn('[ForecastOS] Bridge disconnected — reconnecting in 5s...');
      reconnectTimer = setTimeout(connect, RECONNECT_MS);
    };

    ws.onerror = () => {
      // Will trigger onclose which handles reconnect
    };
  }

  // ── FALLBACK POLL ─────────────────────────────────────────────
  // If WebSocket fails, poll the REST endpoint every 30s
  async function pollFallback(sym) {
    if (connected) return; // WS is working, skip
    try {
      const resp = await fetch(`${BRIDGE_REST}/latest/${sym}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.data) {
          emit(sym, json.data);
          if (window.currentSymbol && sym.startsWith(window.currentSymbol)) {
            applyToTerminal(json.data);
          }
        }
      }
    } catch(e) {
      // Bridge unreachable — simulated data stays active
    }
  }

  // ── INIT ──────────────────────────────────────────────────────
  // Start WS connection after DOM loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }

  // Fallback poll every 30s
  setInterval(() => {
    if (!connected && window.currentSymbol) {
      pollFallback(window.currentSymbol + '1');
    }
  }, 30000);

  console.log('[ForecastOS] Data client loaded — bridge:', BRIDGE_WS);

})();
