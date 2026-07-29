<script lang="ts">
  import { TOUR_STEPS, placeCard } from '../lib/tour';

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();

  let stepIndex = $state(0);
  let rect = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let cardPos = $state<{ top: number; left: number } | null>(null);
  let mobile = $state(false);
  let cardEl = $state<HTMLElement | null>(null);
  let dialogEl = $state<HTMLElement | null>(null);

  const PAD = 8;

  let step = $derived(TOUR_STEPS[stepIndex]!);
  let last = $derived(stepIndex === TOUR_STEPS.length - 1);

  /* Same rationale as Summary: capture the trigger before focus moves into
     the dialog; restoring can silently fail if it's gone — focus stays put. */
  let returnTo: HTMLElement | null = null;
  /* The entry screen offers Enter as the way to start, and the tour opens on
     that same keystroke — which is still travelling up to window when the
     handler below mounts. Without a cutoff it advances the tour it just
     opened, and a first run started with Enter lands on the last step with
     the first two skipped for good. Events created before this instant
     belong to whatever opened the tour, not to the tour. */
  let openedAt = 0;
  $effect(() => {
    if (open) {
      stepIndex = 0;
      openedAt = performance.now();
      returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else if (returnTo) {
      returnTo.focus();
      returnTo = null;
    }
  });

  function findTarget(): HTMLElement | null {
    for (const sel of step.selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }
    return null;
  }

  /* Spotlight the current step's target and keep tracking it: the topbar
     resizes with its clamped numbers, and wheel events scroll the page right
     through the fixed overlay. */
  $effect(() => {
    if (!open) return;
    void stepIndex;

    const target = findTarget();
    if (!target) {
      // Never spotlight nothing — a missing target skips its step.
      if (last) onclose();
      else stepIndex += 1;
      return;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });

    const measure = () => {
      // Locals, then assign: reading back state written in this effect would
      // make the effect its own dependency.
      const r = target.getBoundingClientRect();
      const spot = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
      const narrow = window.matchMedia('(max-width: 699px)').matches;
      rect = spot;
      mobile = narrow;
      if (!narrow && cardEl) {
        cardPos = placeCard(
          spot,
          { width: cardEl.offsetWidth, height: cardEl.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight }
        );
      }
    };
    measure();
    /* The dialog takes focus, not the button inside it. Enter is how the entry
       screen starts a run, and that keystroke is still in flight when the tour
       opens on top of it: focus the primary action and the browser delivers
       the rest of the keypress to it as a click, advancing a tour nobody has
       read yet. A container can't be activated, and the step's title is
       announced because the dialog is labelled by it. */
    dialogEl?.focus();

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(target);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  });

  function next() {
    if (last) onclose();
    else stepIndex += 1;
  }

  function back() {
    if (stepIndex > 0) stepIndex -= 1;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    // Both clocks are page-relative, so anything older than the open is the
    // keystroke that caused it.
    if (e.timeStamp < openedAt) return;
    if (e.key === 'Escape') {
      onclose();
    } else if (e.key === 'ArrowRight') {
      next();
    } else if (e.key === 'ArrowLeft') {
      back();
    } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      // Buttons already act on Enter; advancing here too would double-fire.
      next();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- tour: 100, above summary's 90. Clicks anywhere but the card are
       swallowed on purpose — a stray tap must not skip the content. -->
  <div
    class="tour"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tour-title"
    tabindex="-1"
    bind:this={dialogEl}
  >
    {#if rect}
      <div
        class="spotlight"
        style:top="{rect.top}px"
        style:left="{rect.left}px"
        style:width="{rect.width}px"
        style:height="{rect.height}px"
      ></div>
    {/if}

    <div
      class="step-card"
      bind:this={cardEl}
      style:top={!mobile && cardPos ? `${cardPos.top}px` : undefined}
      style:left={!mobile && cardPos ? `${cardPos.left}px` : undefined}
    >
      <div aria-live="polite">
        <p class="progress-line">Step {stepIndex + 1} of {TOUR_STEPS.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p class="body-copy">{step.body}</p>
      </div>
      <div class="row">
        {#if stepIndex > 0}
          <button class="btn btn-ghost back" type="button" onclick={back}>Back</button>
        {/if}
        <button class="btn btn-primary next" type="button" onclick={next}>
          {last ? "Got it, let's spend" : 'Next'}
        </button>
      </div>
      <button class="btn btn-ghost skip" type="button" onclick={onclose}>Skip the tour</button>
    </div>
  </div>
{/if}

<style>
  .tour {
    position: fixed;
    inset: 0;
    z-index: 100;
  }
  /* Focused only to park the keyboard inside the dialog; the spotlight is the
     visible answer to "where am I", so a ring around the whole viewport would
     just be noise. Every control inside keeps its own. */
  .tour:focus { outline: none; }

  /* One transparent div does all the work: the gold ring, the glow, and a
     giant shadow that dims everything outside the cutout. It morphs between
     steps for free; reduced-motion zeroes the transition globally. */
  .spotlight {
    position: fixed;
    border-radius: var(--r-md);
    pointer-events: none;
    box-shadow:
      0 0 0 3px var(--gold),
      0 0 26px 6px rgba(232, 183, 60, 0.45),
      0 0 0 200vmax rgba(8, 37, 28, 0.72);
    transition:
      top 0.35s cubic-bezier(0.22, 1, 0.36, 1),
      left 0.35s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.35s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .step-card {
    position: fixed;
    width: min(420px, calc(100vw - 32px));
    background: var(--cream-2);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg);
    padding: 22px 24px 20px;
    animation: rise 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    transition:
      top 0.35s cubic-bezier(0.22, 1, 0.36, 1),
      left 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(26px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }

  .progress-line {
    margin: 0 0 6px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: rgba(10, 31, 24, 0.62);
  }
  h2 {
    margin: 0 0 8px;
    font-family: var(--display);
    font-weight: 900;
    font-size: 29px;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .body-copy {
    margin: 0 0 18px;
    font-size: 19px;
    line-height: 1.5;
  }

  .row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }
  .row .next {
    flex: 1;
    min-height: 52px;
    padding: 13px 24px;
  }
  .row .back {
    flex: none;
    min-height: 52px;
  }
  .skip {
    width: 100%;
    min-height: 52px;
  }

  /* Narrow screens: a bottom sheet, no computed positioning at all. The
     scrollIntoView centering keeps the target in the clear upper half. */
  @media (max-width: 699px) {
    .step-card {
      width: auto;
      left: 12px;
      right: 12px;
      top: auto;
      bottom: calc(12px + env(safe-area-inset-bottom));
    }
  }
</style>
