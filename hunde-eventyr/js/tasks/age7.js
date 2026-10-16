// Age 7: a game is one mode, drawn by weight (data.age7): nine rounds of
// Plus within 100 where at most one operand has two digits, or Minus
// within 20, nothing going negative; or the 2-, 5- or 10-table from 1 × t to 10 × t
// (ten rounds) with distractors that are multiples of the table
// (3 × 5 = 15 offers 10, 20, 30 — never 14).
(function () {
  const HE = window.HE;
  const S = HE.strings.arena;
  const D = HE.data;
  const T = HE.tasks;
  const TABLES = [2, 5, 10];
  // Tables start at 1 × t so the 2-table opens with 2 (ten rounds); plus
  // and minus stay at nine.
  const KS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ROUNDS = 9;

  function rnd(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function pickMode() {
    const forced = HE.params.get("mode");
    if (forced === "plus" || forced === "minus") return forced;
    if (TABLES.includes(parseInt(forced, 10))) return "tables";
    const w = D.age7.weights;
    let r = Math.random() * (w.plus + w.minus + w.tables);
    if ((r -= w.plus) < 0) return "plus";
    if ((r -= w.minus) < 0) return "minus";
    return "tables";
  }

  function plusRound() {
    // Plus stays within 20 (was within 100; user, 2026-09-13), one addend
    // below 10.
    const small = rnd(1, 9);
    const big = rnd(1, 20 - small);
    const [a, b] = Math.random() < 0.5 ? [big, small] : [small, big];
    return { prompt: S.promptOp(a, "+", b), answer: a + b, signs: T.signsAround(a + b, { min: 1 }) };
  }

  function minusRound() {
    // Minus stays within 20 (was 99): the first playtest found 87 − 6 too
    // much for a 7-year-old. One number below 10.
    const a = rnd(1, 20);
    const b = rnd(1, Math.min(9, a)); // never below zero
    return { prompt: S.promptOp(a, "−", b), answer: a - b, signs: T.signsAround(a - b, { min: 0 }) };
  }

  function tableGame() {
    const forced = parseInt(HE.params.get("mode"), 10);
    const t = TABLES.includes(forced) ? forced : D.pick(TABLES);
    return {
      key: String(t),
      table: t,
      title: S.table(t),
      rounds: KS.map((k) => ({
        prompt: S.prompt(t, k),
        answer: t * k,
        signs: T.signsAround(t * k, { step: t, reach: 3, min: t }),
      })),
    };
  }

  HE.tasks[7] = {
    keys: ["plus", "minus"].concat(TABLES.map(String)),
    tables: TABLES,
    flatTablePrize: true, // Fartringen pays the 2-table's prize for every table here (user, 2026-09-13)
    newGame() {
      const mode = pickMode();
      if (mode === "tables") return tableGame();
      const make = mode === "plus" ? plusRound : minusRound;
      return { key: mode, title: S[mode], rounds: Array.from({ length: ROUNDS }, make) };
    },
  };
})();
