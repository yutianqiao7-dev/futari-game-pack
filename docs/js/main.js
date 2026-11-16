'use strict';
// ===== メニューと全体の流れ =====
const ICONS = {
  hockey: `<svg viewBox="0 0 120 120"><defs>
    <radialGradient id="ihA" cx=".35" cy=".3"><stop offset="0" stop-color="#e8fbff"/><stop offset=".45" stop-color="#4cc9f0"/><stop offset="1" stop-color="#023e8a"/></radialGradient>
    <radialGradient id="ihB" cx=".35" cy=".3"><stop offset="0" stop-color="#ffe3ee"/><stop offset=".45" stop-color="#ff5d8f"/><stop offset="1" stop-color="#7a0b3a"/></radialGradient>
    <radialGradient id="ihP" cx=".4" cy=".3"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#e07a00"/></radialGradient></defs>
    <path d="M22 20h76l14 84H8z" fill="#0d2b52" stroke="#7ee8fa" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M15 62h90" stroke="#7ee8fa" stroke-width="1.5" opacity=".7"/><ellipse cx="60" cy="62" rx="17" ry="7" fill="none" stroke="#7ee8fa" stroke-width="1.5" opacity=".7"/>
    <path d="M46 20h28" stroke="#ff5d8f" stroke-width="5" stroke-linecap="round"/><path d="M40 104h40" stroke="#4cc9f0" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="62" cy="36" rx="12" ry="6" fill="url(#ihB)"/><ellipse cx="62" cy="33" rx="6" ry="3.4" fill="#ffd9e6"/>
    <path d="M70 70l14-12M66 76l20-8" stroke="#ffd166" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="60" cy="74" rx="9" ry="4.6" fill="url(#ihP)"/>
    <ellipse cx="44" cy="92" rx="16" ry="8" fill="url(#ihA)"/><ellipse cx="44" cy="87" rx="8" ry="4.4" fill="#d9f7ff"/></svg>`,
  cards: `<svg viewBox="0 0 120 120"><defs>
    <linearGradient id="icF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#d62828"/></linearGradient>
    <linearGradient id="icW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ee8fa"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
    <linearGradient id="icG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9f18c"/><stop offset="1" stop-color="#1b8a4b"/></linearGradient></defs>
    <g transform="rotate(-18 60 110)"><rect x="34" y="22" width="50" height="72" rx="7" fill="url(#icW)" stroke="#fff" stroke-width="2.5"/><path d="M59 40c9 12 13 18 13 25a13 13 0 0 1-26 0c0-7 4-13 13-25z" fill="#e6fbff" opacity=".9"/></g>
    <g transform="rotate(16 60 110)"><rect x="36" y="22" width="50" height="72" rx="7" fill="url(#icG)" stroke="#fff" stroke-width="2.5"/><path d="M46 74c0-22 12-32 30-34c0 24-10 34-30 34z" fill="#f1ffe2" opacity=".9"/></g>
    <rect x="35" y="20" width="50" height="74" rx="7" fill="url(#icF)" stroke="#fff" stroke-width="2.5"/>
    <path d="M60 34c3 10 14 15 14 29a14 14 0 0 1-28 0c0-8 5-11 6-18c4 3 6 6 6 10c3-6 3-13 2-21z" fill="#fff3c4"/>
    <circle cx="55" cy="64" r="2.4" fill="#7a1c00"/><circle cx="65" cy="64" r="2.4" fill="#7a1c00"/></svg>`,
  sea: `<svg viewBox="0 0 120 120"><defs>
    <linearGradient id="isS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe7ef"/><stop offset="1" stop-color="#7b8ba1"/></linearGradient>
    <linearGradient id="isW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#48cae4"/><stop offset="1" stop-color="#023e8a"/></linearGradient></defs>
    <path d="M50 30h6v-12h4v12h10v14H44z" fill="#c9d3df"/><rect x="38" y="42" width="40" height="14" rx="2" fill="#eef3f8"/>
    <path d="M30 50l-14-6" stroke="#9fb0c4" stroke-width="5" stroke-linecap="round"/><rect x="26" y="46" width="13" height="10" rx="3" fill="#b4c2d2"/>
    <path d="M6 56h108l-12 26H22z" fill="url(#isS)"/><path d="M6 56h108l-3 7H10z" fill="#fff" opacity=".55"/>
    <circle cx="48" cy="49" r="2" fill="#3a86ff"/><circle cx="58" cy="49" r="2" fill="#3a86ff"/><circle cx="68" cy="49" r="2" fill="#3a86ff"/>
    <path d="M0 84q10-9 20 0t20 0t20 0t20 0t20 0t20 0v36H0z" fill="url(#isW)"/>
    <path d="M0 96q10-8 20 0t20 0t20 0t20 0t20 0t20 0" fill="none" stroke="#caf0f8" stroke-width="2.5" opacity=".7"/>
    <g fill="#ffd166"><path d="M96 16l3 9l9 1l-7 6l3 9l-8-5l-8 5l3-9l-7-6l9-1z"/></g></svg>`,
  escape: `<svg viewBox="0 0 120 120"><defs>
    <linearGradient id="ieD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d6e4c"/><stop offset="1" stop-color="#3e2a1a"/></linearGradient>
    <radialGradient id="ieG" cx=".5" cy=".5"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient></defs>
    <path d="M22 108V48a38 38 0 0 1 76 0v60z" fill="#2a2140" stroke="#bfa26a" stroke-width="4"/>
    <path d="M30 108V50a30 30 0 0 1 60 0v58z" fill="url(#ieD)"/><path d="M60 22v86" stroke="#2a1a0e" stroke-width="2.5"/>
    <circle cx="60" cy="62" r="20" fill="url(#ieG)"/><circle cx="60" cy="62" r="11" fill="#2a1a0e" stroke="#ffd166" stroke-width="2.5"/>
    <path d="M60 55a4 4 0 0 1 2.5 7.2l1.5 6.8h-8l1.5-6.8A4 4 0 0 1 60 55z" fill="#ffd166"/>
    <g fill="#ffd166"><circle cx="42" cy="92" r="3"/><circle cx="60" cy="96" r="3"/><circle cx="78" cy="92" r="3"/></g></svg>`,
  pilot: `<svg viewBox="0 0 120 120"><defs>
    <linearGradient id="ipB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa9c7"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#8090b0"/></linearGradient>
    <linearGradient id="ipF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ff9f1c"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></linearGradient></defs>
    <g fill="#fff"><circle cx="16" cy="20" r="1.6"/><circle cx="100" cy="34" r="1.3"/><circle cx="24" cy="70" r="1.2"/><circle cx="104" cy="84" r="1.6"/><circle cx="84" cy="12" r="1"/></g>
    <g transform="rotate(18 60 60)"><path d="M52 88h16l-3 26h-10z" fill="url(#ipF)"/>
    <path d="M60 10c12 14 16 36 14 62H46c-2-26 2-48 14-62z" fill="url(#ipB)"/>
    <path d="M46 56L22 84l4 8l22-10zM74 56l24 28l-4 8l-22-10z" fill="#ef476f"/>
    <ellipse cx="60" cy="40" rx="7" ry="11" fill="#1d3557"/><ellipse cx="58" cy="36" rx="3" ry="5" fill="#7ee8fa" opacity=".8"/>
    <rect x="50" y="72" width="20" height="10" rx="3" fill="#5c677d"/></g>
    <path d="M92 20l10-10M96 30l14-6" stroke="#80ffdb" stroke-width="3.5" stroke-linecap="round"/></svg>`
};
const META = [
  { id: 'hockey', title: 'エアホッケー', tag: '対戦', desc: 'はじいて、きめろ! 7点先取のスピード勝負', tune: 'hockey', c1: '#0ea5e9', c2: '#312e81' },
  { id: 'cards', title: 'エレメントデュエル', tag: '対戦', desc: '炎・水・草の読みあいカードバトル', tune: 'cards', c1: '#f97316', c2: '#7c2d12' },
  { id: 'sea', title: 'かいせんバトル', tag: '対戦', desc: 'かくれた艦隊を ねらいうち!', tune: 'sea', c1: '#06b6d4', c2: '#1e3a8a' },
  { id: 'escape', title: '封印のとびら', tag: '協力', desc: '声をかけあって 3つの封印をとけ!', tune: 'escape', c1: '#d4a24c', c2: '#4a2c12' },
  { id: 'pilot', title: 'ふたりで宇宙船', tag: '協力', desc: 'そうじゅう と しゃげき を分担して生きのこれ', tune: 'pilot_', c1: '#8b5cf6', c2: '#1e1b4b' }
];
META[4].tune = 'space';

