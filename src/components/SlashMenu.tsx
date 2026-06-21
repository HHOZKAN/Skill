import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SlashItem } from '../lib/extensions/slashCommand';

export interface SlashMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

const SlashMenu = forwardRef<SlashMenuRef, Props>(({ items, command }, ref) => {
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
    return <div className="slash-menu slash-empty">Aucun bloc</div>;
  }

  return (
    <div className="slash-menu" ref={listRef}>
      <div className="slash-label">Blocs</div>
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          className={`slash-item${i === selected ? ' active' : ''}`}
          onMouseEnter={() => setSelected(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            select(i);
          }}
        >
          <span className="slash-ico">{item.icon}</span>
          <span className="slash-txt">
            <span className="slash-t">{item.title}</span>
            <span className="slash-d">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

SlashMenu.displayName = 'SlashMenu';

export default SlashMenu;
