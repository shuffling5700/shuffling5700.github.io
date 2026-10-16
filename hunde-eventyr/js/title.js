// Title screen. "Hvem spiller?" lists every saved game (one slot each);
// Nyt spil asks hero then age and always makes a new slot; Hent gemt spil
// fra fil imports into a new slot. Nothing here can overwrite a game.
(function () {
  const HE = window.HE;
  const S = HE.strings;
  const D = HE.data;
  const W = 256;
  const H = 224;
  const VIS = 4; // slot rows shown at once
  const HERO_IDS = Object.keys(D.HEROES);

  const st = { phase: "menu", slots: [], sel: 0, scroll: 0, hero: 0, age: 0, msg: "", msgTimer: 0, frames: 0 };

  function say(msg) {
    st.msg = msg;
    st.msgTimer = 120;
  }

  function refresh() {
    st.slots = HE.slots();
  }

  // Menu indices: 0..n-1 the slots, n = Nyt spil, n+1 = Hent fra fil.
  function menuLength() {
    return st.slots.length + 2;
  }

  function choose() {
    const n = st.slots.length;
    if (st.sel < n) {
      HE.useSlot(st.slots[st.sel]);
      return HE.go("town");
    }
    if (st.sel === n) {
      st.phase = "hero";
      st.hero = 0;
      st.age = 0;
      return;
    }
    HE.importSaveFile((ok) => {
      say(ok ? S.title.loaded : S.title.loadFail);
      if (ok) {
        refresh();
        st.sel = 0;
        st.scroll = 0;
      }
    });
  }

  function updateMenu(inp) {
    const len = menuLength();
    if (inp.pressed("ArrowUp") || inp.pressed("ArrowDown")) {
      st.sel = (st.sel + (inp.pressed("ArrowUp") ? len - 1 : 1)) % len;
      st.msgTimer = 0;
    }
    // keep the highlighted slot inside the visible window
    if (st.sel < st.scroll) st.scroll = st.sel;
    if (st.sel < st.slots.length && st.sel >= st.scroll + VIS) st.scroll = st.sel - VIS + 1;
    if (inp.ok()) choose();
  }

  function updateHero(inp) {
    if (inp.pressed("ArrowLeft") || inp.pressed("ArrowRight")) st.hero = 1 - st.hero;
    if (inp.ok()) st.phase = "age";
    if (inp.leave()) st.phase = "menu";
  }

  function updateAge(inp) {
    if (inp.pressed("ArrowLeft") || inp.pressed("ArrowRight")) st.age = 1 - st.age;
    if (inp.leave()) st.phase = "hero";
    if (inp.ok()) {
      HE.newGame({ hero: HERO_IDS[st.hero], age: D.AGES[st.age] });
      HE.go("town", { reset: true });
    }
  }

  function update() {
    st.frames += 1;
    if (st.msgTimer > 0) st.msgTimer -= 1;
    const inp = HE.input;
    if (st.phase === "menu") updateMenu(inp);
    else if (st.phase === "hero") updateHero(inp);
    else updateAge(inp);
  }

  function drawGround(ctx) {
    ctx.fillStyle = "#2e7d32";
    ctx.fillRect(0, 176, W, H - 176);
  }

  function drawMenu(ctx) {
    HE.text(ctx, S.gameTitle, W / 2, 8, { size: 20, color: "#fdd835" });
    HE.text(ctx, S.title.who, W / 2, 34, { size: 8, color: "#cfd8dc" });
    const n = st.slots.length;
    const shown = st.slots.slice(st.scroll, st.scroll + VIS);
    const items = shown.map((s) => {
      const hero = D.HEROES[s.profile.hero] || D.HEROES.freja;
      const pet = s.pets[s.activePet];
      return { label: S.title.slot(hero.name, s.profile.age, S.petNames[s.activePet], pet.level, s.gold) };
    });
    items.push({ label: S.title.newGame }, { label: S.title.load });
    const drawSel = st.sel < n ? st.sel - st.scroll : shown.length + (st.sel - n);
    HE.drawMenu(ctx, items, drawSel, 30, 50);
    if (st.scroll > 0) HE.text(ctx, "▲", W - 12, 50, { size: 8, color: "#90a4ae" });
    if (st.scroll + VIS < n) HE.text(ctx, "▼", W - 12, 50 + (VIS - 1) * 14, { size: 8, color: "#90a4ae" });

    // preview the highlighted game (or the last played one)
    const s = st.sel < n ? st.slots[st.sel] : HE.save;
    const hero = D.HEROES[s.profile.hero] || D.HEROES.freja;
    HE.drawImg(ctx, hero.img + "-down", W / 2 - 40, 176, { h: 44 });
    const pet = s.pets[s.activePet];
    HE.drawPet(ctx, s.activePet, pet.level, W / 2 + 30, 176, { height: Math.min(48, D.petHeight(pet.level)), frames: st.frames, wearing: pet.wearing });
    if (st.msgTimer > 0) HE.text(ctx, st.msg, W / 2, 200, { size: 8, color: "#ffb74d" });
    else if (st.frames % 60 < 40) HE.text(ctx, S.title.controls, W / 2, 200, { size: 8, color: "#e8f5e9" });
  }

  function drawPick(ctx, header, labels, sel, drawOption) {
    HE.text(ctx, header, W / 2, 24, { size: 16, color: "#fdd835" });
    labels.forEach((label, i) => {
      const cx = W / 2 + (i === 0 ? -56 : 56);
      const on = i === sel;
      drawOption(cx, i);
      HE.text(ctx, (on ? "▶ " : "") + label, cx, 156, { size: 10, color: on ? "#fdd835" : "#ffffff" });
    });
    if (st.frames % 60 < 40) HE.text(ctx, S.title.pickControls, W / 2, 200, { size: 8, color: "#e8f5e9" });
  }

  function draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    drawGround(ctx);
    if (st.phase === "menu") return drawMenu(ctx);
    if (st.phase === "hero") {
      const names = HERO_IDS.map((id) => D.HEROES[id].name);
      return drawPick(ctx, S.title.whoAreYou, names, st.hero, (cx, i) =>
        HE.drawImg(ctx, D.HEROES[HERO_IDS[i]].img + "-down", cx, 150, { h: 80 })
      );
    }
    const hero = D.HEROES[HERO_IDS[st.hero]];
    HE.drawImg(ctx, hero.img + "-down", W / 2, 176, { h: 44 });
    drawPick(ctx, S.title.howOld, D.AGES.map(S.title.years), st.age, (cx, i) =>
      HE.text(ctx, String(D.AGES[i]), cx, 84, { size: 32, color: i === st.age ? "#fdd835" : "#607d8b" })
    );
  }

  HE.registerScene("title", {
    enter() {
      refresh();
      st.phase = "menu";
      st.sel = 0;
      st.scroll = 0;
      st.msgTimer = 0;
    },
    update,
    draw,
  });
  HE.titleState = st;
})();
