// Guldarenaen: intro -> round(k) -> hit -> round(k+1) | results.
(function () {
  const HE = window.HE;
  const S = HE.strings.arena;
  const D = HE.data;
  const A = D.arena;
  const W = 256;
  const H = 224;

  const COLS = [56, 128, 200]; // centre x of each crab + sign
  const SIGN_Y = 56;
  const SIGN_W = 40;
  const SIGN_H = 18;
  const CRAB_Y = 86; // crab sprite 16x12
  const TARGET_HALF_W = 20;
  const GROUND_Y = 204;
  const TREX_Y = GROUND_Y - D.arena.trexHeight; // top of the skater
  const TREX_W = 16; // logical width: trexX is its left edge, the shot leaves its centre

  const st = {};
  let frames = 0;

  function newGame() {
    st.game = HE.activeTasks().newGame(); // { key, title, rounds }
    st.round = 0;
    st.correct = 0;
    st.wrong = 0;
    st.gold = 0;
    st.bonus = false;
    st.phase = "intro";
    st.trexX = 120;
    st.trexRight = true;
    st.trexRolling = 0; // frames since the last move, for the two-frame push
    st.shot = null;
    st.typed = "";
    st.timer = 0;
    st.crabs = [];
    st.message = "";
  }

  function startRound() {
    st.crabs = st.game.rounds[st.round].signs.map((s, i) => ({
      x: COLS[i],
      value: s.value,
      correct: s.correct,
      hit: false,
    }));
    st.shot = null;
    st.typed = ""; // digits typed as an answer instead of shooting
    st.phase = "round";
  }

  // The crab that was shot or whose number was typed; null for a typed
  // number no sign shows (counts as wrong).
  function resolve(crab) {
    if (crab) crab.hit = true;
    st.shot = null;
    if (crab && crab.correct) {
      st.correct += 1;
      st.gold += 1;
      st.message = S.correct;
      st.timer = A.hitPauseCorrect;
    } else {
      st.wrong += 1;
      st.gold = Math.max(0, st.gold - 1);
      st.message = S.wrong(st.game.rounds[st.round].answer);
      st.timer = A.hitPauseWrong;
    }
    st.phase = "hit";
  }

  function finish() {
    if (st.correct === st.game.rounds.length) {
      st.bonus = true;
      st.gold += A.bonusGold;
    }
    st.phase = "results";
    // Bank the game into the save.
    const sv = HE.save;
    sv.gold += st.gold;
    sv.games += 1;
    const stat = HE.stat(st.game.key);
    stat.correct += st.correct;
    stat.wrong += st.wrong;
    HE.persist();
  }

  function update() {
    frames += 1;
    const inp = HE.input;
    // Esc/Backspace walks out at any point (Backspace deletes instead while
    // an answer is being typed). Before the results only finish() banks
    // gold, so an abandoned game earns nothing.
    const typing = st.phase === "round" && st.typed;
    if (st.door && (inp.pressed("Escape") || (inp.pressed("Backspace") && !typing))) return HE.go("town", { door: st.door });
    switch (st.phase) {
      case "intro":
        if (inp.go()) startRound();
        break;
      case "round": {
        if (inp.held("ArrowLeft") || inp.held("ArrowRight")) {
          st.trexRight = inp.held("ArrowRight");
          st.trexX += st.trexRight ? A.trexSpeed : -A.trexSpeed;
          st.trexRolling += 1;
        } else st.trexRolling = 0;
        st.trexX = Math.max(A.trexMinX, Math.min(W - 20, st.trexX));
        // Typed answer: digits build it, Backspace trims, ok submits.
        const d = inp.digit();
        if (d !== null && st.typed.length < 3) st.typed += d;
        if (typing && inp.pressed("Backspace")) st.typed = st.typed.slice(0, -1);
        if (st.typed && inp.go()) {
          const v = parseInt(st.typed, 10);
          resolve(st.crabs.find((c) => c.value === v) || null);
          break;
        }
        if (inp.go() && !st.shot) {
          st.shot = { x: st.trexX + TREX_W / 2 + 1, y: TREX_Y - 4 };
        }
        if (st.shot) {
          st.shot.y -= A.shotSpeed;
          if (st.shot.y + 6 < SIGN_Y) {
            st.shot = null; // missed everything: no penalty
          } else {
            for (const c of st.crabs) {
              const inX = st.shot.x + 2 > c.x - TARGET_HALF_W && st.shot.x < c.x + TARGET_HALF_W;
              const inY = st.shot.y < CRAB_Y + 12 && st.shot.y + 6 > SIGN_Y;
              if (inX && inY) {
                resolve(c);
                break;
              }
            }
          }
        }
        break;
      }
      case "hit":
        st.timer -= 1;
        if (st.timer <= 0) {
          st.round += 1;
          if (st.round >= st.game.rounds.length) finish();
          else startRound();
        }
        break;
      case "results":
        // Space/Enter replays; Esc/Backspace leaves (when entered from town).
        if (inp.go()) newGame();
        break;
    }
  }

  function drawGround(ctx) {
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, GROUND_Y, W, 2);
  }

  function drawCrab(ctx, c, highlight) {
    if (highlight) {
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(c.x - TARGET_HALF_W - 2, SIGN_Y - 3, TARGET_HALF_W * 2 + 4, CRAB_Y + 12 - SIGN_Y + 6);
    }
    // sign
    ctx.fillStyle = "#fff3c4";
    ctx.fillRect(c.x - SIGN_W / 2, SIGN_Y, SIGN_W, SIGN_H);
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(c.x - SIGN_W / 2, SIGN_Y, SIGN_W, 1);
    ctx.fillRect(c.x - SIGN_W / 2, SIGN_Y + SIGN_H - 1, SIGN_W, 1);
    ctx.fillRect(c.x - SIGN_W / 2, SIGN_Y, 1, SIGN_H);
    ctx.fillRect(c.x + SIGN_W / 2 - 1, SIGN_Y, 1, SIGN_H);
    // post
    ctx.fillRect(c.x - 1, SIGN_Y + SIGN_H, 2, CRAB_Y - SIGN_Y - SIGN_H + 2);
    HE.text(ctx, String(c.value), c.x, SIGN_Y + 4, { size: 10, color: "#000000" });
    // crab
    ctx.globalAlpha = c.hit && !c.correct ? 0.35 : 1;
    HE.drawSprite(ctx, "crab", c.x - 8, CRAB_Y);
    ctx.globalAlpha = 1;
  }

  // The active pet on the sideline, bottom-left. Idle: bob. Correct hit:
  // hops with its call. Wrong hit: sags with "Øv...".
  function drawSideline(ctx) {
    const pet = HE.petId();
    const lvl = HE.petLevel();
    const height = D.petArenaHeight(lvl);
    let box;
    if (st.phase === "hit" && st.message === S.correct) {
      const t = (A.hitPauseCorrect - st.timer) / 60; // seconds into the pause
      const dy = -Math.abs(Math.sin(t * Math.PI * A.hopsPerSecond)) * A.hopHeight;
      box = HE.drawPet(ctx, pet, lvl, A.banditX, GROUND_Y, { height, dy });
      if (box) HE.bubble(ctx, HE.strings.calls[pet], A.banditX, box.y - 2);
    } else if (st.phase === "hit") {
      box = HE.drawPet(ctx, pet, lvl, A.banditX, GROUND_Y, { height, squash: 0.9 });
      if (box) HE.bubble(ctx, S.sad, A.banditX, box.y - 2);
    } else {
      HE.drawPet(ctx, pet, lvl, A.banditX, GROUND_Y, { height, frames });
    }
  }

  // Cartoon T-rex on his board: frame a idle, a/b alternating while rolling,
  // mirrored to face the way he last moved.
  function drawTrex(ctx) {
    const pushing = st.trexRolling > 0 && Math.floor(frames / 8) % 2 === 1;
    HE.drawImg(ctx, pushing ? "trex-b" : "trex-a", st.trexX + TREX_W / 2, GROUND_Y, { h: A.trexHeight, flipX: !st.trexRight });
  }

  function drawHud(ctx) {
    HE.text(ctx, st.game.title, 4, 4, { size: 8, align: "left", color: "#cfd8dc" });
    HE.text(ctx, S.round(st.round + 1, st.game.rounds.length), W / 2, 4, { size: 8, color: "#cfd8dc" });
    HE.text(ctx, S.gold(st.gold), W - 4, 4, { size: 8, align: "right", color: "#fdd835" });
  }

  function draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    const blink = frames % 60 < 40;

    if (st.phase === "intro") {
      drawGround(ctx);
      HE.text(ctx, S.name, W / 2, 48, { size: 16, color: "#fdd835" });
      HE.text(ctx, st.game.title, W / 2, 80, { size: 12 });
      HE.text(ctx, S.intro, W / 2, 108, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, S.controls, W / 2, 124, { size: 8, color: "#cfd8dc" });
      if (blink) HE.text(ctx, S.start, W / 2, 156, { size: 8 });
      drawTrex(ctx);
      drawSideline(ctx);
      return;
    }

    if (st.phase === "results") {
      drawGround(ctx);
      // Text column sits left of centre so a level-10 Bandit (86 px tall,
      // ~50 wide) fits to the right without covering the prompt.
      const TX = W / 2 - 28;
      HE.text(ctx, S.results, TX, 28, { size: 16, color: "#fdd835" });
      HE.text(ctx, st.game.title, TX, 52, { size: 8, color: "#cfd8dc" });
      HE.text(ctx, S.correctCount(st.correct), TX, 74, { size: 10, color: "#81c784" });
      HE.text(ctx, S.wrongCount(st.wrong), TX, 90, { size: 10, color: "#ef9a9a" });
      if (st.bonus) HE.text(ctx, S.bonus, TX, 110, { size: 8, color: "#fdd835" });
      HE.text(ctx, S.earned(st.gold), TX, 128, { size: 12, color: "#fdd835" });
      if (blink) HE.text(ctx, st.door ? S.leaveOrAgain : S.again, TX, 160, { size: 8 });
      // The pet at full level height, right of the text.
      HE.drawPet(ctx, HE.petId(), HE.petLevel(), W - 40, GROUND_Y, { frames });
      return;
    }

    drawHud(ctx);
    HE.text(ctx, st.game.rounds[st.round].prompt, W / 2, 26, { size: 16 });
    const flashing = st.phase === "hit" && frames % 12 < 6;
    for (const c of st.crabs) drawCrab(ctx, c, flashing && c.correct);
    if (st.game.table) HE.drawTablePanel(ctx, st.game.table, HE.tableRevealed(st.game, st.correct + st.wrong), W - 28, 18);
    drawGround(ctx);
    drawTrex(ctx);
    if (st.shot) {
      HE.drawSprite(ctx, "shot", st.shot.x, st.shot.y);
    }
    if (st.phase === "round" && st.typed) {
      HE.text(ctx, S.typed(st.typed), st.trexX + TREX_W / 2, TREX_Y - 14, { size: 8, color: "#fdd835" });
    }
    if (st.phase === "hit") {
      const ok = st.message === S.correct;
      ctx.fillStyle = "#101820";
      ctx.fillRect(28, 132, W - 56, 22); // stops short of the table panel
      HE.text(ctx, st.message, W / 2, 138, { size: 10, color: ok ? "#81c784" : "#ffb74d" });
    }
    drawSideline(ctx); // last, so his speech bubble sits over the message box
  }

  HE.registerScene("arena", {
    enter(payload) {
      st.door = payload.door || null; // where to return to in town
      newGame();
    },
    update,
    draw,
  });
  HE.arenaState = st; // read-only view for playtest tooling
})();
