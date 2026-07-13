import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { MentionItem } from '../lib/extensions/noteMention';

export interface MentionMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface Props {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

const MentionMenu = forwardRef<MentionMenuRef, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelected(0), [items]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.slash-item.active');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const select = (i: number) => {
    const item = items[i];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (!items.length) return false;
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        select(selected);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return <div className="slash-menu slash-empty">Aucune compétence trouvée</div>;
  }

  return (
    <div className="slash-menu" ref={listRef}>
      <div className="slash-label">Lier à une compétence</div>
      {items.map((item, i) => (
        <button
          key={`${item.treeId}:${item.nodeId}`}
          type="button"
          className={`slash-item${i === selected ? ' active' : ''}`}
          onMouseEnter={() => setSelected(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            select(i);
          }}
        >
          <span className="slash-ico">◆</span>
          <span className="slash-txt">
            <span className="slash-t">{item.label}</span>
            <span className="slash-d">{item.treeLabel}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

MentionMenu.displayName = 'MentionMenu';

export default MentionMenu;
