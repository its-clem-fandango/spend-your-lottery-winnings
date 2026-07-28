<script lang="ts">
  import { flushSync, untrack } from 'svelte';
  import { money } from '../lib/money';

  interface Props {
    total: number;
    spent: number;
    remaining: number;
    count: number;
    /** A single add was just turned down — transient, ~1s. */
    refused: boolean;
    /** How far past the winnings the cart has gone; 0 while solvent. */
    deficit: number;
    deficitLine: string;
    onopencart: () => void;
    onhelp: () => void;
    oneditwinnings: () => void;
  }
  let {
    total, spent, remaining, count, refused, deficit, deficitLine,
    onopencart, onhelp, oneditwinnings
  }: Props = $props();

  /* In the red every tap is refused, so the "you're broke" swap would blank the
     deficit figure roughly constantly — hiding the exact number the banner is
     making fun of. The refusal copy is for running out, not for being under. */
  let showRefusedCopy = $derived(refused && deficit === 0);

  let bar = $state<HTMLElement | null>(null);
  let cartBtn = $state<HTMLButtonElement | null>(null);
  let bumping = $state(false);

  /* Displayed values lag the real ones so the counters can roll. */
  let shownSpent = $state(0);
  let shownRemaining = $state(0);
  let ready = false;

  let bumpTimer: ReturnType<typeof setTimeout> | undefined;

  export function bump() {
    // Flush the class removal to the DOM before the reflow, or the toggle
    // collapses to a no-op and the animation never restarts.
    flushSync(() => (bumping = false));
    void cartBtn?.offsetWidth;
    bumping = true;
    clearTimeout(bumpTimer);
    bumpTimer = setTimeout(() => (bumping = false), 400);
  }

  export function cartElement() {
    return cartBtn;
  }

  let frame: number | undefined;

  /**
   * One tween drives both counters.
   *
   * The reads of shownSpent/shownRemaining are wrapped in untrack() on purpose:
   * the effect writes them every frame, so tracking them would make the effect
   * re-enter, stack overlapping tweens and leave the numbers oscillating (and
   * briefly negative). Cancelling the previous frame matters for the same
   * reason — rapid clicks must retarget the running tween, not race it.
   */
  function retarget(toSpent: number, toRemaining: number) {
    const fromSpent = shownSpent;
    const fromRemaining = shownRemaining;
    const t0 = performance.now();
    if (frame !== undefined) cancelAnimationFrame(frame);

    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 430);
      const eased = 1 - Math.pow(1 - p, 3);
      /* Whole dollars while rolling, the exact figure once landed. money()
         renders cents when a value has them, and every intermediate frame of a
         tween has them — without this the counters jitter two extra digits the
         whole way down and the column keeps resizing. */
      const s = fromSpent + (toSpent - fromSpent) * eased;
      const r = fromRemaining + (toRemaining - fromRemaining) * eased;
      shownSpent = p < 1 ? Math.round(s) : toSpent;
      shownRemaining = p < 1 ? Math.round(r) : toRemaining;
      frame = p < 1 ? requestAnimationFrame(step) : undefined;
    };
    frame = requestAnimationFrame(step);
  }

  $effect(() => {
    const targetSpent = spent;
    const targetRemaining = remaining;
    untrack(() => {
      if (!ready) {
        // First paint lands on the real numbers instead of counting up from zero.
        shownSpent = targetSpent;
        shownRemaining = targetRemaining;
        ready = true;
        return;
      }
      retarget(targetSpent, targetRemaining);
    });
  });

  $effect(() => () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
  });

  /* The tab rail is a second sticky layer parked under this one. Its height
     changes with the clamped number size, so measure rather than hard-code —
     a fixed value leaves a seam that cards scroll through. */
  $effect(() => {
    if (!bar) return;
    const sync = () => {
      const h = bar!.getBoundingClientRect().height;
      if (h) document.documentElement.style.setProperty('--topbar-h', Math.round(h) + 'px');
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(bar);
    window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  });

  let pct = $derived(total ? Math.max(0, Math.min(100, (spent / total) * 100)) : 0);
</script>

<header class="topbar" bind:this={bar}>
  <div class="inner">
    <div class="brand">Spend Your<br /><span>Lottery Winnings</span></div>

    <dl class="stats" data-tour="stats">
      <div class="stat">
        <dt>Winnings</dt>
        <dd>
          <button
            class="edit-winnings num"
            type="button"
            onclick={oneditwinnings}
            aria-label="Winnings {money(total)}. Change amount or start over"
          >{money(total)}</button>
        </dd>
      </div>
      <div class="stat">
        <dt>Spent</dt>
        <dd class="num">{money(shownSpent)}</dd>
      </div>
      <div class="stat remaining" class:refused={showRefusedCopy} class:in-debt={deficit > 0}>
        <dt>Remaining</dt>
        <dd class="num" class:broke-copy={showRefusedCopy}>
          {showRefusedCopy ? "Nope. You're broke." : money(shownRemaining)}
        </dd>
      </div>
    </dl>

    <button class="help" type="button" onclick={onhelp} aria-label="How to play">?</button>

    <button class="btn cart" type="button" bind:this={cartBtn} class:bump={bumping} onclick={onopencart} aria-haspopup="dialog" data-tour="cart">
      Cart
      <span class="count" class:on={count > 0} aria-hidden="true">{count}</span>
      <span class="vh">{count === 1 ? '1 item in cart' : `${count} items in cart`}</span>
    </button>
  </div>

  <div class="progress">
    <div class="track">
      <div class="fill" class:hot={pct > 92 && !deficit} class:over={deficit > 0} style="width:{pct}%"></div>
    </div>
  </div>

  <!-- Inside the sticky header on purpose: the ResizeObserver above publishes
       this element's height as --topbar-h, which parks the board's tab rail.
       As a sibling below, the banner would scroll away and the rail would
       ride over it. The figure is the real deficit, not the tween, so the
       live region announces once per action instead of once per frame. -->
  {#if deficit > 0}
    <div class="debt" role="status">
      <strong>{money(-deficit)} in the hole.</strong>
      <span>{deficitLine}</span>
    </div>
  {/if}
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    background: var(--green-800);
    color: var(--cream-2);
    box-shadow: 0 10px 30px -18px rgba(8, 37, 28, 0.9);
  }
  .inner {
    max-width: 1180px;
    margin: 0 auto;
    padding: 14px clamp(14px, 3vw, 28px) 0;
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 32px);
  }
  .brand {
    font-family: var(--display);
    font-weight: 900;
    font-size: 17px;
    letter-spacing: -0.02em;
    line-height: 1.1;
    flex: none;
    max-width: 130px;
    display: none;
  }
  .brand span { color: var(--gold); }
  @media (min-width: 900px) { .brand { display: block; } }

  .stats { display: flex; flex: 1; gap: clamp(10px, 3.4vw, 36px); min-width: 0; margin: 0; }
  .stat { min-width: 0; }
  .stat dt {
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(246, 239, 223, 0.45);
    margin: 0 0 2px;
    white-space: nowrap;
  }
  .stat dd { margin: 0; font-size: clamp(17px, 4.2vw, 27px); line-height: 1.1; white-space: nowrap; }

  /* Reads as the number it replaces, with just enough of a hint to be findable. */
  .edit-winnings {
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-bottom: 1.5px dashed rgba(246, 239, 223, 0.3);
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .edit-winnings:hover { color: var(--gold); border-bottom-color: var(--gold); }
  .edit-winnings:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 3px; }
  /* The number that matters gets the foil treatment. */
  .stat.remaining dd {
    background: var(--foil);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .stat.remaining.refused dd,
  .stat.remaining.in-debt dd { background: none; color: #ff9b93; }
  .broke-copy {
    font-family: var(--body) !important;
    font-weight: 700;
    font-size: clamp(14px, 3.4vw, 20px);
    letter-spacing: 0;
  }

  /* Quiet next to the foil cart button, but findable when someone's lost. */
  .help {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: 1.5px solid rgba(246, 239, 223, 0.35);
    background: transparent;
    color: var(--cream-2);
    font-family: var(--display);
    font-size: 19px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: border-color 0.18s ease, transform 0.18s ease;
  }
  .help:hover {
    border-color: var(--gold);
    transform: translateY(-1px);
  }

  .cart {
    flex: none;
    position: relative;
    background: var(--foil-btn);
    color: var(--green-900);
    padding: 11px 18px;
    font-size: 14px;
    font-weight: 900;
    border-radius: 999px;
    border: 1px solid rgba(139, 94, 18, 0.5);
    box-shadow: inset 0 1px 0 rgba(255, 244, 205, 0.85), 0 4px 14px -4px rgba(232, 183, 60, 0.7);
  }
  .cart:hover { transform: translateY(-2px); }
  .count {
    position: absolute;
    top: -6px; right: -6px;
    min-width: 22px; height: 22px;
    padding: 0 6px;
    border-radius: 99px;
    background: var(--green-900);
    color: var(--gold);
    font-size: 12px;
    font-weight: 700;
    display: grid;
    place-items: center;
    border: 2px solid var(--gold);
    transform: scale(0);
    transition: transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .count.on { transform: scale(1); }
  .cart.bump { animation: bump 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes bump {
    0% { transform: scale(1); }
    40% { transform: scale(1.14); }
    100% { transform: scale(1); }
  }

  .progress { max-width: 1180px; margin: 12px auto 0; padding: 0 clamp(14px, 3vw, 28px) 12px; }

  .debt {
    background: var(--red);
    color: var(--cream-2);
    padding: 7px clamp(14px, 3vw, 28px);
    font-size: 12.5px;
    line-height: 1.4;
    display: flex;
    flex-wrap: wrap;
    gap: 0 7px;
    animation: debt-in 0.28s ease;
  }
  .debt strong { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .debt span { opacity: 0.88; }
  @keyframes debt-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: none; }
  }
  .track {
    height: 10px;
    border-radius: 99px;
    background: rgba(0, 0, 0, 0.32);
    overflow: hidden;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(232, 183, 60, 0.18);
  }
  .fill {
    position: relative;
    height: 100%;
    width: 0;
    border-radius: 99px;
    background: linear-gradient(90deg, var(--gold-soft), var(--gold) 60%, var(--gold-deep));
    transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
  }
  .fill.hot { background: linear-gradient(90deg, var(--gold), #ff9b6b); }
  /* pct is already clamped to 100, so the bar just pins full and turns. */
  .fill.over { background: linear-gradient(90deg, var(--red), #ff7a6d); }
  /* Money in motion should glitter. Reduced-motion kills this globally. */
  .fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 30%, rgba(255, 252, 240, 0.6) 50%, transparent 70%);
    background-size: 220px 100%;
    background-repeat: no-repeat;
    animation: glitter 2.4s ease-in-out infinite;
  }
  @keyframes glitter {
    0% { background-position: -220px 0; }
    60%, 100% { background-position: calc(100% + 220px) 0; }
  }
</style>
