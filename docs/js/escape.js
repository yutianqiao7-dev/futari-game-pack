'use strict';
// ===== 封印のとびら: 「とびら係」は仕掛けだけ、「古文書係」は解き方だけが見える。声で伝えあって解く =====
Games.escape = {
  start(env) {
    const TIME = 240, MAXMISS = 3;
    const COL = [{ n: '赤', c: '#ff4d6d' }, { n: '青', c: '#3b82f6' }, { n: '黄', c: '#ffd43b' }, { n: '緑', c: '#2fbf5b' }, { n: '白', c: '#f1f3f5' }];
    const G = [
      '<circle cx="20" cy="20" r="6.5"/><path d="M20 4v5M20 31v5M4 20h5M31 20h5M8.7 8.7l3.5 3.5M27.8 27.8l3.5 3.5M31.3 8.7l-3.5 3.5M12.2 27.8l-3.5 3.5"/>',
      '<path d="M27 6a15 15 0 1 0 7 22a12 12 0 0 1-7-22z"/>',
      '<path d="M20 4l4.7 10.2l11.1 1.3l-8.2 7.6l2.2 11L20 28.6L10.2 34l2.2-11L4.2 15.5l11.1-1.3z"/>',
      '<path d="M3 20q17-17 34 0q-17 17-34 0z"/><circle cx="20" cy="20" r="4.5"/>',
      '<circle cx="13" cy="13" r="7"/><path d="M18 18l16 16M27 27l5-5M31 31l4-4"/>',
      '<path d="M4 14q4-7 8 0t8 0t8 0t8 0M4 26q4-7 8 0t8 0t8 0t8 0"/>',
      '<path d="M3 33L15 11l7 11l4-6l11 17z"/>',
      '<path d="M20 4c2 9 12 13 12 22a12 12 0 0 1-24 0c0-6 4-9 5-14c3 2 4 5 4 8c2-4 4-9 3-16z"/>',
      '<path d="M7 33q0-24 26-26q0 26-26 26zM7 33L24 16"/>',
      '<path d="M20 20a3 3 0 1 1 3 3a7 7 0 1 1-7-7a11 11 0 1 1 11 11"/>',
      '<path d="M5 31V13l8 8l7-13l7 13l8-8v18z"/>',
      '<path d="M20 36V6M10 16L20 6l10 10M14 30l6-5l6 5"/>'
    ];
    const glyph = i => `<svg class="glyph" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${G[i]}</svg>`;

    // --- 同じシード値から、2台で同じ問題を作る ---
    const r = rng(env.seed), ri = n => Math.floor(r() * n);
    const wires = [0, 1, 2, 3, 4].map(() => ri(5));
    const cnt = c => wires.filter(x => x === c).length;
    const wireSol = cnt(0) === 0 ? 1 : wires[4] === 4 ? 4 : cnt(1) >= 2 ? wires.lastIndexOf(1) : cnt(2) === 1 ? 0 : 3;
    let cols, target, order;
    for (;;) {
      cols = [0, 1, 2, 3].map(() => shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], r).slice(0, 5));
      target = ri(4); const pos = shuffle([0, 1, 2, 3, 4], r).slice(0, 4).sort((a, b) => a - b); order = pos.map(p => cols[target][p]);
      if (!cols.some((c, i) => i !== target && order.every(g => c.includes(g)))) break;
    }
    const shown = shuffle(order.slice(), r);
    const emblem = ri(3), crystals = [0, 1, 2, 3].map(() => ri(5)), table = [0, 1, 2].map(() => [0, 1, 2, 3, 4].map(() => ri(10)));
    const code = crystals.map(c => table[emblem][c]).join('');

    const operator = (env.slot === 0) !== env.flip;
    let stage = 0, miss = 0, left = TIME, over = false, tick = null, lastSec = TIME, endAt = Date.now() + TIME * 1000, pressed = [], entry = '';

    const top = `<div class="es-top"><div class="es-timer">4:00</div><div class="es-seals"><i></i><i></i><i></i></div><div class="es-miss"><i></i><i></i><i></i></div></div>`;
    const R = env.root;
    if (operator) {
      R.innerHTML = `<div class="es op">${top}
        <div class="es-role"><b>とびら係</b>見えるものを 声で相手に伝えよう</div>
        <div class="es-door"><div class="es-arch"><span class="es-emblem">${glyph(emblem)}</span></div><div class="es-panel"></div></div></div>`;
    } else {
      R.innerHTML = `<div class="es rd">${top}
        <div class="es-role"><b>古文書係</b>相手の話を聞いて 解き方を教えよう</div>
        <div class="es-tabs"><button data-c="0">一 光の糸</button><button data-c="1">二 紋章</button><button data-c="2">三 星の鍵</button></div>
        <div class="es-book"></div></div>`;
    }
    const timerEl = $('.es-timer', R), panel = $('.es-panel', R), book = $('.es-book', R), wrap = $('.es', R);
    const chip = c => `<span class="chip" style="--c:${COL[c].c}">${COL[c].n}</span>`;

    function paintTop() {
      R.querySelectorAll('.es-seals i').forEach((e, i) => e.classList.toggle('on', i < stage));
      R.querySelectorAll('.es-miss i').forEach((e, i) => e.classList.toggle('on', i < miss));
      const s = Math.max(0, Math.ceil(left)); timerEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); timerEl.classList.toggle('danger', s <= 30);
    }
    function sync() { env.send({ t: 'ep', st: stage, ms: miss, left: Math.round(left * 10) / 10 }); }

    // --- とびら係の画面 ---
    function paintStage() {
      if (stage === 0) {
        panel.innerHTML = `<h3>第一の封印</h3><p>光の糸を <b>1本だけ</b> 切れ</p><div class="es-wires">${wires.map((c, i) => `<button class="wire" data-i="${i}" style="--c:${COL[c].c}"><i></i><span>${i + 1}</span></button>`).join('')}</div><p class="es-sub">左から 1・2・3・4・5本目</p>`;
      } else if (stage === 1) {
        pressed = [];
        panel.innerHTML = `<h3>第二の封印</h3><p>4つの紋章を <b>正しい順</b> におせ</p><div class="es-glyphs">${shown.map(g => `<button class="gbtn" data-g="${g}">${glyph(g)}<em></em></button>`).join('')}</div>`;
      } else if (stage === 2) {
        entry = '';
        panel.innerHTML = `<h3>第三の封印</h3><p>とびらの上の紋章と 水晶の色を伝えよ</p><div class="es-crystals">${crystals.map(c => `<i style="--c:${COL[c].c}"></i>`).join('')}</div>
          <div class="es-code"><b></b><b></b><b></b><b></b></div><div class="es-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="c" class="sub">けす</button><button data-k="0">0</button><span></span></div>`;
      }
      $('.es-emblem', R).classList.toggle('lit', stage === 2);
    }
    function solved() {
      stage++; Snd.play('seal'); Snd.vibrate([30, 30, 60]); paintTop(); sync();
      const p = FX.at(R.querySelectorAll('.es-seals i')[stage - 1]); FX.burst(p.x, p.y, { count: 30, colors: ['#fff', '#ffd166', '#ffe8a3'], speed: 300 }); FX.ring(p.x, p.y, '#ffd166', 80);
      panel.classList.add('done');
      if (stage >= 3) { end(true); return; }
      env.later(() => { panel.classList.remove('done'); paintStage(); }, 1000);
    }
    function wrong() {
      miss++; Snd.play('error'); Snd.vibrate(200); FX.shake(wrap); paintTop(); sync();
      const p = FX.at(panel); FX.text(p.x, p.y, 'ちがう!', '#ff6b8b', 40);
      if (miss >= MAXMISS) end(false, 'まちがいが 3回になってしまった…');
    }
    function end(win, why) {
      if (over) return; over = true; clearInterval(tick);
      env.send({ t: 'ee', win, left: Math.round(left), why: why || '' }); finale(win, why);
    }
    function finale(win, why) {
      over = true; clearInterval(tick);
      if (win) { Snd.play('door'); wrap.classList.add('open'); }
      const used = TIME - Math.round(left), tm = Math.floor(used / 60) + '分' + String(used % 60).padStart(2, '0') + '秒';
      env.later(() => env.result(win ? { kind: 'clear', title: 'だっしゅつ成功!', sub: `とびらが ひらいた!<br>かかった時間 ${tm} ・ まちがい ${miss}回` } : { kind: 'fail', title: 'しっぱい…', sub: why || '時間ぎれ…' }), win ? 1700 : 700);
    }
    if (operator) {
      panel.addEventListener('click', e => {
        if (over || panel.classList.contains('done')) return;
        const w = e.target.closest('.wire'), g = e.target.closest('.gbtn'), k = e.target.closest('[data-k]');
        if (w && stage === 0) {
          if (+w.dataset.i === wireSol) { w.classList.add('cut'); Snd.play('cut'); solved(); } else { FX.shake(w); wrong(); }
        } else if (g && stage === 1 && !g.classList.contains('on')) {
          const id = +g.dataset.g;
          if (id === order[pressed.length]) {
            pressed.push(id); g.classList.add('on'); $('em', g).textContent = pressed.length; Snd.play('rune');
            if (pressed.length === 4) solved();
          } else { pressed = []; panel.querySelectorAll('.gbtn').forEach(b => { b.classList.remove('on'); $('em', b).textContent = ''; }); wrong(); }
        } else if (k && stage === 2) {
          const v = k.dataset.k;
          if (v === 'c') { entry = entry.slice(0, -1); Snd.play('back'); } else if (entry.length < 4) { entry += v; Snd.play('key'); }
          panel.querySelectorAll('.es-code b').forEach((b, i) => b.textContent = entry[i] || '');
          if (entry.length === 4) { if (entry === code) solved(); else { entry = ''; env.later(() => panel.querySelectorAll('.es-code b').forEach(b => b.textContent = ''), 350); wrong(); } }
        }
      });
      paintStage();
    }

    // --- 古文書係の画面 ---
    const CH = [
      `<h3>第一の封印「光の糸」</h3><p>糸は5本。下のきまりを <b>1番から順に</b> しらべ、<b>さいしょに当てはまった</b>きまりに したがうこと。</p>
       <ol class="es-rules"><li>${chip(0)}の糸が <b>1本もない</b> → <b>左から2本目</b>を切れ</li><li>いちばん右の糸が ${chip(4)} → <b>いちばん右</b>を切れ</li>
       <li>${chip(1)}の糸が <b>2本以上</b> → <b>いちばん右にある${COL[1].n}</b>を切れ</li><li>${chip(2)}の糸が <b>ちょうど1本</b> → <b>いちばん左</b>を切れ</li><li>どれにも当てはまらない → <b>左から4本目</b>を切れ</li></ol>
       <p class="es-sub">まず相手に、左から順に 5本の色を言ってもらおう。</p>`,
      `<h3>第二の封印「紋章」</h3><p>とびらの4つの紋章が <b>すべて入っている列</b> を1つさがせ。その列の <b>上にあるものから順に</b> おさせること。</p>
       <div class="es-cols">${cols.map(c => `<div>${c.map(g => `<span>${glyph(g)}</span>`).join('')}</div>`).join('')}</div>
       <p class="es-sub">形をことばで説明してもらおう(太陽、月、星、目、カギ、波、山、炎、葉っぱ、うずまき、かんむり、矢 など)。</p>`,
      `<h3>第三の封印「星の鍵」</h3><p>とびらの上で光る紋章の <b>行</b> を見よ。水晶の色を <b>左から順に</b> 数字にかえると、4けたの鍵になる。</p>
       <table class="es-table"><tr><th></th>${COL.map((c, i) => `<th>${chip(i)}</th>`).join('')}</tr>${table.map((row, e) => `<tr><th>${glyph(e)}</th>${row.map(d => `<td>${d}</td>`).join('')}</tr>`).join('')}</table>
       <p class="es-sub">とびらの上の紋章は 太陽・月・星 のどれか。水晶は4つ。</p>`
    ];
    function showCh(i) { book.innerHTML = CH[i]; book.scrollTop = 0; R.querySelectorAll('.es-tabs button').forEach(b => { b.classList.toggle('on', +b.dataset.c === i); b.classList.toggle('now', +b.dataset.c === stage); b.classList.toggle('clear', +b.dataset.c < stage); }); }
    if (!operator) {
      $('.es-tabs', R).addEventListener('click', e => { const c = e.target.dataset && e.target.dataset.c; if (c != null) { Snd.play('tap'); showCh(+c); } });
      showCh(0);
    }

    // --- 時間 ---
    tick = setInterval(() => {
      if (over) return;
      left = (endAt - Date.now()) / 1000;
      const s = Math.ceil(left);
      if (s !== lastSec) { lastSec = s; if (s <= 30 && s > 0) Snd.play(s <= 10 ? 'alarm' : 'tick'); if (operator && s % 3 === 0) sync(); }
      paintTop();
      if (left <= 0 && operator) { left = 0; end(false, '時間ぎれ…'); }
    }, 200);
    paintTop();

    return {
      msg(m) {
        if (operator) return;
        if (m.t === 'ep') {
          endAt = Date.now() + m.left * 1000;
          if (m.ms > miss) { Snd.play('error'); Snd.vibrate(200); FX.shake(wrap); }
          if (m.st > stage) { stage = m.st; Snd.play('seal'); const p = FX.at(R.querySelectorAll('.es-seals i')[stage - 1]); FX.burst(p.x, p.y, { count: 30, colors: ['#fff', '#ffd166'], speed: 300 }); if (stage < 3) showCh(stage); }
          miss = m.ms; paintTop(); R.querySelectorAll('.es-tabs button').forEach(b => { b.classList.toggle('now', +b.dataset.c === stage); b.classList.toggle('clear', +b.dataset.c < stage); });
        } else if (m.t === 'ee' && !over) { left = m.left; if (m.win) stage = 3; paintTop(); finale(m.win, m.why); }
      },
      stop() { clearInterval(tick); }
    };
  }
};
