<script lang="ts">
  import { drawShareCard } from '../lib/share-card';
  import { shortMoney } from '../lib/money';
  import type { Item } from '../lib/types';

  interface Props {
    open: boolean;
    total: number;
    spent: number;
    remaining: number;
    count: number;
    rows: Array<{ item: Item; qty: number; subtotal: number }>;
    shareUrl: string;
    onclose: () => void;
    onrestart: () => void;
  }
  let { open, total, spent, remaining, count, rows, shareUrl, onclose, onrestart }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let closeBtn = $state<HTMLButtonElement | null>(null);
  let copied = $state(false);
  let canShare = $state(false);

  $effect(() => {
    canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  });

  /* Runs before the draw effect below, so the trigger is captured before
     focus moves to the close button. Restoring can silently fail if the
     trigger is gone or inert by then — that's fine, focus just stays put. */
  let returnTo: HTMLElement | null = null;
  $effect(() => {
    if (open) {
      returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else if (returnTo) {
      returnTo.focus();
      returnTo = null;
    }
  });

  $effect(() => {
    if (!open || !canvas) return;
    const data = { total, spent, remaining, count, rows, shareUrl: prettyUrl(shareUrl) };
    drawShareCard(canvas, data);
    // Webfonts may land after first paint; redraw once they're ready so the
    // card never ships with fallback type.
    document.fonts?.ready.then(() => canvas && drawShareCard(canvas, data));
    closeBtn?.focus();
  });

  function prettyUrl(url: string) {
    try {
      const u = new URL(url);
      return u.host + u.pathname + u.search;
    } catch {
      return '';
    }
  }

  function download() {
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `spent-${shortMoney(total).replace('$', '')}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      /* clipboard blocked — the URL is visible on the card itself */
    }
  }

  function share() {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'lottery-spending.png', { type: 'image/png' });
      const data: ShareData = {
        title: 'Spend Your Lottery Winnings',
        text: `I spent ${shortMoney(spent)} of a ${shortMoney(total)} jackpot.`,
        url: shareUrl
      };
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
      navigator.share(data).catch(() => {});
    });
  }
</script>

{#if open}
  <div class="wrap" role="dialog" aria-modal="true" aria-labelledby="summary-title">
    <div class="card">
      <h2 class="vh" id="summary-title">Your spending summary</h2>
      <div class="top">
        <button class="icon-btn" type="button" bind:this={closeBtn} onclick={onclose} aria-label="Close summary">✕</button>
      </div>
      <div class="body">
        <canvas
          bind:this={canvas}
          width="1200"
          height="675"
          role="img"
          aria-label="Summary card of everything you bought"
        ></canvas>

        <div class="actions">
          <button class="btn btn-dark" type="button" onclick={copyLink}>
            {copied ? 'Link copied' : 'Copy share link'}
          </button>
          <button class="btn btn-ghost" type="button" onclick={download}>Download image</button>
          {#if canShare}
            <button class="btn btn-ghost" type="button" onclick={share}>Share</button>
          {/if}
          <button class="btn btn-ghost" type="button" onclick={onclose}>Keep spending</button>
          <button class="btn btn-ghost" type="button" onclick={onrestart}>Start over</button>
        </div>

        <p class="note">Prices are ballpark 2026 figures. Your accountant will have notes.</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .wrap {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(8, 37, 28, 0.72);
    backdrop-filter: blur(6px);
    overflow-y: auto;
    padding: clamp(16px, 4vw, 44px) 16px;
  }
  .card {
    width: min(720px, 100%);
    margin: 0 auto;
    background: var(--cream-2);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    animation: rise 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(26px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }
  .top { padding: 22px 22px 0; display: flex; justify-content: flex-end; }
  canvas { display: block; width: 100%; height: auto; border-radius: var(--r-md); box-shadow: var(--shadow-md); }
  .body { padding: 6px 22px 24px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .actions :global(.btn) { flex: 1 1 150px; }
  .note { margin: 14px 0 0; font-size: 12.5px; color: rgba(10, 31, 24, 0.45); text-align: center; }
</style>
