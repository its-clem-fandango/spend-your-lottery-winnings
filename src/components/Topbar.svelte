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

  /* Published to CSS so the phone layout can reserve each figure's column from
     the jackpot instead of from whatever is rolling through it this frame. All
     three numbers are bounded by the winnings — Winnings *is* it, Spent climbs
     to it, Remaining starts there — so this is the widest any of them gets, and
     it only changes when the jackpot does. See the grid in the stylesheet. */
  let figLen = $derived(money(total).length);
</script>

<header class="topbar" bind:this={bar}>
  <div class="inner">
    <div class="brand">Spend Your<br /><span>Lottery Winnings</span></div>

    <dl class="stats" data-tour="stats" style="--fig-len:{figLen}">
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
       live region announces once per action instead of once per frame.

       The region stays mounted and empty rather than appearing with its text:
       a live region inserted together with its first content is routinely
       missed by NVDA and JAWS, which would make going into the red the one
       moment the app most wants to announce and least likely to. Only the
       banner's skin hangs off .on, so empty it collapses to nothing. -->
  <div class="debt" class:on={deficit > 0} role="status">
    {#if deficit > 0}
      <strong>{money(deficit)} in the hole.</strong>
      <span>{deficitLine}</span>
    {/if}
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
    /* Named because the stats grid below has to do arithmetic with it. */
    --pad: clamp(14px, 3vw, 28px);
  }
  .inner {
    max-width: 1180px;
    margin: 0 auto;
    padding: 14px var(--pad) 0;
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 32px);
    flex-wrap: wrap;
  }
  .brand {
    font-family: var(--display);
    font-weight: 900;
    font-size: clamp(14px, 3.4vw, 19px);
    letter-spacing: -0.02em;
    line-height: 1.1;
    flex: none;
    /* Wide enough to hold "Lottery Winnings" on the one line the <br> intends,
       and still leaves the help and cart buttons their room at 320px. */
    max-width: clamp(126px, 26vw, 145px);
    display: none;
  }
  .brand span { color: var(--gold); }

  /* Shown where there's room for it, which is not a straight line. On a phone
     the stats have a row to themselves (below) and the brand shares the top one
     with the buttons. Between 800px and 1100px everything is back on one line
     and the three figures need every pixel of it, so the brand yields — it's
     the only thing here that isn't load-bearing. */
  @media (max-width: 799px), (min-width: 1100px) {
    .brand { display: block; }
  }

  /* Wraps before it shrinks. Flex shares a shortfall out in proportion to size,
     so without this a trillion-dollar jackpot takes the row over the edge and
     "$28,000" loses its tail alongside it — a figure that had room to spare.
     Dropping a whole stat to the next line keeps every number intact instead. */
  .stats {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 4px clamp(8px, 3.4vw, 36px);
    min-width: 0;
    margin: 0;
  }

  /* Three currency figures plus the help and cart buttons do not fit on one
     phone-width line: at 412px the numbers alone want 312px of the ~210px they
     were getting, and min-width:0 let them shrink past their own text and print
     over each other. Their own row is the only place they fit at full precision.
     Ordered after the buttons rather than moved in the markup, so the tab order
     on a desktop single line still runs left to right.

     Grid, not flex, and that is the whole point. Content-sized columns meant the
     row was re-laid out by its own contents sixty times a second while the
     counters rolled: Fraunces has no tabular figures (font-variant-numeric is a
     no-op in it — its "1" and its "0" differ by a quarter of their width), so
     every frame of the tween was a different width. The stats slid sideways the
     whole way down, and at the frame the total crossed the line the third one
     wrapped to a second row and the header grew 46px — under a finger that had
     just tapped, with the board jumping down to match. Fixed tracks cannot wrap
     and cannot move, so the only thing that changes while you spend is the
     digits. */
  @media (max-width: 799px) {
    .stats {
      order: 1;
      flex-basis: 100%;
      display: grid;
      /* Remaining takes the extra: it is the number the game is about, and it
         is the one that has to hold "Nope. You're broke." */
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr);
      gap: 3px 10px;
      /* One 1fr track, which is what the two plain figures get. */
      --track: calc((100vw - 2 * var(--pad) - 20px) / 3.2);
    }
    /* Brand left, controls right. They were sharing the left edge with nothing
       but 95px of empty green after them. */
    .help { margin-left: auto; }
  }
  .stat { min-width: 0; }
  .stat dt {
    font-size: 12px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(246, 239, 223, 0.62);
    margin: 0 0 3px;
    white-space: nowrap;
  }
  /* Truncation rather than overlap as the last resort. MAX_AMOUNT is
     $1,000,000,000,000 — eighteen characters — and no amount of sizing fits
     three of those on a 320px phone, so the one that can't have the room loses
     its tail instead of printing over its neighbour. The exact figure is a tap
     away in the winnings dialog and the cart. */
  .stat dd {
    margin: 0;
    font-size: clamp(16px, 4.9vw, 30px);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Sized to the jackpot rather than to the viewport, so a run renders only as
     small as its own longest figure requires — a $2M game keeps the full-size
     number a $500M one cannot have, and neither of them changes size mid-play.
     0.64em per character is the widest run Fraunces sets at this weight: its
     zero is its widest digit, and round jackpots are nothing but zeroes. Below
     the 13px floor the ellipsis above takes over, which is the same last resort
     this row has always fallen back on.

     Kept here rather than in the layout block above because it has to outrank
     the plain `.stat dd` rule it overrides, and they carry equal specificity —
     up there it lost on source order and the figures ran out of their tracks. */
  @media (max-width: 799px) {
    .stat dd {
      font-size: clamp(13px, min(4.9vw, calc(var(--track) / (var(--fig-len) * 0.64))), 30px);
    }
    /* Qualified so it beats `.stat dd`, which the bare `.broke-copy` below
       never did — the punchline has been rendering at the figure's size all
       along, and at 19px it was what pushed the row onto a second line. 9.7em
       is the copy's own measured width, so it lands inside its track. */
    .stat.remaining dd.broke-copy {
      font-size: clamp(10px, min(3.4vw, calc(var(--track) * 1.2 / 9.7)), 22px);
    }
  }

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
  /* On a phone the winnings figure shrinks to 19px or less — as little as 13px
     on a wide jackpot, now that it is sized to fit its track — which left the
     only control in the stats row 22px tall. The dd clips its overflow for the
     ellipsis below, so a pseudo-element reaching outside it would be clipped
     for hit-testing too — the box itself has to grow. 24px is the floor a
     pointer target is owed (WCAG 2.5.8); a full 44 would mean a taller topbar
     on the screen that can least afford one, and the same dialog is a tap away
     on the cart's total. */
  @media (max-width: 799px) {
    .edit-winnings {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
    }
  }
  /* Inset, because the dd it sits in now clips its overflow and an outset ring
     would be the first thing cut off. */
  .edit-winnings:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; border-radius: 3px; }
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
    font-size: clamp(15px, 3.4vw, 22px);
    letter-spacing: 0;
  }

  /* Quiet next to the foil cart button, but findable when someone's lost. */
  .help {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: 1.5px solid rgba(246, 239, 223, 0.45);
    background: transparent;
    color: var(--cream-2);
    font-family: var(--display);
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: border-color 0.18s ease, transform 0.18s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .help:hover {
      border-color: var(--gold);
      transform: translateY(-1px);
    }
  }

  .cart {
    flex: none;
    position: relative;
    background: var(--foil-btn);
    color: var(--green-900);
    padding: 13px 21px;
    font-size: 16px;
    font-weight: 900;
    border-radius: 999px;
    border: 1px solid rgba(139, 94, 18, 0.5);
    box-shadow: inset 0 1px 0 rgba(255, 244, 205, 0.85), 0 4px 14px -4px rgba(232, 183, 60, 0.7);
  }
  /* Ungated hover here would stick after every tap, and the cart is the one
     button on the board that gets tapped over and over. */
  @media (hover: hover) and (pointer: fine) {
    .cart:hover { transform: translateY(-2px); }
  }
  .count {
    position: absolute;
    top: -6px; right: -6px;
    min-width: 24px; height: 24px;
    padding: 0 6px;
    border-radius: 99px;
    background: var(--green-900);
    color: var(--gold);
    font-size: 13.5px;
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

  .progress { max-width: 1180px; margin: 12px auto 0; padding: 0 var(--pad) 12px; }

  /* Empty and unstyled while solvent: no background, no padding, so a flex box
     with no children takes up no height and the banner still reads as arriving
     rather than filling in. */
  .debt {
    color: var(--cream-2);
    font-size: 14.5px;
    line-height: 1.4;
    display: flex;
    flex-wrap: wrap;
    gap: 0 7px;
  }
  .debt.on {
    background: var(--red);
    padding: 7px var(--pad);
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
