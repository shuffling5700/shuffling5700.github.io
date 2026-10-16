// Fartringen: intro -> question(k) -> move -> question(k+1) | results.
// Nine questions on an oval against Hyæne Hans. A correct answer moves the
// active pet 2–6 steps by how fast it came; Hans trots 3–5 regardless. The
// T-rex skater referees from the finish line. Answer by typing the number
// or by picking one of three signs with ← →; Space/Enter submits.
(function () {
  const HE = window.HE;
  const S = HE.strings.race;
  const SA = HE.strings.arena;
  const D = HE.data;
  const R = D.race;
  const W = 256;
  const H = 224;

  // Track geometry: ellipses centred on (CX, CY). Hans runs the outer lane,
  // the pet the inner. Runners start at the bottom and go anticlockwise.
  // The oval sits left of centre so the table panel fits down the right.
  const CX = 114;
  const CY = 122;
  const OUTER = { rx: 100, ry: 72 };
  const INNER = { rx: 62, ry: 38 };
  const LANE_HANS = { rx: 88, ry: 62 };
  const LANE_PET = { rx: 70, ry: 44 };
  const SIGN_X = [76, 114, 152];
  const SIGN_Y = 96;
  const SIGN_W = 34;
  const SIGN_H = 16;

  const st = {};
  let frames = 0;

  const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
  const rndInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  // Budget per question in seconds, drawn once per race, and Hans's form.
  function drawBudget(game) {
    const tableGame = HE.activeTasks() === HE.tasks[10] && /^\d+$/.test(game.key);
    const [lo, hi] = tableGame ? R.tableBudget : R.questionBudget;
    const total = rnd(lo, hi);
    const b = tableGame ? total / game.rounds.length : total;
    const u = (total - lo) / (hi - lo);
    return { b, form: u < 0.35 ? "top" : u > 0.65 ? "sleepy" : "ok" };
  }

  function newRace() {
    st.game = HE.activeTasks().newGame(); // { key, title, rounds }
    st.lap = st.game.rounds.length * R.stepsPerQuestion;
    const bud = drawBudget(st.game);
    st.budget = bud.b;
    st.form = bud.form;
    // The prize follows the table, then Hans's form: double when he is in
    // top form (tight budget), half when he is sleepy.
    // No stake: the race is free and the old stake comes off the prize.
    // Age 7's 5- and 10-tables are not harder for her than the 2-table, so
    // they pay the same (flatTablePrize).
    const tableFor = HE.activeTasks().flatTablePrize ? R.flatTable : st.game.table;
    const base = st.game.table ? R.winGoldForTable(tableFor) : R.winGold;
    st.prize = Math.max(R.minPrize, Math.round(base * R.formPrize[st.form]) - R.entryFromPrize);
    st.round = 0;
    st.you = 0; // steps
    st.hans = 0;
    st.correct = 0;
    st.wrong = 0;
    st.turbos = 0;
    st.time = 0; // seconds spent on correct answers
    st.phase = "intro";
    st.anim = null;
    st.message = "";
    st.shout = "";
    st.result = null;
  }

  function startQuestion() {
    st.signs = st.game.rounds[st.round].signs;
    st.sel = -1; // no sign highlighted until an arrow is pressed
    st.typed = "";
    st.clock = 0;
    st.shout = "";
    st.message = "";
    st.phase = "question";
  }

  function tierFor(t) {
    const f = t / st.budget;
    return R.tiers.find((tier) => f <= tier.upTo);
  }

  function answer(value) {
    const round = st.game.rounds[st.round];
    const hans = rndInt(R.hansSteps[0], R.hansSteps[1]);
    let you = 0;
    if (value === round.answer) {
      const t = st.clock / 60;
      const tier = tierFor(t);
      you = tier.steps;
      st.correct += 1;
      st.time += t;
      if (tier.shout === "turbo") st.turbos += 1;
      st.shout = S.shout[tier.shout];
      st.timer = R.movePause;
    } else {
      st.wrong += 1;
      st.message = S.wrong(round.answer);
      st.timer = R.wrongPause;
    }
    st.anim = { from: { you: st.you, hans: st.hans }, t: 0, dur: R.movePause };
    st.you = Math.min(st.lap, st.you + you);
    st.hans = Math.min(st.lap, st.hans + hans);
    st.phase = "move";
  }

  function finish() {
    const sv = HE.save;
    const won = st.you > st.hans;
    const res = { won, tie: st.you === st.hans, gold: 0, perfect: false, record: false };
    const total = Math.round(st.time * 10) / 10;
    res.time = total;
    if (won) {
      let gold = st.prize;
      if (st.turbos === st.game.rounds.length) {
        res.perfect = true;
        gold += R.perfectGold;
      }
      if (st.correct === st.game.rounds.length) {
        const best = sv.records[st.game.key];
        if (best === undefined || total < best) {
          sv.records[st.game.key] = total;
          res.record = true;
          gold += R.recordGold;
        }
      }
      res.gold = gold;
      sv.gold += gold;
      sv.races.won += 1;
    } else {
      sv.races.lost += 1; // a loss costs nothing
    }
    const stat = HE.stat(st.game.key);
    stat.correct += st.correct;
    stat.wrong += st.wrong;
    HE.persist();
    st.result = res;
    st.phase = "results";
  }

  function update() {
    frames += 1;
    const inp = HE.input;
    const typing = st.phase === "question" && st.typed;
    // Esc leaves at any point; Backspace too unless it is deleting a digit.
    // Only finish() banks anything, so leaving mid-race changes nothing.
    if (st.door && (inp.pressed("Escape") || (inp.pressed("Backspace") && !typing))) return HE.go("town", { door: st.door });
    switch (st.phase) {
      case "intro":
        if (inp.go()) startQuestion();
        break;
      case "question": {
        st.clock += 1;
        const d = inp.digit();
        if (d !== null && st.typed.length < 3) st.typed += d;
        if (typing && inp.pressed("Backspace")) st.typed = st.typed.slice(0, -1);
        if (inp.pressed("ArrowLeft")) st.sel = st.sel < 0 ? 0 : Math.max(0, st.sel - 1);
        if (inp.pressed("ArrowRight")) st.sel = st.sel < 0 ? 2 : Math.min(2, st.sel + 1);
        if (inp.pressed("ArrowDown")) st.sel = 1;
        if (inp.go()) {
          if (st.typed) answer(parseInt(st.typed, 10));
          else if (st.sel >= 0) answer(st.signs[st.sel].value);
        }
        break;
      }
      case "move":
        st.anim.t += 1;
        st.timer -= 1;
        if (st.timer <= 0) {
          st.round += 1;
          if (st.round >= st.game.rounds.length) finish();
          else startQuestion();
        }
        break;
      case "results":
        if (inp.go()) newRace();
        break;
    }
  }

  // --- drawing ---------------------------------------------------------

  function ellipse(ctx, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(CX, CY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function laneLine(ctx, rx, ry) {
    ctx.strokeStyle = "#fff8e1";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(CX, CY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTrack(ctx) {
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 0, W, H);
    ellipse(ctx, OUTER.rx + 3, OUTER.ry + 3, "#f5f5f5"); // curb
    ellipse(ctx, OUTER.rx, OUTER.ry, "#a1482c"); // cinder
    laneLine(ctx, (LANE_HANS.rx + LANE_PET.rx) / 2, (LANE_HANS.ry + LANE_PET.ry) / 2);
    ellipse(ctx, INNER.rx + 2, INNER.ry + 2, "#f5f5f5");
    ellipse(ctx, INNER.rx, INNER.ry, "#43a047"); // infield
    // finish line: a chequered strip across the bottom of the track
    for (let y = CY + INNER.ry + 2; y < CY + OUTER.ry; y += 4) {
      for (let i = 0; i < 2; i++) {
        const dark = (Math.floor((y - CY) / 4) + i) % 2 === 0;
        ctx.fillStyle = dark ? "#212121" : "#fafafa";
        ctx.fillRect(CX - 4 + i * 4, y, 4, 4);
      }
    }
  }

  // Point on a lane at progress p (steps / lap), anticlockwise from the bottom.
  function lanePoint(lane, p) {
    const phi = Math.PI / 2 - Math.PI * 2 * p;
    return { x: CX + lane.rx * Math.cos(phi), y: CY + lane.ry * Math.sin(phi), bottomHalf: Math.sin(phi) > 0 };
  }

  function progress(who) {
    if (st.anim && st.phase === "move") {
      const k = Math.min(1, st.anim.t / st.anim.dur);
      const e = 1 - (1 - k) * (1 - k); // ease out
      return (st.anim.from[who] + (st[who] - st.anim.from[who]) * e) / st.lap;
    }
    return st[who] / st.lap;
  }

  function drawHans(ctx, cx, bottom, pose, flipX) {
    return HE.drawImg(ctx, "hans-" + pose, cx, bottom, { h: R.hansHeight, flipX });
  }

  function drawRunners(ctx) {
    const moving = st.phase === "move" && st.anim.t < st.anim.dur;
    const pet = HE.petId();
    const lvl = HE.petLevel();
    const hp = lanePoint(LANE_HANS, progress("hans"));
    const yp = lanePoint(LANE_PET, progress("you"));
    if (Math.abs(progress("hans") - progress("you")) < 0.02) {
      // neck and neck: nudge apart so neither hides the other
      hp.x += 5;
      yp.x -= 5;
    }
    const pose = moving && st.hans !== st.anim.from.hans ? (Math.floor(frames / 6) % 2 ? "run-a" : "run-b") : "idle";
    const hansBox = drawHans(ctx, hp.x, hp.y + 6, pose, !hp.bottomHalf);
    const dy = moving ? -Math.abs(Math.sin(frames / 4)) * 3 : 0;
    const petBox = HE.drawPet(ctx, pet, lvl, yp.x, yp.y + 6, { height: 18 + lvl, dy, flipX: yp.bottomHalf });
    if (st.phase === "move" && st.shout && petBox) HE.bubble(ctx, st.shout, yp.x, petBox.y - 2);
    if (st.phase === "move" && st.message && hansBox) HE.bubble(ctx, S.hansLaugh, hp.x, hansBox.y - 2);
  }

  function drawReferee(ctx, cx, bottom) {
    // flag on a pole, then the T-rex holding it
    ctx.fillStyle = "#3e2723";
    ctx.fillRect(cx + 10, bottom - R.trexHeight - 8, 1, R.trexHeight + 8);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#212121" : "#fafafa";
        ctx.fillRect(cx + 11 + i * 3, bottom - R.trexHeight - 8 + j * 3, 3, 3);
      }
    HE.drawImg(ctx, "trex-a", cx, bottom, { h: R.trexHeight, flipX: true });
  }

  function drawSigns(ctx) {
    st.signs.forEach((s, i) => {
      const x = SIGN_X[i];
      const on = i === st.sel && !st.typed;
      ctx.fillStyle = on ? "#fdd835" : "#fff3c4";
      ctx.fillRect(x - SIGN_W / 2, SIGN_Y, SIGN_W, SIGN_H);
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(x - SIGN_W / 2, SIGN_Y, SIGN_W, 1);
      ctx.fillRect(x - SIGN_W / 2, SIGN_Y + SIGN_H - 1, SIGN_W, 1);
      ctx.fillRect(x - SIGN_W / 2, SIGN_Y, 1, SIGN_H);
      ctx.fillRect(x + SIGN_W / 2 - 1, SIGN_Y, 1, SIGN_H);
      HE.text(ctx, String(s.value), x, SIGN_Y + 4, { size: 10, color: "#000000" });
    });
    if (st.typed) {
      ctx.fillStyle = "#101820";
      ctx.fillRect(CX - 20, SIGN_Y + SIGN_H + 6, 40, 14);
      HE.text(ctx, S.typed(st.typed), CX, SIGN_Y + SIGN_H + 9, { size: 10, color: "#fdd835" });
    }
  }

  function drawHud(ctx) {
    HE.text(ctx, st.game.title, 4, 4, { size: 8, align: "left", color: "#e8f5e9" });
    HE.text(ctx, SA.round(st.round + 1, st.game.rounds.length), W / 2, 4, { size: 8, color: "#e8f5e9" });
    HE.text(ctx, SA.gold(HE.save.gold), W - 4, 4, { size: 8, align: "right", color: "#fdd835" });
    HE.text(ctx, S.steps(st.you, st.hans), 4, H - 12, { size: 8, align: "left", color: "#e8f5e9" });
  }

  function drawIntro(ctx, blink) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    HE.text(ctx, S.name, W / 2, 20, { size: 16, color: "#fdd835" });
    HE.text(ctx, st.game.title, W / 2, 46, { size: 12 });
    HE.text(ctx, S.form[st.form], W / 2, 68, { size: 8, color: st.form === "top" ? "#ef9a9a" : "#cfd8dc" });
    HE.text(ctx, S.intro, W / 2, 84, { size: 8, color: "#cfd8dc" });
    HE.text(ctx, S.stakes(st.prize), W / 2, 100, { size: 8, color: "#fdd835" });
    HE.text(ctx, S.controls, W / 2, 116, { size: 8, color: "#cfd8dc" });
    HE.text(ctx, S.controls2, W / 2, 128, { size: 8, color: "#cfd8dc" });
    if (blink) HE.text(ctx, S.start, W / 2, 150, { size: 8 });
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 196, W, H - 196);
    HE.drawPet(ctx, HE.petId(), HE.petLevel(), 48, 196, { height: D.petArenaHeight(HE.petLevel()), frames, flipX: true });
    drawReferee(ctx, 128, 196);
    drawHans(ctx, 208, 196, "idle", true);
  }

  function drawResults(ctx, blink) {
    const r = st.result;
    const name = HE.petName();
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    HE.text(ctx, S.results, W / 2, 14, { size: 16, color: "#fdd835" });
    HE.text(ctx, r.won ? S.won(name) : r.tie ? S.photo : S.lost, W / 2, 38, { size: 12, color: r.won ? "#81c784" : "#ef9a9a" });
    HE.text(ctx, S.steps(st.you, st.hans), W / 2, 58, { size: 8, color: "#cfd8dc" });
    HE.text(ctx, `${SA.correctCount(st.correct)} · ${SA.wrongCount(st.wrong)}`, W / 2, 70, { size: 8, color: "#cfd8dc" });
    // One line per fact, stacked.
    const lines = [];
    const secs = String(r.time).replace(".", ",");
    if (r.won) {
      lines.push([S.time(secs), "#cfd8dc"]);
      if (r.perfect) lines.push([S.perfect, "#fdd835"]);
      if (r.record) lines.push([S.record(secs), "#fdd835"]);
    } else {
      lines.push([S.train, "#cfd8dc"]);
    }
    lines.forEach(([str, color], i) => HE.text(ctx, str, W / 2, 86 + i * 12, { size: 8, color }));
    const goldY = 88 + lines.length * 12;
    if (r.won) HE.text(ctx, S.gold(r.gold), W / 2, goldY, { size: 12, color: "#fdd835" });
    else HE.text(ctx, S.lostNothing, W / 2, goldY, { size: 12, color: "#ef9a9a" });
    if (blink) HE.text(ctx, st.door ? S.again : SA.again, W / 2, 150, { size: 8 });
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 196, W, H - 196);
    const lvl = HE.petLevel();
    const hop = r.won ? -Math.abs(Math.sin(frames / 10)) * 8 : 0;
    HE.drawPet(ctx, HE.petId(), lvl, 56, 196, { height: D.petArenaHeight(lvl), dy: hop, squash: r.won ? 1 : 0.92, flipX: true });
    drawReferee(ctx, 128, 196);
    drawHans(ctx, 200, 196, r.won ? "sulk" : "gloat", true);
  }

  function draw(ctx) {
    const blink = frames % 60 < 40;
    if (st.phase === "intro") return drawIntro(ctx, blink);
    if (st.phase === "results") return drawResults(ctx, blink);
    drawTrack(ctx);
    drawHud(ctx);
    if (st.game.table) HE.drawTablePanel(ctx, st.game.table, HE.tableRevealed(st.game, st.correct + st.wrong), W - 28, 18);
    HE.text(ctx, st.game.rounds[st.round].prompt, CX, 18, { size: 14 });
    if (st.phase === "question") drawSigns(ctx);
    if (st.phase === "move" && st.message) {
      ctx.fillStyle = "#101820";
      ctx.fillRect(CX - 64, SIGN_Y + 2, 128, 14);
      HE.text(ctx, st.message, CX, SIGN_Y + 5, { size: 8, color: "#ffb74d" });
    }
    drawReferee(ctx, 222, H - 4);
    drawRunners(ctx);
  }

  HE.registerScene("race", {
    enter(payload) {
      st.door = payload.door || null;
      newRace();
    },
    update,
    draw,
  });
  HE.raceState = st; // read-only view for playtest tooling
})();