const UI = {
  show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); },
  toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('on'), 2400); },
  modal(html) { const m = $('#modal'); m.innerHTML = '<div class="modal-card glass">' + html + '</div>'; m.classList.add('on'); return m.firstChild; },
  closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; }
};

let cur = null, curId = null, curFlip = false, inPlay = false;
const params = new URLSearchParams(location.search);
const guideMode = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !params.has('play');

function stopGame() {
  if (cur) { cur.env.alive = false; cur.env._timers.forEach(clearTimeout); try { if (cur.stop) cur.stop(); } catch (e) { console.error(e); } cur = null; }
  FX.clear(); UI.closeModal();
}
function toMenu() { stopGame(); inPlay = true; UI.show('s-menu'); Snd.bgm('menu'); $('#me-badge').textContent = (Net.slot + 1) + 'P'; $('#me-badge').className = 'badge p' + Net.slot; }
function begin(id, flip) { const m = { t: 'start', game: id, seed: (Math.random() * 2147483647) | 0, flip: !!flip }; Net.send(m); startGame(m); }
function requestGame(id) {
  if (Net.peers < 2) return;
  if (Net.slot === 0) begin(id, id === curId ? !curFlip : Math.random() < 0.5); else Net.send({ t: 'req', game: id });
}
function startGame(m) {
  const meta = META.find(g => g.id === m.game); if (!meta || !Games[m.game]) return;
  stopGame(); curId = m.game; curFlip = m.flip; inPlay = true;
  UI.show('s-game'); $('#game-title').textContent = meta.title;
  const root = $('#game-root'); root.innerHTML = ''; root.className = 'game-root g-' + m.game;
  Snd.play('start'); Snd.bgm(meta.tune);
  const env = {
    root, host: Net.slot === 0, slot: Net.slot, seed: m.seed, flip: m.flip, alive: true, _timers: [],
    send: o => Net.send(o),
    later(fn, ms) { const id = setTimeout(() => { if (env.alive) fn(); }, ms); env._timers.push(id); return id; },
    rematch() { requestGame(curId); },
    quit() { Net.send({ t: 'quit' }); Snd.play('back'); toMenu(); },
    // 結果表示: kind = win / lose / draw / clear / fail
    result(o) {
      const good = o.kind === 'win' || o.kind === 'clear';
      Snd.stopBgm(); Snd.play(good ? 'win' : o.kind === 'draw' ? 'draw' : 'lose');
      if (good) { FX.confetti(); Snd.vibrate([60, 40, 120]); }
      const c = UI.modal(`<div class="res res-${o.kind}"><div class="res-title">${o.title}</div>${o.sub ? `<div class="res-sub">${o.sub}</div>` : ''}${o.extra || ''}
        <div class="res-btns"><button class="btn primary" data-a="again">もう一度</button><button class="btn" data-a="menu">メニューへ</button></div>
        <div class="res-wait"></div></div>`);
      c.addEventListener('click', e => {
        const a = e.target.dataset && e.target.dataset.a; if (!a) return;
        Snd.play('tap');
        if (a === 'again') { env.rematch(); if (!env.host) $('.res-wait', c).textContent = 'リクエストを送りました…'; }
        else env.quit();
      });
    }
  };
  cur = Games[m.game].start(env) || {}; cur.env = env;
}

