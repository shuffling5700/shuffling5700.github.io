// Age 10: one times table from 3 to 9, k = 2 … 10 in order, distractors
// within ±2 of the answer. This is the original Guldarenaen, unchanged.
(function () {
  const HE = window.HE;
  const S = HE.strings.arena;
  const TABLES = [3, 4, 5, 6, 7, 8, 9];
  const KS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  HE.tasks[10] = {
    keys: TABLES.map(String),
    tables: TABLES, // Tabelmuren draws one of these
    division: true, // Brobyggeren opens only for a profile that divides
    newGame() {
      const forced = parseInt(HE.params.get("table"), 10);
      const t = TABLES.includes(forced) ? forced : HE.data.pick(TABLES);
      return {
        key: String(t),
        table: t, // the panel on the right builds 1×t … 10×t as you answer
        title: S.table(t),
        rounds: KS.map((k) => ({
          prompt: S.prompt(t, k),
          answer: t * k,
          signs: HE.tasks.signsAround(t * k, { step: 1, reach: 2, min: 1 }),
        })),
      };
    },
  };
})();
