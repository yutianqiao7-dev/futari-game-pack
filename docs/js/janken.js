'use strict';
// ===== 心理戦じゃんけん: 勝った手で点数がちがう。同じ手は続けて出せない。ダブルは1回だけ =====
Games.janken = {
  start(env) {
    const GOAL = 15, MAXR = 12, TIME = 10;
    const HN = ['グー', 'チョキ', 'パー'], PTS = [3, 2, 5], IMG = ['jk_rock', 'jk_scissors', 'jk_paper'];
    const beats = (a, b) => (a === 0 && b === 1) || (a === 1 && b === 2) || (a === 2 && b === 0);
    const hand = (h, cls) => `<img class="jk-hand ${cls || ''}" src="${Img.url(IMG[h])}" alt="${HN[h]}" draggable="false">`;

    env.root.innerHTML = `<div class="jk">
      <div class="jk-score opp"><span>あいて</span><b>0</b><i class="jk-dbl">ダブル</i></div>
      <div class="jk-arena">
        <div class="jk-slot opp"><div class="jk-q">?</div></div>
        <div class="jk-mid"><span class="jk-round">ラウンド 1</span><span class="jk-msg">手をえらぼう</span><span class="jk-rule">${GOAL}点先取 ・ 同じ手は続けて出せない</span></div>
        <div class="jk-slot me"></div>
      </div>
      <div class="jk-timer"><i></i></div>
      <div class="jk-hands">${[0, 1, 2].map(h => `<button class="jk-btn" data-h="${h}">${hand(h)}<b>${HN[h]}</b><small>勝つと <em>${PTS[h]}</em> 点</small><span class="jk-ng">連続NG</span></button>`).join('')}</div>
      <div class="jk-row"><button class="btn jk-dblbtn">ダブル <small>(1回だけ・点数2倍)</small></button><button class="btn primary jk-go" disabled>これで勝負!</button></div>
      <div class="jk-score me"><span>じぶん</span><b>0</b><i class="jk-dbl">ダブル</i></div>
    </div>`;
    const R = env.root, msgEl = $('.jk-msg', R), goBtn = $('.jk-go', R), dblBtn = $('.jk-dblbtn', R), bar = $('.jk-timer i', R),
      slotMe = $('.jk-slot.me', R), slotOp = $('.jk-slot.opp', R), arena = $('.jk-arena', R);

    let score = [0, 0], round = 1, sel = -1, dbl = false, dblUsed = [false, false], prev = -1;
    let myPick = null, oppLocked = false, oppPick = null, sent = false, busy = false, over = false, left = TIME, queue = [];

    function setMsg(t, cls) { msgEl.textContent = t; msgEl.className = 'jk-msg ' + (cls || ''); }
    function paint() {
      $('.jk-score.me b', R).textContent = score[0]; $('.jk-score.opp b', R).textContent = score[1];
      $('.jk-score.me .jk-dbl', R).classList.toggle('used', dblUsed[0]); $('.jk-score.opp .jk-dbl', R).classList.toggle('used', dblUsed[1]);
      R.querySelectorAll('.jk-btn').forEach(b => {
        const h = +b.dataset.h; b.classList.toggle('sel', h === sel); b.classList.toggle('ng', h === prev);
        b.disabled = h === prev || !!myPick || busy || over;
      });
      dblBtn.classList.toggle('on', dbl); dblBtn.disabled = dblUsed[0] || !!myPick || busy || over;
      goBtn.disabled = sel < 0 || !!myPick || busy || over;
    }
    R.querySelector('.jk-hands').addEventListener('click', e => {
      const b = e.target.closest('.jk-btn'); if (!b || b.disabled) return;
      const h = +b.dataset.h; if (sel === h) { lock(); return; }
      sel = h; Snd.play('select'); paint();
    });
    dblBtn.addEventListener('click', () => { if (dblBtn.disabled) return; dbl = !dbl; Snd.play(dbl ? 'power' : 'back'); paint(); });
    goBtn.addEventListener('click', lock);

    function lock() {
      if (sel < 0 || myPick || busy || over) return;
      myPick = { h: sel, d: dbl }; Snd.play('card');
      slotMe.innerHTML = `<div class="jk-q mine">${dbl ? '<i>×2</i>' : ''}?</div>`;
      setMsg(oppLocked ? '' : 'あいてを待っています…'); env.send({ t: 'jp' }); paint(); check();
    }
    function check() {
      if (myPick && oppLocked && !sent) { sent = true; env.send({ t: 'jr', h: myPick.h, d: myPick.d ? 1 : 0 }); }
      if (myPick && oppPick && !busy) resolve();
    }
    // 時間切れ: えらんでいる手、なければ出せる手からランダム
    const tick = setInterval(() => {
      if (!env.alive) return clearInterval(tick);
      if (myPick || busy || over) return;
      left -= 0.1; bar.style.width = Math.max(0, left / TIME * 100) + '%'; bar.classList.toggle('low', left < 3);
      if (left < 3 && Math.abs(left - Math.round(left)) < 0.05) Snd.play('tick');
      if (left <= 0) {
        if (sel < 0) { const ok = [0, 1, 2].filter(h => h !== prev); sel = ok[Math.floor(Math.random() * ok.length)]; }
        UI.toast('時間切れ! ' + HN[sel] + ' を出しました'); lock();
      }
    }, 100);

    function resolve() {
      busy = true; paint();
      const a = myPick, b = oppPick;
      setMsg('じゃん', 'hot'); Snd.play('count');
      slotMe.innerHTML = hand(0, 'shake'); slotOp.innerHTML = hand(0, 'shake opp');
      env.later(() => { setMsg('けん', 'hot'); Snd.play('count'); }, 380);
      env.later(() => {
        setMsg('ぽん!', 'hot'); Snd.play('clash'); FX.shake(arena);
        slotMe.innerHTML = hand(a.h, 'pop') + (a.d ? '<i class="jk-x2">×2</i>' : ''); slotOp.innerHTML = hand(b.h, 'pop opp') + (b.d ? '<i class="jk-x2">×2</i>' : '');
        if (a.d) dblUsed[0] = true; if (b.d) dblUsed[1] = true;
      }, 760);
      env.later(() => {
        const win = beats(a.h, b.h), lose = beats(b.h, a.h);
        if (!win && !lose) { setMsg('あいこ! 点は入らない'); Snd.play('draw'); }
        else {
          const w = win ? a : b, p = PTS[w.h] * (w.d ? 2 : 1), mine = win;
          score[mine ? 0 : 1] += p;
          const wEl = mine ? slotMe : slotOp; wEl.classList.add('won'); (mine ? slotOp : slotMe).classList.add('lost');
          setMsg(`${HN[w.h]}で ${mine ? 'かち' : 'まけ'}! ${mine ? '+' : 'あいて +'}${p}点`, mine ? 'good' : 'bad');
          Snd.play(mine ? 'super' : 'dmg'); if (!mine) Snd.vibrate(100);
          const pt = FX.at($(mine ? '.jk-score.me b' : '.jk-score.opp b', R)), c = FX.at(wEl);
          FX.burst(c.x, c.y, { count: 30, speed: 380, colors: mine ? ['#fff', '#ffd166', '#7ee8fa'] : ['#fff', '#ff5d8f', '#ffb3c8'] });
          FX.text(pt.x, pt.y - 10, '+' + p, mine ? '#ffd166' : '#ff8fa8', 40);
        }
        prev = a.h; paint();
      }, 1300);
      env.later(() => {
        slotMe.className = 'jk-slot me'; slotOp.className = 'jk-slot opp';
        slotMe.innerHTML = ''; slotOp.innerHTML = '<div class="jk-q">?</div>';
        myPick = null; oppPick = null; oppLocked = false; sent = false; busy = false; sel = -1; dbl = false; left = TIME; bar.style.width = '100%'; bar.classList.remove('low');
        if (score[0] >= GOAL || score[1] >= GOAL || round >= MAXR) return finish();
        round++; $('.jk-round', R).textContent = 'ラウンド ' + round + (round === MAXR ? ' (さいご)' : ''); setMsg('手をえらぼう'); paint();
        const q = queue; queue = []; q.forEach(onMsg);
      }, 3300);
    }
    function finish() {
      over = true; paint(); clearInterval(tick);
      const k = score[0] > score[1] ? 'win' : score[0] < score[1] ? 'lose' : 'draw';
      setMsg('しょうぶあり!', 'hot');
      env.later(() => env.result({ kind: k, title: k === 'win' ? 'かち!' : k === 'lose' ? 'まけ…' : 'ひきわけ', sub: `じぶん ${score[0]}点 ・ あいて ${score[1]}点` }), 500);
    }
    function onMsg(m) {
      if (busy) { queue.push(m); return; }
      if (m.t === 'jp') { oppLocked = true; slotOp.innerHTML = '<div class="jk-q lock">?</div>'; Snd.play('card'); if (!myPick) setMsg('あいては手を決めた!', 'hot'); check(); }
      else if (m.t === 'jr') { oppPick = { h: m.h, d: !!m.d }; check(); }
    }
    paint();
    return { msg: onMsg, stop() { clearInterval(tick); } };
  }
};
