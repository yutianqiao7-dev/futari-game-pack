'use strict';
// ===== 共通の道具 =====
const $ = (s, r) => (r || document).querySelector(s);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { r = r || Math.random; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
const Games = {};

// ===== Blender で作った画像素材(docs/img/*.webp)。読みこみ前は従来の描画にもどる =====
const Img = (() => {
  const cache = {};
  function get(name) {
    let im = cache[name];
    if (!im) { im = cache[name] = new Image(); im.decoding = 'async'; im.src = 'img/' + name + '.webp'; }
    return im.complete && im.naturalWidth ? im : null;
  }
  // 先に読みこんでおく(ゲームを開いた瞬間に絵が出るように)
  ['hockey_table', 'hockey_mallet_blue', 'hockey_mallet_pink', 'hockey_puck', 'space_ship', 'space_turret', 'space_drone', 'space_heart', 'space_planet',
    'space_rock0', 'space_rock1', 'space_rock2', 'space_rock3', 'sea_water_mine', 'sea_water_enemy', 'escape_door', 'escape_orb_red', 'escape_orb_blue', 'escape_orb_yellow', 'escape_orb_green', 'escape_lever_up', 'escape_lever_dn', 'escape_lamp_off', 'escape_lamp_on'].forEach(get);
  return { get, url: name => 'img/' + name + '.webp' };
})();

// キャンバスを論理サイズ W×H で画面いっぱいに合わせる
function fitCanvas(cv, W, H) {
  const v = { s: 1 };
  function fit() {
    const p = cv.parentElement; if (!p) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const s = Math.min(p.clientWidth / W, p.clientHeight / H);
    cv.style.width = (W * s) + 'px'; cv.style.height = (H * s) + 'px';
    cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
    v.s = cv.width / W;
  }
  fit();
  window.addEventListener('resize', fit);
  v.off = () => window.removeEventListener('resize', fit);
  v.pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  return v;
}

// ===== 画面全体のエフェクト(紙ふぶき・火花・数字) =====
const FX = (() => {
  const cv = $('#fx'), c = cv.getContext('2d');
  let ps = [], run = false, last = 0, dpr = 1;
  function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  size(); window.addEventListener('resize', size);
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    ps = ps.filter(p => {
      p.t += dt; if (p.t < 0) return true; if (p.t >= p.life) return false;
      p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = 1 - p.t / p.life; c.globalAlpha = Math.min(1, k * 1.8);
      if (p.txt) {
        const sc = 1 + Math.max(0, 0.25 - p.t) * 2.4;
        c.font = '900 ' + (p.size * sc) + 'px "Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round';
        c.lineWidth = 6; c.strokeStyle = 'rgba(8,10,30,.75)'; c.strokeText(p.txt, p.x, p.y); c.fillStyle = p.color; c.fillText(p.txt, p.x, p.y);
      } else if (p.rect) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.t * 9 + p.rot)); c.fillStyle = p.color; c.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5); c.restore();
      } else if (p.ring) {
        c.strokeStyle = p.color; c.lineWidth = 4 * k + 0.5; c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k) + 2, 0, 7); c.stroke();
      } else {
        c.globalCompositeOperation = 'lighter'; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * k + 0.4, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
      }
      return true;
    });
    c.globalAlpha = 1;
    if (ps.length) requestAnimationFrame(loop); else run = false;
  }
  function kick() { if (!run) { run = true; last = performance.now(); requestAnimationFrame(loop); } }
  function add(p) { ps.push(Object.assign({ t: 0, life: 0.8, vx: 0, vy: 0, g: 0, drag: 0.98, rot: 0, vr: 0, size: 4, color: '#fff' }, p)); }
  return {
    at(e) { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    burst(x, y, o) {
      o = o || {}; const n = o.count || 18, cols = o.colors || ['#fff', '#ffd166', '#ff9f1c'];
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = rand(0.3, 1) * (o.speed || 260); add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), g: o.g == null ? 300 : o.g, life: rand(0.4, 1) * (o.life || 0.8), size: rand(0.5, 1) * (o.size || 5), color: cols[i % cols.length], drag: 0.96 }); }
      kick();
    },
    ring(x, y, color, size) { add({ x, y, ring: true, color: color || '#fff', size: size || 60, life: 0.55, drag: 1 }); kick(); },
    text(x, y, txt, color, size) { add({ x, y, txt, color: color || '#fff', size: size || 34, vy: -70, life: 1.2, drag: 0.97 }); kick(); },
    confetti() {
      const cols = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#b388ff', '#fff'];
      for (let i = 0; i < 130; i++) add({ x: rand(0, innerWidth), y: rand(-innerHeight * 0.5, -10), vx: rand(-60, 60), vy: rand(80, 260), g: 120, rect: true, size: rand(7, 13), color: cols[i % cols.length], life: rand(2.2, 4), rot: rand(0, 6), vr: rand(-5, 5), drag: 0.995, t: -rand(0, 0.6) });
      kick();
    },
    shake(e, cls) { cls = cls || 'shake'; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); setTimeout(() => e.classList.remove(cls), 600); },
    clear() { ps = []; }
  };
})();

