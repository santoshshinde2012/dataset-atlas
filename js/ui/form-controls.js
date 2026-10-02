/** Shared presentation and accessible feedback; feature modules own their validation rules. */
export function setFieldError(control, message = '') {
  if (!control?.id) return;
  const errorId = `${control.id}-error`;
  let error = document.getElementById(errorId);
  if (!error && message) {
    error = document.createElement('span'); error.id = errorId; error.className = 'field-error';
    error.setAttribute('aria-live', 'polite');
    const group = control.closest('.year-inputs, .workbench-inputs');
    if (group) group.append(error); else (control.closest('label') || control).after(error);
  }
  control.setCustomValidity?.(message);
  control.setAttribute('aria-invalid', String(Boolean(message)));
  const descriptions = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (message) descriptions.add(errorId); else descriptions.delete(errorId);
  if (descriptions.size) control.setAttribute('aria-describedby', [...descriptions].join(' '));
  else control.removeAttribute('aria-describedby');
  if (error) { error.textContent = message; error.hidden = !message; }
}

export function initFormControls() {
  const enhanced = new WeakSet();
  function enhance(control) {
    if (enhanced.has(control)) return;
    enhanced.add(control);
    control.classList.add('form-control');
    if (control.tagName === 'INPUT' && control.type === 'number') control.inputMode = 'decimal';
    const label = control.labels?.[0];
    const help = label?.querySelector('small');
    if (help && control.id) {
      help.id ||= `${control.id}-help`;
      const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)); ids.add(help.id);
      control.setAttribute('aria-describedby', [...ids].join(' '));
    }
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches('input, select, textarea')) enhance(node);
    node.querySelectorAll('input, select, textarea').forEach(enhance);
  }
  scan(document.body);
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) scan(node);
  }).observe(document.body, { childList: true, subtree: true });
}
