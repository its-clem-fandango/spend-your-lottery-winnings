<script lang="ts">
  import { flushSync } from 'svelte';
  import Entry from './Entry.svelte';
  import Topbar from './Topbar.svelte';
  import Board from './Board.svelte';
  import CartDrawer from './CartDrawer.svelte';
  import Summary from './Summary.svelte';
  import Tour from './Tour.svelte';
  import WinningsDialog from './WinningsDialog.svelte';

  import { spendable } from '../lib/tax';
  import { shortMoney } from '../lib/money';
  import { brokeLine } from '../lib/broke';
  import { encodeRun, decodeRun } from '../lib/share-code';
  import { hasSeenTour, markTourSeen } from '../lib/tour';
  import {
    indexItems, spent as spentOf, remaining as remainingOf,
    itemCount, addItem, removeItem, clearCart, isStuck, ranked
  } from '../lib/cart';
  import type { Cart, Category, GameState, Item, ItemImage } from '../lib/types';

  interface Props {
    items: Item[];
    categories: Category[];
    images: Record<string, ItemImage>;
  }
  let { items, categories, images }: Props = $props();

  const index = indexItems(items);

  let state = $state<GameState>({ gross: 0, taxed: false, total: 0, cart: {}, order: [] });
  let started = $state(false);
  let cartOpen = $state(false);
  let summaryOpen = $state(false);
  let tourOpen = $state(false);
  let winningsOpen = $state(false);
  let refused = $state(false);
  let shaking = $state(false);
  let flashing = $state(false);

  let board = $state<Board | null>(null);
  let topbar = $state<Topbar | null>(null);
  let cartDrawer = $state<CartDrawer | null>(null);
  let root = $state<HTMLElement | null>(null);
  let summaryReturn = $state<HTMLElement | null>(null);

  let spent = $derived(spentOf(state.cart, index));
  let remaining = $derived(remainingOf(state, index));
  let count = $derived(itemCount(state.cart));
  let stuck = $derived(isStuck(state, index, items));
  let rows = $derived(ranked(state, index));

  /* Derived here rather than in Topbar so Game stays the one place that decides
     what gets shown. Reads the real remaining, never the topbar's tween, or the
     banner would flicker its way in and out mid-animation. */
  let deficit = $derived(Math.max(0, -remaining));
  let deficitLine = $derived(deficit > 0 ? brokeLine(deficit, state.total) : '');

  let shareUrl = $derived.by(() => {
    if (typeof window === 'undefined') return '';
    const code = encodeRun(state.gross, state.taxed, state.cart, state.order, items);
    return `${window.location.origin}${window.location.pathname}?r=${code}`;
  });

  let refuseTimer: ReturnType<typeof setTimeout> | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Clearing doesn't ask first. It empties the cart on the first press and then
   * offers to take it back, which is the same protection as a confirmation
   * without making everyone who meant it answer a question. The snapshot is the
   * whole cart, so undo restores the order too and not just the quantities.
   *
   * Owned here rather than by the three buttons that trigger it: two of them
   * (the drawer and the winnings dialog) can be closed by the time the window
   * lapses, and the offer has to outlive them.
   */
  const UNDO_MS = 6000;
  let undone = $state<{ cart: Cart; order: string[] } | null>(null);
  let undoCount = $state(0); // survives the dismissal so the line can't flash "0 things"
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  /* Spoken, not shown. The two visible copies live inline in the drawer and at
     the end of the board; this is the one that announces, so a screen reader
     hears it once however many surfaces are currently rendering it. */
  let undoLine = $derived(
    `Cart cleared. ${undoCount} ${undoCount === 1 ? 'thing' : 'things'} back on the shelf.`
  );

  /**
   * The offer is inline now — it appears where the Clear button was rather than
   * floating over the board — so it renders in whichever of the two surfaces you
   * can actually see: the drawer while it's open, the end of the board when it
   * isn't. Never both, which is what lets this return "the" undo button.
   */
  function undoElement(): HTMLButtonElement | null {
    return (cartOpen ? cartDrawer?.undoElement() : board?.undoElement()) ?? null;
  }

  /* Focus lands on Undo because the button that was just pressed unmounts with
     the cart it emptied — without this the keyboard is left on <body> and the
     one control that undoes the damage is a full tab cycle away. */
  $effect(() => {
    if (undone) undoElement()?.focus();
  });

  $effect(() => () => clearTimeout(undoTimer));

  /**
   * One restore, once, and only from a shared link. Refresh is deliberately
   * how you start again: the board has three ways to empty a cart now, so
   * reload no longer has to double as the escape hatch, and landing back on
   * the entry screen is what people expect a refresh to do.
   *
   * It also means the first paint is already the right screen. Nothing here
   * can run before the server-rendered HTML is on screen, so anything this
   * effect decides is a visible swap — restoring a saved run from storage
   * showed the entry screen for a beat and then replaced it.
   *
   * The query is still stripped once a link is consumed, so the run you're
   * looking at is yours to change rather than something ?r= keeps reasserting.
   */
  let hydrated = false;
  $effect(() => {
    if (typeof window === 'undefined' || hydrated) return;
    hydrated = true;

    const code = new URLSearchParams(window.location.search).get('r');
    if (!code) return;

    const run = decodeRun(code, items);
    if (run) {
      state = { gross: run.gross, taxed: run.taxed, total: run.total, cart: run.cart, order: run.order };
      started = true;
      history.replaceState(null, '', window.location.pathname);
    }
  });

  $effect(() => {
    document.title = started
      ? `Spending ${shortMoney(state.total)} | Spend Your Lottery Winnings`
      : 'Spend Your Lottery Winnings';
  });

  function start(gross: number, taxed: boolean) {
    state = { gross, taxed, total: spendable(gross, taxed), cart: {}, order: [] };
    started = true;
    window.scrollTo(0, 0);
    // Marked at open, not at finish: the tour auto-runs exactly once, ever,
    // however it's exited. Shared ?r= links never come through here.
    if (!hasSeenTour()) {
      tourOpen = true;
      markTourSeen();
    }
  }

  function restart() {
    tourOpen = false;
    summaryOpen = false;
    cartOpen = false;
    winningsOpen = false;
    summaryReturn = null; // the button it points at is about to be unmounted
    // Straight to null, not dismissUndo(): there's nothing left to hand focus
    // back to, and there's no cart worth restoring into.
    clearTimeout(undoTimer);
    undone = null;
    started = false;
    state = { gross: 0, taxed: false, total: 0, cart: {}, order: [] };
    history.replaceState(null, '', window.location.pathname);
    window.scrollTo(0, 0);
  }

  /** Changing the jackpot deliberately leaves the cart alone — that's the point
      of having it. Spending past the new total just goes into the red. */
  function applyWinnings(gross: number, taxed: boolean) {
    state = { ...state, gross, taxed, total: spendable(gross, taxed) };
    winningsOpen = false;
  }

  /* Closes the drawer first: the board goes inert under the dialog, and
     closeCart() would otherwise try to hand focus back to an inert button. */
  function openWinnings() {
    cartOpen = false;
    winningsOpen = true;
  }

  function clear() {
    if (!count) return;
    undone = { cart: state.cart, order: state.order };
    undoCount = count;
    state = clearCart(state);
    armUndo();
  }

  function undo() {
    if (!undone) return;
    state = { ...state, cart: undone.cart, order: undone.order };
    dismissUndo();
  }

  /**
   * Wiping from the winnings dialog opens the drawer on the way out. The offer
   * is inline now, so it has to land somewhere you are actually looking — and
   * this dialog dismisses itself on clear, taking its own footing with it.
   */
  function wipeFromWinnings() {
    clear();
    winningsOpen = false;
    cartOpen = true;
  }

  /** Restarted on blur too, so the window is time you actually had it in front
      of you rather than time that ran out while the button held focus. */
  function armUndo() {
    clearTimeout(undoTimer);
    undoTimer = setTimeout(dismissUndo, UNDO_MS);
  }

  function dismissUndo() {
    clearTimeout(undoTimer);
    if (!undone) return;
    // Hand focus back before the button goes, to the one anchor that's present
    // and reachable in all three of the places clearing is offered from.
    const el = undoElement();
    if (el && document.activeElement === el) topbar?.cartElement()?.focus();
    undone = null;
  }

  function add(id: string, el?: HTMLElement) {
    const result = addItem(state, index, id);
    if (!result.added) {
      refuse();
      return;
    }
    // The snapshot is of a cart that no longer exists once you've started
    // rebuilding, and restoring it would quietly delete what you just added.
    dismissUndo();
    state = result.state;
    board?.popCard(id);
    topbar?.bump();
    if (el) flyToCart(el);
  }

  function remove(id: string) {
    dismissUndo();
    state = removeItem(state, id);
  }

  /**
   * Overspending is a dead end with personality rather than a silent no-op.
   * Without this the whole thing feels like a form.
   */
  function refuse() {
    // Svelte batches state→DOM, so the classic remove/reflow/re-add restart
    // only works if the removal is flushed to the DOM first.
    flushSync(() => (shaking = false));
    void root?.offsetWidth;
    shaking = true;
    flashing = true;
    refused = true;
    navigator.vibrate?.(40);

    clearTimeout(flashTimer);
    clearTimeout(refuseTimer);
    flashTimer = setTimeout(() => (flashing = false), 260);
    refuseTimer = setTimeout(() => {
      shaking = false;
      refused = false;
    }, 1150);
  }

  function flyToCart(cardEl: HTMLElement) {
    const img = cardEl.querySelector('img');
    const target = topbar?.cartElement();
    if (!img || !target) return;

    const from = img.getBoundingClientRect();
    const to = target.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = 'fly-ghost';
    ghost.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;
      border-radius:10px;overflow:hidden;z-index:70;pointer-events:none;
      transition:transform .62s cubic-bezier(.5,-0.2,.4,1),opacity .62s ease;will-change:transform,opacity`;
    const clone = img.cloneNode(true) as HTMLImageElement;
    clone.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    ghost.appendChild(clone);
    document.body.appendChild(ghost);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    requestAnimationFrame(() => {
      ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(.18) rotate(22deg)`;
      ghost.style.opacity = '0';
    });
    setTimeout(() => ghost.remove(), 680);
  }

  /* Closing the drawer strands focus inside a now-inert subtree, so hand it
     back to the button that owns the drawer. */
  function closeCart() {
    cartOpen = false;
    topbar?.cartElement()?.focus();
  }

  /**
   * Every route into the summary names its own focus-restore target, because
   * document.activeElement can't be trusted to still be focusable by the time
   * the dialog closes. Called from a click handler, before any state changes,
   * so activeElement is exactly the button that was pressed — except from the
   * drawer, where that button is about to go inert and the cart button is the
   * honest place to come back to.
   */
  function openSummary(el?: HTMLElement | null) {
    summaryReturn = el ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    summaryOpen = true;
  }

  function onKeydown(e: KeyboardEvent) {
    if (tourOpen) return; // the tour owns the keyboard while it's up
    if (e.key !== 'Escape') return;
    if (winningsOpen) winningsOpen = false;
    else if (summaryOpen) summaryOpen = false;
    else if (cartOpen) closeCart();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if !started}
  <Entry onstart={start} />
{:else}
  <!-- inert while an overlay is up: aria-modal alone doesn't stop Tab from
       wandering into the board behind it. -->
  <div class="game" class:shake={shaking} bind:this={root} inert={summaryOpen || tourOpen || winningsOpen}>
    <Topbar
      bind:this={topbar}
      total={state.total}
      {spent}
      {remaining}
      {count}
      {refused}
      {deficit}
      {deficitLine}
      onopencart={() => (cartOpen = true)}
      oneditwinnings={openWinnings}
      onhelp={() => { cartOpen = false; tourOpen = true; }}
    />

    <Board
      bind:this={board}
      {items}
      {categories}
      {images}
      cart={state.cart}
      {remaining}
      {count}
      {spent}
      {undoCount}
      undone={!!undone && !cartOpen}
      onadd={add}
      onremove={remove}
      onclear={clear}
      onundo={undo}
      onundofocus={() => clearTimeout(undoTimer)}
      onundoblur={armUndo}
      ondone={() => openSummary()}
    />

    <div class="nudge" class:on={stuck && !summaryOpen} role="status">
      <p><strong>That's the lot.</strong> Nothing left you can afford.</p>
      <button class="btn go" type="button" onclick={() => openSummary()}>See the damage</button>
    </div>
  </div>

  <div class="flash" class:on={flashing} aria-hidden="true"></div>

  <CartDrawer
    bind:this={cartDrawer}
    open={cartOpen}
    order={state.order}
    cart={state.cart}
    {index}
    {images}
    {spent}
    {undoCount}
    undone={!!undone && cartOpen}
    onclose={closeCart}
    onadd={(id) => add(id)}
    onremove={remove}
    onclear={clear}
    onundo={undo}
    onundofocus={() => clearTimeout(undoTimer)}
    onundoblur={armUndo}
    ondone={() => { cartOpen = false; openSummary(topbar?.cartElement()); }}
  />

  <Summary
    open={summaryOpen}
    total={state.total}
    {spent}
    {remaining}
    {count}
    {rows}
    {shareUrl}
    returnTo={summaryReturn}
    onclose={() => (summaryOpen = false)}
    onrestart={restart}
  />

  <WinningsDialog
    open={winningsOpen}
    gross={state.gross}
    taxed={state.taxed}
    {spent}
    {count}
    onapply={applyWinnings}
    onclose={() => (winningsOpen = false)}
    onclear={wipeFromWinnings}
    onrestart={restart}
  />

  <Tour open={tourOpen} onclose={() => (tourOpen = false)} />

  <!-- The offer itself is rendered inline by Board and CartDrawer. This is only
       its voice: a live region that has been mounted all along, because one
       inserted together with its first content is routinely missed by NVDA and
       JAWS — and it would be the moment the app most wants to be heard. -->
  <span class="vh" role="status">{undone ? undoLine : ''}</span>
{/if}

