/* Positionne un popup flottant (slash-menu, mentions…) près du caret, en
   retombant au-dessus si la place manque en dessous. Partagé entre les
   extensions Tiptap basées sur @tiptap/suggestion. */
export function positionPopup(popup: HTMLElement, clientRect: (() => DOMRect | null) | null | undefined) {
  if (!clientRect) return;
  const rect = clientRect();
  if (!rect) return;
  const margin = 6;
  const popupH = popup.offsetHeight || 320;
  const popupW = popup.offsetWidth || 240;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow < popupH + margin && rect.top > popupH + margin
    ? rect.top - popupH - margin
    : rect.bottom + margin;
  const left = Math.min(rect.left, window.innerWidth - popupW - margin);
  popup.style.left = `${Math.max(margin, left)}px`;
  popup.style.top = `${top}px`;
}
