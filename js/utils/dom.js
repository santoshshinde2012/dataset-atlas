/** Small DOM helpers shared by UI components. Browser-only module. */

export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
