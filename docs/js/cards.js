'use strict';
// ===== エレメントデュエル: 同時にカードを出して、パワーと相性で勝負 =====
Games.cards = {
  start(env) {
    const MAXHP = 20, EL = ['fire', 'water', 'grass'], ELJ = ['炎', '水', '草'];
    const NAMES = [
      ['ひのこ', 'ほのおトカゲ', 'かえんギツネ', 'マグマゴーレム', 'フェニックス', 'ごうかドラゴン'],
      ['しずく', 'あわガニ', 'なみイルカ', 'うずしおヘビ', 'こおりクジラ', 'うみのりゅうおう'],
      ['めばえ', 'はっぱネズミ', 'つるヘビ', 'もりのシカ', 'たいぼくのせい', 'せかいじゅ']
    ];
    const beats = (a, b) => (a === 0 && b === 2) || (a === 2 && b === 1) || (a === 1 && b === 0);
    const BODY = [
      // 炎のせい
      `<path d="M50 6c4 17 27 25 27 52a27 27 0 0 1-54 0c0-15 9-21 11-33c7 5 10 11 10 18c6-10 8-23 6-37z" fill="url(#cgF)" stroke="#7a1500" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M50 42c3 9 14 13 14 25a14 14 0 0 1-28 0c0-8 5-11 6-18c3 3 5 6 5 9c2-5 4-10 3-16z" fill="#fff1a8"/>
       <circle cx="43" cy="66" r="4.2" fill="#3b0d00"/><circle cx="57" cy="66" r="4.2" fill="#3b0d00"/><circle cx="44.4" cy="64.4" r="1.5" fill="#fff"/><circle cx="58.4" cy="64.4" r="1.5" fill="#fff"/>
       <path d="M45 74q5 5 10 0" fill="none" stroke="#3b0d00" stroke-width="2.4" stroke-linecap="round"/>`,
      // 水のせい
      `<path d="M50 6c14 20 29 34 29 53a29 29 0 0 1-58 0c0-19 15-33 29-53z" fill="url(#cgW)" stroke="#0b2a6b" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M34 50c-4 8-4 16 0 22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>
       <circle cx="43" cy="60" r="4.4" fill="#06204f"/><circle cx="59" cy="60" r="4.4" fill="#06204f"/><circle cx="44.5" cy="58.3" r="1.6" fill="#fff"/><circle cx="60.5" cy="58.3" r="1.6" fill="#fff"/>
       <path d="M46 69q5 5 10 0" fill="none" stroke="#06204f" stroke-width="2.4" stroke-linecap="round"/>
       <ellipse cx="37" cy="67" rx="4" ry="2.4" fill="#ff9ebb" opacity=".7"/><ellipse cx="65" cy="67" rx="4" ry="2.4" fill="#ff9ebb" opacity=".7"/>`,
      // 草のせい
      `<path d="M50 42c-3-17-15-26-30-26c0 16 12 27 30 26z" fill="url(#cgG)" stroke="#0e4d2a" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M50 42c3-17 15-26 30-26c0 16-12 27-30 26z" fill="url(#cgG)" stroke="#0e4d2a" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M50 42c-6-8-14-14-22-18M50 42c6-8 14-14 22-18" fill="none" stroke="#e9ffd0" stroke-width="1.6" opacity=".8"/>
       <circle cx="50" cy="64" r="25" fill="url(#cgG2)" stroke="#0e4d2a" stroke-width="2.5"/>
       <circle cx="42" cy="62" r="4.2" fill="#12351d"/><circle cx="58" cy="62" r="4.2" fill="#12351d"/><circle cx="43.4" cy="60.4" r="1.5" fill="#fff"/><circle cx="59.4" cy="60.4" r="1.5" fill="#fff"/>
       <path d="M45 71q5 5 10 0" fill="none" stroke="#12351d" stroke-width="2.4" stroke-linecap="round"/>
       <ellipse cx="35" cy="69" rx="4" ry="2.4" fill="#ffb3c1" opacity=".8"/><ellipse cx="65" cy="69" rx="4" ry="2.4" fill="#ffb3c1" opacity=".8"/>`
    ];
    function art(e, p) {     // Blender で作ったキャラ(パワーで3段階に成長)
      return `<img class="card-art" src="${Img.url('card_' + EL[e] + (p <= 3 ? 0 : p <= 5 ? 1 : 2))}" alt="" draggable="false">`;
    }
    function artOld(e, p) {
      const s = 0.62 + (p - 2) * 0.075, crown = p >= 6 ? `<path d="M34 12l5 9l11-13l11 13l5-9l-3 20H37z" fill="#ffd166" stroke="#8a5a00" stroke-width="2" stroke-linejoin="round" transform="translate(0,-12)"/>` : '';
      const stars = p >= 4 ? `<g fill="#fff" opacity=".9"><path d="M12 30l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2z"/><path d="M88 60l1.5 4.5l4.5 1.5l-4.5 1.5L88 72l-1.5-4.5L82 66l4.5-1.5z"/>${p >= 7 ? '<path d="M84 16l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2z"/><path d="M14 74l1.5 4.5L20 80l-4.5 1.5L14 86l-1.5-4.5L8 80l4.5-1.5z"/>' : ''}</g>` : '';
      return `<svg class="card-art" viewBox="0 0 100 100">${stars}<g transform="translate(50 54) scale(${s}) translate(-50 -50)">${BODY[e]}${crown}</g></svg>`;
    }
    function mkCard(cd, down) {
      const d = el('div', 'card' + (down ? ' down' : ''));
      d.innerHTML = `<div class="card-in"><div class="card-b"><i></i></div><div class="card-f"></div></div>`;
      if (cd) face(d, cd);
      return d;
    }
    function face(d, cd) {
      d.classList.add('el-' + EL[cd.e]); if (cd.p >= 6) d.classList.add('rare');
      $('.card-f', d).innerHTML = `<span class="card-pw">${cd.p}</span><span class="card-el">${ELJ[cd.e]}</span>${art(cd.e, cd.p)}<span class="card-nm">${NAMES[cd.e][cd.p - 2]}</span>`;
    }

    env.root.innerHTML = `
      <svg width="0" height="0" style="position:absolute"><defs>
        <linearGradient id="cgF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset=".5" stop-color="#ff7b00"/><stop offset="1" stop-color="#d00000"/></linearGradient>
        <linearGradient id="cgW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8f7ff"/><stop offset=".5" stop-color="#48b5ff"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
        <linearGradient id="cgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8ff9a"/><stop offset="1" stop-color="#2f9e44"/></linearGradient>
        <radialGradient id="cgG2" cx=".4" cy=".3"><stop offset="0" stop-color="#e6ffb8"/><stop offset=".6" stop-color="#74c94f"/><stop offset="1" stop-color="#2b8a3e"/></radialGradient>
      </defs></svg>
      <div class="cb">
        <div class="cb-side opp"><span class="cb-who">あいて</span><div class="hp"><div class="hp-fill"></div><span class="hp-num">${MAXHP}</span></div></div>
        <div class="cb-ohand"></div>
        <div class="cb-arena">
          <div class="cb-slot opp"></div>
          <div class="cb-mid"><span class="cb-round">ラウンド 1</span><span class="cb-msg">カードをえらぼう</span>
            <span class="cb-chart"><b class="f">炎</b>▶<b class="g">草</b>▶<b class="w">水</b>▶<b class="f">炎</b><small>つよい相手にはパワー2倍</small></span></div>
          <div class="cb-slot me"></div>
        </div>
        <div class="cb-hand"></div>
        <div class="cb-side me"><span class="cb-who">じぶん</span><div class="hp"><div class="hp-fill"></div><span class="hp-num">${MAXHP}</span></div><span class="cb-deck"></span></div>
        <button class="btn primary cb-go" disabled>このカードで しょうぶ!</button>
      </div>`;
    const R = env.root, handEl = $('.cb-hand', R), ohandEl = $('.cb-ohand', R), slotMe = $('.cb-slot.me', R), slotOp = $('.cb-slot.opp', R),
      msgEl = $('.cb-msg', R), goBtn = $('.cb-go', R), roundEl = $('.cb-round', R), deckEl = $('.cb-deck', R), arena = $('.cb-arena', R);

    const deck = []; for (let e = 0; e < 3; e++) for (let p = 2; p <= 7; p++) deck.push({ e, p });
    shuffle(deck);
    const hand = deck.splice(0, 4);
    let hp = [MAXHP, MAXHP], sel = -1, myPick = null, oppLocked = false, oppCard = null, sent = false, busy = false, round = 1, oppHandN = 4, oppDeckN = deck.length, over = false;

    function setMsg(t, cls) { msgEl.textContent = t; msgEl.className = 'cb-msg ' + (cls || ''); }
    function paintHP() {
      [['.cb-side.me', hp[0]], ['.cb-side.opp', hp[1]]].forEach(([s, v]) => {
        const f = $(s + ' .hp-fill', R); f.style.width = Math.max(0, v / MAXHP * 100) + '%'; f.classList.toggle('low', v <= 6);
        $(s + ' .hp-num', R).textContent = Math.max(0, v);
      });
      deckEl.textContent = '山札 ' + deck.length;
    }
    function paintHand(newIdx) {
      handEl.innerHTML = '';
      hand.forEach((cd, i) => {
        const d = mkCard(cd); if (i === sel) d.classList.add('sel'); if (i === newIdx) d.classList.add('drawn');
        d.addEventListener('click', () => {
          if (myPick || busy || over) return;
          if (sel === i) { lock(); return; }
          sel = i; Snd.play('select'); paintHand(); goBtn.disabled = false;
        });
        handEl.appendChild(d);
      });
    }
    function paintOpp() {
      ohandEl.innerHTML = '';
      for (let i = 0; i < oppHandN; i++) { const d = mkCard(null, true); d.style.setProperty('--r', ((i - (oppHandN - 1) / 2) * 7) + 'deg'); ohandEl.appendChild(d); }
    }
    function lock() {
      if (sel < 0 || myPick || busy) return;
      myPick = hand.splice(sel, 1)[0]; sel = -1; goBtn.disabled = true; Snd.play('card');
      paintHand(); slotMe.innerHTML = ''; const d = mkCard(myPick); d.classList.add('enter-up'); slotMe.appendChild(d);
      setMsg(oppLocked ? '' : 'あいてを待っています…'); env.send({ t: 'cp' }); check();
    }
    goBtn.addEventListener('click', lock);

    function check() {
      if (myPick && oppLocked && !sent) { sent = true; env.send({ t: 'cr', e: myPick.e, p: myPick.p }); }
      if (myPick && oppCard && !busy) resolve();
    }
    function resolve() {
      busy = true; setMsg('オープン!', 'hot');
      const a = myPick, b = oppCard, od = slotOp.firstChild, md = slotMe.firstChild;
      const ma = beats(a.e, b.e) ? 2 : 1, mb = beats(b.e, a.e) ? 2 : 1, pa = a.p * ma, pb = b.p * mb;
      env.later(() => { face(od, b); od.classList.remove('down'); Snd.play('flip'); }, 450);
      env.later(() => {
        if (ma > 1 || mb > 1) {
          const w = ma > 1 ? md : od; w.classList.add('boost'); w.appendChild(el('span', 'card-x2', '×2'));
          setMsg(ma > 1 ? 'こうかばつぐん! パワー2倍!' : 'あいての相性がいい…', ma > 1 ? 'good' : 'bad'); Snd.play('super');
          const p = FX.at(w); FX.ring(p.x, p.y, ma > 1 ? '#ffd166' : '#ff5d8f', 90);
        }
      }, 1250);
      env.later(() => {
        const diff = pa - pb; Snd.play('clash'); FX.shake(arena);
        const mid = FX.at($('.cb-mid', R)); FX.burst(mid.x, mid.y, { count: 36, speed: 420, colors: ['#fff', '#ffd166', '#ff7b00', '#7ee8fa'] });
        md.classList.add(diff > 0 ? 'atk-up' : diff < 0 ? 'hurt' : 'bump-up'); od.classList.add(diff < 0 ? 'atk-down' : diff > 0 ? 'hurt' : 'bump-down');
        if (diff === 0) { setMsg(`${pa} 対 ${pb} … ひきわけ!`); return; }
        const meHit = diff < 0, dmg = Math.abs(diff);
        hp[meHit ? 0 : 1] -= dmg;
        setMsg(`${pa} 対 ${pb} … ${meHit ? dmg + ' ダメージをうけた!' : dmg + ' ダメージをあたえた!'}`, meHit ? 'bad' : 'good');
        env.later(() => {
          paintHP(); Snd.play('dmg'); if (meHit) Snd.vibrate(120);
          const bar = $(meHit ? '.cb-side.me .hp' : '.cb-side.opp .hp', R), p = FX.at(bar);
          FX.shake(bar); FX.text(p.x, p.y + (meHit ? -18 : 40), '-' + dmg, meHit ? '#ff6b8b' : '#ffd166', 44); FX.burst(p.x, p.y, { count: 22, colors: ['#ff5d8f', '#fff', '#ffb703'] });
        }, 350);
      }, 2100);
      env.later(() => {
        slotMe.firstChild && slotMe.firstChild.classList.add('leave'); slotOp.firstChild && slotOp.firstChild.classList.add('leave');
      }, 3700);
      env.later(() => {
        slotMe.innerHTML = ''; slotOp.innerHTML = '';
        let ni = -1; if (deck.length) { hand.push(deck.shift()); ni = hand.length - 1; Snd.play('card'); }
        if (oppDeckN > 0) { oppDeckN--; oppHandN++; }
        myPick = null; oppCard = null; oppLocked = false; sent = false; busy = false; round++;
        paintHP(); paintHand(ni); paintOpp();
        if (hp[0] <= 0 || hp[1] <= 0 || (hand.length === 0 && oppHandN === 0)) return finish();
        roundEl.textContent = 'ラウンド ' + round; setMsg('カードをえらぼう');
        const q = queue; queue = []; q.forEach(onMsg);
      }, 4100);
    }
    function finish() {
      over = true; const k = hp[0] > hp[1] ? 'win' : hp[0] < hp[1] ? 'lose' : 'draw';
      setMsg('しょうぶあり!', 'hot');
      env.later(() => env.result({ kind: k, title: k === 'win' ? 'かち!' : k === 'lose' ? 'まけ…' : 'ひきわけ', sub: `のこりHP　じぶん ${Math.max(0, hp[0])} ・ あいて ${Math.max(0, hp[1])}` }), 600);
    }

    paintHP(); paintHand(); paintOpp();
    let queue = [];
    function onMsg(m) {
        if (busy) { queue.push(m); return; }
        if (m.t === 'cp') { oppLocked = true; oppHandN = Math.max(0, oppHandN - 1); paintOpp(); slotOp.innerHTML = ''; const d = mkCard(null, true); d.classList.add('enter-down'); slotOp.appendChild(d); Snd.play('card'); if (!myPick) setMsg('あいてはカードを出した!', 'hot'); check(); }
        else if (m.t === 'cr') { oppCard = { e: m.e, p: m.p }; check(); }
    }
    return { msg: onMsg };
  }
};
