<script lang="ts">
  import ItemCard from './ItemCard.svelte';
  import { money } from '../lib/money';
  import { twoStep } from '../lib/confirm.svelte';
  import type { Category, Item, ItemImage, Cart } from '../lib/types';

  interface Props {
    items: Item[];
    categories: Category[];
    images: Record<string, ItemImage>;
    cart: Cart;
    remaining: number;
    count: number;
    spent: number;
    onadd: (id: string, el: HTMLElement) => void;
    onremove: (id: string) => void;
    onclear: () => void;
    ondone: () => void;
  }
  let {
    items, categories, images, cart, remaining, count, spent,
    onadd, onremove, onclear, ondone
  }: Props = $props();

  const confirmClear = twoStep(() => onclear());

  /* CC BY and CC BY-SA oblige us to name the photographer. Storing the credit
     in items.json isn't crediting anyone — it has to be somewhere a person can
     actually read, and the end of the board is the only end this page has. */
  let credited = $derived(items.filter((i) => i.imageCredit));

  $effect(() => {
    if (!count) confirmClear.disarm();
  });

  $effect(() => () => confirmClear.disarm());

  let active = $state(categories[0]?.slug ?? '');
  let sections: Record<string, HTMLElement> = {};
  const cards: Record<string, ItemCard> = {};

  /** Replays the add animation on a specific card. */
  export function popCard(id: string) {
    cards[id]?.pop();
  }

  let grouped = $derived(
    categories.map((c) => ({ category: c, items: items.filter((i) => i.category === c.slug) }))
  );

  function scrollTo(slug: string) {
    // The global reduced-motion CSS override doesn't reach JS-initiated scrolls.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sections[slug]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  /* Scroll spy rather than filtering: on mobile the whole board stays one
     continuous scroll, and the tabs just track where you are. */
  $effect(() => {
    const els = Object.values(sections).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) active = entry.target.id.replace('cat-', '');
        }
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  });
</script>

<!-- These are section links with a scroll spy, not tabs — tab ARIA would
     promise arrow-key navigation and panels that don't exist. -->
