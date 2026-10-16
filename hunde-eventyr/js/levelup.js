// The level-up ceremony, in the spirit of an evolution: the room goes
// dark, a glowing silhouette flickers between the old and the new shape
// faster and faster, a white flash, a fanfare, and the pet stands there
// grown, with stars. Space returns to wherever we came from.
(function () {
  const HE = window.HE;
  const S = HE.strings.grow;
  const D = HE.data;
  const W = 256;
  const H = 224;
  const FLOOR_Y = 160;
  const MYSTERY = 210; // frames of flickering
  const FLASH = 24;

  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const octx = off.getContext("2d");

  const st = {};

  function enter(p) {
    st.petId = p.petId;
    st.from = p.from;
    st.to = p.to;
    st.back = p.back || { scene: "town", payload: {} };
    st.t = 0;
    st.phase = "mystery";
    st.showTo = false;
    st.nextSwap = 0;
    st.stars = [];
  }

  // Swap interval shrinks from 36 frames to 4 as the mystery builds.
  function swapEvery(t) {
    const k = t / MYSTERY;
    return Math.max(4, Math.round(36 - 32 * k * k));
  }

  function burst() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1 + Math.random() * 2.5;
      st.stars.push({ x: W / 2, y: FLOOR_Y - D.petHeight(st.to) / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 60 + Math.random() * 60 });
    }
  }

  function update() {
    st.t += 1;
    const inp = HE.input;
    switch (st.phase) {
      case "mystery":
        if (st.t >= st.nextSwap) {
          st.showTo = !st.showTo;
          st.nextSwap = st.t + swapEvery(st.t);
          HE.sfx.tick(st.t / MYSTERY);
        }
        if (st.t >= MYSTERY) {
          st.phase = "flash";
          st.t = 0;
          HE.sfx.fanfare();
        }
        break;
      case "flash":
        if (st.t >= FLASH) {
          st.phase = "reveal";
          st.t = 0;
          burst();
        }
        break;
      case "reveal":
        for (const s of st.stars) {
          s.x += s.vx;
          s.y += s.vy;
          s.vy += 0.05;
          s.life -= 1;
        }
        st.stars = st.stars.filter((s) => s.life > 0);
        if (st.t > 40 && (inp.ok() || inp.leave())) HE.go(st.back.scene, st.back.payload);
        break;
    }
  }

  // The pet as a flat glowing shape: draw it offscreen, keep only its alpha.
  function silhouette(ctx, lvl, color) {
    octx.clearRect(0, 0, W, H);
    HE.drawPet(octx, st.petId, lvl, W / 2, FLOOR_Y, { wearing: [] });
    octx.globalCompositeOperation = "source-in";
    octx.fillStyle = color;
    octx.fillRect(0, 0, W, H);
    octx.globalCompositeOperation = "source-over";
    ctx.drawImage(off, 0, 0);
  }

  function glow(ctx, k) {
    // soft rings behind the pet, pulsing
    const cx = W / 2;
    const cy = FLOOR_Y - 30;
    for (let i = 4; i >= 1; i--) {
      const r = 18 * i + Math.sin(st.t / 6) * 4 + k * 20;
      ctx.globalAlpha = 0.06 + 0.04 * (5 - i);
      ctx.fillStyle = "#fff59d";
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx) {
    const name = HE.petName(st.petId);
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, W, H);
    if (st.phase === "mystery") {
      const k = st.t / MYSTERY;
      glow(ctx, k);
      silhouette(ctx, st.showTo ? st.to : st.from, k < 0.5 ? "#e3f2fd" : "#fff59d");
      HE.text(ctx, st.t < 80 ? S.what : S.changing(name), W / 2, 186, { size: 10, color: "#cfd8dc" });
      return;
    }
    if (st.phase === "flash") {
      const a = 1 - st.t / FLASH;
      HE.drawPet(ctx, st.petId, st.to, W / 2, FLOOR_Y, {});
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      return;
    }
    glow(ctx, 0.5);
    HE.drawPet(ctx, st.petId, st.to, W / 2, FLOOR_Y, { frames: st.t });
    for (const s of st.stars) {
      ctx.fillStyle = s.life % 10 < 5 ? "#fff59d" : "#ffffff";
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
    const full = st.to >= 10;
    HE.text(ctx, full ? S.full(name) : S.grown(name, st.to), W / 2, 180, { size: 10, color: "#fdd835" });
    if (st.t > 40 && st.t % 60 < 40) HE.text(ctx, S.go, W / 2, 204, { size: 8, color: "#cfd8dc" });
  }

  HE.registerScene("levelup", { enter, update, draw });
  HE.levelupState = st;
})();
