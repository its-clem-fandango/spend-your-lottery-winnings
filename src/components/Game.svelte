<script lang="ts">
  import Entry from './Entry.svelte';
  import Topbar from './Topbar.svelte';
  import Board from './Board.svelte';
  import CartDrawer from './CartDrawer.svelte';
  import Summary from './Summary.svelte';

  import { afterTax } from '../lib/tax';
  import { shortMoney } from '../lib/money';
  import { encodeRun, decodeRun } from '../lib/share-code';
  import {
    indexItems, spent as spentOf, remaining as remainingOf,
    itemCount, addItem, removeItem, isStuck, ranked
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
  let broke = $state(false);
  let shaking = $state(false);
  let flashing = $state(false);

  let board = $state<Board | null>(null);
  let topbar = $state<Topbar | null>(null);
  let root = $state<HTMLElement | null>(null);

  let spent = $derived(spentOf(state.cart, index));
  let remaining = $derived(remainingOf(state, index));
  let count = $derived(itemCount(state.cart));
  let stuck = $derived(isStuck(state, index, items));
  let rows = $derived(ranked(state, index));

  let shareUrl = $derived.by(() => {
    if (typeof window === 'undefined') return '';
    const code = encodeRun(state.total, state.taxed, state.cart, state.order, items);
    return `${window.location.origin}${window.location.pathname}?r=${code}`;
  });

  let brokeTimer: ReturnType<typeof setTimeout> | undefined;

  /* A shared run in the URL replays straight into the board. */
  $effect(() => {
    if (typeof window === 'undefined') return;
    const code = new URLSearchParams(window.location.search).get('r');
    if (!code) return;
    const run = decodeRun(code, items);
    if (!run) return;
    state = { gross: run.amount, taxed: run.taxed, total: run.amount, cart: run.cart, order: run.order };
    started = true;
  });

  $effect(() => {
    if (started) document.title = `Spending ${shortMoney(state.total)} — Spend Your Lottery Winnings`;
  });

  function start(gross: number, taxed: boolean) {
    const total = taxed ? Math.round(afterTax(gross)) : gross;
    state = { gross, taxed, total, cart: {}, order: [] };
    started = true;
    window.scrollTo(0, 0);
  }

  function restart() {
    summaryOpen = false;
    cartOpen = false;
    started = false;
    state = { gross: 0, taxed: false, total: 0, cart: {}, order: [] };
    history.replaceState(null, '', window.location.pathname);
    window.scrollTo(0, 0);
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
    shaking = false;
    void root?.offsetWidth;
    shaking = true;
    flashing = true;
    broke = true;
    navigator.vibrate?.(40);

    clearTimeout(brokeTimer);
    setTimeout(() => (flashing = false), 260);
    brokeTimer = setTimeout(() => {
      shaking = false;
      broke = false;
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

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (summaryOpen) summaryOpen = false;
    else if (cartOpen) cartOpen = false;
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if !started}
  <Entry onstart={start} />
{:else}
  <div class="game" class:shake={shaking} bind:this={root}>
    <Topbar
      bind:this={topbar}
      total={state.total}
      {spent}
      {remaining}
      {count}
      {broke}
      onopencart={() => (cartOpen = true)}
    />

    <Board
      bind:this={board}
      {items}
      {categories}
      {images}
      cart={state.cart}
      {remaining}
      onadd={add}
      onremove={remove}
    />

    <div class="nudge" class:on={stuck && !summaryOpen} role="status">
      <p><strong>That's the lot.</strong> Nothing left you can afford.</p>
      <button class="btn go" type="button" onclick={() => (summaryOpen = true)}>See the damage</button>
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
    onclose={() => (cartOpen = false)}
    onadd={(id) => add(id)}
    onremove={remove}
    ondone={() => { cartOpen = false; summaryOpen = true; }}
  />

  <Summary
    open={summaryOpen}
    total={state.total}
    {spent}
    {remaining}
    {count}
    {rows}
    {shareUrl}
    onclose={() => (summaryOpen = false)}
    onrestart={restart}
  />
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
  .nudge p { margin: 0; font-size: 13.5px; line-height: 1.35; }
  .go { background: var(--gold); color: var(--green-900); padding: 9px 16px; font-size: 13.5px; flex: none; }
</style>
