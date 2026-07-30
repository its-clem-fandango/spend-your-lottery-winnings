<script lang="ts">
  import { money } from '../lib/money';
  import type { Cart, Item, ItemImage } from '../lib/types';

  interface Props {
    open: boolean;
    order: string[];
    cart: Cart;
    index: Record<string, Item>;
    images: Record<string, ItemImage>;
    spent: number;
    onclose: () => void;
    onadd: (id: string) => void;
    onremove: (id: string) => void;
    onclear: () => void;
    ondone: () => void;
    /** A clear is still take-back-able. Owned by Game, shown here in place. */
    undone: boolean;
    undoCount: number;
    onundo: () => void;
    onundofocus: () => void;
    onundoblur: () => void;
  }
  let {
    open, order, cart, index, images, spent, undone, undoCount,
    onclose, onadd, onremove, onclear, ondone, onundo, onundofocus, onundoblur
  }: Props = $props();

  let closeBtn = $state<HTMLButtonElement | null>(null);
  let undoBtn = $state<HTMLButtonElement | null>(null);

  /** Game hands focus here when a clear lands while this drawer is the one on screen. */
  export function undoElement() {
    return undoBtn;
  }

  /* Not while an undo is on offer: that would pull focus off the one control
     that takes the clear back, which is the whole reason it's there. */
  $effect(() => {
    if (open && !undone) closeBtn?.focus();
  });
</script>

<div class="scrim" class:on={open} onclick={onclose} role="presentation"></div>

<!-- inert (not aria-hidden) while closed: the drawer is only translated
     offscreen, and aria-hidden alone would leave its buttons in the tab order. -->
