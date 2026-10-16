// Keyboard state: held keys plus edge-triggered presses consumed each frame.
(function () {
  const HE = (window.HE = window.HE || {});
  const TRACK = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Enter", "Escape", "Backspace"]);
  for (let d = 0; d <= 9; d++) TRACK.add("Digit" + d).add("Numpad" + d);
  const held = new Set();
  const pressed = new Set();
  // The numpad's Enter is its own key code; treat it as Enter.
  const code = (e) => (e.code === "NumpadEnter" ? "Enter" : e.code);

  window.addEventListener("keydown", (e) => {
    const c = code(e);
    if (!TRACK.has(c)) return;
    e.preventDefault();
    if (!held.has(c)) pressed.add(c);
    held.add(c);
  });
  window.addEventListener("keyup", (e) => {
    const c = code(e);
    if (!TRACK.has(c)) return;
    e.preventDefault();
    held.delete(c);
  });
  window.addEventListener("blur", () => held.clear());

  HE.input = {
    held: (code) => held.has(code),
    pressed: (code) => pressed.has(code),
    // Space and Enter both mean "ok" (buy, feed, choose, replay);
    // Escape and Backspace both mean "leave" (out of a building).
    ok: () => pressed.has("Space") || pressed.has("Enter"),
    // In the arenas (where up/down is not a menu) the up arrow is ok too:
    // start, answer, submit, play again — one key for the whole game.
    go: () => pressed.has("Space") || pressed.has("Enter") || pressed.has("ArrowUp"),
    leave: () => pressed.has("Escape") || pressed.has("Backspace"),
    // The digit typed this frame (top row or numpad), or null.
    digit: () => {
      for (let d = 0; d <= 9; d++) if (pressed.has("Digit" + d) || pressed.has("Numpad" + d)) return d;
      return null;
    },
    endFrame: () => pressed.clear(),
  };
})();
