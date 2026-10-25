/** Clipboard port returns success and reports failures; browser APIs can be substituted in tests. */
export function createClipboard(toast, { clipboard = globalThis.navigator?.clipboard, document = globalThis.document } = {}) {
  function fallbackCopy(text) {
    const previousFocus = document.activeElement;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    // A native modal makes the rest of the document inert, including a body-level textarea.
    const container = previousFocus?.closest?.('dialog[open]') || document.body;
    try {
      container.appendChild(ta);
      ta.focus();
      ta.select();
      return document.execCommand('copy') === true;
    } catch {
      return false;
    } finally {
      ta.remove();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }

  return async function copyText(text, msg = 'Copied to clipboard') {
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(text);
        toast(msg);
        return true;
      } catch { /* denied or unavailable: use the focused-document fallback */ }
    }
    const copied = fallbackCopy(text);
    toast(copied ? msg : 'Copy failed');
    return copied;
  };
}
