'use strict';
// ===== 封印のとびら: 「とびら係」は仕掛けだけ、「古文書係」は解き方だけが見える。声で伝えあって解く =====
// 謎は7種類。毎回そのうち3つがランダムに出る。とびらの上の紋章(太陽・月・星)で解き方が変わる謎もある
Games.escape = {
  start(env) {
    const TIME = 300, MAXMISS = 3;
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
    const EMB = ['太陽', '月', '星'];
    const chip = c => `<span class="chip" style="--c:${COL[c].c}">${COL[c].n}</span>`;
    const KAN = ['一', '二', '三'];

    // --- 同じシード値から、2台で同じ問題を作る ---
    const r = rng(env.seed), ri = n => Math.floor(r() * n);
    const emblem = ri(3);                       // とびらの上の紋章(ずっと光っている)
    let stage = 0, miss = 0;

    // ================= 謎の種類 =================
    // op(): とびら係の画面 / click(e): 'ok' で解除、'bad' でまちがい / manual(): 古文書のページ
    const PUZ = {
      // ---- 光の糸: 6本の糸から1本を切る。紋章ごとにきまりがちがう ----
      wires() {
        const w = [0, 1, 2, 3, 4, 5].map(() => ri(5));
        const cnt = c => w.filter(x => x === c).length, first = c => w.indexOf(c), last = c => w.lastIndexOf(c);
        const RULES = [
          [[() => cnt(0) >= 3, () => first(0), `${chip(0)}が<b>3本以上</b> → <b>いちばん左の${COL[0].n}</b>`],
           [() => cnt(4) === 0, () => 2, `${chip(4)}が<b>1本もない</b> → <b>左から3本目</b>`],
           [() => cnt(1) === cnt(2), () => 5, `${chip(1)}と${chip(2)}の本数が<b>同じ</b>(0本どうしもふくむ) → <b>いちばん右</b>`],
           [() => w[0] === w[5], () => 4, `<b>両はしの糸が同じ色</b> → <b>左から5本目</b>`],
           [() => true, () => 1, `どれでもない → <b>左から2本目</b>`]],
          [[() => cnt(1) === 0, () => 3, `${chip(1)}が<b>1本もない</b> → <b>左から4本目</b>`],
           [() => w[0] === 2, () => last(2), `<b>いちばん左</b>が${chip(2)} → <b>いちばん右の${COL[2].n}</b>`],
           [() => cnt(3) >= 2, () => 1, `${chip(3)}が<b>2本以上</b> → <b>左から2本目</b>`],
           [() => cnt(0) === 1, () => first(0), `${chip(0)}が<b>ちょうど1本</b> → <b>その${COL[0].n}</b>`],
           [() => true, () => 5, `どれでもない → <b>いちばん右</b>`]],
          [[() => cnt(4) >= 2, () => last(4), `${chip(4)}が<b>2本以上</b> → <b>いちばん右の${COL[4].n}</b>`],
           [() => cnt(3) === 0, () => 0, `${chip(3)}が<b>1本もない</b> → <b>いちばん左</b>`],
           [() => w[2] === 0, () => 5, `<b>左から3本目</b>が${chip(0)} → <b>いちばん右</b>`],
           [() => cnt(2) >= 2, () => first(2), `${chip(2)}が<b>2本以上</b> → <b>いちばん左の${COL[2].n}</b>`],
           [() => true, () => 2, `どれでもない → <b>左から3本目</b>`]]
        ];
        const sol = RULES[emblem].find(x => x[0]())[1]();
        return {
          name: '光の糸', answer: () => sol,
          op: () => `<p>光の糸を <b>1本だけ</b> 切れ</p><div class="es-wires">${w.map((c, i) => `<button class="wire" data-i="${i}" style="--c:${COL[c].c}"><i></i><span>${i + 1}</span></button>`).join('')}</div><p class="es-sub">左から 1〜6本目</p>`,
          click(e) { const b = e.target.closest('.wire'); if (!b) return; if (+b.dataset.i === sol) { b.classList.add('cut'); Snd.play('cut'); return 'ok'; } FX.shake(b); return 'bad'; },
          manual: () => `<p>糸は6本。<b>とびらの上の紋章</b>で、使うきまりがちがう。きまりは <b>上から順に</b> しらべ、<b>さいしょに当てはまった</b>ものにしたがう。</p>
            ${RULES.map((rs, e) => `<div class="es-case"><div class="es-case-h">${glyph(e)}<b>${EMB[e]}</b>のとき</div><ol class="es-rules">${rs.map(x => `<li>${x[2]}</li>`).join('')}</ol></div>`).join('')}`
        };
      },

      // ---- 紋章: 4つの紋章を正しい順におす ----
      glyphs() {
        let cols, order;
        for (;;) {
          cols = [0, 1, 2, 3, 4].map(() => shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], r).slice(0, 6));
          const t = ri(5), pos = shuffle([0, 1, 2, 3, 4, 5], r).slice(0, 4).sort((a, b) => a - b);
          order = pos.map(p => cols[t][p]);
          if (!cols.some((c, i) => i !== t && order.every(g => c.includes(g)))) break;
        }
        if (emblem === 2) order.reverse();           // 星のときは下から
        const shown = shuffle(order.slice(), r);
        let pressed = 0;
        return {
          name: '紋章', answer: () => order,
          op: () => { pressed = 0; return `<p>4つの紋章を <b>正しい順</b> におせ</p><div class="es-glyphs">${shown.map(g => `<button class="gbtn" data-g="${g}">${glyph(g)}<em></em></button>`).join('')}</div>`; },
          click(e, panel) {
            const b = e.target.closest('.gbtn'); if (!b || b.classList.contains('on')) return;
            if (+b.dataset.g === order[pressed]) { pressed++; b.classList.add('on'); $('em', b).textContent = pressed; Snd.play('rune'); return pressed === 4 ? 'ok' : undefined; }
            pressed = 0; panel.querySelectorAll('.gbtn').forEach(x => { x.classList.remove('on'); $('em', x).textContent = ''; }); return 'bad';
          },
          manual: () => `<p>とびらの4つの紋章が <b>すべて入っている列</b> を1つさがし、その列の <b>上から順に</b> おさせる。ただし とびらの上の紋章が <b>${glyph(2)}星</b> のときは <b>下から順に</b>。</p>
            <div class="es-cols c5">${cols.map(c => `<div>${c.map(g => `<span>${glyph(g)}</span>`).join('')}</div>`).join('')}</div>
            <p class="es-sub">形をことばで説明してもらおう(太陽、月、星、目、カギ、波、山、炎、葉っぱ、うずまき、かんむり、矢)。</p>`
        };
      },

      // ---- 星の鍵: 水晶の色を数字にして4けたの鍵 ----
      code() {
        const crystals = [0, 1, 2, 3].map(() => ri(5)), table = [0, 1, 2].map(() => [0, 1, 2, 3, 4].map(() => ri(10)));
        let digits = crystals.map(c => table[emblem][c]);
        if (emblem === 1) digits = digits.reverse();   // 月のときは右から読む
        const code = digits.join('');
        let entry = '';
        const paint = panel => panel.querySelectorAll('.es-code b').forEach((b, i) => b.textContent = entry[i] || '');
        return {
          name: '星の鍵', answer: () => code,
          op: () => { entry = ''; return `<p>水晶の色を伝えて 4けたの鍵を入れよ</p><div class="es-crystals">${crystals.map(c => `<img src="${Img.url('escape_crystal_' + ['red', 'blue', 'yellow', 'green', 'white'][c])}" style="--c:${COL[c].c}" alt="${COL[c].n}">`).join('')}</div>
            <div class="es-code"><b></b><b></b><b></b><b></b></div><div class="es-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="c" class="sub">けす</button><button data-k="0">0</button><span></span></div>`; },
          click(e, panel) {
            const k = e.target.closest('[data-k]'); if (!k) return;
            const v = k.dataset.k;
            if (v === 'c') { entry = entry.slice(0, -1); Snd.play('back'); } else if (entry.length < 4) { entry += v; Snd.play('key'); }
            paint(panel);
            if (entry.length === 4) { if (entry === code) return 'ok'; entry = ''; env.later(() => paint(panel), 350); return 'bad'; }
          },
          manual: () => `<p>とびらの上の紋章の <b>行</b> を使い、水晶の色を数字にかえると4けたの鍵になる。ふつうは <b>左の水晶から順に</b>読む。紋章が <b>${glyph(1)}月</b> のときだけ <b>右の水晶から順に</b>読む。</p>
            <table class="es-table"><tr><th></th>${COL.map((c, i) => `<th>${chip(i)}</th>`).join('')}</tr>${table.map((row, e) => `<tr><th>${glyph(e)}</th>${row.map(d => `<td>${d}</td>`).join('')}</tr>`).join('')}</table>`
        };
      },

      // ---- 光の宝珠: 光った色を、表で別の色にかえておす(まちがえた回数で表が変わる) ----
      orbs() {
        const C4 = [0, 1, 2, 3];
        const derange = () => { for (;;) { const p = shuffle(C4.slice(), r); if (p.every((v, i) => v !== i)) return p; } };
        const maps = [derange(), derange(), derange()];          // まちがい 0回 / 1回 / 2回
        const seq = [0, 1, 2, 3, 4].map(() => ri(4));
        const LEN = [2, 3, 4];
        let round = 0, input = 0, token = 0, panelRef = null;
        function flash() {
          const my = ++token;
          const run = () => {
            if (my !== token || !panelRef) return;
            const n = LEN[round];
            for (let i = 0; i < n; i++) {
              env.later(() => { if (my !== token) return; const o = panelRef.querySelector(`.orb[data-c="${seq[i]}"]`); if (o) { o.classList.add('lit'); Snd.play('rune'); env.later(() => o.classList.remove('lit'), 420); } }, 400 + i * 700);
            }
            env.later(run, 400 + n * 700 + 2600);
          };
          run();
        }
        return {
          name: '光の宝珠', answer: () => ({ seq, LEN, maps }),
          op: () => { round = 0; input = 0; return `<p>光る順を伝え、表のとおりに おせ <b class="es-round">1 / 3</b></p><div class="es-orbs">${C4.map(c => `<button class="orb" data-c="${c}" style="--c:${COL[c].c}"></button>`).join('')}</div><p class="es-sub">光る順番は くりかえし見られる</p>`; },
          enter(panel) { panelRef = panel; flash(); },
          leave() { token++; panelRef = null; },
          click(e, panel) {
            const o = e.target.closest('.orb'); if (!o) return;
            o.classList.add('press'); env.later(() => o.classList.remove('press'), 200);
            const want = maps[Math.min(miss, 2)][seq[input]];
            if (+o.dataset.c !== want) { input = 0; flash(); return 'bad'; }
            input++; Snd.play('key');
            if (input === LEN[round]) {
              round++; input = 0;
              if (round === 3) { token++; return 'ok'; }
              Snd.play('super'); const rd = panel.querySelector('.es-round'); if (rd) rd.textContent = (round + 1) + ' / 3';
              flash();
            }
          },
          manual: () => `<p>宝珠が光った <b>色を1つずつ</b> 下の表で別の色にかえ、その順に おさせる。<b>いままでの まちがいの回数</b>で使う行がかわる(とちゅうで まちがえたら 行もかわる)。光る数は 2つ→3つ→4つ とふえる。</p>
            <table class="es-table"><tr><th>光った色→</th>${C4.map(c => `<th>${chip(c)}</th>`).join('')}</tr>${maps.map((m, i) => `<tr><th>まちがい${i}回</th>${m.map(v => `<td>${chip(v)}</td>`).join('')}</tr>`).join('')}</table>`
        };
      },

      // ---- 見えない迷路: とびら係には壁が見えない。古文書の地図で道案内 ----
      maze() {
        const N = 6, cells = () => Array.from({ length: N }, () => Array.from({ length: N }, () => ({ n: 1, e: 1, s: 1, w: 1 })));
        const D = { n: [0, -1, 's'], s: [0, 1, 'n'], e: [1, 0, 'w'], w: [-1, 0, 'e'] };
        function carve() {
          const m = cells(), seen = new Set(['0,0']), st = [[0, 0]];
          while (st.length) {
            const [x, y] = st[st.length - 1];
            const nb = Object.keys(D).filter(k => { const nx = x + D[k][0], ny = y + D[k][1]; return nx >= 0 && ny >= 0 && nx < N && ny < N && !seen.has(nx + ',' + ny); });
            if (!nb.length) { st.pop(); continue; }
            const k = nb[ri(nb.length)], nx = x + D[k][0], ny = y + D[k][1];
            m[y][x][k] = 0; m[ny][nx][D[k][2]] = 0; seen.add(nx + ',' + ny); st.push([nx, ny]);
          }
          return m;
        }
        const mazes = [], marks = [];
        while (mazes.length < 4) {
          const a = [ri(N), ri(N)], b = [ri(N), ri(N)];
          const key = [a.join(), b.join()].sort().join('|');
          if (a.join() === b.join() || marks.some(k => k.key === key || k.a.join() === a.join() || k.b.join() === b.join())) continue;
          mazes.push(carve()); marks.push({ a, b, key });
        }
        const pick = ri(4), M = mazes[pick];
        function dist(sx, sy) {
          const d = Array.from({ length: N }, () => Array(N).fill(-1)); d[sy][sx] = 0; const q = [[sx, sy]];
          while (q.length) { const [x, y] = q.shift(); for (const k in D) if (!M[y][x][k]) { const nx = x + D[k][0], ny = y + D[k][1]; if (d[ny][nx] < 0) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); } } }
          return d;
        }
        let start, goal;
        for (;;) {
          start = [ri(N), ri(N)]; const d = dist(start[0], start[1]);
          const far = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[y][x] >= 9) far.push([x, y]);
          if (far.length) { goal = far[ri(far.length)]; break; }
        }
        let pos = start.slice();
        const LET = 'ABCDEF';
        const cellHTML = (x, y) => {
          const mk = [marks[pick].a, marks[pick].b].some(p => p[0] === x && p[1] === y);
          const me = pos[0] === x && pos[1] === y, gl = goal[0] === x && goal[1] === y;
          return `<i class="${mk ? 'mk ' : ''}${me ? 'me ' : ''}${gl ? 'gl' : ''}"></i>`;
        };
        const grid = () => { let s = ''; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) s += cellHTML(x, y); return s; };
        const svg = (m, mk) => {
          const S = 20; let l = '';
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const c = m[y][x], X = x * S + 2, Y = y * S + 2;
            if (c.n) l += `M${X} ${Y}h${S}`; if (c.w) l += `M${X} ${Y}v${S}`;
            if (y === N - 1 && c.s) l += `M${X} ${Y + S}h${S}`; if (x === N - 1 && c.e) l += `M${X + S} ${Y}v${S}`;
          }
          const ring = p => `<circle cx="${p[0] * S + 2 + S / 2}" cy="${p[1] * S + 2 + S / 2}" r="6" fill="none" stroke="#1d7a3a" stroke-width="3"/>`;
          return `<svg viewBox="0 0 124 124"><path d="${l}" stroke="#3d2400" stroke-width="2.4" stroke-linecap="round" fill="none"/>${ring(mk.a)}${ring(mk.b)}</svg>`;
        };
        return {
          name: '見えない迷路', answer: () => { const prev = {}, q = [start.join()]; prev[start.join()] = null; while (q.length) { const c = q.shift(); if (c === goal.join()) break; const [x, y] = c.split(',').map(Number); for (const k in D) if (!M[y][x][k]) { const n = (x + D[k][0]) + ',' + (y + D[k][1]); if (!(n in prev)) { prev[n] = [c, k]; q.push(n); } } } const path = []; let c = goal.join(); while (prev[c]) { path.unshift(prev[c][1]); c = prev[c][0]; } return path; },
          op: () => { pos = start.slice(); return `<p>白い光を 赤い出口まで動かせ。<b>壁は見えない</b></p>
            <div class="es-maze"><div class="es-mz-top">${[...LET].map(c => `<b>${c}</b>`).join('')}</div><div class="es-mz-side">${[1, 2, 3, 4, 5, 6].map(n => `<b>${n}</b>`).join('')}</div><div class="es-mz-grid">${grid()}</div></div>
            <div class="es-arrows"><button data-d="n">▲</button><button data-d="w">◀</button><button data-d="s">▼</button><button data-d="e">▶</button></div>`; },
          click(e, panel) {
            const b = e.target.closest('[data-d]'); if (!b) return;
            const k = b.dataset.d, [x, y] = pos;
            if (M[y][x][k]) { const g = panel.querySelector('.es-mz-grid'); FX.shake(g); return 'bad'; }
            pos = [x + D[k][0], y + D[k][1]]; Snd.play('key');
            panel.querySelector('.es-mz-grid').innerHTML = grid();
            if (pos[0] === goal[0] && pos[1] === goal[1]) return 'ok';
          },
          manual: () => `<p>とびらの迷路にある <b>緑の輪2つ</b> の位置を聞き、同じ位置に輪がある地図をさがす。白い光(いまの場所)と赤い出口の位置も聞いて、<b>壁にぶつからない</b>ように道案内する。壁にぶつかると まちがい。</p>
            <p class="es-sub">マスは 横が A〜F(左から)、たてが 1〜6(上から)。</p>
            <div class="es-mazes">${mazes.map((m, i) => `<div>${svg(m, marks[i])}</div>`).join('')}</div>`
        };
      },

      // ---- ことばのダイヤル: 4つのダイヤルで、表の中のことばを1つだけ作れる ----
      dials() {
        const WORDS = ['あさがお', 'かまきり', 'ひまわり', 'たんぽぽ', 'かみなり', 'くつした', 'すいとう', 'こおろぎ', 'ふくろう', 'はなたば', 'ゆきだま', 'にわとり', 'おにぎり', 'てぶくろ', 'ほうせき', 'ろうそく', 'すなはま', 'かいだん', 'みずうみ', 'ぶらんこ'];
        let ans, sets;
        for (;;) {
          ans = WORDS[ri(WORDS.length)];
          sets = [0, 1, 2, 3].map(i => {
            const pool = [...new Set(WORDS.map(w => w[i]).filter(ch => ch !== ans[i]))];
            return shuffle([ans[i], ...shuffle(pool, r).slice(0, 4)], r);
          });
          if (WORDS.filter(w => [0, 1, 2, 3].every(i => sets[i].includes(w[i]))).length === 1) break;
        }
        let at = sets.map(() => ri(5));
        const dial = i => `<div class="es-dial" data-i="${i}"><button data-m="-1">▲</button><b>${sets[i][at[i]]}</b><button data-m="1">▼</button></div>`;
        return {
          name: 'ことばのダイヤル', answer: () => ({ ans, sets, at }),
          op: () => `<p>ダイヤルを回して <b>正しいことば</b> を となえよ</p><div class="es-dials">${sets.map((_, i) => dial(i)).join('')}</div><button class="btn primary es-say">となえる</button><p class="es-sub">それぞれのダイヤルには 5つの文字がある</p>`,
          click(e, panel) {
            const m = e.target.closest('[data-m]');
            if (m) { const i = +m.closest('.es-dial').dataset.i; at[i] = (at[i] + 5 + +m.dataset.m) % 5; m.closest('.es-dial').querySelector('b').textContent = sets[i][at[i]]; Snd.play('key'); return; }
            if (e.target.closest('.es-say')) return at.map((a, i) => sets[i][a]).join('') === ans ? 'ok' : 'bad';
          },
          manual: () => `<p>4つのダイヤルに入っている文字(それぞれ5つ)を聞き、<b>この中のことばで 作れるものは1つだけ</b>。それを となえさせる。</p>
            <div class="es-words">${WORDS.map(w => `<span>${w}</span>`).join('')}</div>`
        };
      },

      // ---- レバーと灯: 灯のつき方で、レバーの正しい上下が決まる ----
      levers() {
        const pats = shuffle([...Array(32).keys()], r).slice(0, 8);      // 灯の8通り → レバー5本の上下
        const lamp = ri(8);
        let target = pats[lamp];
        if (emblem === 1) target ^= 31;                                   // 月のときは上下を逆に
        let state; do { state = ri(32); } while (state === target);
        const bit = (v, i) => (v >> (4 - i)) & 1;
        const levers = () => [0, 1, 2, 3, 4].map(i => `<button class="lever ${bit(state, i) ? 'up' : 'dn'}" data-l="${i}"><i></i><span>${i + 1}</span></button>`).join('');
        const lampsOf = v => [0, 1, 2].map(i => (v >> (2 - i)) & 1);
        return {
          name: 'レバーと灯', answer: () => ({ target, state }),
          op: () => `<p>灯のつき方を伝え、レバーを正しくして 決定せよ</p><div class="es-lamps">${lampsOf(lamp).map(b => `<i class="${b ? 'on' : ''}"></i>`).join('')}</div>
            <div class="es-levers">${levers()}</div><button class="btn primary es-set">決定</button>`,
          click(e, panel) {
            const l = e.target.closest('.lever');
            if (l) { state ^= 1 << (4 - +l.dataset.l); panel.querySelector('.es-levers').innerHTML = levers(); Snd.play('cut'); return; }
            if (e.target.closest('.es-set')) return state === target ? 'ok' : 'bad';
          },
          manual: () => `<p>3つの灯の <b>つき方(左から)</b> を聞き、5本のレバーを表のとおりに。<b>↑は上、↓は下</b>。とびらの上の紋章が <b>${glyph(1)}月</b> のときは <b>上下をすべて逆</b>にする。</p>
            <table class="es-table es-lv"><tr><th>灯</th><th colspan="5">レバー 1〜5</th></tr>${[...Array(8).keys()].map(p => `<tr><th>${lampsOf(p).map(b => b ? '●' : '○').join('')}</th>${[0, 1, 2, 3, 4].map(i => `<td>${bit(pats[p], i) ? '↑' : '↓'}</td>`).join('')}</tr>`).join('')}</table>
            <p class="es-sub">● = ついている、○ = 消えている</p>`
        };
      }
    };
    const pickKeys = shuffle(Object.keys(PUZ), r).slice(0, 3);
    const P = pickKeys.map(k => PUZ[k]());

    const operator = env.solo || (env.slot === 0) !== env.flip;   // ひとりモードでは自分がとびら係、COMが古文書係
    let left = TIME, over = false, tick = null, lastSec = TIME, endAt = Date.now() + TIME * 1000;

    const top = `<div class="es-top"><div class="es-timer">5:00</div><div class="es-seals"><i></i><i></i><i></i></div><div class="es-miss"><i></i><i></i><i></i></div></div>`;
    const R = env.root;
    if (operator) {
      R.innerHTML = `<div class="es op">${top}
        <div class="es-role"><b>とびら係</b>${env.solo ? 'COMが古文書を読んでくれるよ<button class="es-help">古文書をきく</button>' : '見えるものを 声で相手に伝えよう'}</div>
        <div class="es-comread"><div class="es-comhead"><span>COM「古文書には こう書いてあるよ」</span><button class="es-close">とじる</button></div><div class="es-book"></div></div>
        <div class="es-door"><div class="es-arch"><span class="es-emblem lit">${glyph(emblem)}</span></div><div class="es-panel"></div></div></div>`;
    } else {
      R.innerHTML = `<div class="es rd">${top}
        <div class="es-role"><b>古文書係</b>相手の話を聞いて 解き方を教えよう</div>
        <div class="es-tabs">${P.map((p, i) => `<button data-c="${i}">${KAN[i]} ${p.name}</button>`).join('')}</div>
        <div class="es-book"></div></div>`;
    }
    const timerEl = $('.es-timer', R), panel = $('.es-panel', R), book = $('.es-book', R), wrap = $('.es', R);

    function paintTop() {
      R.querySelectorAll('.es-seals i').forEach((e, i) => e.classList.toggle('on', i < stage));
      R.querySelectorAll('.es-miss i').forEach((e, i) => e.classList.toggle('on', i < miss));
      const s = Math.max(0, Math.ceil(left)); timerEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); timerEl.classList.toggle('danger', s <= 30);
    }
    function sync() { env.send({ t: 'ep', st: stage, ms: miss, left: Math.round(left * 10) / 10 }); }

    // --- とびら係の画面 ---
    function paintStage() {
      const p = P[stage];
      panel.innerHTML = `<h3>第${KAN[stage]}の封印「${p.name}」</h3>` + p.op();
      if (p.enter) p.enter(panel);
    }
    function solved() {
      const p = P[stage]; if (p.leave) p.leave();
      stage++; Snd.play('seal'); Snd.vibrate([30, 30, 60]); paintTop(); sync();
      const s = FX.at(R.querySelectorAll('.es-seals i')[stage - 1]); FX.burst(s.x, s.y, { count: 30, colors: ['#fff', '#ffd166', '#ffe8a3'], speed: 300 }); FX.ring(s.x, s.y, '#ffd166', 80);
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
      if (P[stage] && P[stage].leave) P[stage].leave();
      env.send({ t: 'ee', win, left: Math.round(left), why: why || '' }); finale(win, why);
    }
    function finale(win, why) {
      over = true; clearInterval(tick);
      if (win) { Snd.play('door'); wrap.classList.add('open'); }
      const used = TIME - Math.round(left), tm = Math.floor(used / 60) + '分' + String(used % 60).padStart(2, '0') + '秒';
      const names = P.map(p => p.name).join('・');
      env.later(() => env.result(win ? { kind: 'clear', title: 'だっしゅつ成功!', sub: `とびらが ひらいた!<br>かかった時間 ${tm} ・ まちがい ${miss}回<br><small>今回の封印: ${names}</small>` } : { kind: 'fail', title: 'しっぱい…', sub: why || '時間ぎれ…' }), win ? 1700 : 700);
    }
    if (operator) {
      panel.addEventListener('click', e => {
        if (over || panel.classList.contains('done') || stage >= 3) return;
        const res = P[stage].click(e, panel);
        if (res === 'ok') solved(); else if (res === 'bad') wrong();
      });
      paintStage();
    }

    // --- 古文書係の画面 ---
    const page = i => `<h3>第${KAN[i]}の封印「${P[i].name}」</h3>` + P[i].manual();
    const emblemNote = `<p class="es-sub es-embnote">とびらの上には いつも紋章(${glyph(0)}太陽・${glyph(1)}月・${glyph(2)}星 のどれか)が光っている。まず それを聞いておこう。</p>`;
    function showCh(i) { book.innerHTML = page(i) + emblemNote; book.scrollTop = 0; R.querySelectorAll('.es-tabs button').forEach(b => { b.classList.toggle('on', +b.dataset.c === i); b.classList.toggle('now', +b.dataset.c === stage); b.classList.toggle('clear', +b.dataset.c < stage); }); }
    if (operator && env.solo) {
      const read = $('.es-comread', R);
      $('.es-help', R).addEventListener('click', () => { if (over) return; Snd.play('card'); book.innerHTML = page(Math.min(stage, 2)); book.scrollTop = 0; read.classList.add('on'); });
      $('.es-close', R).addEventListener('click', () => { Snd.play('back'); read.classList.remove('on'); });
    }
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
      stop() { clearInterval(tick); if (P[stage] && P[stage].leave) P[stage].leave(); },
      _debug: { keys: pickKeys, P, emblem, get stage() { return stage; }, get miss() { return miss; } }   // 動作確認用
    };
  }
};