<div class="tabs-wrap">
  <nav class="tabs" aria-label="Categories">
    {#each categories as c (c.slug)}
      <button
        class="tab"
        type="button"
        aria-current={active === c.slug ? 'true' : undefined}
        onclick={() => scrollTo(c.slug)}
      >
        {c.name}
      </button>
    {/each}
  </nav>
</div>

<main>
  {#each grouped as group, gi (group.category.slug)}
    <section
      class="cat"
      id="cat-{group.category.slug}"
      bind:this={sections[group.category.slug]}
      aria-labelledby="h-{group.category.slug}"
    >
      <div class="cat-head">
        <h2 id="h-{group.category.slug}">{group.category.name}</h2>
        <p>{group.category.note}</p>
      </div>
      <div class="grid">
        {#each group.items as item, ii (item.id)}
          <ItemCard
            bind:this={cards[item.id]}
            {item}
            image={images[item.id]}
            qty={cart[item.id] ?? 0}
            affordable={item.price <= remaining}
            eager={gi === 0 && ii < 4}
            {onadd}
            {onremove}
          />
        {/each}
      </div>
    </section>
  {/each}

  <!-- The board used to just stop. If you've scrolled the whole thing you've
       made your decisions, so end with the two that are left. -->
  <footer class="end">
    {#if count}
      <p class="end-line">
        <strong>That's the whole board.</strong>
        {count} {count === 1 ? 'thing' : 'things'} in the cart, {money(spent)} gone.
      </p>
      <div class="end-actions">
        <button
          class="btn end-clear"
          type="button"
          class:armed={confirmClear.armed}
          onclick={confirmClear.press}
        >
          {confirmClear.armed ? `Press again to clear ${count}` : 'Clear cart'}
        </button>
        <button class="btn end-done" type="button" onclick={ondone}>See the damage</button>
      </div>
      <span class="vh" role="status">
        {confirmClear.armed ? 'Press the clear button again to empty your cart.' : ''}
      </span>
      <p class="end-note">Clearing empties the cart. Your winnings stay put.</p>
    {:else}
      <p class="end-line">
        <strong>That's the whole board.</strong>
        {items.length} ways to make it disappear, and you've picked none of them.
      </p>
    {/if}

    {#if credited.length}
      <details class="credits">
        <summary>Photography credits</summary>
        <ul>
          {#each credited as item (item.id)}
            <li>
              <span>{item.name}</span> —
              <a href={item.imageCredit!.url} target="_blank" rel="noopener noreferrer"
                >{item.imageCredit!.author}</a
              >, <em>{item.imageCredit!.license}</em>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </footer>
</main>

<style>
  .tabs-wrap {
    position: sticky;
    top: var(--topbar-h);
    z-index: 30;
    background: var(--cream);
    border-bottom: 1px solid var(--line);
  }
  .tabs {
    max-width: 1180px;
    margin: 0 auto;
    padding: 10px clamp(14px, 3vw, 28px);
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab {
    flex: none;
    border: 1.5px solid var(--line);
    background: transparent;
    border-radius: 999px;
    padding: 8px 15px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    color: rgba(10, 31, 24, 0.66);
    white-space: nowrap;
    transition: transform 0.14s ease, background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
  }
  .tab:hover { transform: translateY(-1px); border-color: var(--green-700); color: var(--ink); }
  .tab[aria-current='true'] {
    background: var(--foil-btn);
    border-color: var(--gold-deep);
    color: var(--green-900);
    box-shadow: inset 0 1px 0 rgba(255, 244, 205, 0.85), 0 2px 10px -2px rgba(232, 183, 60, 0.6);
  }

  main {
    max-width: 1180px;
    margin: 0 auto;
    padding: clamp(20px, 3vw, 34px) clamp(14px, 3vw, 28px) 140px;
  }
  .cat { margin-bottom: 52px; scroll-margin-top: calc(var(--topbar-h) + 66px); }

  .end {
    border-top: 1px solid var(--line);
    padding-top: 30px;
    text-align: center;
  }
  .end-line {
    margin: 0 0 18px;
    font-size: 14.5px;
    color: rgba(10, 31, 24, 0.55);
  }
  .end-line strong {
    display: block;
    font-family: var(--display);
    font-weight: 900;
    font-size: clamp(22px, 3.6vw, 30px);
    letter-spacing: -0.025em;
    color: var(--ink);
    margin-bottom: 5px;
  }
  .end-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .end-actions .btn { padding: 14px 24px; font-size: 15px; border-radius: 999px; }
  .end-clear {
    background: transparent;
    border: 1.5px solid rgba(216, 72, 63, 0.45);
    color: var(--red);
    font-weight: 700;
  }
  .end-clear:hover { background: rgba(216, 72, 63, 0.09); border-color: var(--red); }
  .end-clear.armed { background: var(--red); color: var(--cream-2); border-color: var(--red); }
  .end-clear:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
  .end-done {
    background: var(--foil-btn);
    color: var(--green-900);
    font-weight: 900;
    border: 1px solid rgba(139, 94, 18, 0.5);
    box-shadow: inset 0 1px 0 rgba(255, 244, 205, 0.85);
  }
  .end-done:hover { transform: translateY(-2px); }
  .end-note { margin: 12px 0 0; font-size: 11.5px; color: rgba(10, 31, 24, 0.42); }

  /* Collapsed by default — an obligation to meet, not something to read. */
  .credits { margin-top: 26px; font-size: 12px; }
  .credits summary {
    cursor: pointer;
    color: rgba(10, 31, 24, 0.45);
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .credits summary:hover { color: var(--ink); }
  /* Two columns of short sentences rather than a full-width table — the gap
     between a name and its photographer was doing nothing but grow. */
  .credits ul {
    list-style: none;
    margin: 14px auto 0;
    padding: 0;
    max-width: 860px;
    columns: 2;
    column-gap: 34px;
    text-align: left;
  }
  @media (max-width: 620px) { .credits ul { columns: 1; } }
  .credits li {
    break-inside: avoid;
    margin-bottom: 4px;
    color: rgba(10, 31, 24, 0.45);
    line-height: 1.45;
  }
  .credits li span { color: rgba(10, 31, 24, 0.62); }
  .credits a { color: rgba(10, 31, 24, 0.72); text-underline-offset: 2px; }
  .credits a:hover { color: var(--ink); }
  .credits em { font-style: normal; opacity: 0.7; white-space: nowrap; }
  .cat-head { display: flex; align-items: baseline; gap: 14px; margin: 0 0 18px; flex-wrap: wrap; }
  .cat-head h2 {
    font-family: var(--display);
    font-weight: 900;
    letter-spacing: -0.025em;
    font-size: clamp(26px, 4.6vw, 38px);
    margin: 0;
  }
  .cat-head p { margin: 0; font-size: 13.5px; font-style: italic; color: rgba(10, 31, 24, 0.55); }
  /* Gold rule trailing off after the note — every section gets a plaque. */
  .cat-head::after {
    content: '';
    flex: 1;
    min-width: 60px;
    height: 2px;
    align-self: center;
    background: linear-gradient(90deg, rgba(232, 183, 60, 0.75), rgba(232, 183, 60, 0));
    border-radius: 2px;
  }

  .grid {
    display: grid;
    gap: clamp(12px, 1.8vw, 18px);
    grid-template-columns: repeat(auto-fill, minmax(236px, 1fr));
  }
  @media (max-width: 520px) {
    .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  }
</style>
