/** One line of commentary on how thoroughly the money got spent. */
export function verdict(remaining: number, total: number): string {
  if (!total) return 'A bold financial strategy.';
  const share = remaining / total;
  if (share <= 0) return 'Not a dollar left. Magnificent.';
  if (share < 0.02) return 'Down to pocket change. Respect.';
  if (share < 0.2) return 'Thorough. Genuinely thorough.';
  if (share < 0.6) return 'You left a lot on the table.';
  if (share < 0.99) return 'Cautious. Almost suspiciously cautious.';
  return 'You won a fortune and bought almost nothing.';
}
