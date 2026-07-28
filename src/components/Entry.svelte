<script lang="ts">
  import { money, clamp } from '../lib/money';
  import { afterTax, effectiveRate } from '../lib/tax';
  import { MAX_AMOUNT } from '../lib/slider';

  interface Props {
    onstart: (gross: number, taxed: boolean) => void;
  }
  let { onstart }: Props = $props();

  /* Starts empty on purpose: the question deserves a real answer, not a
     pre-filled fantasy. (Live jackpot feeds were investigated and rejected —
     the lotteries' endpoints are unofficial, CORS-blocked, and this site is
     static.) */
  let gross = $state(0);
  let taxed = $state(false);
  let field = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  const CHIPS = [
    { amount: 2_000_000, label: '$2M', note: 'local news story' },
    { amount: 50_000_000, label: '$50M', note: 'quit-your-job money' },
    { amount: 500_000_000, label: '$500M', note: 'historic jackpot' }
  ];

  let net = $derived(afterTax(gross));
  let rate = $derived(effectiveRate(gross));

  /* Keystrokes before hydration land on a dead input; with no pre-filled
     amount there is nothing to mask that. data-ready lets tests (and anything
     else) wait for the moment typing actually works. */
  let ready = $state(false);

  /* Keyboard users land ready to type, like a form that asked a question.
     Touch devices skip it — popping the keyboard on load is hostile. */
  $effect(() => {
    ready = true;
    if (matchMedia('(pointer: fine)').matches) inputEl?.focus();
  });

  function setAmount(value: number) {
    gross = clamp(Math.round(value), 0, MAX_AMOUNT);
    field = gross ? gross.toLocaleString('en-US') : '';
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
    const parsed = parseFloat(el.value.replace(/[^0-9.]/g, ''));
    gross = clamp(Math.round(Number.isFinite(parsed) ? parsed : 0), 0, MAX_AMOUNT);
    field = gross ? gross.toLocaleString('en-US') : '';
    /* When sanitising leaves the parsed value unchanged (paste junk into
       "1,200"), no state changes and Svelte skips the DOM write — sync it by
       hand or the junk stays visible. */
    if (/[^0-9,]/.test(el.value)) nudge();
    if (el.value !== field) el.value = field;
    queueMicrotask(() => {
      const shift = field.length - before;
      try { el.setSelectionRange(caret + shift, caret + shift); } catch {}
    });
  }

  function start() {
    if (gross < 1) return;
    onstart(gross, taxed);
  }
</script>

