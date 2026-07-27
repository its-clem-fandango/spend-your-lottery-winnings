<script lang="ts">
  import { money, clamp } from '../lib/money';
  import { afterTax, effectiveRate } from '../lib/tax';
  import { sliderToAmount, amountToSlider, MIN_AMOUNT, MAX_AMOUNT, SLIDER_STEPS } from '../lib/slider';

  interface Props {
    initialAmount?: number;
    onstart: (gross: number, taxed: boolean) => void;
  }
  let { initialAmount = 12_400_000, onstart }: Props = $props();

  let gross = $state(initialAmount);
  let taxed = $state(false);
  let field = $state(initialAmount.toLocaleString('en-US'));
  let input = $state<HTMLInputElement | null>(null);

  const CHIPS = [
    { amount: 500_000, label: '$500K', note: 'Scratch-off dream' },
    { amount: 2_000_000, label: '$2M', note: 'Local news story' },
    { amount: 50_000_000, label: '$50M', note: 'Quit-your-job money' },
    { amount: 500_000_000, label: '$500M', note: 'Historic jackpot' }
  ];

  let sliderPos = $derived(amountToSlider(gross || MIN_AMOUNT));
  let net = $derived(afterTax(gross));
  let rate = $derived(effectiveRate(gross));

  function setAmount(value: number) {
    gross = clamp(Math.round(value), 0, MAX_AMOUNT);
    field = gross ? gross.toLocaleString('en-US') : '';
  }

  /* Reformat as the user types without the caret jumping to the end. */
  function onInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const caret = el.selectionStart ?? 0;
    const before = el.value.length;
    const parsed = parseFloat(el.value.replace(/[^0-9.]/g, ''));
    gross = clamp(Math.round(Number.isFinite(parsed) ? parsed : 0), 0, MAX_AMOUNT);
    field = gross ? gross.toLocaleString('en-US') : '';
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

