<script lang="ts">
  import AmountField from './AmountField.svelte';
  import { money } from '../lib/money';
  import { spendable, effectiveRate } from '../lib/tax';

  interface Props {
    open: boolean;
    gross: number;
    taxed: boolean;
    spent: number;
    count: number;
    onapply: (gross: number, taxed: boolean) => void;
    onclose: () => void;
    onclear: () => void;
    onrestart: () => void;
  }
  let { open, gross, taxed, spent, count, onapply, onclose, onclear, onrestart }: Props = $props();

  /* Draft state, so backing out costs nothing. Seeded each time the dialog
     opens rather than tracking the props, or typing would fight the game. */
  let draftGross = $state(gross);
  let draftTaxed = $state(taxed);
  let field = $state<AmountField | null>(null);

  let returnTo: HTMLElement | null = null;
  $effect(() => {
    if (open) {
      returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      draftGross = gross;
      draftTaxed = taxed;
      field?.focus();
    } else if (returnTo) {
      returnTo.focus();
      returnTo = null;
    }
  });

  let total = $derived(spendable(draftGross, draftTaxed));
  let rate = $derived(effectiveRate(draftGross));
  let deficit = $derived(Math.max(0, spent - total));

  function apply() {
    if (draftGross < 1) return;
    onapply(draftGross, draftTaxed);
  }
</script>

{#if open}
  <div class="wrap" role="dialog" aria-modal="true" aria-labelledby="winnings-title">
    <div class="card">
      <div class="head">
        <h2 id="winnings-title">Change your winnings</h2>
        <button class="icon-btn close" type="button" onclick={onclose} aria-label="Close">✕</button>
      </div>

      <AmountField
        bind:this={field}
        value={draftGross}
        id="winnings-amount"
        size="compact"
        describedby="winnings-detail"
        onvalue={(n) => (draftGross = n)}
        onsubmit={apply}
      />

      <p class="detail" id="winnings-detail" aria-live="polite">
        {#if draftGross < 1}
          Type a number. Your cart stays exactly where it is.
        {:else if deficit > 0}
          You've already spent <span class="hl">{money(spent)}</span>. That puts you
          <span class="bad">{money(deficit)} in the hole</span>, which is allowed, if you insist.
        {:else}
          Spending <span class="hl">{money(total)}</span>{draftTaxed ? `. About ${rate}% never reaches you.` : '.'}
          Your cart is untouched.
        {/if}
      </p>

      <div class="row">
        <span id="tax-label">Spend the after-tax amount</span>
        <button
          class="switch"
          type="button"
          role="switch"
          aria-checked={draftTaxed}
          aria-labelledby="tax-label"
          onclick={() => (draftTaxed = !draftTaxed)}
        ><span class="knob"></span></button>
      </div>

      <div class="actions">
        <button class="btn cancel" type="button" onclick={onclose}>Cancel</button>
        <button class="btn apply" type="button" disabled={draftGross < 1} onclick={apply}>
          Update winnings
        </button>
      </div>

      <!-- The ladder, least to most destructive: change the amount above and
           the cart survives; clear here and the winnings survive; start over
           and nothing does. -->
      <div class="tertiary">
        {#if count > 0}
          <button class="linkish wipe" type="button" onclick={onclear}>
            Clear the cart, keep the winnings
          </button>
        {/if}
        <button class="linkish restart" type="button" onclick={onrestart}>Start over from scratch</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .wrap {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(8, 37, 28, 0.72);
    backdrop-filter: blur(6px);
    overflow-y: auto;
    display: grid;
    place-items: center;
    padding: clamp(16px, 4vw, 44px) 16px;
  }
  /* Green, not the summary's cream: this is the entry screen's question asked
     a second time, and the amount field is built for this background. */
  .card {
    width: min(440px, 100%);
    background: var(--green-800);
    color: var(--cream-2);
    border: 1px solid rgba(232, 183, 60, 0.28);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg);
    padding: 20px 22px 18px;
    animation: rise 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }

  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  .head h2 {
    font-family: var(--display);
    font-weight: 900;
    font-size: 24px;
    letter-spacing: -0.025em;
    margin: 0;
  }
  .close { background: transparent; color: var(--cream-2); border: 1.5px solid rgba(246, 239, 223, 0.3); }
  @media (hover: hover) and (pointer: fine) {
    .close:hover { transform: rotate(90deg); border-color: var(--gold); }
  }

  .detail {
    margin: 13px 0 0;
    font-size: 16px;
    line-height: 1.55;
    color: rgba(246, 239, 223, 0.8);
    min-height: 3.1em;
  }
  .hl { color: var(--gold); font-weight: 700; }
  .bad { color: #ff9b93; font-weight: 700; }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    margin-top: 2px;
    border-top: 1px solid rgba(246, 239, 223, 0.12);
    font-size: 16px;
  }
  .switch {
    flex: none;
    width: 46px;
    height: 26px;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid rgba(246, 239, 223, 0.3);
    background: rgba(0, 0, 0, 0.28);
    cursor: pointer;
    display: flex;
    transition: background 0.18s ease, border-color 0.18s ease;
  }
  .switch .knob {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--cream-2);
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .switch[aria-checked='true'] { background: var(--gold-deep); border-color: var(--gold); }
  .switch[aria-checked='true'] .knob { transform: translateX(20px); background: var(--gold-hi); }
  .switch:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }

  .actions { display: flex; gap: 10px; margin-top: 6px; }
  .actions :global(.btn) { flex: 1 1 0; }
  /* Not .btn-ghost: that one is built for the cream surfaces, with ink text
     and a dark hairline border that all but vanishes on green. */
  .cancel {
    background: transparent;
    color: var(--cream-2);
    border: 1.5px solid rgba(246, 239, 223, 0.3);
    padding: 15px 20px;
    font-size: 17px;
  }
  .cancel:hover { background: rgba(246, 239, 223, 0.08); border-color: rgba(246, 239, 223, 0.5); }
  .apply {
    background: var(--foil-btn);
    color: var(--green-900);
    font-weight: 900;
    border: 1px solid rgba(139, 94, 18, 0.5);
    box-shadow: inset 0 1px 0 rgba(255, 244, 205, 0.85);
  }
  @media (hover: hover) and (pointer: fine) {
    .apply:hover:not(:disabled) { transform: translateY(-2px); }
  }

  .tertiary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(246, 239, 223, 0.12);
  }
  .wipe {
    background: none;
    border: 0;
    padding: 4px;
    font: inherit;
    font-size: 14.5px;
    font-weight: 700;
    color: rgba(246, 239, 223, 0.85);
    text-decoration: underline;
    text-decoration-color: rgba(246, 239, 223, 0.3);
    text-underline-offset: 3px;
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .wipe:hover { color: var(--gold-hi); }
  .wipe:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; border-radius: 3px; }

  .restart {
    display: block;
    margin: 2px auto 0;
    background: none;
    border: 0;
    padding: 4px;
    font: inherit;
    font-size: 14px;
    color: rgba(246, 239, 223, 0.68);
    text-decoration: underline;
    text-decoration-color: rgba(246, 239, 223, 0.25);
    text-underline-offset: 3px;
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .restart:hover { color: #ff9b93; }
  .restart:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; border-radius: 3px; }
</style>