<style>
  .game.shake { animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  @keyframes shake {
    10%, 90% { transform: translate3d(-2px, 0, 0); }
    20%, 80% { transform: translate3d(5px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-9px, 0, 0); }
    40%, 60% { transform: translate3d(9px, 0, 0); }
  }

  .flash {
    position: fixed;
    inset: 0;
    z-index: 80;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(120% 90% at 50% 50%, transparent 40%, rgba(216, 72, 63, 0.42) 100%);
    transition: opacity 0.16s ease;
  }
  .flash.on { opacity: 1; }

  /* left/right rather than the usual left:50% + translateX(-50%). A fixed box
     positioned only from the left edge gets its available width measured from
     that edge to the viewport's — so left:50% quietly capped this at half the
     screen, and `max-width: calc(100vw - 24px)` never once applied. On a 390px
     phone the toast was 195px wide with its sentence broken over seven lines.
     Pinning both edges and letting auto margins do the centring gives it the
     full width it was always asking for; the transform is left to the slide. */
  .nudge {
    position: fixed;
    left: 12px;
    right: 12px;
    width: max-content;
    /* Against the inset box, not the viewport: percentages on a fixed element
       resolve against the initial containing block, so `100%` here would be the
       full 390px and put the edges back outside the 12px gutters. */
    max-width: calc(100vw - 24px);
    margin-inline: auto;
    bottom: calc(18px + env(safe-area-inset-bottom));
    transform: translateY(140%);
    z-index: 45;
    background: var(--green-800);
    color: var(--cream-2);
    border: 1px solid rgba(232, 183, 60, 0.55);
    border-radius: var(--r-pill);
    padding: 11px 12px 11px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: var(--shadow-lg);
    transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  .nudge.on { transform: translateY(0); }
  .nudge p { margin: 0; font-size: 16px; line-height: 1.35; }
  .go { background: var(--gold); color: var(--green-900); padding: 10px 18px; font-size: 15.5px; flex: none; }

</style>