<section class="entry">
  <div class="inner">
    <p class="kicker">Congratulations, allegedly</p>
    <h1>So. You <em>won</em>.</h1>
    <p class="sub">
      Now the hard part. Money this size doesn't spend itself — it just sits there, judging
      you. Put in a number and let's get rid of it.
    </p>

    <label class="vh" for="amount">Jackpot amount in dollars</label>
    <div class="field">
      <span class="dollar" aria-hidden="true">$</span>
      <input
        id="amount"
        bind:this={input}
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="0"
        value={field}
        oninput={onInput}
        onkeydown={(e) => e.key === 'Enter' && start()}
        aria-describedby="tax-copy"
      />
    </div>

    <div class="chips" role="group" aria-label="Common jackpot sizes">
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

    <div class="slider-row">
      <label for="slider">Or slide</label>
      <input
        id="slider"
        type="range"
        min="0"
        max={SLIDER_STEPS}
        step="1"
        value={sliderPos}
        style="--fill:{sliderPos / 10}%"
        oninput={(e) => setAmount(sliderToAmount(+(e.currentTarget as HTMLInputElement).value))}
        aria-label="Jackpot amount slider"
      />
    </div>

    <div class="tax">
      <span class="switch">
        <input type="checkbox" id="tax-toggle" bind:checked={taxed} />
        <span class="track" aria-hidden="true"></span>
        <span class="knob" aria-hidden="true"></span>
      </span>
      <label class="tax-copy" for="tax-toggle" id="tax-copy">
        <b>Show the after-tax estimate</b>
        <span id="tax-detail">
          {#if !gross}
            Lottery winnings are taxed as ordinary income — the 24% withheld up front is only
            a down payment on what you actually owe.
          {:else if taxed}
            A <span class="hl">{money(gross)}</span> lump sum lands closer to
            <span class="hl">{money(net)}</span>. That's about <span class="hl">{rate}%</span>
            gone to federal income tax plus a typical 5% state cut. Spending the realistic number.
          {:else}
            Lottery winnings are taxed as ordinary income. This one would really be worth about
            <span class="hl">{money(net)}</span> after tax — the 24% withheld up front is only a
            down payment.
          {/if}
        </span>
      </label>
    </div>

    <button class="btn btn-primary start" type="button" disabled={gross < 1} onclick={start}>
      Start spending →
    </button>
    <p class="foot">No accounts, no data, no actual money. Obviously.</p>
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
    mask-image: radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 78%);
    -webkit-mask-image: radial-gradient(70% 60% at 50% 40%, #000 0%, transparent 78%);
  }
  .inner { position: relative; z-index: 1; width: min(680px, 100%); text-align: center; }

  .kicker {
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--gold);
    margin: 0 0 18px;
  }
  h1 {
    font-family: var(--display);
    font-weight: 900;
    font-size: clamp(42px, 9vw, 84px);
    line-height: 0.95;
    letter-spacing: -0.035em;
    margin: 0 0 14px;
  }
  h1 em { font-style: normal; color: var(--gold); }
  .sub {
    margin: 0 auto 34px;
    max-width: 44ch;
    font-size: clamp(15px, 2.1vw, 18px);
    line-height: 1.55;
    color: rgba(246, 239, 223, 0.72);
  }

  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(232, 183, 60, 0.35);
    border-radius: var(--r-lg);
    padding: 14px clamp(14px, 3vw, 26px);
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }
  .field:focus-within {
    border-color: var(--gold);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 0 6px rgba(232, 183, 60, 0.12);
  }
  .dollar {
    font-family: var(--display);
    font-weight: 700;
    font-size: clamp(30px, 7vw, 54px);
    color: var(--gold);
    line-height: 1;
  }
  .field input {
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
    font-size: clamp(30px, 7.4vw, 58px);
    line-height: 1.1;
    letter-spacing: -0.03em;
    padding: 0;
    text-align: left;
  }
  .field input::placeholder { color: rgba(246, 239, 223, 0.28); }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 18px 0 4px; }
  .chip {
    border: 1.5px solid rgba(246, 239, 223, 0.22);
    background: transparent;
    color: rgba(246, 239, 223, 0.86);
    border-radius: 999px;
    padding: 9px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.14s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  }
  .chip:hover { transform: translateY(-2px); border-color: var(--gold); color: var(--cream-2); }
  .chip[aria-pressed='true'] { background: var(--gold); border-color: var(--gold); color: var(--green-900); }
  .chip small {
    display: block;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.62;
    margin-top: 1px;
  }
  @media (max-width: 600px) {
    .chips { display: grid; grid-template-columns: 1fr 1fr; }
    .chip { padding: 10px 8px; }
  }

  .slider-row { margin: 26px 0 6px; display: flex; align-items: center; gap: 14px; }
  .slider-row label {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
    color: rgba(246, 239, 223, 0.45);
    white-space: nowrap;
  }
  .slider-row input {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 4px;
    border-radius: 99px;
    background: linear-gradient(
      90deg,
      var(--gold) var(--fill, 20%),
      rgba(246, 239, 223, 0.18) var(--fill, 20%)
    );
    outline: none;
    cursor: pointer;
  }
  .slider-row input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--gold);
    border: 3px solid var(--green-800);
    cursor: grab;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  }
  .slider-row input::-moz-range-thumb {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--gold);
    border: 3px solid var(--green-800);
    cursor: grab;
  }

  .tax {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    text-align: left;
    margin: 24px auto 0;
    padding: 14px 16px;
    max-width: 520px;
    background: rgba(0, 0, 0, 0.16);
    border: 1px solid rgba(246, 239, 223, 0.1);
    border-radius: var(--r-md);
  }
  .switch { position: relative; flex: none; width: 46px; height: 27px; margin-top: 1px; }
  .switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 2; }
  .switch .track {
    position: absolute; inset: 0;
    border-radius: 99px;
    background: rgba(246, 239, 223, 0.2);
    transition: background 0.2s ease;
  }
  .switch .knob {
    position: absolute; top: 3px; left: 3px;
    width: 21px; height: 21px;
    border-radius: 50%;
    background: var(--cream-2);
    transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .switch input:checked ~ .track { background: var(--gold); }
  .switch input:checked ~ .knob { transform: translateX(19px); }
  .switch input:focus-visible ~ .track { box-shadow: 0 0 0 4px rgba(232, 183, 60, 0.3); }

  .tax-copy { font-size: 13.5px; line-height: 1.5; color: rgba(246, 239, 223, 0.62); }
  .tax-copy b { display: block; color: var(--cream-2); font-size: 14.5px; font-weight: 600; margin-bottom: 2px; }
  .tax-copy :global(.hl), .hl { color: var(--gold); font-weight: 700; }

  .start { margin-top: 28px; width: min(100%, 340px); }
  .foot { margin: 18px 0 0; font-size: 12.5px; color: rgba(246, 239, 223, 0.34); }
</style>
