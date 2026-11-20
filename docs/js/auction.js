'use strict';
// ===== 入札オークション: 100枚のコインで8つの品を競り合う。入札額はひみつ(勝ち負けだけ分かる)。
//   お宝は高く入れたほうが買う。呪いの品は低く入れたほうが引き取る。同じ額なら流れる =====
Games.auction = {
  start(env) {
    const COINS = 100;
    const ITEMS = [
      { k: 'au_crown', n: '金の王冠', v: 8 }, { k: 'au_chest', n: 'お宝の箱', v: 6 }, { k: 'au_cat', n: '金のネコ像', v: 5 },
      { k: 'au_gem', n: '青い宝石', v: 4 }, { k: 'au_cup', n: '金の杯', v: 3 }, { k: 'au_necklace', n: '真珠の首かざり', v: 2 },
      { k: 'au_skull', n: '呪いのドクロ', v: -5 }, { k: 'au_doll', n: '呪いの人形', v: -3 }
    ];
    const r = rng(env.seed), lots = shuffle(ITEMS.slice(), r);
    if (lots[0].v < 0) lots.push(lots.shift());          // 最初の品はお宝にする
    const img = (it, cls) => `<img class="${cls || ''}" src="${Img.url(it.k)}" alt="${it.n}" draggable="false">`;

    env.root.innerHTML = `<div class="au">
      <div class="au-top">
        <div class="au-p opp"><span>あいて</span><b class="au-pt">0点</b><small>コイン <em>???</em></small></div>
        <div class="au-p me"><span>じぶん</span><b class="au-pt">0点</b><small>コイン <em>${COINS}</em></small></div>
      </div>
      <div class="au-lots">${lots.map((it, i) => `<div class="au-lot${it.v < 0 ? ' curse' : ''}" data-i="${i}">${img(it)}<b>${it.v > 0 ? '+' : ''}${it.v}</b></div>`).join('')}</div>
      <div class="au-stage"><div class="au-item"></div><div class="au-name"></div><div class="au-rule"></div></div>
      <div class="au-msg"></div>
      <div class="au-bid">
        <div class="au-num"><button data-d="-10">-10</button><button data-d="-1">-1</button><b>0</b><button data-d="1">+1</button><button data-d="10">+10</button></div>
        <input class="au-range" type="range" min="0" max="${COINS}" value="0">
      </div>
      <button class="btn primary au-go"><img src="${Img.url('au_gavel')}" alt="">入札する</button>
    </div>`;
    const R = env.root, msgEl = $('.au-msg', R), numEl = $('.au-num b', R), range = $('.au-range', R), goBtn = $('.au-go', R), stage = $('.au-stage', R);
    const setMsg = (t, cls) => { msgEl.textContent = t; msgEl.className = 'au-msg ' + (cls || ''); };

    let idx = 0, coins = [COINS, COINS], pts = [0, 0], bid = 0, myBid = null, oppLocked = false, oppBid = null, sent = false, busy = false, over = false, queue = [];
    const hist = [];

    function setBid(v) { bid = clamp(Math.round(v), 0, coins[0]); numEl.textContent = bid; range.max = coins[0]; range.value = bid; }
    $('.au-num', R).addEventListener('click', e => { const d = e.target.dataset && e.target.dataset.d; if (d == null || myBid != null || busy) return; setBid(bid + +d); Snd.play('key'); });
    range.addEventListener('input', () => { if (myBid != null || busy) return; setBid(+range.value); });
    goBtn.addEventListener('click', lock);

    function showLot() {
      const it = lots[idx];
      R.querySelectorAll('.au-lot').forEach((d, i) => d.classList.toggle('now', i === idx));
      stage.className = 'au-stage enter' + (it.v < 0 ? ' curse' : '');
      $('.au-item', R).innerHTML = img(it);
      $('.au-name', R).innerHTML = `${idx + 1}品目 <b>${it.n}</b> <em>${it.v > 0 ? '+' : ''}${it.v}点</em>`;
      $('.au-rule', R).textContent = it.v > 0 ? '高く入札したほうが 手に入れる(入札したコインを払う)' : '低く入札したほうが 引き取ってしまう(高いほうはコインを払ってのがれる)';
      setMsg('コインを何枚 出す?'); setBid(Math.min(bid, coins[0])); goBtn.disabled = false;
      void stage.offsetWidth;
    }
    function lock() {
      if (myBid != null || busy || over) return;
      myBid = bid; goBtn.disabled = true; Snd.play('card');
      setMsg(oppLocked ? '' : `${myBid}枚で入札! あいてを待っています…`); env.send({ t: 'ab' }); check();
    }
    function check() {
      if (myBid != null && oppLocked && !sent) { sent = true; env.send({ t: 'av', v: myBid }); }
      if (myBid != null && oppBid != null && !busy) resolve();
    }
    function resolve() {
      busy = true; const it = lots[idx], a = myBid, b = oppBid;
      setMsg('落札は…', 'hot'); Snd.play('tick');
      env.later(() => {
        let who = -1;                                      // 品を手に入れた人(呪いは引き取った人)
        if (a !== b) who = it.v > 0 ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
        const payer = a === b ? -1 : (a > b ? 0 : 1);     // 高く入れたほうが払う
        if (payer >= 0) coins[payer] -= payer === 0 ? a : b;
        if (who >= 0) pts[who] += it.v;
        hist.push({ it, a, b, who });
        const lot = R.querySelector(`.au-lot[data-i="${idx}"]`); lot.classList.add(who === 0 ? 'mine' : who === 1 ? 'theirs' : 'none');
        const close = Math.abs(a - b) <= 5 && a !== b ? '(僅差!)' : '';
        Snd.play('clash'); FX.shake(stage);
        if (who < 0) { setMsg('同じ額! この品は流れた', ''); Snd.play('draw'); }
        else if (it.v > 0) {
          setMsg(who === 0 ? `落札! ${it.n}を手に入れた ${close}` : `あいてが落札… ${close}`, who === 0 ? 'good' : 'bad');
          if (who === 0) { Snd.play('win'); const p = FX.at($('.au-item', R)); FX.burst(p.x, p.y, { count: 40, speed: 400, colors: ['#fff', '#ffd166', '#ffe8a3'] }); }
        } else {
          setMsg(who === 0 ? `呪いを引き取ってしまった… ${close}` : `呪いは あいてのもとへ! ${close}`, who === 0 ? 'bad' : 'good');
          Snd.play(who === 0 ? 'hurt' : 'super'); if (who === 0) Snd.vibrate(150);
        }
        $('.au-item', R).classList.add(who === 0 ? 'to-me' : who === 1 ? 'to-opp' : 'gone');
        paintTop();
      }, 900);
      env.later(() => {
        idx++; myBid = null; oppBid = null; oppLocked = false; sent = false; busy = false;
        if (idx >= lots.length) return finish();
        showLot(); const q = queue; queue = []; q.forEach(onMsg);
      }, 3200);
    }
    function paintTop() {
      $('.au-p.me .au-pt', R).textContent = pts[0] + '点'; $('.au-p.opp .au-pt', R).textContent = pts[1] + '点';
      $('.au-p.me em', R).textContent = coins[0];
    }
    function finish() {
      over = true; goBtn.disabled = true;
      const k = pts[0] !== pts[1] ? (pts[0] > pts[1] ? 'win' : 'lose') : coins[0] !== coins[1] ? (coins[0] > coins[1] ? 'win' : 'lose') : 'draw';
      const tb = pts[0] === pts[1] && k !== 'draw' ? '<p class="au-tb">点が同じなので、のこりコインが多いほうの勝ち</p>' : '';
      const rows = hist.map(h => `<tr class="${h.who === 0 ? 'm' : h.who === 1 ? 't' : ''}"><td>${img(h.it)}${h.it.n}</td><td>${h.a}</td><td>${h.b}</td></tr>`).join('');
      env.later(() => env.result({ kind: k, title: k === 'win' ? 'かち!' : k === 'lose' ? 'まけ…' : 'ひきわけ',
        sub: `お宝の点 じぶん ${pts[0]} ・ あいて ${pts[1]}<br>のこりコイン じぶん ${coins[0]} ・ あいて ${coins[1]}`,
        extra: `${tb}<table class="au-hist"><tr><th>品</th><th>じぶん</th><th>あいて</th></tr>${rows}</table>` }), 400);
    }
    function onMsg(m) {
      if (busy) { queue.push(m); return; }
      if (m.t === 'ab') { oppLocked = true; Snd.play('card'); if (myBid == null) setMsg('あいては入札した!', 'hot'); check(); }
      else if (m.t === 'av') { oppBid = m.v; check(); }
    }
    paintTop(); showLot();
    return { msg: onMsg };
  }
};
