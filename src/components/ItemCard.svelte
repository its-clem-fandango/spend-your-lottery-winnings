<script lang="ts">
  import { money } from '../lib/money';
  import type { Item, ItemImage } from '../lib/types';

  interface Props {
    item: Item;
    image: ItemImage | undefined;
    qty: number;
    affordable: boolean;
    eager: boolean;
    onadd: (id: string, el: HTMLElement) => void;
    onremove: (id: string) => void;
  }
  let { item, image, qty, affordable, eager, onadd, onremove }: Props = $props();

  /* Cards are ~210px at desktop, roughly two-up on phones. */
  const SIZES = '(max-width: 520px) 45vw, (max-width: 1180px) 22vw, 210px';

  let root = $state<HTMLElement | null>(null);
  let popping = $state(false);

  export function pop() {
    popping = false;
    // Force a reflow so the animation restarts on a repeat add.
    void root?.offsetWidth;
    popping = true;
    setTimeout(() => (popping = false), 440);
  }
</script>

<!--
  The card is a div with a full-bleed button on top rather than a <button>
  wrapper: buttons cannot nest, and the remove control has to sit inside the
  card's bounds. The overlay carries the accessible name and keyboard handling.
-->
<div
  class="card"
  class:owned={qty > 0}
  class:unaffordable={!affordable}
  class:pop={popping}
  bind:this={root}
  data-id={item.id}
>
  <div class="media">
    {#if image}
      <picture>
        <source type="image/avif" srcset={image.avif} sizes={SIZES} />
        <source type="image/webp" srcset={image.webp} sizes={SIZES} />
        <img
          src={image.src}
          width={image.width}
          height={image.height}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding={eager ? 'sync' : 'async'}
          fetchpriority={eager ? 'high' : 'auto'}
          draggable="false"
        />
      </picture>
    {/if}
  </div>

  <h3>{item.name}</h3>
  <p class="blurb">{item.blurb}</p>
  <span class="price">{money(item.price)}</span>

  <span class="qty" class:on={qty > 0} aria-hidden="true">{qty}</span>

  <button
    class="hit"
    type="button"
    aria-label="Add {item.name}, {money(item.price)}"
    onclick={() => root && onadd(item.id, root)}
  ></button>

  <button
    class="rm"
    type="button"
    aria-label="Remove one {item.name}"
    tabindex={qty > 0 ? 0 : -1}
    onclick={() => onremove(item.id)}
  >−</button>
</div>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    text-align: left;
    background: var(--cream-2);
    border: 1.5px solid var(--line);
    border-radius: var(--r-md);
    padding: 12px 12px 12px;
    cursor: pointer;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition:
      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.18s ease,
      border-color 0.18s ease,
      opacity 0.2s ease;
    will-change: transform;
  }
  .card:hover {
    transform: translateY(-5px) rotate(-0.5deg);
    box-shadow: var(--shadow-md);
    border-color: rgba(8, 37, 28, 0.3);
  }
  .card:active { transform: translateY(-1px) scale(0.99); }
  .card.owned { border-color: var(--green-600); background: #fff; }

  /* Kept clickable on purpose — the refusal animation is the feedback. */
  .card.unaffordable { opacity: 0.42; }
  .card.unaffordable:hover { opacity: 0.62; }

  .media {
    border-radius: var(--r-sm);
    overflow: hidden;
    margin-bottom: 10px;
    background: var(--green-800);
    aspect-ratio: 4 / 3;
  }
  .media picture { display: block; width: 100%; height: 100%; }
  .media img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .card:hover .media img { transform: scale(1.06); }

  .card.pop .media img { animation: pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes pop {
    0% { transform: scale(1); }
    45% { transform: scale(1.16) rotate(-2deg); }
    100% { transform: scale(1); }
  }

  h3 { margin: 0 0 3px; font-size: 14.5px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; }
  .blurb { margin: 0 0 10px; font-size: 12.3px; line-height: 1.4; color: rgba(10, 31, 24, 0.55); flex: 1; }
  .price {
    font-family: var(--display);
    font-weight: 700;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .qty {
    position: absolute;
    top: 9px; right: 9px;
    min-width: 25px; height: 25px;
    padding: 0 7px;
    border-radius: 99px;
    background: var(--green-800);
    color: var(--gold);
    font-size: 12.5px;
    font-weight: 700;
    display: grid;
    place-items: center;
    transform: scale(0);
    transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: 2;
  }
  .qty.on { transform: scale(1); }

  .hit {
    position: absolute;
    inset: 0;
    z-index: 1;
    border: 0;
    background: transparent;
    cursor: pointer;
    border-radius: var(--r-md);
    padding: 0;
  }
  .hit:focus-visible { outline: 3px solid var(--gold); outline-offset: -3px; }

  .rm {
    position: absolute;
    left: 9px; top: 9px;
    z-index: 2;
    width: 27px; height: 27px;
    border-radius: 50%;
    border: 1.5px solid var(--line);
    background: var(--cream-2);
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 18px;
    line-height: 1;
    font-weight: 700;
    color: rgba(10, 31, 24, 0.55);
    opacity: 0;
    transform: scale(0.7);
    pointer-events: none;
    transition:
      opacity 0.2s ease,
      transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1),
      background 0.16s ease,
      color 0.16s ease,
      border-color 0.16s ease;
  }
  .card.owned .rm { opacity: 1; transform: scale(1); pointer-events: auto; }
  .rm:hover { background: var(--red); border-color: var(--red); color: #fff; }
</style>