<section class="entry" data-ready={ready ? '' : undefined}>
  <div class="inner">
    <p class="kicker">Congratulations, allegedly</p>

    <h1><label for="amount">If I <em>won</em><span class="vh"> — jackpot amount in dollars</span>&hellip;</label></h1>

    <div class="line" class:nudged>
      <span class="oops" class:show={nudged} role="status">{nudged ? 'Numbers only.' : ''}</span>
      <span class="dollar" aria-hidden="true">$</span>
      <input
        id="amount"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        bind:this={inputEl}
        value={field}
        onbeforeinput={onBeforeInput}
        oninput={onInput}
        onfocus={(e) => e.currentTarget.select()}
        onkeydown={(e) => e.key === 'Enter' && start()}
        aria-describedby="tax-detail"
      />
    </div>

    <p class="tax" id="tax-detail" aria-live="polite">
      {#if !gross}
        Type a number. We'll break the tax news gently.
      {:else if taxed}
        Spending the honest <span class="hl">{money(net)}</span> — about
        <span class="hl">{rate}%</span> of the jackpot never reaches you.
        <button type="button" class="linkish" onclick={() => (taxed = false)}>Back to the fantasy</button>
      {:else}
        That's about <span class="hl">{money(net)}</span> after taxes —
        <button type="button" class="linkish" onclick={() => (taxed = true)}>spend that instead</button>
      {/if}
    </p>

    <div class="go">
      <button class="btn btn-primary start" type="button" disabled={gross < 1} onclick={start}>
        Start spending →
      </button>
      <span class="hint" aria-hidden="true">or press <kbd>Enter</kbd></span>
    </div>

    <div class="chips" role="group" aria-label="Common jackpot sizes">
      <span class="chips-label">no idea? try</span>
      {#each CHIPS as chip (chip.amount)}
        <button
          type="button"
          class="chip"
          aria-pressed={gross === chip.amount}
          onclick={() => setAmount(chip.amount)}
        >
          {chip.label}<small>{chip.note}</small>
        </button>
      {/each}
    </div>

  </div>
</section>

<style>
  .entry {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(20px, 5vw, 56px) 20px calc(40px + env(safe-area-inset-bottom));
    background: radial-gradient(
      1100px 620px at 50% -12%,
      var(--green-700) 0%,
      var(--green-800) 42%,
      var(--green-900) 100%
    );
    color: var(--cream-2);
    position: relative;
    overflow: hidden;
  }
  .entry::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(rgba(232, 183, 60, 0.16) 1px, transparent 1.4px);
    background-size: 26px 26px;
    mask-image: radial-gradient(70% 60% at 42% 40%, #000 0%, transparent 78%);
    -webkit-mask-image: radial-gradient(70% 60% at 42% 40%, #000 0%, transparent 78%);
  }

  /* Left-aligned, one question at a time — the whole screen is the form. */
  .inner {
    position: relative;
    z-index: 1;
    width: min(760px, 100%);
    text-align: left;
  }

  .kicker {
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--gold);
    margin: 0 0 20px;
  }

  h1 {
    font-family: var(--display);
    font-weight: 900;
    font-size: clamp(44px, 9vw, 88px);
    line-height: 0.98;
    letter-spacing: -0.035em;
    margin: 0 0 10px;
  }
  h1 label { cursor: text; }
  /* The one word that matters gets animated gold foil. */
  h1 em {
    font-style: normal;
    background: var(--foil);
    background-size: 250% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: foil-shift 5s ease-in-out infinite;
  }
  @keyframes foil-shift {
    0%, 100% { background-position: 0% 0; }
    50% { background-position: 100% 0; }
  }

  /* The answer line: no box, just an underline that wakes up when you do. */
  .line {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: clamp(8px, 1.6vw, 16px);
    margin-top: clamp(18px, 4vw, 34px);
    padding-bottom: 10px;
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
  @media (prefers-reduced-motion: reduce) {
    .line.nudged { animation: none; }
  }
  .dollar {
    font-family: var(--display);
    font-weight: 700;
    font-size: clamp(34px, 6.6vw, 62px);
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
    font-size: clamp(38px, 8vw, 72px);
    line-height: 1.1;
    letter-spacing: -0.03em;
    padding: 0;
    caret-color: var(--gold);
  }
  .line input::selection { background: rgba(232, 183, 60, 0.35); }

  /* Tax reality as a sentence, not a control panel. */
  .tax {
    margin: 14px 0 0;
    font-size: clamp(14px, 1.9vw, 16.5px);
    line-height: 1.55;
    color: rgba(246, 239, 223, 0.62);
    min-height: 2.6em;
  }
  .hl { color: var(--gold); font-weight: 700; }
  .linkish {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    font-weight: 700;
    color: var(--cream-2);
    text-decoration: underline;
    text-decoration-color: rgba(232, 183, 60, 0.6);
    text-underline-offset: 3px;
    cursor: pointer;
    transition: color 0.15s ease, text-decoration-color 0.15s ease;
  }
  .linkish:hover { color: var(--gold-hi); text-decoration-color: var(--gold); }
  .linkish:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 3px;
    border-radius: 3px;
  }

  .go {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: clamp(24px, 4vw, 36px);
  }
  .start { width: min(100%, 300px); }
  .hint {
    font-size: 12.5px;
    color: rgba(246, 239, 223, 0.4);
    white-space: nowrap;
  }
  .hint kbd {
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border: 1px solid rgba(246, 239, 223, 0.28);
    border-bottom-width: 2px;
    border-radius: 5px;
    color: rgba(246, 239, 223, 0.65);
  }
  /* The Enter hint is meaningless where there is no Enter. */
  @media (hover: none) { .hint { display: none; } }

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 22px;
    margin-top: clamp(30px, 5vw, 46px);
  }
  .chips-label {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(246, 239, 223, 0.4);
  }
  .chip {
    background: none;
    border: 0;
    padding: 4px 0;
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    cursor: pointer;
    font-family: var(--body);
    color: rgba(246, 239, 223, 0.85);
    border-bottom: 1.5px dashed rgba(246, 239, 223, 0.25);
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .chip:hover { color: var(--cream-2); border-bottom-color: var(--gold); }
  .chip:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 3px;
    border-radius: 3px;
  }
  .chip[aria-pressed='true'] {
    color: var(--gold);
    border-bottom: 1.5px solid var(--gold);
  }
  .chip small {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    opacity: 0.55;
  }


  @media (max-width: 600px) {
    .go { flex-direction: column; align-items: stretch; }
    .start { width: 100%; }
  }
</style>
