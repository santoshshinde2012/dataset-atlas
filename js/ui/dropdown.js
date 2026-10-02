/** One progressive-enhancement dropdown for static and dynamically rendered selects. */
export function initDropdowns() {
  if (!HTMLElement.prototype.showPopover) return; // Native select fallback on older browsers.
  const controls = new Map();
  let current = null;
  let sequence = 0;
  function enhance(select) {
    if (controls.has(select) || select.multiple) return;
    const label = select.getAttribute('aria-label') || [...(select.labels || [])].map((l) => [...l.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim()).join(' ') || 'Choose an option';
    const host = document.createElement('span');
    host.className = 'dropdown';
    select.before(host); host.append(select);
    select.classList.add('dropdown-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const button = document.createElement('button');
    button.type = 'button'; button.className = 'dropdown-trigger';
    button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', label); button.dataset.select = select.id;
    const caption = document.createElement('span'); caption.className = 'dropdown-caption';
    button.append(caption); host.append(button);
    const popup = document.createElement('div'); popup.className = 'dropdown-popup'; popup.id = `dropdown-${++sequence}`;
    popup.setAttribute('popover', 'manual');
    button.setAttribute('aria-controls', popup.id);
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search options…'; search.className = 'dropdown-search'; search.setAttribute('aria-label', `Search ${label.toLowerCase()}`);
    const list = document.createElement('div'); list.className = 'dropdown-options'; list.tabIndex = 0; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', label);
    const empty = document.createElement('p'); empty.className = 'dropdown-empty'; empty.textContent = 'No matching options'; empty.setAttribute('role', 'status');
    popup.append(search, list, empty);
    let shown = [], active = 0, typeahead = '', typedAt = 0;
    function sync() {
      caption.textContent = select.selectedOptions[0]?.textContent || 'Choose an option';
      button.disabled = select.disabled; host.hidden = select.hidden;
      for (const attribute of ['aria-invalid', 'aria-describedby', 'aria-required']) {
        if (select.hasAttribute(attribute)) button.setAttribute(attribute, select.getAttribute(attribute));
        else button.removeAttribute(attribute);
      }
      button.title = caption.textContent;
      button.setAttribute('aria-label', `${label}: ${caption.textContent}`);
      if (current?.select === select) renderOptions();
    }
    function activate(index) {
      active = Math.max(0, Math.min(index, shown.length - 1));
      [...list.children].forEach((node, i) => node.classList.toggle('highlighted', i === active));
      const node = list.children[active];
      if (node) { list.setAttribute('aria-activedescendant', node.id); if (node.offsetTop < list.scrollTop) list.scrollTop = node.offsetTop;
        else if (node.offsetTop + node.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = node.offsetTop + node.offsetHeight - list.clientHeight; }
      else list.removeAttribute('aria-activedescendant');
    }
    function renderOptions() {
      const query = search.value.trim().toLocaleLowerCase();
      shown = [...select.options].filter((o) => !o.hidden && !o.disabled && !o.parentElement.disabled && o.textContent.toLocaleLowerCase().includes(query));
      list.replaceChildren();
      for (const [i, option] of shown.entries()) {
        const node = document.createElement('div'); node.className = 'dropdown-option'; node.id = `${popup.id}-option-${i}`;
        node.setAttribute('role', 'option'); node.setAttribute('aria-label', option.textContent); node.setAttribute('aria-selected', String(option.selected)); node.textContent = option.textContent;
        node.onpointermove = () => activate(i);
        node.onmousedown = (event) => event.preventDefault();
        node.onclick = () => choose(i);
        list.append(node);
      }
      empty.hidden = shown.length > 0;
      activate(Math.max(0, shown.findIndex((o) => o.selected)));
    }
    function close(restore = false) {
      if (current?.select !== select) return;
      if (popup.matches(':popover-open')) popup.hidePopover();
      popup.remove(); button.setAttribute('aria-expanded', 'false'); current = null;
      if (restore && button.isConnected) button.focus({ preventScroll: true });
    }
    function position() {
      const rect = button.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 230), innerWidth - 24);
      const below = innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < 220 && above > below;
      const height = Math.min(340, upward ? above : below);
      popup.style.width = `${width}px`;
      popup.style.maxHeight = `${Math.max(100, height)}px`;
      popup.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
      popup.style.top = upward ? 'auto' : `${rect.bottom + 6}px`;
      popup.style.bottom = upward ? `${innerHeight - rect.top + 6}px` : 'auto';
    }
    function open() {
      if (current?.select === select) { close(true); return; }
      current?.close();
      typeahead = ''; typedAt = 0;
      search.value = ''; search.hidden = select.options.length <= 15;
      (select.closest('dialog') || document.body).append(popup);
      current = { select, popup, button, close, position };
      renderOptions(); position(); popup.showPopover(); button.setAttribute('aria-expanded', 'true');
      (search.hidden ? list : search).focus({ preventScroll: true });
    }
    function choose(index) {
      const option = shown[index]; if (!option) return;
      select.value = option.value;
      close(true);
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      // A form may replace its controls in the change handler. Restore the successor.
      queueMicrotask(() => {
        const successor = select.id ? document.querySelector(`.dropdown-trigger[data-select="${CSS.escape(select.id)}"]`) : button;
        successor?.focus({ preventScroll: true });
      });
    }
    button.onclick = open;
    button.onkeydown = (event) => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); open();
        if (event.key === 'End') activate(shown.length - 1);
        if (event.key === 'Home') activate(0);
      }
    };
    popup.onkeydown = (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
      else if (event.key === 'Tab') {
        // Return to the trigger before the browser moves to the next form control.
        close(true);
      } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); list.focus(); activate(active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.target === list && ['Home', 'End'].includes(event.key)) {
        event.preventDefault(); activate(event.key === 'Home' ? 0 : shown.length - 1);
      } else if (event.key === 'Enter' || (event.key === ' ' && event.target === list)) {
        event.preventDefault(); choose(active);
      } else if (event.target === list && event.key.length === 1) {
        event.preventDefault();
        typeahead = Date.now() - typedAt > 700 ? event.key : typeahead + event.key; typedAt = Date.now();
        const index = shown.findIndex((o) => o.textContent.toLowerCase().startsWith(typeahead.toLowerCase()));
        if (index >= 0) activate(index);
      }
    };
    search.oninput = renderOptions;
    select.addEventListener('change', sync);
    // Preserve existing state writers without polling or a second source of truth.
    for (const property of ['value', 'selectedIndex']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, property);
      Object.defineProperty(select, property, { configurable: true, get() { return descriptor.get.call(this); }, set(value) { descriptor.set.call(this, value); sync(); } });
    }
    const observer = new MutationObserver(sync);
    observer.observe(select, { childList: true, subtree: true, attributes: true });
    controls.set(select, { observer, close }); sync();
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches('select')) enhance(root);
    root.querySelectorAll('select').forEach(enhance);
  }
  scan(document.body);
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) scan(node);
    for (const [select, control] of controls) if (!select.isConnected) { control.close(); control.observer.disconnect(); controls.delete(select); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointerdown', (event) => {
    if (current && !current.popup.contains(event.target) && !current.button.contains(event.target)) current.close();
  }, true);
  document.addEventListener('scroll', (event) => {
    if (current && !current.popup.contains(event.target)) {
      const rect = current.button.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight) current.close();
      else current.position();
    }
  }, true);
  window.addEventListener('resize', () => current?.close());
  document.addEventListener('close', () => current?.close(), true);
}
