// Tabelmuren: a times table laid as ten bricks, 1×t to 10×t, with four
// missing. Type the number for the highlighted hole and press Enter:
// right fills the brick and pays 1 gold, wrong costs 1 gold and shakes the
// brick; the third wrong answer fills the brick in grey with the answer.
// Keyboard only. A finished wall shows the tally; Space lays a new one.
(function () {
  const HE = window.HE;
  const S = HE.strings.wall;
  const SA = HE.strings.arena;
  const D = HE.data;
  const W = 256;
  const H = 224;
  const GAPS = 4;
  const BRICK_W = 44;
  const BRICK_H = 22;
  const X0 = 8;
  const ROW_Y = [70, 110]; // 40 apart: brick, then the next row's k× label
  const GROUND_Y = 196;
  const MAX_TRIES = 3;

  const st = {};
  let frames = 0;

  function newWall() {
    const tasks = HE.activeTasks();
    const forced = parseInt(HE.params.get("table"), 10);
    const t = tasks.tables.includes(forced) ? forced : D.pick(tasks.tables);
    st.table = t;
    const ks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const holes = new Set();
    while (holes.size < GAPS) holes.add(D.pick(ks));
    st.bricks = ks.map((k) => ({ k, value: t * k, hole: holes.has(k), filled: !holes.has(k), grey: false, tries: 0 }));
    st.cur = st.bricks.findIndex((b) => b.hole);
    st.typed = "";
    st.correct = 0;
    st.wrong = 0;
    st.net = 0; // gold won minus gold lost this wall
    st.message = "";
    st.msgTimer = 0;
    st.shake = 0;
    st.phase = "intro";
  }

  function say(msg, t) {
    st.message = msg;
    st.msgTimer = t;
  }

  function next() {
    st.cur = st.bricks.findIndex((b, i) => i > st.cur && b.hole && !b.filled);
    st.typed = "";
    if (st.cur < 0) finish();
  }

  function answer(n) {
    const b = st.bricks[st.cur];
    if (n === b.value) {
      b.filled = true;
      st.correct += 1;
      st.net += 1;
      say(SA.correct, 40);
      next();
      return;
    }
    st.wrong += 1;
    st.net -= 1;
    b.tries += 1;
    st.shake = 16;
    st.typed = "";
    if (b.tries >= MAX_TRIES) {
      b.filled = true;
      b.grey = true;
      say(S.reveal(b.value), 70);
      next();
    } else say(S.tryAgain, 40);
  }

  function finish() {
    const sv = HE.save;
    sv.gold = Math.max(0, sv.gold + st.net);
    const stat = HE.stat(String(st.table));
    stat.correct += st.correct;
    stat.wrong += st.wrong;
    HE.persist();
    st.phase = "done";
  }

  function update() {
    frames += 1;
    if (st.msgTimer > 0) st.msgTimer -= 1;
    if (st.shake > 0) st.shake -= 1;
    const inp = HE.input;
    const typing = st.phase === "fill" && st.typed;
    if (st.door && (inp.pressed("Escape") || (inp.pressed("Backspace") && !typing))) return HE.go("town", { door: st.door });
    switch (st.phase) {
      case "intro":
        if (inp.go()) st.phase = "fill";
        break;
      case "fill": {
        const d = inp.digit();
        if (d !== null && st.typed.length < 3) st.typed += d;
        if (typing && inp.pressed("Backspace")) st.typed = st.typed.slice(0, -1);
        if (inp.go() && st.typed) answer(parseInt(st.typed, 10));
        break;
      }
      case "done":
        if (inp.go()) newWall();
        break;
    }
  }

  function brickPos(i) {
    const row = i < 5 ? 0 : 1;
    return { x: X0 + (i % 5) * (BRICK_W + 5), y: ROW_Y[row] };
  }

  function drawBricks(ctx) {
    st.bricks.forEach((b, i) => {
      let { x, y } = brickPos(i);
      const cur = i === st.cur && st.phase === "fill";
      if (cur && st.shake > 0) x += Math.round(Math.sin(st.shake * 1.5) * 3);
      if (b.filled) {
        ctx.fillStyle = b.grey ? "#78909c" : "#c8553d";
        ctx.fillRect(x, y, BRICK_W, BRICK_H);
        ctx.fillStyle = b.grey ? "#546e7a" : "#a1482c";
        ctx.fillRect(x, y + BRICK_H - 3, BRICK_W, 3);
        HE.text(ctx, String(b.value), x + BRICK_W / 2, y + 6, { size: 10, color: "#fff8e1" });
      } else {
        ctx.fillStyle = "#1c262e"; // the hole
        ctx.fillRect(x, y, BRICK_W, BRICK_H);
        if (cur) {
          ctx.fillStyle = "#fdd835";
          ctx.fillRect(x, y, BRICK_W, 1);
          ctx.fillRect(x, y + BRICK_H - 1, BRICK_W, 1);
          ctx.fillRect(x, y, 1, BRICK_H);
          ctx.fillRect(x + BRICK_W - 1, y, 1, BRICK_H);
          HE.text(ctx, st.typed + (frames % 40 < 20 ? "_" : ""), x + BRICK_W / 2, y + 6, { size: 10, color: "#fdd835" });
        } else HE.text(ctx, "?", x + BRICK_W / 2, y + 6, { size: 10, color: "#455a64" });
      }
      HE.text(ctx, `${b.k}×`, x + BRICK_W / 2, y - 9, { size: 8, color: "#90a4ae" });
    });
  }

  function drawGround(ctx) {
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, GROUND_Y, W, 2);
  }

  function drawPetCorner(ctx, cheer) {
    const pet = HE.petId();
    const lvl = HE.petLevel();
    const height = D.petArenaHeight(lvl);
    const dy = cheer ? -Math.abs(Math.sin(frames / 5)) * 6 : 0;
    const box = HE.drawPet(ctx, pet, lvl, 30, GROUND_Y, { height, dy, frames: cheer ? undefined : frames });
    if (cheer && box) HE.bubble(ctx, HE.strings.calls[pet], 30, box.y - 2);
  }

  function draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    const blink = frames % 60 < 40;
    if (st.phase === "intro") {
      drawGround(ctx);
      HE.text(ctx, S.name, W / 2, 40, { size: 16, color: "#fdd835" });
      HE.text(ctx, SA.table(st.table), W / 2, 68, { size: 12 });
      HE.text(ctx, S.intro, W / 2, 96, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, S.stakes, W / 2, 110, { size: 8, color: "#fdd835" });
      HE.text(ctx, S.controls, W / 2, 124, { size: 8, color: "#cfd8dc" });
      if (blink) HE.text(ctx, S.start, W / 2, 156, { size: 8 });
      drawPetCorner(ctx, false);
      return;
    }
    if (st.phase === "done") {
      drawGround(ctx);
      HE.text(ctx, S.done, W / 2, 22, { size: 16, color: "#fdd835" });
      HE.text(ctx, SA.table(st.table), W / 2, 44, { size: 8, color: "#cfd8dc" });
      drawBricks(ctx);
      HE.text(ctx, `${SA.correctCount(st.correct)} · ${SA.wrongCount(st.wrong)}`, W / 2, 140, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, S.net(st.net), W / 2, 154, { size: 12, color: st.net >= 0 ? "#fdd835" : "#ef9a9a" });
      if (blink) HE.text(ctx, st.door ? S.again : SA.again, W / 2, 176, { size: 8 });
      drawPetCorner(ctx, st.net > 0);
      return;
    }
    HE.text(ctx, SA.table(st.table), 4, 4, { size: 8, align: "left", color: "#cfd8dc" });
    HE.text(ctx, SA.gold(Math.max(0, HE.save.gold + st.net)), W - 4, 4, { size: 8, align: "right", color: "#fdd835" });
    HE.text(ctx, S.intro, W / 2, 30, { size: 8, color: "#cfd8dc" });
    drawBricks(ctx);
    if (st.msgTimer > 0) {
      const ok = st.message === SA.correct;
      HE.text(ctx, st.message, W / 2, 148, { size: 10, color: ok ? "#81c784" : "#ffb74d" });
    }
    if (blink) HE.text(ctx, S.controls, W / 2, 172, { size: 8, color: "#607d8b" });
    drawGround(ctx);
    drawPetCorner(ctx, st.msgTimer > 0 && st.message === SA.correct);
  }

  HE.registerScene("wall", {
    enter(payload) {
      st.door = payload.door || null;
      newWall();
    },
    update,
    draw,
  });
  HE.wallState = st;
})();
