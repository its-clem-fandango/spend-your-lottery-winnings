<script lang="ts">
  import { money } from '../lib/money';
  import { twoStep } from '../lib/confirm.svelte';
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
  }
  let { open, order, cart, index, images, spent, onclose, onadd, onremove, onclear, ondone }: Props = $props();

  let closeBtn = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (open) closeBtn?.focus();
  });

  /* Two-step rather than a confirm dialog: the drawer is already a dialog, and
     nesting one inside it means nesting focus traps. */
  const confirmClear = twoStep(() => onclear());

  $effect(() => {
    if (!open || !order.length) confirmClear.disarm();
  });

  $effect(() => () => confirmClear.disarm());
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
    <div class="buttons">
      {#if order.length}
        <!-- "Press" rather than tap or click: one word that's true on both a
             phone and a keyboard, and one selector that covers both in tests. -->
        <button class="btn clear" type="button" class:armed={confirmClear.armed} onclick={confirmClear.press}>
          {confirmClear.armed ? 'Press again' : 'Clear cart'}
        </button>
        <span class="vh" role="status">
          {confirmClear.armed ? 'Press the clear button again to empty your cart.' : ''}
        </span>
      {/if}
      <button class="btn done" type="button" onclick={ondone}>I'm done spending</button>
    </div>
    {#if order.length}
      <p class="keeps">Clearing empties the cart. Your winnings stay put.</p>
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
  .head h2 { font-family: var(--display); font-weight: 900; font-size: 23px; margin: 0; letter-spacing: -0.025em; }
  .close:hover { transform: rotate(90deg); }

  .list { flex: 1; overflow-y: auto; padding: 8px 20px 20px; margin: 0; list-style: none; }
  .empty { padding: 52px 24px; text-align: center; color: rgba(10, 31, 24, 0.5); font-size: 14px; line-height: 1.6; }
  .empty .big {
    font-family: var(--display);
    font-weight: 900;
    font-size: 21px;
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
  .main strong { display: block; font-size: 13.6px; font-weight: 700; line-height: 1.3; }
  .main span { font-size: 12.5px; color: rgba(10, 31, 24, 0.55); font-variant-numeric: tabular-nums; }

  .stepper { display: flex; align-items: center; gap: 2px; flex: none; }
  .stepper .n { min-width: 22px; text-align: center; font-weight: 700; font-size: 13.5px; font-variant-numeric: tabular-nums; }

  .foot {
    padding: 16px 20px calc(18px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: var(--cream);
  }
  .total { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .total span {
    font-size: 12.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(10, 31, 24, 0.5);
  }
  .total strong {
    font-family: var(--display);
    font-weight: 900;
    font-size: 26px;
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
    padding: 15px;
    font-size: 15.5px;
    font-weight: 900;
    border-radius: 999px;
    border: 1px solid rgba(139, 94, 18, 0.5);
    box-shadow: inset 0 1px 0 rgba(255, 244, 205, 0.85), 0 8px 20px -8px rgba(232, 183, 60, 0.8);
  }
  .done:hover { transform: translateY(-2px); }

  .clear {
    flex: 0 0 auto;
    background: transparent;
    border: 1.5px solid rgba(216, 72, 63, 0.45);
    color: var(--red);
    padding: 15px 17px;
    font-size: 14.5px;
    font-weight: 700;
    border-radius: 999px;
    white-space: nowrap;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .clear:hover { background: rgba(216, 72, 63, 0.09); border-color: var(--red); }
  .clear.armed { background: var(--red); color: var(--cream-2); border-color: var(--red); }
  .clear:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }

  .keeps {
    margin: 10px 0 0;
    text-align: center;
    font-size: 11.5px;
    color: rgba(10, 31, 24, 0.42);
  }
</style>
