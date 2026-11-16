'use strict';
// ===== かいせんバトル: 自分の盤面は自分の端末だけが知っている。撃たれた側が結果を返す =====
Games.sea = {
  start(env) {
    const N = 8, LENS = [4, 3, 3, 2, 2], PCT = 100 / N;
    function shipSVG(len, v) {
      const L = len * 100;
      let parts = `<path d="M6 50Q8 20 42 18H${L - 52}Q${L - 16} 24 ${L - 5} 50Q${L - 16} 76 ${L - 52} 82H42Q8 80 6 50Z" fill="url(#bsHull)" stroke="#1c2738" stroke-width="4" stroke-linejoin="round"/>
        <path d="M18 50Q20 30 46 29H${L - 56}Q${L - 30} 33 ${L - 20} 50Q${L - 30} 67 ${L - 56} 71H46Q20 70 18 50Z" fill="url(#bsDeck)"/>`;
      const mid = L / 2;
      parts += `<rect x="${mid - 26}" y="30" width="52" height="40" rx="8" fill="#e8eef5" stroke="#1c2738" stroke-width="3"/><rect x="${mid - 14}" y="38" width="28" height="24" rx="5" fill="#5b7fa6"/><circle cx="${mid}" cy="50" r="5" fill="#ffd166"/>`;
      const guns = len >= 4 ? [62, L - 78] : len === 3 ? [58, L - 74] : [L - 62];
      guns.forEach((gx, i) => { const dir = (len >= 3 && i === 0) ? -1 : 1; parts += `<rect x="${dir > 0 ? gx : gx - 34}" y="45" width="34" height="10" rx="4" fill="#3a4a60"/><circle cx="${gx}" cy="50" r="14" fill="#9fb0c4" stroke="#1c2738" stroke-width="3"/><circle cx="${gx - 3}" cy="47" r="4" fill="#fff" opacity=".6"/>`; });
      return v ? `<svg viewBox="0 0 100 ${L}" preserveAspectRatio="none"><g transform="matrix(0 1 1 0 0 0)">${parts}</g></svg>` : `<svg viewBox="0 0 ${L} 100" preserveAspectRatio="none">${parts}</svg>`;
    }
    function boardHTML() { let s = '<div class="bs-water"></div><div class="bs-grid">'; for (let i = 0; i < N * N; i++) s += `<i class="bs-cell" data-i="${i}"></i>`; return s + '</div><div class="bs-ships"></div><div class="bs-marks"></div>'; }

    env.root.innerHTML = `
      <svg width="0" height="0" style="position:absolute"><defs>
        <linearGradient id="bsHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset=".5" stop-color="#a8b6c8"/><stop offset="1" stop-color="#5d6d83"/></linearGradient>
        <linearGradient id="bsDeck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a36a"/><stop offset="1" stop-color="#8d6a3b"/></linearGradient>
      </defs></svg>
      <div class="bs">
        <div class="bs-status"></div>
        <div class="bs-tabs"><button data-v="enemy">てきの海</button><button data-v="mine">じぶんの海</button></div>
        <div class="bs-stage"><div class="bs-board mine">${boardHTML()}</div><div class="bs-board enemy">${boardHTML()}</div></div>
        <div class="bs-fleet"></div>
        <div class="bs-foot"></div>
      </div>`;
    const R = env.root, statusEl = $('.bs-status', R), bMine = $('.bs-board.mine', R), bEnemy = $('.bs-board.enemy', R), foot = $('.bs-foot', R), fleetEl = $('.bs-fleet', R), tabs = $('.bs-tabs', R), stage = $('.bs-stage', R);

    let ships = [], phase = 'place', myReady = false, oppReady = false, turn = '', pending = false, view = 'mine';
    const got = new Array(N * N).fill(0), shot = new Array(N * N).fill(0);   // 0:なし 1:はずれ 2:あたり
    const sunkEnemy = []; let mySunk = 0;
    const myFirst = (env.slot === 0) !== env.flip;

    const cellsOf = s => { const a = []; for (let k = 0; k < s.len; k++) a.push(s.v ? (s.y + k) * N + s.x : s.y * N + s.x + k); return a; };
    function valid(idx, x, y, v) {
      const s = ships[idx], len = s.len; if (x < 0 || y < 0 || (v ? x >= N || y + len > N : x + len > N || y >= N)) return false;
      const mine = cellsOf({ len, x, y, v });
      return !ships.some((o, j) => j !== idx && o.placed && cellsOf(o).some(c => mine.includes(c)));
    }
    function randomize() {
      ships = LENS.map(len => ({ len, x: 0, y: 0, v: false, hits: 0, placed: false }));
      ships.forEach((s, i) => { for (let t = 0; t < 500; t++) { const v = Math.random() < 0.5, x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N); if (valid(i, x, y, v)) { s.x = x; s.y = y; s.v = v; s.placed = true; break; } } });
    }
    function posShip(d, s) { d.style.left = s.x * PCT + '%'; d.style.top = s.y * PCT + '%'; d.style.width = (s.v ? 1 : s.len) * PCT + '%'; d.style.height = (s.v ? s.len : 1) * PCT + '%'; }
    function paintShips() {
      const layer = $('.bs-ships', bMine); layer.innerHTML = '';
      ships.forEach((s, i) => {
        const d = el('div', 'bs-ship' + (s.hits >= s.len ? ' sunk' : ''), shipSVG(s.len, s.v)); d.dataset.i = i; posShip(d, s); layer.appendChild(d);
        if (phase === 'place' && !myReady) dragify(d, i);
      });
    }
    function dragify(d, i) {
      d.classList.add('movable');
      let sx, sy, ox, oy, moved, id = null;
      d.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; try { d.setPointerCapture(id); } catch (x) {} sx = e.clientX; sy = e.clientY; ox = ships[i].x; oy = ships[i].y; moved = false; d.classList.add('drag'); });
      d.addEventListener('pointermove', e => {
        if (id !== e.pointerId) return; const cs = bMine.clientWidth / N, s = ships[i];
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > cs * 0.3) moved = true;
        const nx = clamp(ox + Math.round((e.clientX - sx) / cs), 0, N - (s.v ? 1 : s.len)), ny = clamp(oy + Math.round((e.clientY - sy) / cs), 0, N - (s.v ? s.len : 1));
        if ((nx !== s.x || ny !== s.y) && valid(i, nx, ny, s.v)) { s.x = nx; s.y = ny; posShip(d, s); Snd.play('place'); }
      });
      const end = e => {
        if (id !== e.pointerId) return; id = null; d.classList.remove('drag');
        if (moved) return;
        const s = ships[i], nv = !s.v;
        for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1], [-2, 0], [0, -2], [-3, 0], [0, -3], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
          const nx = clamp(s.x + dx, 0, N - (nv ? 1 : s.len)), ny = clamp(s.y + dy, 0, N - (nv ? s.len : 1));
          if (valid(i, nx, ny, nv)) { s.x = nx; s.y = ny; s.v = nv; Snd.play('place'); paintShips(); return; }
        }
        Snd.play('error'); FX.shake(d);
      };
      d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
    }
    function setView(v) { view = v; bMine.classList.toggle('on', v === 'mine'); bEnemy.classList.toggle('on', v === 'enemy'); tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }
    function setStatus(t, cls) { statusEl.textContent = t; statusEl.className = 'bs-status ' + (cls || ''); }
    function paintFleet() {
      const row = (label, arr) => `<div class="bs-frow"><span>${label}</span>${arr.map(o => `<b class="${o.dead ? 'dead' : ''}" style="--n:${o.len}"></b>`).join('')}</div>`;
      const en = LENS.map(len => ({ len, dead: false })); sunkEnemy.forEach(s => { const o = en.find(o => o.len === s.len && !o.dead); if (o) o.dead = true; });
      fleetEl.innerHTML = row('てき', en) + row('じぶん', ships.map(s => ({ len: s.len, dead: s.hits >= s.len })));
    }
    function mark(board, i, kind) {
      const m = el('i', 'bs-mark ' + kind); m.style.left = (i % N) * PCT + '%'; m.style.top = Math.floor(i / N) * PCT + '%'; $('.bs-marks', board).appendChild(m); return m;
    }
    function boomAt(board, i, hit) {
      const p = FX.at(board.querySelector(`.bs-cell[data-i="${i}"]`));
      if (hit) { Snd.play('boom'); Snd.vibrate(90); FX.shake(stage); FX.burst(p.x, p.y, { count: 40, speed: 380, colors: ['#fff', '#ffd166', '#ff7b00', '#ff3d00'], size: 7 }); FX.ring(p.x, p.y, '#ffb703', 70); }
      else { Snd.play('splash'); FX.burst(p.x, p.y, { count: 26, speed: 240, up: 160, colors: ['#fff', '#caf0f8', '#90e0ef'], size: 5, g: 700 }); FX.ring(p.x, p.y, '#caf0f8', 50); }
    }

    // --- じゅんび ---
    function placeUI() {
      setStatus('艦隊をならべよう', 'hot'); tabs.style.visibility = 'hidden'; setView('mine');
      foot.innerHTML = `<p class="bs-hint">ドラッグで移動 ・ タップで向きをかえる</p><div class="bs-btns"><button class="btn" data-a="shuffle">シャッフル</button><button class="btn primary" data-a="ready">じゅんびOK!</button></div>`;
      foot.onclick = e => {
        const a = e.target.dataset && e.target.dataset.a; if (!a || myReady) return;
        if (a === 'shuffle') { Snd.play('card'); randomize(); paintShips(); }
        else { myReady = true; Snd.play('ok'); env.send({ t: 'br' }); paintShips(); foot.innerHTML = '<p class="bs-hint">じゅんびOK!</p>'; setStatus(oppReady ? '' : 'あいてのじゅんびを待っています…'); tryStart(); }
      };
    }
    function tryStart() {
      if (!(myReady && oppReady) || phase !== 'place') return;
      phase = 'battle'; tabs.style.visibility = 'visible'; foot.innerHTML = ''; paintFleet(); Snd.play('sonar');
      setStatus('せんとう かいし!', 'hot');
      env.later(() => setTurn(myFirst ? 'me' : 'opp'), 1100);
    }
    function setTurn(t) {
      if (phase !== 'battle') return; turn = t; pending = false;
      if (t === 'me') { setView('enemy'); setStatus('あなたのターン! ねらうマスをタップ', 'good'); Snd.play('select'); }
      else { setView('mine'); setStatus('あいてのターン…'); }
    }
    tabs.addEventListener('click', e => { const v = e.target.dataset && e.target.dataset.v; if (v) { Snd.play('tap'); setView(v); } });

    // --- こうげき ---
    bEnemy.addEventListener('click', e => {
      const c = e.target.closest('.bs-cell'); if (!c || phase !== 'battle' || turn !== 'me' || pending) return;
      const i = +c.dataset.i; if (shot[i]) { Snd.play('error'); return; }
      pending = true; shot[i] = 3; mark(bEnemy, i, 'aim'); Snd.play('fire'); setStatus('はっしゃ!', 'hot'); env.send({ t: 'bs', i });
    });
    function finish(win) {
      phase = 'over'; setStatus(win ? 'てきの艦隊を ぜんめつさせた!' : '艦隊が ぜんめつ…', win ? 'good' : 'bad');
      env.later(() => env.result({ kind: win ? 'win' : 'lose', title: win ? 'かち!' : 'まけ…', sub: win ? 'みごとな ねらいうち!' : 'つぎは しずめてやろう' }), 1700);
    }

    randomize(); paintShips(); placeUI();
    return {
      msg(m) {
        if (m.t === 'br') { oppReady = true; if (myReady) tryStart(); else UI.toast('あいては じゅんびOK!'); }
        else if (m.t === 'bs') {                      // 撃たれた
          const i = m.i, s = ships.find(s => cellsOf(s).includes(i)); let sunk = null, all = false;
          if (s) { s.hits++; got[i] = 2; if (s.hits >= s.len) { sunk = { len: s.len, x: s.x, y: s.y, v: s.v }; mySunk++; all = ships.every(o => o.hits >= o.len); } } else got[i] = 1;
          env.send({ t: 'bx', i, h: s ? 1 : 0, s: sunk, o: all });
          setView('mine'); const aim = mark(bMine, i, 'aim'); Snd.play('fire');
          env.later(() => {
            aim.remove(); mark(bMine, i, s ? 'hit' : 'miss'); boomAt(bMine, i, !!s);
            if (sunk) { Snd.play('sink'); paintShips(); setStatus('艦がしずめられた!', 'bad'); } else setStatus(s ? 'めいちゅうされた!' : 'はずれた! たすかった', s ? 'bad' : 'good');
            paintFleet();
            if (all) finish(false); else env.later(() => setTurn('me'), 1400);
          }, 650);
        }
        else if (m.t === 'bx') {                      // 自分の攻撃の結果
          const i = m.i;
          env.later(() => {
            const a = bEnemy.querySelector('.bs-mark.aim'); if (a) a.remove();
            shot[i] = m.h ? 2 : 1; mark(bEnemy, i, m.h ? 'hit' : 'miss'); boomAt(bEnemy, i, !!m.h);
            if (m.s) {
              sunkEnemy.push(m.s); const d = el('div', 'bs-ship sunk reveal', shipSVG(m.s.len, m.s.v)); posShip(d, m.s); $('.bs-ships', bEnemy).appendChild(d);
              Snd.play('sink'); const p = FX.at(d); FX.text(p.x, p.y, 'げきちん!', '#ffd166', 40); setStatus('げきちん!', 'good');
            } else setStatus(m.h ? 'めいちゅう!' : 'はずれ…', m.h ? 'good' : '');
            paintFleet();
            if (m.o) { env.send({ t: 'bf', ships: ships.filter(s => s.hits < s.len).map(s => ({ len: s.len, x: s.x, y: s.y, v: s.v })) }); finish(true); }
            else env.later(() => setTurn('opp'), 1400);
          }, 650);
        }
        else if (m.t === 'bf') {                      // 負けたあと、相手の残りの艦を見せてもらう
          (m.ships || []).forEach(s => { const d = el('div', 'bs-ship ghost', shipSVG(s.len, s.v)); posShip(d, s); $('.bs-ships', bEnemy).appendChild(d); });
          env.later(() => setView('enemy'), 600);
        }
      }
    };
  }
};
