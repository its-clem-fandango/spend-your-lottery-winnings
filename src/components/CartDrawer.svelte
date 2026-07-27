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
    ondone: () => void;
  }
  let { open, order, cart, index, images, spent, onclose, onadd, onremove, ondone }: Props = $props();

  let closeBtn = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (open) closeBtn?.focus();
  });
</script>

<div
  class="scrim"
  class:on={open}
  onclick={onclose}
  onkeydown={(e) => e.key === 'Enter' && onclose()}
  role="presentation"
></div>

<aside class="drawer" class:on={open} role="dialog" aria-modal="false" aria-labelledby="cart-title" aria-hidden={!open}>
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
                <img src={images[id].src} alt="" width="48" height="48" loading="lazy" decoding="async" />
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
    <button class="btn done" type="button" onclick={ondone}>I'm done spending</button>
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
  .done { width: 100%; background: var(--green-800); color: var(--cream-2); padding: 15px; font-size: 15.5px; border-radius: 999px; }
  .done:hover { background: var(--green-700); transform: translateY(-2px); }
</style>
