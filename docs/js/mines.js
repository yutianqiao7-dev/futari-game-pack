'use strict';
// ===== 地雷原しかけ合い: 自分の盤に地雷をかくし、相手の盤を掘る。安全なマス1つ=1点。
//   開くのは掘ったマスだけ(数字はまわりの地雷の数)。掘るのは何回でも続けられるが、地雷を踏むとそのターンの点は0。先に15点ためたほうの勝ち =====
Games.mines = {
  start(env) {
    const N = 6, CELLS = N * N, MINES = 7, GOAL = 15;
    const myFirst = env.host ? !env.flip : env.flip;
    const nb = i => { const x = i % N, y = Math.floor(i / N), a = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < N && Y < N) a.push(Y * N + X); } return a; };

    const mine = new Array(CELLS).fill(false);          // 自分の盤の地雷
    const myOpen = new Array(CELLS).fill(-1);           // 自分の盤で相手が開けたマス(数字)。-2 = 踏まれた地雷
    const opView = new Array(CELLS).fill(-1);           // 相手の盤: -1 かくれ / 0〜8 数字 / -2 地雷
    const flag = new Array(CELLS).fill(false);
    let phase = 'setup', ready = [false, false], turn = myFirst ? 0 : 1, bank = [0, 0], tp = [0, 0], waiting = false, flagMode = false, over = false, oppMines = null;

    const cellHTML = i => `<button class="mn-c" data-i="${i}"></button>`;
    env.root.innerHTML = `<div class="mn">
      <div class="mn-score"><div class="mn-who opp"><span>あいて</span><b>0</b><em></em></div><div class="mn-goal">${GOAL}点先取</div><div class="mn-who me"><span>じぶん</span><b>0</b><em></em></div></div>
      <div class="mn-msg">自分の盤に 地雷を${MINES}こ かくそう</div>
      <div class="mn-big"><div class="mn-grid big">${[...Array(CELLS).keys()].map(cellHTML).join('')}</div></div>
      <div class="mn-foot">
        <div class="mn-minewrap"><small>じぶんの盤</small><div class="mn-grid mini">${[...Array(CELLS).keys()].map(i => `<i data-i="${i}"></i>`).join('')}</div></div>
        <div class="mn-btns">
          <button class="btn small mn-rand">ランダムにおく</button>
          <button class="btn primary mn-ok" disabled>じゅんびOK</button>
          <button class="btn small mn-flag" hidden>旗モード</button>
          <button class="btn primary mn-bank" hidden disabled>ここでやめて<br>得点にする</button>
        </div>
      </div>
    </div>`;
    const R = env.root, big = $('.mn-grid.big', R), mini = $('.mn-grid.mini', R), msgEl = $('.mn-msg', R),
      okBtn = $('.mn-ok', R), randBtn = $('.mn-rand', R), flagBtn = $('.mn-flag', R), bankBtn = $('.mn-bank', R);
    const setMsg = (t, cls) => { msgEl.textContent = t; msgEl.className = 'mn-msg ' + (cls || ''); };
    const bomb = `<img src="${Img.url('mn_bomb')}" alt="地雷" draggable="false">`, flagImg = `<img src="${Img.url('mn_flag')}" alt="旗" draggable="false">`;

    function paintBig() {
      big.querySelectorAll('.mn-c').forEach(b => {
        const i = +b.dataset.i;
        if (phase === 'setup') { b.className = 'mn-c' + (mine[i] ? ' set' : ''); b.innerHTML = mine[i] ? bomb : ''; return; }
        const v = opView[i];
        if (v === -2) { b.className = 'mn-c open boom'; b.innerHTML = bomb; }
        else if (v >= 0) { b.className = 'mn-c open n' + v; b.innerHTML = v ? v : ''; }
        else if (oppMines && oppMines.includes(i)) { b.className = 'mn-c reveal'; b.innerHTML = bomb; }
        else { b.className = 'mn-c' + (flag[i] ? ' flagged' : ''); b.innerHTML = flag[i] ? flagImg : ''; }
      });
      big.classList.toggle('myturn', phase === 'play' && turn === 0 && !over);
    }
    function paintMini() {
      mini.querySelectorAll('i').forEach(c => {
        const i = +c.dataset.i, v = myOpen[i];
        c.className = (mine[i] ? 'm ' : '') + (v === -2 ? 'boom' : v >= 0 ? 'open' : '');
        c.textContent = v > 0 ? v : '';
      });
    }
    function paintTop() {
      $('.mn-who.me b', R).textContent = bank[0]; $('.mn-who.opp b', R).textContent = bank[1];
      $('.mn-who.me em', R).textContent = tp[0] ? 'このターン +' + tp[0] : '';
      $('.mn-who.opp em', R).textContent = tp[1] ? 'このターン +' + tp[1] : '';
      $('.mn-who.me', R).classList.toggle('on', phase === 'play' && turn === 0); $('.mn-who.opp', R).classList.toggle('on', phase === 'play' && turn === 1);
      bankBtn.disabled = !(phase === 'play' && turn === 0 && tp[0] > 0 && !waiting && !over);
      flagBtn.classList.toggle('on', flagMode);
    }
    function paintAll() { paintBig(); paintMini(); paintTop(); }

    // --- じゅんび: 地雷をおく ---
    function setCount() { const n = mine.filter(Boolean).length; okBtn.disabled = n !== MINES; setMsg(n === MINES ? 'これでよければ「じゅんびOK」' : `自分の盤に 地雷を${MINES}こ かくそう(あと ${MINES - n}こ)`); }
    randBtn.addEventListener('click', () => {
      if (phase !== 'setup' || ready[0]) return; mine.fill(false);
      shuffle([...Array(CELLS).keys()]).slice(0, MINES).forEach(i => mine[i] = true); Snd.play('place'); paintAll(); setCount();
    });
    okBtn.addEventListener('click', () => {
      if (okBtn.disabled || ready[0]) return; ready[0] = true; Snd.play('ok');
      okBtn.disabled = true; randBtn.disabled = true; env.send({ t: 'mready' });
      if (ready[1]) begin(); else setMsg('あいての じゅんびを待っています…');
    });
    function begin() {
      phase = 'play'; okBtn.hidden = true; randBtn.hidden = true; flagBtn.hidden = false; bankBtn.hidden = false;
      R.querySelector('.mn').classList.add('playing'); Snd.play('start'); paintAll(); turnMsg();
    }
    function turnMsg() {
      if (over) return;
      if (turn === 0) { setMsg(tp[0] ? `+${tp[0]}点! まだ掘る? それとも得点にする?` : 'あなたの番: 相手の盤を掘ろう', 'hot'); }
      else setMsg('あいての番: あなたの盤を掘っています…');
    }

    big.addEventListener('click', e => {
      const b = e.target.closest('.mn-c'); if (!b) return; const i = +b.dataset.i;
      if (phase === 'setup') {
        if (ready[0]) return;
        if (!mine[i] && mine.filter(Boolean).length >= MINES) { Snd.play('error'); FX.shake(b); return; }
        mine[i] = !mine[i]; Snd.play(mine[i] ? 'place' : 'back'); paintAll(); setCount(); return;
      }
      if (over || turn !== 0 || waiting || opView[i] !== -1) return;
      if (flagMode) { flag[i] = !flag[i]; Snd.play('select'); paintBig(); return; }
      if (flag[i]) { Snd.play('error'); FX.shake(b); UI.toast('旗をはずしてから掘ろう'); return; }
      waiting = true; Snd.play('tap'); b.classList.add('dig'); env.send({ t: 'mo', i }); paintTop();
    });
    flagBtn.addEventListener('click', () => { flagMode = !flagMode; Snd.play('tap'); paintTop(); });
    bankBtn.addEventListener('click', () => {
      if (bankBtn.disabled) return; doBank(0); env.send({ t: 'me' });
    });

    // 掘られたマスの結果を自分の盤で計算する(開くのは そのマスだけ。まわりの地雷の数を返す)
    function dig(i) {
      if (mine[i]) return { b: 1, c: [i, -2] };
      return { b: 0, c: [i, nb(i).filter(j => mine[j]).length] };
    }
    function apply(view, c) { for (let k = 0; k < c.length; k += 2) view[c[k]] = c[k + 1]; }
    function afterBoom(who) {
      tp[who] = 0; turn = 1 - who; paintAll();
      env.later(turnMsg, 900);
    }
    function doBank(who) {
      bank[who] += tp[who]; const got = tp[who]; tp[who] = 0; turn = 1 - who;
      Snd.play(who === 0 ? 'heal' : 'card');
      const p = FX.at($(who === 0 ? '.mn-who.me b' : '.mn-who.opp b', R)); if (got) FX.text(p.x, p.y, '+' + got, who === 0 ? '#ffd166' : '#ff8fa8', 36);
      paintAll();
      if (bank[who] >= GOAL) return finish(who === 0);
      turnMsg();
    }
    function finish(iWon) {
      over = true; paintAll(); setMsg(iWon ? 'かち! 15点たまった!' : 'あいてが 15点ためた…', iWon ? 'good' : 'bad');
      env.send({ t: 'mf', m: mine.map((v, i) => v ? i : -1).filter(i => i >= 0) });
      env.later(() => env.result({ kind: iWon ? 'win' : 'lose', title: iWon ? 'かち!' : 'まけ…', sub: `じぶん ${bank[0]}点 ・ あいて ${bank[1]}点`, peek: true }), 1800);
    }

    function onMsg(m) {
      if (m.t === 'mready') { ready[1] = true; if (ready[0]) begin(); else if (phase === 'setup') UI.toast('あいては じゅんびできたよ'); }
      else if (m.t === 'mo') {           // 相手が自分の盤を掘った
        const r = dig(m.i); env.send({ t: 'mr', i: m.i, b: r.b, c: r.c });
        apply(myOpen, r.c);
        if (r.b) { Snd.play('boom'); setMsg('あいては地雷をふんだ! このターンの点は0', 'good'); FX.shake(mini); afterBoom(1); }
        else { tp[1] += r.c.length / 2; Snd.play('place'); paintAll(); }
      }
      else if (m.t === 'mr') {           // 自分が掘った結果
        waiting = false; apply(opView, m.c);
        const b = big.querySelector(`[data-i="${m.i}"]`);
        if (m.b) {
          paintBig(); Snd.play('boom'); Snd.vibrate(200); FX.shake(big);
          const p = FX.at(b); FX.burst(p.x, p.y, { count: 40, speed: 420, colors: ['#fff', '#ffd166', '#ff7b00', '#d00000'] }); boomFx(b);
          setMsg('地雷をふんだ! このターンの点は0…', 'bad'); afterBoom(0);
        } else {
          const n = m.c.length / 2; tp[0] += n; Snd.play(n > 1 ? 'super' : 'place');
          const p = FX.at(b); FX.text(p.x, p.y, '+' + n, '#ffd166', 28); if (n > 1) FX.burst(p.x, p.y, { count: 14, colors: ['#fff', '#b9f18c'] });
          paintAll();
          if (bank[0] + tp[0] >= GOAL) { doBank(0); env.send({ t: 'me' }); } else turnMsg();
        }
      }
      else if (m.t === 'me') doBank(1);
      else if (m.t === 'mf') { oppMines = m.m; paintBig(); }
    }
    function boomFx(b) {
      const e = el('img', 'mn-ex'); e.src = Img.url('mn_explosion'); const r = b.getBoundingClientRect();
      e.style.left = (r.left + r.width / 2) + 'px'; e.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(e);
      setTimeout(() => e.remove(), 800);
    }
    paintAll(); setCount();
    return { msg: onMsg };
  }
};