// --- メニューを組み立てる ---
(function buildMenu() {
  const list = $('#menu-list');
  META.forEach((g, i) => {
    const b = el('button', 'gcard', `<span class="gcard-ic">${ICONS[g.id]}</span><span class="gcard-tx"><span class="gcard-tag ${g.tag === '協力' ? 'coop' : 'vs'}">${g.tag}</span><b>${g.title}</b><small>${g.desc}</small></span><span class="gcard-go">▶</span>`);
    b.style.setProperty('--c1', g.c1); b.style.setProperty('--c2', g.c2); b.style.animationDelay = (i * 70) + 'ms';
    b.addEventListener('click', () => { Snd.play('tap'); requestGame(g.id); });
    list.appendChild(b);
  });
  const paintMute = () => document.querySelectorAll('#mute-btn,#mute-btn2').forEach(b => { b.innerHTML = Snd.muted
    ? '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; });
  document.querySelectorAll('#mute-btn,#mute-btn2').forEach(b => b.addEventListener('click', () => { Snd.toggle(); paintMute(); Snd.play('tap'); }));
  paintMute();
  $('#back-btn').addEventListener('click', () => {
    Snd.play('tap');
    const c = UI.modal(`<div class="res"><div class="res-sub big">メニューにもどりますか?</div><div class="res-btns"><button class="btn primary" data-a="y">もどる</button><button class="btn" data-a="n">つづける</button></div></div>`);
    c.addEventListener('click', e => { const a = e.target.dataset && e.target.dataset.a; if (a === 'y') { UI.closeModal(); if (cur) cur.env.quit(); else toMenu(); } else if (a === 'n') { Snd.play('tap'); UI.closeModal(); } });
  });
})();

// --- QRコードとURLの表示 ---
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
function showQR(qrEl, url, size) {
  qrEl.innerHTML = '';
  if (window.QRCode) { try { new QRCode(qrEl, { text: url, width: size, height: size, colorDark: '#0b1030', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); } catch (e) {} }
}
function lanURL() { return fetch('/info').then(r => r.json()).then(info => 'http://' + ((LOCAL ? info.ips[0] : location.hostname) || location.hostname) + ':' + info.port); }

// --- ゲーム中のメッセージ(どちらの通信方式でも共通) ---
function wireMessages() {
  Net.onMsg = m => {
    if (m.t === 'start') startGame(m);
    else if (m.t === 'req') { if (Net.slot === 0) begin(m.game, m.game === curId ? !curFlip : Math.random() < 0.5); }
    else if (m.t === 'quit') { if (cur) { toMenu(); UI.toast('メニューにもどりました'); } }
    else if (cur && cur.msg) { try { cur.msg(m); } catch (e) { console.error(e); } }
  };
}
function lostPeer() { if (inPlay) UI.toast('相手とのせつぞくが切れました'); stopGame(); inPlay = false; Snd.stopBgm(); UI.show('s-wait'); }
function gotPeer() { if (!inPlay) { toMenu(); Snd.play('join'); UI.toast('2台がつながりました!'); } }

// --- 方式1: パソコンの中継サーバー(同じWi-Fi) ---
function bootWS() {
  if (guideMode) {
    UI.show('s-guide'); lanURL().then(url => { $('#guide-url').textContent = url; showQR($('#guide-qr'), url, 240); }).catch(() => {});
    setInterval(() => fetch('/info').then(r => r.json()).then(i => {
      const s = $('#guide-status'); s.textContent = i.players >= 2 ? '2台つながりました! スマホであそんでね' : 'せつぞく待ち… ' + i.players + ' / 2'; s.classList.toggle('ok', i.players >= 2);
    }).catch(() => {}), 1500);
    return;
  }
  UI.show('s-wait'); $('#wait-hint').textContent = 'もう1台のスマホで、同じアドレスをひらいてね';
  lanURL().then(url => { $('#wait-url').textContent = url; showQR($('#wait-qr'), url, 150); }).catch(() => { $('#wait-url').textContent = location.origin; });
  Net.onSys = () => {
    if (Net.full) { stopGame(); inPlay = false; UI.show('s-wait'); $('#wait-msg').textContent = 'いま2人があそんでいます。あくまで待ってね'; return; }
    if (Net.peers >= 2) gotPeer();
    else { lostPeer(); $('#wait-msg').textContent = Net.slot < 0 ? 'サーバーにつないでいます…' : 'もう1台をさがしています…'; }
  };
  wireMessages(); Net.connect('ws');
}

// --- 方式2: スマホ同士が直接つながる(GitHub Pages など。あいことばで部屋に入る) ---
function bootP2P() {
  const msg = $('#wait-msg'), hint = $('#wait-hint'), roomEl = $('#wait-room'), qrEl = $('#wait-qr'), form = $('#join-form'), fresh = $('#wait-new');
  const keep = params.has('p2p') ? '&p2p=1' : '';
  let qrFor = '';
  fresh.href = location.pathname + (keep ? '?p2p=1' : '');
  function paintWait() {
    roomEl.hidden = true; form.hidden = true; fresh.hidden = true; qrEl.style.display = 'none'; hint.textContent = '';
    if (Net.err === 'lib') { msg.textContent = '通信の部品を読みこめませんでした'; hint.textContent = 'インターネットにつないで、ページを読みこみ直してね'; return; }
    if (Net.slot === 1) {
      fresh.hidden = false;
      if (Net.full) { msg.textContent = 'この部屋は もう2人であそんでいます'; return; }
      if (Net.err === 'noroom') { msg.textContent = 'あいことば「' + Net.room + '」の部屋が見つかりません'; hint.textContent = '相手の画面のあいことばを たしかめてね(さがしつづけています)'; }
      else msg.textContent = 'あいことば「' + Net.room + '」の部屋に つないでいます…';
      return;
    }
    if (!Net.ready) { msg.textContent = Net.err === 'net' ? 'つながりません。電波をたしかめてね' : '部屋をつくっています…'; return; }
    const url = location.origin + location.pathname + '?room=' + Net.room + keep;
    msg.textContent = 'もう1台を まっています…'; roomEl.hidden = false; $('#wait-code').textContent = Net.room; form.hidden = false; qrEl.style.display = '';
    hint.textContent = 'もう1台でQRコードを読むか、同じページをひらいて あいことばを入れてね';
    if (qrFor !== url) { qrFor = url; showQR(qrEl, url, 150); }
  }
  form.addEventListener('submit', e => {
    e.preventDefault(); const code = $('#join-code').value.replace(/\D/g, '');
    if (code.length !== 4) { Snd.play('error'); FX.shake(form); return; }
    location.href = location.pathname + '?room=' + code + keep;
  });
  UI.show('s-wait'); $('#wait-url').textContent = '';
  Net.onSys = () => { if (Net.peers >= 2) gotPeer(); else { lostPeer(); paintWait(); } };
  wireMessages(); Net.connect('p2p'); paintWait();
}

// /info に答えるサーバーがあれば方式1、なければ方式2
(params.has('p2p') || params.has('room') ? Promise.resolve(null) : fetch('/info').then(r => r.ok ? r.json() : null).catch(() => null))
  .then(i => { if (i && i.port) bootWS(); else bootP2P(); });

// 遊んでいる間は画面が消えないようにする(対応している端末のみ)
(function keepAwake() {
  let lock = null;
  const ask = () => { if (!navigator.wakeLock || lock || document.visibilityState !== 'visible') return; navigator.wakeLock.request('screen').then(l => { lock = l; l.addEventListener('release', () => { lock = null; }); }).catch(() => {}); };
  window.addEventListener('pointerdown', ask, { passive: true }); document.addEventListener('visibilitychange', ask);
})();
// 画面の誤操作(拡大・引っぱり更新)を止める
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
