import { useEffect, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';

interface Heading {
  level: number;
  text: string;
  pos: number;
  key: string;
}

export default function Toc({ editor }: { editor: Editor }) {
  const headings = useEditorState({
    editor,
    selector: ({ editor }): Heading[] => {
      const out: Heading[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.textContent.trim()) {
          out.push({
            level: node.attrs.level as number,
            text: node.textContent,
            pos,
            key: `${pos}:${node.textContent}`,
          });
        }
      });
      return out;
    },
    equalityFn: (a, b) => !!b && a.length === b.length && a.every((h, i) => h.key === b[i].key),
  }) as Heading[];

  const [active, setActive] = useState<number | null>(null);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    const scroll = document.querySelector('.editor-scroll') as HTMLElement | null;

    const place = () => {
      const page = document.querySelector('.editor-page') as HTMLElement | null;
      if (!page || !scroll) {
        setStyle({ display: 'none' });
        return;
      }
      const pr = page.getBoundingClientRect();
      const sr = scroll.getBoundingClientRect();
      const width = 212;
      const gap = 28;
      const left = pr.left - gap - width;
      if (left < sr.left + 6) {
        setStyle({ display: 'none' });
        return;
      }
      setStyle({ position: 'fixed', left, top: sr.top + 30, width });
    };

    const spy = () => {
      const sr = scroll?.getBoundingClientRect();
      if (!sr) return;
      let act: number | null = null;
      for (const h of headings) {
        let top: number;
        try {
          top = editor.view.coordsAtPos(h.pos).top;
        } catch {
          continue;
        }
        if (top <= sr.top + 96) act = h.pos;
        else break;
      }
      setActive(act);
    };

    const onScroll = () => {
      place();
      spy();
    };

    place();
    spy();
    window.addEventListener('resize', place);
    scroll?.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('resize', place);
      scroll?.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headings]);

  const go = (pos: number) => {
    const scroll = document.querySelector('.editor-scroll') as HTMLElement | null;
    if (!scroll) return;
    let top: number;
    try {
      top = editor.view.coordsAtPos(pos).top;
    } catch {
      return;
    }
    const target = scroll.scrollTop + (top - scroll.getBoundingClientRect().top) - 24;
    const max = scroll.scrollHeight - scroll.clientHeight;
    scroll.scrollTo({ top: Math.max(0, Math.min(max, target)), behavior: 'smooth' });
  };

  if (!headings.length || !style || style.display === 'none') return null;

  return (
    <nav className="note-toc" style={style} aria-label="Sommaire">
      <div className="toc-title">Sommaire</div>
      <ul>
        {headings.map((h) => (
          <li key={h.key} className={`toc-item lvl-${h.level}${active === h.pos ? ' active' : ''}`}>
            <button type="button" onClick={() => go(h.pos)} title={h.text}>
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
