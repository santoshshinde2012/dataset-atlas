/** Clipboard service with an execCommand fallback for older engines. */
export function createClipboard(toast) {
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      toast('Copy failed');
    }
    ta.remove();
  }

  return function copyText(text, msg = 'Copied to clipboard') {
    const done = () => toast(msg);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  };
}