<aside class="drawer" class:on={open} inert={!open} role="dialog" aria-labelledby="cart-title">
  <div class="head">
    <h2 id="cart-title">The haul</h2>
    <button class="icon-btn close" type="button" bind:this={closeBtn} onclick={onclose} aria-label="Close cart">✕</button>
  </div>

  <ul class="list">
    {#if !order.length}
      <li class="empty">
        <span class="big">Nothing yet.</span>
        An empty cart and a full bank account. Statistically the smartest you will ever be.
      </li>
    {:else}
      {#each order as id (id)}
        {@const item = index[id]}
        {@const qty = cart[id] ?? 0}
        {#if item}
          <li class="row">
            <span class="thumb">
              {#if images[id]}
                <img src={images[id].thumb} alt="" width="48" height="48" loading="lazy" decoding="async" />
              {/if}
            </span>
            <span class="main">
              <strong>{item.name}</strong>
              <span>
                {money(item.price * qty)}{qty > 1 ? ` · ${qty} × ${money(item.price)}` : ''}
              </span>
            </span>
            <span class="stepper">
              <button class="icon-btn" type="button" onclick={() => onremove(id)} aria-label="Remove one {item.name}">−</button>
              <span class="n">{qty}</span>
              <button class="icon-btn" type="button" onclick={() => onadd(id)} aria-label="Add another {item.name}">+</button>
            </span>
          </li>
        {/if}
      {/each}
    {/if}
  </ul>

  <div class="foot">
    <div class="total">
      <span>Total spent</span>
      <strong>{money(spent)}</strong>
    </div>
    <!-- The offer takes the Clear button's own seat rather than floating over the
         board: you pressed here, so the way back is here. Red becomes gold, the
         fine print becomes the receipt, and nothing else on screen moves. -->
    <div class="buttons">
      {#if order.length}
        <button class="btn clear" type="button" onclick={onclear}>Clear cart</button>
      {:else if undone}
        <button
          class="btn take-back"
          type="button"
          bind:this={undoBtn}
          aria-label="Undo clearing the cart"
          onfocus={onundofocus}
          onblur={onundoblur}
          onclick={onundo}
        >Undo</button>
      {/if}
      <button class="btn done" type="button" onclick={ondone}>I'm done spending</button>
    </div>
    {#if order.length}
      <p class="keeps">Clearing empties the cart. Your winnings stay put.</p>
    {:else if undone}
      <p class="keeps cleared" aria-hidden="true">
        {undoCount} {undoCount === 1 ? 'thing' : 'things'} back on the shelf.
      </p>
    {/if}
  </div>
</aside>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(8, 37, 28, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.28s ease;
    backdrop-filter: blur(2px);
  }
  .scrim.on { opacity: 1; pointer-events: auto; }

  .drawer {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    z-index: 60;
    width: min(420px, 92vw);
    background: var(--cream-2);
    display: flex;
    flex-direction: column;
    transform: translateX(101%);
    transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: var(--shadow-lg);
  }
  .drawer.on { transform: translateX(0); }

  .head {
    padding: 20px 20px 14px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .head h2 { font-family: var(--display); font-weight: 900; font-size: 26px; margin: 0; letter-spacing: -0.025em; }
  @media (hover: hover) and (pointer: fine) {
    .close:hover { transform: rotate(90deg); }
  }

  .list { flex: 1; overflow-y: auto; padding: 8px 20px 20px; margin: 0; list-style: none; }
  .empty { padding: 52px 24px; text-align: center; color: rgba(10, 31, 24, 0.7); font-size: 16px; line-height: 1.6; }
  .empty .big {
    font-family: var(--display);
    font-weight: 900;
    font-size: 24px;
    color: var(--ink);
    display: block;
    margin-bottom: 6px;
    letter-spacing: -0.02em;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
    animation: slidein 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes slidein {
    from { opacity: 0; transform: translateX(14px); }
    to { opacity: 1; transform: none; }
  }
  .thumb { flex: none; width: 48px; height: 48px; border-radius: 8px; overflow: hidden; background: var(--green-800); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .main { flex: 1; min-width: 0; }
  .main strong { display: block; font-size: 16px; font-weight: 700; line-height: 1.3; }
  .main span { font-size: 14.5px; color: rgba(10, 31, 24, 0.72); font-variant-numeric: tabular-nums; }

  .stepper { display: flex; align-items: center; gap: 2px; flex: none; }
  .stepper .n { min-width: 24px; text-align: center; font-weight: 700; font-size: 15.5px; font-variant-numeric: tabular-nums; }

  .foot {
    padding: 16px 20px calc(18px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: var(--cream);
  }
  .total { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .total span {
    font-size: 13.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(10, 31, 24, 0.68);
  }
  .total strong {
    font-family: var(--display);
    font-weight: 900;
    font-size: 29px;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  /* Side by side so clearing is a visible option rather than fine print under
     the primary button — it's the other thing you might want from this screen. */
  .buttons { display: flex; gap: 9px; }
  .done {
    flex: 1 1 auto;
    background: var(--foil-btn);
    color: var(--green-900);
    padding: 16px;
    font-size: 17px;
    font-weight: 900;
    border-radius: 999px;
    border: 1px solid rgba(139, 94, 18, 0.5);
    box-shadow: inset 0 1px 0 rgba(255, 244, 205, 0.85), 0 8px 20px -8px rgba(232, 183, 60, 0.8);
  }
  @media (hover: hover) and (pointer: fine) {
    .done:hover { transform: translateY(-2px); }
  }

  .clear {
    flex: 0 0 auto;
    background: transparent;
    border: 1.5px solid rgba(216, 72, 63, 0.45);
    color: var(--red);
    padding: 16px 18px;
    font-size: 16px;
    font-weight: 700;
    border-radius: 999px;
    white-space: nowrap;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .clear:hover { background: rgba(216, 72, 63, 0.09); border-color: var(--red); }
  .clear:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }

  /* Takes .clear's seat and its outlined weight — gold here would put two foil
     slabs side by side and leave you guessing which one the row is for. Undo is
     the way back, not the way on. */
  .take-back {
    flex: 0 0 auto;
    background: transparent;
    border: 1.5px solid var(--gold-deep);
    color: var(--ink);
    padding: 16px 22px;
    font-size: 16px;
    font-weight: 700;
    border-radius: 999px;
    white-space: nowrap;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .take-back:hover { background: rgba(232, 183, 60, 0.14); }
  }
  .take-back:focus-visible { outline: 2px solid var(--gold-deep); outline-offset: 2px; }

  .keeps {
    margin: 10px 0 0;
    text-align: center;
    font-size: 13px;
    color: rgba(10, 31, 24, 0.6);
  }
  .keeps.cleared { color: rgba(10, 31, 24, 0.78); font-weight: 600; }
</style>
