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
  import type { Category, GameState, Item, ItemImage } from '../lib/types';

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
    state = clearCart(state);
  }

  function add(id: string, el?: HTMLElement) {
    const result = addItem(state, index, id);
    if (!result.added) {
      refuse();
      return;
    }
    state = result.state;
    board?.popCard(id);
    topbar?.bump();
    if (el) flyToCart(el);
  }

  function remove(id: string) {
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
      onadd={add}
      onremove={remove}
      onclear={clear}
      ondone={() => openSummary()}
    />

    <div class="nudge" class:on={stuck && !summaryOpen} role="status">
      <p><strong>That's the lot.</strong> Nothing left you can afford.</p>
      <button class="btn go" type="button" onclick={() => openSummary()}>See the damage</button>
    </div>
  </div>

  <div class="flash" class:on={flashing} aria-hidden="true"></div>

  <CartDrawer
    open={cartOpen}
    order={state.order}
    cart={state.cart}
    {index}
    {images}
    {spent}
    onclose={closeCart}
    onadd={(id) => add(id)}
    onremove={remove}
    onclear={clear}
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
    onclear={() => { clear(); winningsOpen = false; }}
    onrestart={restart}
  />

  <Tour open={tourOpen} onclose={() => (tourOpen = false)} />
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

  .nudge {
    position: fixed;
    left: 50%;
    bottom: calc(18px + env(safe-area-inset-bottom));
    transform: translate(-50%, 140%);
    z-index: 45;
    background: var(--green-800);
    color: var(--cream-2);
    border: 1px solid rgba(232, 183, 60, 0.55);
    border-radius: 999px;
    padding: 11px 12px 11px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: var(--shadow-lg);
    transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);
    max-width: calc(100vw - 24px);
  }
  .nudge.on { transform: translate(-50%, 0); }
  .nudge p { margin: 0; font-size: 16px; line-height: 1.35; }
  .go { background: var(--gold); color: var(--green-900); padding: 10px 18px; font-size: 15.5px; flex: none; }
</style>
