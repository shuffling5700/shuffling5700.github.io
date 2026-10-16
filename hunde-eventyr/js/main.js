// Fixed-step loop, integer scaling, boot. Loaded last.
(function () {
  const HE = window.HE;
  const W = 256;
  const H = 224;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // Logical frame stays 256x224. The backing store is sized to the device
  // pixels it will occupy, so text and shapes render sharp; sprites are drawn
  // with smoothing off so they keep hard pixel edges.
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    canvas.style.width = W * s + "px";
    canvas.style.height = H * s + "px";
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", fit);
  fit();

  HE.W = W;
  HE.H = H;
  HE.params = new URLSearchParams(window.location.search);

  HE.text = function (c, str, x, y, opts) {
    const o = opts || {};
    c.font = (o.bold === false ? "" : "bold ") + (o.size || 8) + "px Menlo, 'Courier New', monospace";
    c.textAlign = o.align || "center";
    c.textBaseline = "top";
    c.fillStyle = o.color || "#ffffff";
    c.fillText(str, x, y);
  };

  // Small white speech bubble, tail pointing down at (cx, tipY).
  HE.bubble = function (c, str, cx, tipY) {
    c.font = "bold 8px Menlo, 'Courier New', monospace";
    const w = Math.ceil(c.measureText(str).width) + 8;
    const h = 12;
    const x = Math.round(cx - w / 2);
    const y = tipY - h - 4;
    c.fillStyle = "#ffffff";
    c.fillRect(x, y, w, h);
    c.fillRect(cx - 2, y + h, 4, 2);
    c.fillRect(cx - 1, y + h + 2, 2, 2);
    HE.text(c, str, cx, y + 2, { size: 8, color: "#101820" });
  };

  // Vertical menu. items: [{ label, disabled }], sel: index. 14 px rows.
  HE.drawMenu = function (c, items, sel, x, y) {
    items.forEach((it, i) => {
      const on = i === sel;
      const color = it.disabled ? "#607d8b" : on ? "#fdd835" : "#ffffff";
      if (on) HE.text(c, "▶", x - 10, y + i * 14, { size: 8, color, align: "left" });
      HE.text(c, it.label, x, y + i * 14, { size: 8, color, align: "left" });
    });
  };

  // The times table building up on the right of an arena: ten boxes for
  // 1×t … 10×t, the first `revealed` filled in, the rest dark.
  //
  // How many are revealed: every box below the question being asked. The
  // rounds run in table order, so that is (first k asked − 1) + answers
  // given — at age 7 the 2-table starts at 1 × 2 and shows nothing until
  // 2 is answered, then 2, then 2 4 while 2 × 3 is on; at age 10 the
  // 7-table starts at 7 × 2 so "7" is there from the first question.
  HE.tableRevealed = function (game, answered) {
    return game.rounds[0].answer / game.table - 1 + answered;
  };

  // 1×t sits at the bottom and the table grows upwards.
  HE.drawTablePanel = function (c, table, revealed, x, y) {
    const w = 26;
    const h = 12;
    for (let k = 1; k <= 10; k++) {
      const yy = y + (10 - k) * (h + 3);
      const on = k <= revealed;
      c.fillStyle = on ? "#fff3c4" : "#1c262e";
      c.fillRect(x, yy, w, h);
      c.fillStyle = on ? "#3e2723" : "#37474f";
      c.fillRect(x, yy, w, 1);
      c.fillRect(x, yy + h - 1, w, 1);
      c.fillRect(x, yy, 1, h);
      c.fillRect(x + w - 1, yy, 1, h);
      if (on) HE.text(c, String(table * k), x + w / 2, yy + 2, { size: 8, color: "#101820" });
    }
  };

  const STEP = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += now - last;
    last = now;
    if (acc > 250) acc = 250;
    while (acc >= STEP) {
      HE.current().update();
      HE.input.endFrame();
      acc -= STEP;
    }
    HE.current().draw(ctx);
    requestAnimationFrame(frame);
  }

  // ?scene=arena runs Guldarenaen standalone, ?scene=race Fartringen;
  // ?scene=town skips the title.
  HE.go(HE.params.get("scene") || "title");
  requestAnimationFrame(frame);
})();
