<script lang="ts">
  import { untrack } from 'svelte';
  import { money } from '../lib/money';

  interface Props {
    total: number;
    spent: number;
    remaining: number;
    count: number;
    broke: boolean;
    onopencart: () => void;
  }
  let { total, spent, remaining, count, broke, onopencart }: Props = $props();

  let bar = $state<HTMLElement | null>(null);
  let cartBtn = $state<HTMLButtonElement | null>(null);
  let bumping = $state(false);

  /* Displayed values lag the real ones so the counters can roll. */
  let shownSpent = $state(0);
  let shownRemaining = $state(0);
  let ready = false;

  export function bump() {
    bumping = false;
    void cartBtn?.offsetWidth;
    bumping = true;
    setTimeout(() => (bumping = false), 400);
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
      shownSpent = fromSpent + (toSpent - fromSpent) * eased;
      shownRemaining = fromRemaining + (toRemaining - fromRemaining) * eased;
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

    <dl class="stats">
      <div class="stat">
        <dt>Winnings</dt>
        <dd class="num">{money(total)}</dd>
      </div>
      <div class="stat">
        <dt>Spent</dt>
        <dd class="num">{money(shownSpent)}</dd>
      </div>
      <div class="stat remaining" class:broke>
        <dt>Remaining</dt>
        <dd class="num" class:broke-copy={broke}>
          {broke ? "Nope. You're broke." : money(shownRemaining)}
        </dd>
      </div>
    </dl>

    <button class="btn cart" type="button" bind:this={cartBtn} class:bump={bumping} onclick={onopencart} aria-haspopup="dialog">
      Cart
      <span class="count" class:on={count > 0} aria-hidden="true">{count}</span>
      <span class="vh">{count === 1 ? '1 item in cart' : `${count} items in cart`}</span>
    </button>
  </div>

  <div class="progress">
    <div class="track">
      <div class="fill" class:hot={pct > 92} style="width:{pct}%"></div>
    </div>
  </div>
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
  .stat dd { margin: 0; font-size: clamp(17px, 4.2vw, 26px); line-height: 1.1; white-space: nowrap; }
  .stat.remaining dd { color: var(--gold); }
  .stat.remaining.broke dd { color: #ff9b93; }
  .broke-copy {
    font-family: var(--body) !important;
    font-weight: 700;
    font-size: clamp(14px, 3.4vw, 20px);
    letter-spacing: 0;
  }

  .cart {
    flex: none;
    position: relative;
    background: var(--gold);
    color: var(--green-900);
    padding: 11px 16px;
    font-size: 14px;
    border-radius: 999px;
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
  .track { height: 8px; border-radius: 99px; background: rgba(0, 0, 0, 0.28); overflow: hidden; }
  .fill {
    height: 100%;
    width: 0;
    border-radius: 99px;
    background: linear-gradient(90deg, var(--gold-soft), var(--gold));
    transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .fill.hot { background: linear-gradient(90deg, var(--gold), #ff9b6b); }
</style>
