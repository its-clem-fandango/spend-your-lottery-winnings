/**
 * Two-press confirmation for something destructive.
 *
 * The first press arms the control and relabels it; a second press inside the
 * window commits, and letting it lapse disarms. Shared because clearing the
 * cart is offered from three places — the drawer, the winnings dialog and the
 * end of the board — and the one thing that must not drift between them is how
 * many presses it takes and how long you have to think about it. Each caller
 * still owns its own wording and styling.
 */
export function twoStep(onconfirm: () => void, windowMs = 3000) {
  let armed = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    get armed() {
      return armed;
    },
    press() {
      if (!armed) {
        armed = true;
        clearTimeout(timer);
        timer = setTimeout(() => (armed = false), windowMs);
        return;
      }
      clearTimeout(timer);
      armed = false;
      onconfirm();
    },
    /** Never leave a control armed across a close, or once there's nothing left to destroy. */
    disarm() {
      clearTimeout(timer);
      armed = false;
    }
  };
}
