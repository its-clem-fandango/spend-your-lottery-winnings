/**
 * Commentary for when the balance goes red — which happens by lowering your
 * winnings below what you already spent, not by overspending (adding is still
 * refused). Every name here is a documented public bankruptcy or a matter of
 * record, weighted toward lottery winners because that parallel is the whole
 * joke; the celebrities sit in the shallow end where it's still funny rather
 * than pointed.
 *
 * Deliberately deterministic. This feeds a $derived that re-runs on every cart
 * change, so a random pick would reshuffle the line mid-read and look like a
 * bug — and a share link has to render the same line for sender and receiver.
 */

export interface BrokeTier {
  /** Upper bound on deficit ÷ winnings. */
  maxRatio: number;
  lines: readonly string[];
}

/* Tiered on the ratio, not the dollar figure: a $50k hole on a $30k jackpot is
   a catastrophe, the same hole against $500M is a rounding error. */
export const BROKE_TIERS: readonly BrokeTier[] = [
  {
    maxRatio: 0.15,
    lines: [
      'Nicolas Cage bought two castles and a dinosaur skull. You are in respectable company.',
      'Mike Tyson kept three Siberian tigers. This is roughly how it starts.',
      'MC Hammer put two hundred people on the payroll. Small overruns, big momentum.'
    ]
  },
  {
    maxRatio: 0.5,
    lines: [
      'Michael Carroll won £9.7 million and ended up back in a biscuit factory. Early days yet.',
      'MC Hammer made $30 million and spent it rather faster. You are keeping pace.',
      'Evelyn Adams won the lottery twice and still managed to run out. Twice.'
    ]
  },
  {
    maxRatio: 1.5,
    lines: [
      'Michael Carroll got through £9.7 million in eight years. You have done proportionally worse in an afternoon.',
      'Evelyn Adams won $5.4 million across two tickets and gave all of it back to Atlantic City.',
      'Jack Whittaker won $315 million in 2002 and spent five years running out. You are ahead of schedule.'
    ]
  },
  {
    maxRatio: Infinity,
    lines: [
      'Jack Whittaker won $315 million in 2002. By 2007 he had nothing. You beat his time by about five years.',
      'Evelyn Adams won twice and lost both fortunes. At least she needed two goes at it.',
      'Michael Carroll called himself the King of Chavs and spent accordingly. You have out-spent the King.'
    ]
  }
];

/**
 * One line for the debt banner. Empty while solvent, so callers can use the
 * result as the render condition.
 */
export function brokeLine(deficit: number, total: number): string {
  if (!(deficit > 0)) return '';
  // total is 0 only before a run starts; Infinity lands in the deepest tier,
  // which is the right answer for owing money against nothing.
  const ratio = total > 0 ? deficit / total : Infinity;
  const tier = BROKE_TIERS.find((t) => ratio < t.maxRatio) ?? BROKE_TIERS[BROKE_TIERS.length - 1]!;
  // Varies as the hole deepens, but only ever changes when the number does.
  return tier.lines[Math.floor(deficit) % tier.lines.length]!;
}