// ===== 効果音とBGM(すべてその場で合成) =====
const Snd = (() => {
  let ac = null, master = null, bgmG = null, nbuf = null, timer = null, curTune = null;
  let muted = false; try { muted = localStorage.getItem('fp_mute') === '1'; } catch (e) {}
  function ctx() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ac = new C(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.85;
      const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
      bgmG = ac.createGain(); bgmG.gain.value = 0.28; bgmG.connect(master);
      nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ac;
  }
  function unlock() { const a = ctx(); if (a && a.state !== 'running') a.resume(); }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
  function tone(o) {
    const a = ctx(); if (!a) return; const t = o.t != null ? o.t : a.currentTime + (o.at || 0), d = o.d || 0.1;
    const osc = a.createOscillator(), g = a.createGain(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v || 0.2, t + (o.a || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(o.dest || master); osc.start(t); osc.stop(t + d + 0.03);
  }
  function noise(o) {
    const a = ctx(); if (!a) return; const t = o.t != null ? o.t : a.currentTime + (o.at || 0), d = o.d || 0.2;
    const src = a.createBufferSource(); src.buffer = nbuf; src.loop = true;
    const f = a.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.f || 1000, t); if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + d); f.Q.value = o.q || 0.8;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v || 0.25, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(o.dest || master); src.start(t, Math.random() * 0.5); src.stop(t + d + 0.03);
  }
  const N = n => 440 * Math.pow(2, n / 12);           // A4からの半音
  function arp(notes, step, o) { notes.forEach((n, i) => tone(Object.assign({ f: N(n), at: i * step, d: 0.22, type: 'triangle', v: 0.2 }, o || {}))); }
  const SFX = {
    tap() { tone({ f: 700, to: 980, d: 0.07, type: 'triangle', v: 0.16 }); },
    back() { tone({ f: 520, to: 300, d: 0.1, type: 'triangle', v: 0.16 }); },
    ok() { arp([3, 7, 10, 15], 0.07); },
    error() { tone({ f: 170, d: 0.22, type: 'square', v: 0.14 }); tone({ f: 127, d: 0.26, type: 'square', v: 0.14, at: 0.02 }); },
    start() { arp([-2, 3, 5, 10, 15], 0.08, { type: 'square', v: 0.11 }); noise({ f: 600, to: 6000, d: 0.5, v: 0.08, ft: 'bandpass' }); },
    join() { arp([3, 10, 15], 0.09, { v: 0.22 }); },
    win() { arp([3, 3, 3, 7, 10, 15], 0.11, { type: 'square', v: 0.12, d: 0.3 }); arp([-9, -2, 3], 0.22, { d: 0.6, v: 0.2 }); tone({ f: N(15), at: 0.66, d: 0.9, type: 'triangle', v: 0.2 }); },
    lose() { arp([3, 1, -2, -6, -9], 0.16, { type: 'triangle', d: 0.4, v: 0.18 }); },
    draw() { arp([3, 5, 3], 0.14, { d: 0.3 }); },
    count() { tone({ f: 523, d: 0.14, type: 'square', v: 0.13 }); },
    go() { tone({ f: 1046, d: 0.45, type: 'square', v: 0.14 }); tone({ f: 1568, d: 0.45, type: 'triangle', v: 0.12 }); },
    hit(s) { s = s == null ? 1 : s; noise({ f: 2400, ft: 'bandpass', d: 0.06, v: 0.25 * s + 0.08, q: 2 }); tone({ f: 420, to: 130, d: 0.09, type: 'triangle', v: 0.25 * s + 0.08 }); },
    wall() { tone({ f: 260, to: 170, d: 0.06, type: 'triangle', v: 0.14 }); noise({ f: 1500, ft: 'bandpass', d: 0.03, v: 0.07 }); },
    goal() { noise({ f: 300, to: 5000, d: 0.7, v: 0.16, ft: 'bandpass' }); arp([3, 7, 10, 15, 19], 0.07, { type: 'square', v: 0.12 }); },
    conceded() { tone({ f: 300, to: 90, d: 0.5, type: 'sawtooth', v: 0.13 }); },
    card() { noise({ f: 3500, ft: 'highpass', d: 0.09, v: 0.12 }); },
    select() { tone({ f: 880, d: 0.06, type: 'sine', v: 0.16 }); },
    flip() { noise({ f: 2500, ft: 'highpass', d: 0.07, v: 0.12 }); tone({ f: 900, to: 1300, d: 0.1, type: 'triangle', v: 0.12, at: 0.05 }); },
    clash() { noise({ f: 900, to: 90, d: 0.4, v: 0.4 }); tone({ f: 130, to: 45, d: 0.35, type: 'square', v: 0.18 }); },
    super() { arp([10, 15, 19, 22], 0.05, { type: 'square', v: 0.1 }); },
    dmg() { tone({ f: 240, to: 60, d: 0.3, type: 'sawtooth', v: 0.16 }); noise({ f: 700, to: 100, d: 0.25, v: 0.2 }); },
    heal() { arp([7, 10, 14, 19], 0.06, { type: 'sine', v: 0.18 }); },
    place() { tone({ f: 330, to: 250, d: 0.08, type: 'triangle', v: 0.18 }); },
    fire() { noise({ f: 400, to: 3000, d: 0.35, v: 0.14, ft: 'bandpass' }); tone({ f: 900, to: 300, d: 0.4, type: 'sine', v: 0.08 }); },
    splash() { noise({ f: 1400, to: 200, d: 0.6, v: 0.26 }); noise({ f: 5000, ft: 'highpass', d: 0.2, v: 0.08, at: 0.03 }); },
    boom() { noise({ f: 600, to: 50, d: 0.8, v: 0.5 }); tone({ f: 110, to: 30, d: 0.6, v: 0.4 }); },
    sink() { noise({ f: 500, to: 40, d: 1.3, v: 0.5 }); tone({ f: 200, to: 28, d: 1.2, type: 'sawtooth', v: 0.16 }); arp([3, -1, -4, -9], 0.2, { at: 0.2, d: 0.4, type: 'triangle', v: 0.12 }); },
    sonar() { tone({ f: 1250, d: 0.7, v: 0.13 }); tone({ f: 1250, d: 0.5, v: 0.05, at: 0.28 }); },
    cut() { noise({ f: 4000, ft: 'highpass', d: 0.05, v: 0.2 }); tone({ f: 1500, to: 600, d: 0.12, type: 'triangle', v: 0.15 }); },
    key() { tone({ f: 620, d: 0.06, type: 'square', v: 0.08 }); },
    rune() { tone({ f: N(3), d: 0.35, type: 'sine', v: 0.2 }); tone({ f: N(10), d: 0.35, type: 'sine', v: 0.1 }); },
    seal() { arp([-2, 3, 7, 10, 15, 19], 0.07, { type: 'sine', v: 0.2, d: 0.6 }); noise({ f: 6000, ft: 'highpass', d: 0.8, v: 0.05 }); },
    door() { noise({ f: 200, to: 80, d: 1.6, v: 0.5 }); tone({ f: 70, to: 45, d: 1.5, type: 'sawtooth', v: 0.14 }); },
    tick() { tone({ f: 1100, d: 0.03, type: 'square', v: 0.05 }); },
    alarm() { tone({ f: 880, d: 0.12, type: 'square', v: 0.1 }); tone({ f: 660, d: 0.12, type: 'square', v: 0.1, at: 0.14 }); },
    laser() { tone({ f: 1500, to: 380, d: 0.09, type: 'sawtooth', v: 0.07 }); },
    expl(s) { s = s || 1; noise({ f: 1200 * s, to: 70, d: 0.3 + 0.2 * s, v: 0.3 }); tone({ f: 150, to: 40, d: 0.3, v: 0.2 }); },
    hurt() { tone({ f: 260, to: 60, d: 0.5, type: 'square', v: 0.16 }); noise({ f: 800, to: 80, d: 0.5, v: 0.35 }); },
    ehit() { tone({ f: 900, to: 500, d: 0.04, type: 'square', v: 0.06 }); },
    eshot() { tone({ f: 500, to: 180, d: 0.14, type: 'square', v: 0.05 }); },
    power() { arp([3, 8, 12, 15, 20], 0.05, { type: 'square', v: 0.1 }); }
  };
  const _ = null;
  const TUNES = {
    menu: { bpm: 104, root: 220, wave: 'triangle', lv: 0.15, hat: 1,
      bass: [0, _, _, 0, _, _, 7, _, 5, _, _, 5, _, _, 7, _, -3, _, _, -3, _, _, 4, _, 5, _, _, 5, 7, _, 7, _],
      lead: [12, _, 16, _, 19, _, 16, _, 17, _, 21, _, 19, _, _, _, 12, _, 16, _, 19, _, 24, _, 21, _, 19, _, 16, 14, 12, _] },
    hockey: { bpm: 138, root: 196, wave: 'square', lv: 0.07, hat: 1, kick: 1,
      bass: [0, 0, _, 0, 0, _, 0, 3, 5, 5, _, 5, 5, _, 7, 5, -2, -2, _, -2, -2, _, -2, 0, 3, 3, _, 3, 5, _, 7, 10],
      lead: [12, _, _, 15, _, _, 17, _, 19, _, 17, _, 15, _, _, _, 10, _, _, 12, _, _, 15, _, 17, _, 19, _, 22, _, 19, _] },
    cards: { bpm: 92, root: 220, wave: 'triangle', lv: 0.14,
      bass: [0, _, _, _, 7, _, _, _, -4, _, _, _, 3, _, _, _, -2, _, _, _, 5, _, _, _, -5, _, _, _, 2, _, -1, _],
      lead: [12, _, 15, _, 19, _, _, 15, 20, _, 19, _, 15, _, _, _, 10, _, 14, _, 17, _, _, 14, 19, _, 17, _, 14, _, 11, _] },
    sea: { bpm: 84, root: 174.6, wave: 'sine', lv: 0.2, kick: 1,
      bass: [0, _, _, _, _, _, 0, _, -5, _, _, _, _, _, -5, _, -2, _, _, _, _, _, -2, _, -7, _, _, _, -5, _, -3, _],
      lead: [_, _, 12, _, _, 14, 15, _, _, _, 19, _, _, _, 17, _, _, _, 10, _, _, 12, 14, _, _, _, 15, _, 14, _, 12, _] },
    escape: { bpm: 116, root: 146.8, wave: 'square', lv: 0.05, hat: 1,
      bass: [0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 1, _, 0, _, -2, _, -2, _, -2, _, -2, _, 3, _, 3, _, 1, _, 1, _],
      lead: [24, _, _, _, 19, _, _, _, 25, _, _, _, 24, _, _, _, 22, _, _, _, 19, _, _, _, 27, _, 25, _, 24, _, 22, _] },
    space: { bpm: 150, root: 220, wave: 'square', lv: 0.065, hat: 1, kick: 1,
      bass: [0, _, 0, 12, 0, _, 0, 12, -4, _, -4, 8, -4, _, -4, 8, 3, _, 3, 15, 3, _, 3, 15, -2, _, -2, 10, -2, _, 2, 5],
      lead: [12, _, 19, _, 24, _, 19, _, 20, _, 24, _, 27, _, 24, _, 15, _, 22, _, 27, _, 22, _, 22, _, 26, _, 29, _, 26, 24] }
  };
  function stopBgm() { if (timer) { clearInterval(timer); timer = null; } curTune = null; }
  function bgm(name) {
    if (curTune === name) return; stopBgm();
    const a = ctx(), T = TUNES[name]; if (!a || !T) return; curTune = name;
    let step = 0, next = 0; const sp = 60 / T.bpm / 4;
    timer = setInterval(() => {
      if (a.state !== 'running') return;
      if (next < a.currentTime) next = a.currentTime + 0.06;
      while (next < a.currentTime + 0.3) {
        const i = step % 32, b = T.bass[i], l = T.lead[i];
        if (b != null) tone({ f: T.root / 2 * Math.pow(2, b / 12), t: next, d: sp * 1.9, type: 'triangle', v: 0.5, dest: bgmG });
        if (l != null) tone({ f: T.root * Math.pow(2, l / 12), t: next, d: sp * 1.7, type: T.wave, v: T.lv, dest: bgmG, a: 0.01 });
        if (T.hat && i % 2 === 0) noise({ f: 7000, ft: 'highpass', t: next, d: 0.04, v: i % 4 === 2 ? 0.12 : 0.05, dest: bgmG });
        if (T.kick && i % 4 === 0) tone({ f: 130, to: 40, t: next, d: 0.14, v: 0.6, dest: bgmG });
        step++; next += sp;
      }
    }, 70);
  }
  return {
    play(name, arg) { if (SFX[name]) { try { SFX[name](arg); } catch (e) {} } },
    bgm, stopBgm,
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('fp_mute', muted ? '1' : '0'); } catch (e) {} if (master) master.gain.value = muted ? 0 : 0.85; return muted; },
    vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  };
})();

