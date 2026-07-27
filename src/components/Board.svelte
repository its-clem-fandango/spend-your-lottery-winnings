<script lang="ts">
  import ItemCard from './ItemCard.svelte';
  import type { Category, Item, ItemImage, Cart } from '../lib/types';

  interface Props {
    items: Item[];
    categories: Category[];
    images: Record<string, ItemImage>;
    cart: Cart;
    remaining: number;
    onadd: (id: string, el: HTMLElement) => void;
    onremove: (id: string) => void;
  }
  let { items, categories, images, cart, remaining, onadd, onremove }: Props = $props();

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
    sections[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

<div class="tabs-wrap">
  <div class="tabs" role="tablist" aria-label="Categories">
    {#each categories as c (c.slug)}
      <button
        class="tab"
        type="button"
        role="tab"
        aria-selected={active === c.slug}
        onclick={() => scrollTo(c.slug)}
      >
        {c.name}
      </button>
    {/each}
  </div>
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
  .tab[aria-selected='true'] { background: var(--green-800); border-color: var(--green-800); color: var(--cream-2); }

  main {
    max-width: 1180px;
    margin: 0 auto;
    padding: clamp(20px, 3vw, 34px) clamp(14px, 3vw, 28px) 140px;
  }
  .cat { margin-bottom: 44px; scroll-margin-top: calc(var(--topbar-h) + 66px); }
  .cat-head { display: flex; align-items: baseline; gap: 12px; margin: 0 0 16px; flex-wrap: wrap; }
  .cat-head h2 {
    font-family: var(--display);
    font-weight: 900;
    letter-spacing: -0.025em;
    font-size: clamp(24px, 4.4vw, 34px);
    margin: 0;
  }
  .cat-head p { margin: 0; font-size: 13.5px; color: rgba(10, 31, 24, 0.5); }

  .grid {
    display: grid;
    gap: clamp(10px, 1.6vw, 16px);
    grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  }
  @media (max-width: 520px) {
    .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  }
</style>
