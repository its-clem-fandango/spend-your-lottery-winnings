<script lang="ts">
  import { parseAmount, formatAmount, hasJunk } from '../lib/amount';

  interface Props {
    value: number;
    /** Defaults to the id the entry screen has always used, so labels keep pointing at it. */
    id?: string;
    size?: 'hero' | 'compact';
    describedby?: string;
    onvalue: (n: number) => void;
    onsubmit?: () => void;
  }
  let {
    value,
    id = 'amount',
    size = 'hero',
    describedby,
    onvalue,
    onsubmit
  }: Props = $props();

  let inputEl: HTMLInputElement | undefined = $state();
  let field = $state(formatAmount(value));

  /* Typing already keeps field and value in step, so this only fires when the
     amount is set from outside — a preset chip, or the dialog opening. */
  $effect(() => {
    if (parseAmount(field) !== value) field = formatAmount(value);
  });

  export function focus() {
    inputEl?.focus();
  }

  /* Rejecting a keystroke silently reads as "the site is broken". Shake the
     line and say why, every time, until the message lands. */
  let nudged = $state(false);
  let nudgeTimer: ReturnType<typeof setTimeout> | undefined;
  function nudge() {
    nudged = false; // drop and re-add the class so the animation restarts
    requestAnimationFrame(() => (nudged = true));
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => (nudged = false), 1800);
  }

  $effect(() => () => clearTimeout(nudgeTimer));

  /* Typed non-digits never enter the field at all — dollars are whole numbers
     here, so that includes '.' and ','. Paste is allowed through and sanitised
     in onInput instead, so "$1,200" pasted from somewhere still lands as 1,200. */
  function onBeforeInput(e: InputEvent) {
    if (e.inputType === 'insertText' && e.data && /\D/.test(e.data)) {
      e.preventDefault();
      nudge();
    }
  }

  /* Reformat as the user types without the caret jumping to the end. */
  function onInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const caret = el.selectionStart ?? 0;
    const before = el.value.length;
    const junk = hasJunk(el.value);
    const n = parseAmount(el.value);
    field = formatAmount(n);
    if (junk) nudge();
    /* When sanitising leaves the parsed value unchanged (paste junk into
       "1,200"), no state changes and Svelte skips the DOM write — sync it by
       hand or the junk stays visible. */
    if (el.value !== field) el.value = field;
    queueMicrotask(() => {
      const shift = field.length - before;
      try { el.setSelectionRange(caret + shift, caret + shift); } catch {}
    });
    onvalue(n);
  }
</script>

<div class="line {size}" class:nudged>
  <span class="oops" class:show={nudged} role="status">{nudged ? 'Numbers only.' : ''}</span>
  <span class="dollar" aria-hidden="true">$</span>
  <input
    {id}
    type="text"
    inputmode="numeric"
    autocomplete="off"
    bind:this={inputEl}
    value={field}
    onbeforeinput={onBeforeInput}
    oninput={onInput}
    onfocus={(e) => e.currentTarget.select()}
    onkeydown={(e) => e.key === 'Enter' && onsubmit?.()}
    aria-describedby={describedby}
  />
</div>

<style>
  /* The answer line: no box, just an underline that wakes up when you do. */
  .line {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: clamp(8px, 1.6vw, 16px);
    border-bottom: 3px solid rgba(232, 183, 60, 0.3);
    transition: border-color 0.2s ease;
  }
  .line:focus-within { border-color: var(--gold); }
  .line:focus-within .dollar { opacity: 1; }
  .line.nudged { border-color: var(--red); animation: line-shake 0.4s ease; }
  @keyframes line-shake {
    0%, 100% { transform: none; }
    20% { transform: translateX(-7px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(2px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .line.nudged { animation: none; }
  }

  .oops {
    position: absolute;
    right: 0;
    bottom: calc(100% + 10px);
    padding: 6px 13px;
    border-radius: 999px;
    background: rgba(216, 72, 63, 0.14);
    border: 1px solid rgba(216, 72, 63, 0.5);
    color: #ffb9b2;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(4px);
    pointer-events: none;
    transition: opacity 0.18s ease, transform 0.18s ease;
  }
  .oops.show { opacity: 1; transform: none; }

  .dollar {
    font-family: var(--display);
    font-weight: 700;
    color: var(--gold);
    line-height: 1;
    opacity: 0.75;
    transition: opacity 0.2s ease;
  }
  .line input {
    flex: 1;
    min-width: 0;
    width: 100%;
    background: none;
    border: 0;
    outline: none;
    color: var(--cream-2);
    font-family: var(--display);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    letter-spacing: -0.03em;
    padding: 0;
    caret-color: var(--gold);
  }
  .line input::selection { background: rgba(232, 183, 60, 0.35); }

  .hero { padding-bottom: 10px; }
  .hero .dollar { font-size: clamp(34px, 6.6vw, 62px); }
  .hero input { font-size: clamp(38px, 8vw, 72px); }

  /* Same line, asked again in a smaller room. */
  .compact { padding-bottom: 7px; border-bottom-width: 2px; gap: 10px; }
  .compact .dollar { font-size: clamp(24px, 5vw, 30px); }
  .compact input { font-size: clamp(27px, 5.6vw, 34px); }
  .compact .oops { font-size: 12px; padding: 5px 11px; bottom: calc(100% + 8px); }
</style>
