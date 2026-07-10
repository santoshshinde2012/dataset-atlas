/** Transient notification service bound to the #toast element. */
export function createToast(element) {
  let timer;
  return function toast(msg) {
    element.textContent = msg;
    element.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { element.hidden = true; }, 2200);
  };
}
