/** Keep keyboard navigation inside an open native dialog across browsers. */
export function trapModalFocus(dialog, event) {
  if (!dialog.open || event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && element.getClientRects().length > 0);
  if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
}
