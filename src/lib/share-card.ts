import { money } from './money';
import { verdict } from './verdict';
import type { Item } from './types';

/**
 * Draws the shareable summary card straight onto a canvas.
 *
 * Deliberately hand-composed rather than html2canvas or similar: it's ~120
 * lines, has no dependencies, and renders identically everywhere. The same
 * layout is the reference if this ever moves server-side for per-result OG
 * images.
 */

export interface ShareCardData {
  total: number;
  spent: number;
  remaining: number;
  count: number;
  rows: Array<{ item: Item; qty: number; subtotal: number }>;
  shareUrl?: string;
}

const PAD = 74;
const ROW_STEP = 46;

export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const styles = getComputedStyle(document.body);
  const display = styles.getPropertyValue('--display').trim() || 'Georgia, serif';
  const body = styles.getPropertyValue('--body').trim() || 'sans-serif';

  ctx.clearRect(0, 0, W, H);

  // Ground
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#14513e');
  bg.addColorStop(0.55, '#0e3b2e');
  bg.addColorStop(1, '#08251c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Dot field, fading left to right
  ctx.save();
  ctx.fillStyle = '#e8b73c';
  for (let y = 24; y < H; y += 34) {
    for (let x = 24; x < W; x += 34) {
      ctx.globalAlpha = 0.18 * (1 - x / (W * 1.15));
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Gold rings, bottom right
  ctx.save();
  ctx.strokeStyle = 'rgba(232,183,60,.18)';
  ctx.lineWidth = 2;
  for (const r of [120, 190, 260, 330]) {
    ctx.beginPath();
    ctx.arc(W - 90, H - 60, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.textBaseline = 'alphabetic';

  // Kicker
  ctx.fillStyle = '#e8b73c';
  ctx.font = `700 22px ${body}`;
  ctx.fillText('S P E N D   Y O U R   L O T T E R Y   W I N N I N G S', PAD, PAD + 8);

  // Headline, shrunk to fit rather than wrapped
  ctx.fillStyle = '#fdf9ef';
  const head = `Here's what ${money(data.total)} buys`;
  let size = 78;
  ctx.font = `900 ${size}px ${display}`;
  while (ctx.measureText(head).width > W - PAD * 2 && size > 40) {
    size -= 3;
    ctx.font = `900 ${size}px ${display}`;
  }
  ctx.fillText(head, PAD, PAD + 100);

  // Verdict
  ctx.fillStyle = 'rgba(246,239,223,.62)';
  ctx.font = `500 26px ${body}`;
  ctx.fillText(verdict(data.remaining, data.total), PAD, PAD + 146);

  ctx.strokeStyle = 'rgba(232,183,60,.35)';
  ctx.lineWidth = 2;
  line(ctx, PAD, PAD + 176, W - PAD);

  // Ranked purchases. Six rows collide with the footer once a "+N more" line is
  // needed, so cap at five in that case.
  const shown = data.rows.length > 6 ? data.rows.slice(0, 5) : data.rows.slice(0, 6);
  let y = PAD + 226;

  if (!shown.length) {
    ctx.fillStyle = 'rgba(246,239,223,.5)';
    ctx.font = `500 30px ${body}`;
    ctx.fillText('Nothing. You bought absolutely nothing.', PAD, y);
  }

  shown.forEach((row, i) => {
    ctx.fillStyle = 'rgba(232,183,60,.85)';
    ctx.font = `700 22px ${body}`;
    ctx.fillText(String(i + 1).padStart(2, '0'), PAD, y);

    ctx.fillStyle = '#fdf9ef';
    ctx.font = `600 30px ${body}`;
    const label = row.item.name + (row.qty > 1 ? `  ×${row.qty}` : '');
    ctx.fillText(clip(ctx, label, W - PAD * 2 - 300), PAD + 46, y);

    ctx.fillStyle = '#e8b73c';
    ctx.font = `700 30px ${display}`;
    ctx.textAlign = 'right';
    ctx.fillText(money(row.subtotal), W - PAD, y);
    ctx.textAlign = 'left';

    y += ROW_STEP;
  });

  if (data.rows.length > shown.length) {
    const extra = data.rows.length - shown.length;
    ctx.fillStyle = 'rgba(246,239,223,.5)';
    ctx.font = `600 24px ${body}`;
    ctx.fillText(`+ ${extra} more purchase${extra === 1 ? '' : 's'}`, PAD + 46, y - 4);
  }

  // Footer stats
  const fy = H - 96;
  ctx.strokeStyle = 'rgba(246,239,223,.16)';
  ctx.lineWidth = 2;
  line(ctx, PAD, fy - 34, W - PAD);

  const cells: Array<[string, string]> = [
    ['PURCHASES', String(data.count)],
    ['SPENT', money(data.spent)],
    ['LEFT OVER', money(data.remaining)]
  ];
  cells.forEach(([label, value], i) => {
    const x = PAD + i * 300;
    ctx.fillStyle = 'rgba(246,239,223,.45)';
    ctx.font = `700 18px ${body}`;
    ctx.fillText(label, x, fy);
    ctx.fillStyle = i === 2 ? '#e8b73c' : '#fdf9ef';
    ctx.font = `900 40px ${display}`;
    ctx.fillText(value, x, fy + 44);
  });

  if (data.shareUrl) {
    ctx.fillStyle = 'rgba(246,239,223,.34)';
    ctx.font = `600 20px ${body}`;
    ctx.textAlign = 'right';
    ctx.fillText(data.shareUrl, W - PAD, fy + 40);
    ctx.textAlign = 'left';
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function clip(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 4 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