// ===== 通信 =====
// 2つの方式: 'ws' = パソコンの中継サーバー(同じWi-Fi) / 'p2p' = スマホ同士が直接つながる(GitHub Pagesなど)
const Net = {
  ws: null, slot: -1, peers: 0, full: false, onSys: null, onMsg: null,
  mode: 'ws', room: '', ready: false, err: '', conn: null, peer: null, lastRecv: 0,
  sys() { if (this.onSys) this.onSys(); },
  connect(mode) { this.mode = mode || 'ws'; if (this.mode === 'p2p') this.connectP2P(); else this.connectWS(); },
  connectP2P() {
    const PRE = 'futari-pack-v1-', self = this;
    const join = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
    if (!window.Peer) { this.err = 'lib'; this.sys(); return; }
    function bind(c) {
      c.on('open', () => { self.conn = c; self.peers = 2; self.err = ''; self.full = false; self.lastRecv = Date.now(); self.sys(); });
      c.on('data', m => {
        self.lastRecv = Date.now(); if (!m || typeof m !== 'object') return;
        if (m.t === 'full') { self.full = true; self.sys(); } else if (m.t !== 'k' && self.onMsg) self.onMsg(m);
      });
      const gone = () => { if (self.conn === c) { self.conn = null; self.peers = 1; self.sys(); if (join) setTimeout(dial, 1500); } };
      c.on('close', gone); c.on('error', gone);
    }
    let dialing = null;
    function dial() {
      if (self.conn || !self.peer || self.peer.destroyed) return;
      if (self.peer.disconnected) { try { self.peer.reconnect(); } catch (e) {} setTimeout(dial, 2000); return; }
      if (dialing) { try { dialing.close(); } catch (e) {} }
      dialing = self.peer.connect(PRE + join, { reliable: true, serialization: 'json' }); bind(dialing);
    }
    function open(tries) {
      if (join) { self.slot = 1; self.room = join; }
      else {
        self.slot = 0; let code = ''; try { code = sessionStorage.getItem('fp_room') || ''; } catch (e) {}
        if (!/^\d{4}$/.test(code) || tries > 0) code = String(1000 + Math.floor(Math.random() * 9000));
        try { sessionStorage.setItem('fp_room', code); } catch (e) {}
        self.room = code;
      }
      const peer = join ? new Peer() : new Peer(PRE + self.room); self.peer = peer;
      peer.on('open', () => { self.ready = true; self.err = ''; self.sys(); if (join) dial(); });
      peer.on('connection', c => {
        if (self.conn && self.conn.open) { c.on('open', () => { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => c.close(), 500); }); return; }
        bind(c);
      });
      peer.on('disconnected', () => { setTimeout(() => { if (!peer.destroyed) { try { peer.reconnect(); } catch (e) {} } }, 1500); });
      peer.on('error', e => {
        if (e.type === 'unavailable-id') { peer.destroy(); open(tries + 1); return; }
        if (e.type === 'peer-unavailable') { self.err = 'noroom'; self.sys(); setTimeout(dial, 3000); return; }
        if (!self.conn) { self.err = 'net'; self.sys(); }
      });
    }
    open(0);
    // 相手が無言で消えたとき(スリープなど)に気づけるようにする
    setInterval(() => { if (self.conn && Date.now() - self.lastRecv > 12000) { try { self.conn.close(); } catch (e) {} } }, 3000);
  },
  connectWS() {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    this.ws = ws;
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hello') { this.slot = m.slot; this.full = false; }
      else if (m.t === 'peers') { this.peers = m.n; if (this.onSys) this.onSys(); }
      else if (m.t === 'full') { this.full = true; if (this.onSys) this.onSys(); }
      else if (m.t !== 'k' && this.onMsg) this.onMsg(m);
    };
    ws.onclose = () => { this.peers = 0; this.slot = -1; if (this.onSys) this.onSys(); setTimeout(() => this.connectWS(), this.full ? 3000 : 1000); };
    ws.onerror = () => {};
  },
  send(o) {
    if (this.mode === 'p2p') { if (this.conn && this.conn.open) { try { this.conn.send(o); } catch (e) {} } }
    else if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o));
  }
};
setInterval(() => Net.send({ t: 'k' }), 4000);
