'use strict';
// ===== ピンポン: スマホをかたむけて(または指で)ラケットを動かす。1P側(ホスト)が玉の計算。7点先取 =====
Games.pong = {
  start(env) {
    const W = 360, H = 640, PW = 74, BR = 8, PY = H - 74, WIN = 7, V0 = 340, VMAX = 920;
    const cv = el('canvas', 'gamecanvas'); env.root.appendChild(cv);
    const tiltBtn = el('button', 'btn small pg-tilt', 'かたむけ操作: OFF'); env.root.appendChild(tiltBtn);
    const view = fitCanvas(cv, W, H), c = cv.getContext('2d'), host = env.host;
    const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, z: 0 };
    const me = { x: W / 2, tx: W / 2, vx: 0 }, op = { x: W / 2, tx: W / 2, vx: 0 };
    let score = [0, 0], phase = 'count', timer = 3.3, count = 3, lastC = 4, server = env.flip ? 1 : 0, from = PY, to = H - PY;
    let raf = 0, last = performance.now(), out = [], parts = [], trail = [], banner = '', bannerT = 0, bannerCol = '#fff', flash = 0, flashMine = true, shake = 0;
    let base = { x: W / 2, y: H / 2, vx: 0, vy: 0 }, recvT = performance.now(), smash = 0, tilt = false, gamma = 0, shown = false, t0 = 0, rally = 0;

    // --- 入力: 指 ---
    const aim = e => { if (tilt) return; me.tx = clamp(view.pt(e).x, PW / 2, W - PW / 2); };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} aim(e); });
    cv.addEventListener('pointermove', e => { if (e.pressure > 0 || e.buttons || e.pointerType === 'touch') aim(e); });
    // --- 入力: かたむけ(左右にかたむけた角度でラケットの位置が決まる) ---
    const onTilt = e => { if (e.gamma != null) gamma = e.gamma; };
    tiltBtn.addEventListener('click', async () => {
      Snd.play('tap');
      if (tilt) { tilt = false; tiltBtn.textContent = 'かたむけ操作: OFF'; tiltBtn.classList.remove('on'); return; }
      try { if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) { const p = await DeviceOrientationEvent.requestPermission(); if (p !== 'granted') { UI.toast('かたむけ操作が許可されませんでした'); return; } } } catch (x) { UI.toast('この端末では かたむけ操作が使えません'); return; }
      window.addEventListener('deviceorientation', onTilt); tilt = true; tiltBtn.textContent = 'かたむけ操作: ON'; tiltBtn.classList.add('on');
      UI.toast('スマホを左右にかたむけて動かそう');
    });

    // --- 演出 ---
    function spark(x, y, n, cols, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rand(0.2, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.25, 0.55), size: rand(1.5, 3.4), col: cols[i % cols.length] }); } }
    function fxEvent(k, x, y, a) {
      if (k === 'hit') { spark(x, y, a > 1 ? 22 : 8, a > 1 ? ['#fff', '#ff5d5d', '#ffd166'] : ['#fff', '#ffd166'], a > 1 ? 380 : 200); Snd.play('hit', a > 1 ? 1 : 0.55); if (a > 1) { banner = 'スマッシュ!'; bannerCol = '#ff7b7b'; bannerT = 0.9; shake = 6; } }
      else if (k === 'wall') { spark(x, y, 4, ['#fff', '#7ee8fa'], 110); Snd.play('wall'); }
      else if (k === 'point') {
        const mine = a === 1; flash = 1; flashMine = mine; shake = 10;
        banner = mine ? 'とった!' : 'とられた…'; bannerCol = mine ? '#ffd166' : '#ff9ebb'; bannerT = 1.4;
        Snd.play(mine ? 'goal' : 'conceded'); Snd.vibrate(mine ? [40, 30, 90] : 160);
      }
      else if (k === 'count') Snd.play('count');
      else if (k === 'go') { Snd.play('go'); banner = 'スタート!'; bannerCol = '#7ee8fa'; bannerT = 0.8; }
      else if (k === 'serve') Snd.play('tap');
    }
    function emit(k, x, y, a) { fxEvent(k, x, y, a); out.push([k, Math.round(W - x), Math.round(H - y), k === 'point' ? 1 - a : a]); }

    // --- 玉の計算(ホストのみ)。自分 = 下(0)、相手 = 上(1) ---
    function serveBall() {
      const s = server; ball.x = s === 0 ? me.x : op.x; ball.y = s === 0 ? PY - 18 : H - PY + 18;
      const ang = rand(-0.35, 0.35); ball.vx = Math.sin(ang) * V0; ball.vy = (s === 0 ? -1 : 1) * Math.cos(ang) * V0;
      from = ball.y; to = s === 0 ? H - PY : PY; rally = 0; emit('serve', ball.x, ball.y, 0);
    }
    function point(mineWon) {
      score[mineWon ? 0 : 1]++; emit('point', W / 2, H / 2, mineWon ? 1 : 0);
      server = mineWon ? 1 : 0; phase = 'point'; timer = 1.6; ball.vx = ball.vy = 0; trail = [];
    }
    function hit(p, side) {
      const off = clamp((ball.x - p.x) / (PW / 2 + BR), -1, 1), sp = Math.hypot(ball.vx, ball.vy);
      const sm = Math.abs(p.vx) > 520 && rally > 0;
      let ns = Math.min(VMAX, sp * 1.045 + 8) * (sm ? 1.22 : 1); ns = Math.min(ns, VMAX * 1.15);
      const ang = off * 0.95 + clamp(p.vx / 2400, -0.25, 0.25);
      ball.vx = Math.sin(ang) * ns; ball.vy = (side === 0 ? -1 : 1) * Math.cos(ang) * ns;
      from = ball.y; to = side === 0 ? H - PY : PY; rally++;
      emit('hit', ball.x, ball.y, sm ? 2 : 1); if (sm) smash = 1;
    }
    function step(h) {
      if (phase === 'serve') { ball.x = server === 0 ? me.x : op.x; return; }
      if (phase !== 'play') return;
      const py = ball.y; ball.x += ball.vx * h; ball.y += ball.vy * h;
      if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); emit('wall', 0, ball.y, 0); }
      if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); emit('wall', W, ball.y, 0); }
      if (ball.vy > 0 && py <= PY && ball.y > PY && Math.abs(ball.x - me.x) < PW / 2 + BR) { ball.y = PY; hit(me, 0); }
      else if (ball.vy < 0 && py >= H - PY && ball.y < H - PY && Math.abs(ball.x - op.x) < PW / 2 + BR) { ball.y = H - PY; hit(op, 1); }
      if (ball.y > H + 20) point(false); else if (ball.y < -20) point(true);
    }
    function hostUpdate(dt) {
      if (phase === 'count') {
        timer -= dt; const n = Math.ceil(timer - 0.3); count = clamp(n, 0, 3);
        if (n < lastC && n >= 1) { lastC = n; emit('count', 0, 0, 0); }
        if (timer <= 0.3) { emit('go', 0, 0, 0); phase = 'serve'; timer = 1.1; }
      } else if (phase === 'point') {
        timer -= dt; if (timer <= 0) { if (score[0] >= WIN || score[1] >= WIN) phase = 'over'; else { phase = 'serve'; timer = 1.1; } }
      } else if (phase === 'serve') { timer -= dt; if (timer <= 0) { phase = 'play'; serveBall(); } }
      const h = 1 / 240; let n = Math.min(24, Math.round(dt / h)); while (n-- > 0) step(h);
      ball.z = height(ball.y);
      const r = v => Math.round(v * 10) / 10;
      env.send({ t: 'gs', b: [r(W - ball.x), r(H - ball.y), r(-ball.vx), r(-ball.vy)], f: [H - from, H - to], o: r(W - me.x), s: [score[1], score[0]], ph: phase, c: count, sv: 1 - server, ev: out });
      out = [];
    }
    function guestUpdate() {
      env.send({ t: 'gm', x: Math.round((W - me.x) * 10) / 10 });
      const age = Math.min(0.12, (performance.now() - recvT) / 1000);
      if (phase === 'play') { ball.x = clamp(base.x + base.vx * age, BR, W - BR); ball.y = base.y + base.vy * age; } else { ball.x = base.x; ball.y = base.y; }
      ball.z = height(ball.y);
    }
    // 見た目の高さ: 打った所から相手コートで1回はずんで、相手のラケットへ
    function height(y) {
      if (phase !== 'play') return 6;
      const f = clamp((y - from) / ((to - from) || 1), 0, 1), b = 0.66;
      return f < b ? 4 * (f / b) * (1 - f / b) * 46 + 4 : 4 * ((f - b) / (1 - b)) * (1 - (f - b) / (1 - b)) * 26 + 4;
    }
    function movePaddles(dt) {
      if (tilt) me.tx = clamp(W / 2 + clamp(gamma / 28, -1, 1) * (W / 2 - PW / 2), PW / 2, W - PW / 2);
      for (const p of [me, op]) { const nx = p.x + clamp(p.tx - p.x, -1500 * dt, 1500 * dt); p.vx = p.vx * 0.6 + ((nx - p.x) / (dt || 1 / 60)) * 0.4; p.x = nx; }
    }

    // --- 描画 ---
    function racket(p, y, mine) {
      const im = Img.get(mine ? 'pg_paddle_red' : 'pg_paddle_blue');
      c.save(); c.translate(p.x, y); if (!mine) c.rotate(Math.PI);
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(4, 8, PW * 0.5, PW * 0.42, 0, 0, 7); c.fill();
      if (im) { const w = PW * 1.12, hh = w * im.naturalHeight / im.naturalWidth; c.drawImage(im, -w / 2, -w * 0.52, w, hh); }
      else { c.fillStyle = mine ? '#e63946' : '#1d4ed8'; c.beginPath(); c.ellipse(0, 0, PW / 2, PW * 0.44, 0, 0, 7); c.fill(); c.fillStyle = '#c08a4a'; c.fillRect(-7, PW * 0.38, 14, 34); }
      c.restore();
    }
    function draw(dt) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const sx = shake > 0.3 ? rand(-shake, shake) : 0, sy = shake > 0.3 ? rand(-shake, shake) : 0;
      c.setTransform(view.s, 0, 0, view.s, sx * view.s, sy * view.s);
      const tb = Img.get('pg_table');
      if (tb) c.drawImage(tb, 0, 0, W, H);
      else { c.fillStyle = '#123f8c'; c.fillRect(0, 0, W, H); c.strokeStyle = '#fff'; c.lineWidth = 4; c.strokeRect(8, 8, W - 16, H - 16); c.fillStyle = '#eee'; c.fillRect(0, H / 2 - 3, W, 6); }
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 120px system-ui,sans-serif';
      c.fillStyle = 'rgba(255,255,255,.13)'; c.fillText(String(score[1]), W / 2, H * 0.27); c.fillText(String(score[0]), W / 2, H * 0.73);
      racket(op, H - PY, false);
      // 玉(影 → 軌跡 → 本体)
      if (phase === 'play' || phase === 'serve') {
        const z = ball.z, s = 1 + z / 60;
        c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(ball.x + z * 0.35, ball.y + z * 0.5, BR * 0.95, BR * 0.75, 0, 0, 7); c.fill();
        c.globalCompositeOperation = 'lighter';
        trail.forEach((p, i) => { const k = (i + 1) / trail.length; c.fillStyle = smash > 0 ? `rgba(255,90,90,${k * 0.35})` : `rgba(255,190,90,${k * 0.22})`; c.beginPath(); c.arc(p[0], p[1], BR * (0.3 + k * 0.7) * p[2], 0, 7); c.fill(); });
        c.globalCompositeOperation = 'source-over';
        const bi = Img.get('pg_ball');
        if (bi) c.drawImage(bi, ball.x - BR * 1.25 * s, ball.y - z * 0.4 - BR * 1.25 * s, BR * 2.5 * s, BR * 2.5 * s);
        else { c.fillStyle = '#ff9f1c'; c.beginPath(); c.arc(ball.x, ball.y - z * 0.4, BR * s, 0, 7); c.fill(); }
      }
      racket(me, PY, true);
      c.globalCompositeOperation = 'lighter';
      parts = parts.filter(p => { p.t += dt; if (p.t >= p.life) return false; p.x += p.vx * dt; p.y += p.vy * dt; const k = 1 - p.t / p.life; c.globalAlpha = k; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * k + 0.3, 0, 7); c.fill(); return true; });
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (flash > 0) { c.fillStyle = flashMine ? `rgba(255,220,120,${flash * 0.3})` : `rgba(255,90,140,${flash * 0.3})`; c.fillRect(0, 0, W, H); }
      let txt = '', col = '#fff', size = 60;
      if (phase === 'count' && count >= 1) { txt = String(count); size = 120; col = '#ffd166'; }
      else if (bannerT > 0) { txt = banner; col = bannerCol; c.globalAlpha = Math.min(1, bannerT * 3); }
      if (txt) {
        c.font = '900 ' + size + 'px "Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif'; c.lineJoin = 'round';
        c.lineWidth = 10; c.strokeStyle = 'rgba(5,8,30,.8)'; c.strokeText(txt, W / 2, H / 2); c.fillStyle = col; c.fillText(txt, W / 2, H / 2); c.globalAlpha = 1;
      }
      if (t0 < 4) { c.font = '800 14px system-ui,sans-serif'; c.fillStyle = 'rgba(255,255,255,.9)'; c.fillText('指でなぞるか、下のボタンで かたむけ操作に', W / 2, H - 22); }
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t0 += dt;
      movePaddles(dt);
      if (host) hostUpdate(dt); else guestUpdate();
      if (phase === 'play') { trail.push([ball.x, ball.y - ball.z * 0.4, 1 + ball.z / 60]); if (trail.length > 10) trail.shift(); } else trail = [];
      flash = Math.max(0, flash - dt * 2); shake *= Math.pow(0.02, dt); bannerT -= dt; smash = Math.max(0, smash - dt * 0.8);
      draw(dt);
      if (phase === 'over' && !shown) {
        shown = true; const win = score[0] > score[1];
        env.later(() => env.result({ kind: win ? 'win' : 'lose', title: win ? 'かち!' : 'まけ…', sub: `${score[0]} - ${score[1]}` }), 300);
      }
    }
    raf = requestAnimationFrame(loop);

    return {
      msg(m) {
        if (m.t === 'gm' && host) op.tx = clamp(m.x, PW / 2, W - PW / 2);
        else if (m.t === 'gs' && !host) {
          base = { x: m.b[0], y: m.b[1], vx: m.b[2], vy: m.b[3] }; recvT = performance.now(); from = m.f[0]; to = m.f[1];
          op.tx = m.o; score = m.s; phase = m.ph; count = m.c; server = m.sv;
          (m.ev || []).forEach(e => { fxEvent(e[0], e[1], e[2], e[3]); if (e[0] === 'hit' && e[3] > 1) smash = 1; });
        }
      },
      stop() { cancelAnimationFrame(raf); view.off(); window.removeEventListener('deviceorientation', onTilt); },
      _debug: { ball, me, get score() { return score; }, get rally() { return rally; } }   // 動作確認用
    };
  }
};
