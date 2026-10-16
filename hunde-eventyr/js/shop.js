// Snackbutikken: two counters, Left/Right to switch. Snacks (Hundekiks /
// Burger / Kage for gold) and Hunde-stil (one wearable unlocks per dog
// level, priced like that level's nam-nam; bought items toggle on and off,
// one per slot).
(function () {
  const HE = window.HE;
  const S = HE.strings;
  const D = HE.data;
  const W = 256;
  const H = 224;
  const IDS = Object.keys(D.SNACKS);
  const PAGES = ["snacks", "outfits"];

  const st = { door: null, page: 0, sel: 0, msg: "", msgTimer: 0, frames: 0 };

  function say(msg) {
    st.msg = msg;
    st.msgTimer = 60;
  }

  function buySnack() {
    const id = IDS[st.sel];
    const price = D.SNACKS[id].gold;
    const sv = HE.save;
    if (sv.gold < price) return say(S.shop.noGold);
    sv.gold -= price;
    sv.inventory[id] += 1;
    HE.persist();
    say(S.shop.bought);
  }

  // Put `def` on, taking off whatever is in the same slot.
  // Outfits are bought once (shared wardrobe) and worn per pet: the active
  // pet dresses here; the others keep whatever they had on.
  function wear(def) {
    const pet = HE.pet();
    pet.wearing = pet.wearing.filter((id) => {
      const other = D.OUTFITS.find((o) => o.id === id);
      return other && other.slot !== def.slot;
    });
    pet.wearing.push(def.id);
  }

  function chooseOutfit() {
    const def = D.OUTFITS[st.sel];
    const sv = HE.save;
    const pet = HE.pet();
    if (sv.wardrobe.includes(def.id)) {
      if (pet.wearing.includes(def.id)) {
        pet.wearing = pet.wearing.filter((id) => id !== def.id);
        say(S.shop.takeOff);
      } else {
        wear(def);
        say(S.shop.putOn);
      }
      HE.persist();
      return;
    }
    if (HE.petLevel() < def.level) return say(S.shop.lockedMsg(def.level));
    const price = D.OUTFIT_PRICE(def.level);
    if (sv.gold < price) return say(S.shop.noGold);
    sv.gold -= price;
    sv.wardrobe.push(def.id);
    wear(def);
    HE.persist();
    say(S.shop.bought);
  }

  function update() {
    st.frames += 1;
    if (st.msgTimer > 0) st.msgTimer -= 1;
    const inp = HE.input;
    const n = st.page === 0 ? IDS.length : D.OUTFITS.length;
    if (inp.pressed("ArrowUp")) st.sel = (st.sel + n - 1) % n;
    if (inp.pressed("ArrowDown")) st.sel = (st.sel + 1) % n;
    if (inp.pressed("ArrowLeft") || inp.pressed("ArrowRight")) {
      st.page = 1 - st.page;
      st.sel = 0;
    }
    if (inp.ok()) (st.page === 0 ? buySnack : chooseOutfit)();
    if (inp.leave()) HE.go("town", { door: st.door });
  }

  function outfitItems() {
    const pet = HE.pet();
    const lvl = HE.petLevel();
    return D.OUTFITS.map((o) => {
      const price = D.OUTFIT_PRICE(o.level);
      let label = S.shop.outfit(S.outfits[o.id], price);
      let disabled = false;
      if (HE.save.wardrobe.includes(o.id)) label += "  " + (pet.wearing.includes(o.id) ? S.shop.wearing : S.shop.owned);
      else if (lvl < o.level) {
        label += "  " + S.shop.lockedUntil(o.level);
        disabled = true;
      } else disabled = HE.save.gold < price;
      return { label, disabled };
    });
  }

  function draw(ctx) {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, W, H);
    const outfits = st.page === 1;
    // counter
    ctx.fillStyle = outfits ? "#f48fb1" : "#4dd0e1";
    ctx.fillRect(0, 178, W, 4);
    ctx.fillStyle = outfits ? "#ad1457" : "#00838f";
    ctx.fillRect(0, 182, W, H - 182);
    HE.text(ctx, outfits ? S.town.outfits : S.town.shop, W / 2, 6, { size: 16, color: "#fdd835" });
    HE.text(ctx, S.shop.pageHint(outfits ? S.town.shop : S.town.outfits), W / 2, 24, { size: 8, color: "#90a4ae" });
    HE.text(ctx, S.arena.gold(HE.save.gold), W - 6, 6, { size: 8, align: "right", color: "#fdd835" });

    let items;
    let wearing;
    if (outfits) {
      items = outfitItems();
      // preview: the highlighted item on top of what he already wears
      const def = D.OUTFITS[st.sel];
      wearing = HE.pet().wearing.filter((id) => {
        const o = D.OUTFITS.find((x) => x.id === id);
        return o && o.slot !== def.slot;
      });
      wearing.push(def.id);
    } else {
      items = IDS.map((id) => {
        const s = D.SNACKS[id];
        return { label: S.shop.item(S.snacks[id], s.np, s.gold, HE.save.inventory[id]), disabled: HE.save.gold < s.gold };
      });
    }
    HE.drawMenu(ctx, items, st.sel, 22, 40);

    const DOG_X = W - 40;
    const box = HE.drawPet(ctx, HE.petId(), HE.petLevel(), DOG_X, 214, { height: 52, frames: st.frames, wearing });
    if (st.msgTimer > 0 && box) HE.bubble(ctx, st.msg, Math.min(DOG_X, W - 44), box.y - 2);
    if (st.frames % 60 < 40) HE.text(ctx, S.shop.controls, 4, 204, { size: 8, align: "left", color: "#e0f7fa" });
  }

  HE.registerScene("shop", {
    enter(payload) {
      st.door = payload.door || null;
      st.page = 0;
      st.sel = 0;
      st.msg = "";
      st.msgTimer = 0;
    },
    update,
    draw,
  });
  HE.shopState = st;
})();
