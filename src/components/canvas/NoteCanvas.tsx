import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CanvasImageItem, CanvasItem, CanvasStroke, CanvasTextItem, NoteCanvas as NoteCanvasData } from '../../types';
import type { Editor, JSONContent } from '@tiptap/react';
import { EMPTY_DOC, extractHeadings, fileToImageItem, newId, randomTilt } from '../../lib/canvas';
import TextItem from './TextItem';
import ImageItem from './ImageItem';
import DrawingLayer from './DrawingLayer';
import TextFormatBar from './TextFormatBar';
import CanvasToc from './CanvasToc';
import PostitMenu from './PostitMenu';
import BlockBgPill from './BlockBgPill';
import CanvasToolbar, { type Tool, PEN_COLORS } from './CanvasToolbar';

interface Props {
  initial: NoteCanvasData;
  onChange: (next: NoteCanvasData) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const MARQUEE_THRESHOLD = 4;

type Rect = { x: number; y: number; w: number; h: number };

export default function NoteCanvas({ initial, onChange }: Props) {
  const [items, setItems] = useState<CanvasItem[]>(initial.items);
  const [strokes, setStrokes] = useState<CanvasStroke[]>(initial.strokes);
  const [pan, setPan] = useState(initial.pan ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initial.zoom ?? 1);
  const [tool, setTool] = useState<Tool>('select');
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(3);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [drafting, setDrafting] = useState<CanvasStroke | null>(null);
  const [editors, setEditors] = useState<Map<string, Editor>>(() => new Map());
  const [tocOpen, setTocOpen] = useState(false);
  const [postitOpen, setPostitOpen] = useState(false);
  const [jumping, setJumping] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);

  /* Refs partagées avec les handlers globaux (la React state n'est pas lue dans une closure) */
  const itemsRef = useRef(items); itemsRef.current = items;
  const strokesRef = useRef(strokes); strokesRef.current = strokes;
  const panRef = useRef(pan); panRef.current = pan;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const penColorRef = useRef(penColor); penColorRef.current = penColor;
  const penWidthRef = useRef(penWidth); penWidthRef.current = penWidth;

  const selectOne = (id: string) => setSelectedIds(new Set([id]));
  const clearSelection = () => setSelectedIds(new Set());
  const isSelected = (id: string) => selectedIds.has(id);

  const registerEditor = (id: string, editor: Editor | null) => {
    setEditors((prev) => {
      const next = new Map(prev);
      if (editor) next.set(id, editor);
      else next.delete(id);
      return next;
    });
  };

  /* Texte unique sélectionné → sa barre de format s'affiche en haut */
  const soleSelectedText = (() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    const it = items.find((i) => i.id === id);
    return it && it.kind === 'text' ? it : null;
  })();
  const activeEditor = soleSelectedText ? editors.get(soleSelectedText.id) ?? null : null;

  /* Pastille de fond du post-it : ancrée sur la bbox écran RÉELLE du bloc
     sélectionné (mesurée), jamais sur des maths de transform composées —
     ainsi elle ne suit pas la rotation du post-it, elle reste juste au-dessus. */
  const [bgPillAnchor, setBgPillAnchor] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!soleSelectedText) {
      setBgPillAnchor((prev) => (prev === null ? prev : null));
      return;
    }
    const host = hostRef.current;
    const el = document.querySelector(`[data-item-id="${soleSelectedText.id}"]`) as HTMLElement | null;
    if (!host || !el) return;
    const er = el.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const left = er.left - hr.left, top = er.top - hr.top;
    setBgPillAnchor((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
  });

  const setStickyBg = (id: string, color: string | null) => {
    setItems((arr) => arr.map((it) => {
      if (it.id !== id || it.kind !== 'text') return it;
      if (color === null) return { ...it, bg: null };
      return { ...it, bg: color, rotate: it.rotate ?? randomTilt() };
    }));
  };

  const headings = useMemo(() => extractHeadings(items), [items]);

  /* Sommaire : centre la vue sur le bloc visé, avec une transition douce */
  const jumpToItem = (itemId: string) => {
    const it = itemsRef.current.find((i) => i.id === itemId);
    const host = hostRef.current;
    if (!it || !host || it.kind !== 'text') return;
    const hr = host.getBoundingClientRect();
    const cx = it.x + it.w / 2;
    const cy = it.y + (it.h ?? 120) / 2;
    setJumping(true);
    setPan({ x: hr.width / 2 - cx * zoomRef.current, y: hr.height / 2 - cy * zoomRef.current });
    selectOne(itemId);
    window.setTimeout(() => setJumping(false), 340);
  };

  /* Menu droit : ajoute un post-it de la couleur choisie, centré dans la vue */
  const addPostit = (color: string) => {
    const host = hostRef.current;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const center = toWorld(hr.left + hr.width / 2, hr.top + hr.height / 2);
    const id = newId('it');
    const w = 260;
    const next: CanvasTextItem = {
      kind: 'text', id,
      x: center.x - w / 2,
      y: center.y - 70,
      w,
      content: EMPTY_DOC,
      bg: color,
      rotate: randomTilt(),
    };
    setItems((arr) => [...arr, next]);
    selectOne(id);
    setPostitOpen(false);
    setTimeout(() => {
      const el = document.querySelector(`[data-item-id="${id}"] .tiptap-editor`) as HTMLElement | null;
      el?.focus();
    }, 30);
  };

  /* Auto-nettoyage : un texte vide qui sort de la sélection est supprimé */
  const prevSelectedRef = useRef<Set<string>>(selectedIds);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedIds;
    const leaving: string[] = [];
    prev.forEach((id) => { if (!selectedIds.has(id)) leaving.push(id); });
    if (leaving.length === 0) return;
    const toDrop = new Set(
      leaving.filter((id) => {
        const it = itemsRef.current.find((i) => i.id === id);
        return it && it.kind === 'text' && isEmptyDoc(it.content);
      }),
    );
    if (toDrop.size === 0) return;
    setItems((arr) => arr.filter((i) => !toDrop.has(i.id)));
  }, [selectedIds]);

  /* Persistance debouncée */
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSnapshot = useRef<NoteCanvasData>(initial);
  useEffect(() => {
    const snap: NoteCanvasData = { items, strokes, pan, zoom };
    currentSnapshot.current = snap;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onChangeRef.current(snap), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, strokes, pan, zoom]);
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      onChangeRef.current(currentSnapshot.current);
    }
  }, []);

  /* Raccourcis clavier */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isEditingText(e.target)) { e.preventDefault(); setSpaceHeld(true); }
      if (!isEditingText(e.target)) {
        if (e.key === 'v' || e.key === 'V') setTool('select');
        if (e.key === 't' || e.key === 'T') setTool('text');
        if (e.key === 'b' || e.key === 'B') setTool('pen');
        if (e.key === 'e' || e.key === 'E') setTool('eraser');
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && !isEditingText(e.target)) {
        e.preventDefault();
        const ids = selectedIds;
        setItems((arr) => arr.filter((it) => !ids.has(it.id)));
        clearSelection();
      }
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ') setSpaceHeld(false); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, [selectedIds]);

  /* Coordonnées monde / écran */
  const toWorld = (clientX: number, clientY: number) => {
    const host = hostRef.current;
    if (!host) return { x: 0, y: 0 };
    const r = host.getBoundingClientRect();
    return {
      x: (clientX - r.left - panRef.current.x) / zoomRef.current,
      y: (clientY - r.top - panRef.current.y) / zoomRef.current,
    };
  };

  /* Bbox écran d'un item, relatif au host */
  const screenRectOf = (id: string): Rect | null => {
    const el = document.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
    const host = hostRef.current;
    if (!el || !host) return null;
    const er = el.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    return { x: er.left - hr.left, y: er.top - hr.top, w: er.width, h: er.height };
  };

  const createTextAt = (clientX: number, clientY: number, box?: { w: number; h: number }) => {
    const w = toWorld(clientX, clientY);
    const id = newId('it');
    const next: CanvasTextItem = box
      ? { kind: 'text', id, x: w.x, y: w.y, w: Math.max(140, box.w), h: Math.max(60, box.h), content: EMPTY_DOC }
      : { kind: 'text', id, x: w.x - 6, y: w.y - 12, w: 480, content: EMPTY_DOC };
    setItems((arr) => [...arr, next]);
    selectOne(id);
    setTimeout(() => {
      const el = document.querySelector(`[data-item-id="${id}"] .tiptap-editor`) as HTMLElement | null;
      el?.focus();
    }, 30);
  };

  /* Outil Texte : clic = défaut ; glisser = on dessine la zone */
  const beginTextCreation = (clientX: number, clientY: number) => {
    const startWorld = toWorld(clientX, clientY);
    const startScreen = { x: clientX, y: clientY };
    const host = hostRef.current;
    const hr = host?.getBoundingClientRect();
    let dragged = false;

    const move = (ev: MouseEvent) => {
      if (!dragged) {
        if (Math.abs(ev.clientX - startScreen.x) + Math.abs(ev.clientY - startScreen.y) < MARQUEE_THRESHOLD) return;
        dragged = true;
      }
      if (!hr) return;
      /* Aperçu visuel en coords écran relatives au host */
      const sx = Math.min(startScreen.x, ev.clientX) - hr.left;
      const sy = Math.min(startScreen.y, ev.clientY) - hr.top;
      const sw = Math.abs(ev.clientX - startScreen.x);
      const sh = Math.abs(ev.clientY - startScreen.y);
      setMarquee({ x: sx, y: sy, w: sw, h: sh });
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setMarquee(null);
      if (dragged) {
        const endWorld = toWorld(ev.clientX, ev.clientY);
        const x = Math.min(startWorld.x, endWorld.x);
        const y = Math.min(startWorld.y, endWorld.y);
        const w = Math.abs(endWorld.x - startWorld.x);
        const h = Math.abs(endWorld.y - startWorld.y);
        const hr2 = host?.getBoundingClientRect();
        if (hr2) {
          createTextAt(hr2.left + (x * zoomRef.current + panRef.current.x), hr2.top + (y * zoomRef.current + panRef.current.y), { w, h });
        }
      } else {
        createTextAt(clientX, clientY);
      }
      setTool('select');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const beginPan = (clientX: number, clientY: number) => {
    setPanning(true);
    const origin = { ...panRef.current };
    const move = (ev: MouseEvent) => setPan({ x: origin.x + (ev.clientX - clientX), y: origin.y + (ev.clientY - clientY) });
    const up = () => {
      setPanning(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const beginMarquee = (clientX: number, clientY: number, additive: boolean) => {
    const host = hostRef.current;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const startX = clientX - hr.left;
    const startY = clientY - hr.top;
    const baseSelection = additive ? new Set(selectedIds) : new Set<string>();
    if (!additive) clearSelection();
    let moved = false;

    const move = (ev: MouseEvent) => {
      const cx = ev.clientX - hr.left;
      const cy = ev.clientY - hr.top;
      if (!moved) {
        if (Math.abs(cx - startX) + Math.abs(cy - startY) < MARQUEE_THRESHOLD) return;
        moved = true;
      }
      const rect: Rect = {
        x: Math.min(startX, cx),
        y: Math.min(startY, cy),
        w: Math.abs(cx - startX),
        h: Math.abs(cy - startY),
      };
      setMarquee(rect);

      /* Items dont la bbox écran touche le marquee */
      const hits = new Set<string>(baseSelection);
      itemsRef.current.forEach((it) => {
        const r = screenRectOf(it.id);
        if (!r) return;
        if (r.x < rect.x + rect.w && r.x + r.w > rect.x && r.y < rect.y + rect.h && r.y + r.h > rect.y) {
          hits.add(it.id);
        }
      });
      setSelectedIds(hits);
    };
    const up = () => {
      setMarquee(null);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* Plume : trace un trait suivi avec lissage par échantillonnage */
  const beginPenStroke = (clientX: number, clientY: number) => {
    const start = toWorld(clientX, clientY);
    const stroke: CanvasStroke = {
      id: newId('s'),
      color: penColorRef.current,
      width: penWidthRef.current,
      points: [[start.x, start.y]],
    };
    setDrafting(stroke);
    let last = start;
    const move = (ev: MouseEvent) => {
      const p = toWorld(ev.clientX, ev.clientY);
      const dx = p.x - last.x, dy = p.y - last.y;
      if (dx * dx + dy * dy < 4) return; /* ~2px en monde */
      last = p;
      stroke.points.push([p.x, p.y]);
      setDrafting({ ...stroke, points: [...stroke.points] });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (stroke.points.length >= 1) {
        setStrokes((arr) => [...arr, stroke]);
      }
      setDrafting(null);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* Gomme : supprime tout trait dont un segment passe à moins de seuil du curseur */
  const beginEraser = (clientX: number, clientY: number) => {
    const radiusWorld = 14 / zoomRef.current;
    const eraseAt = (cx: number, cy: number) => {
      const w = toWorld(cx, cy);
      const remaining = strokesRef.current.filter((s) => !strokeNearPoint(s, w.x, w.y, radiusWorld));
      if (remaining.length !== strokesRef.current.length) {
        setStrokes(remaining);
      }
    };
    eraseAt(clientX, clientY);
    const move = (ev: MouseEvent) => eraseAt(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    /* Pan : Espace ou clic milieu uniquement */
    if (spaceHeld || e.button === 1) {
      e.preventDefault();
      clearSelection();
      beginPan(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;

    /* Plume : trait libre */
    if (tool === 'pen') {
      e.preventDefault();
      beginPenStroke(e.clientX, e.clientY);
      return;
    }

    /* Gomme */
    if (tool === 'eraser') {
      e.preventDefault();
      beginEraser(e.clientX, e.clientY);
      return;
    }

    /* Outil Texte → clic = défaut, glisser = dessine la zone */
    if (tool === 'text') {
      beginTextCreation(e.clientX, e.clientY);
      return;
    }

    /* Mode sélection : marquee (Maj = additif) */
    beginMarquee(e.clientX, e.clientY, e.shiftKey);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const host = hostRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    setPan({ x: cx - wx * next, y: cy - wy * next });
    setZoom(next);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    host.addEventListener('wheel', onWheelNative, { passive: false });
    return () => host.removeEventListener('wheel', onWheelNative);
  }, []);

  /* Glisser-déposer d'images depuis l'explorateur */
  const onDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const w = toWorld(e.clientX, e.clientY);
    const items: CanvasItem[] = [];
    let dx = 0, dy = 0;
    for (const file of files) {
      try {
        const it = await fileToImageItem(file, { x: w.x + dx, y: w.y + dy });
        items.push(it);
        dx += 24; dy += 24;
      } catch { /* fichier illisible — on saute */ }
    }
    if (items.length) {
      setItems((arr) => [...arr, ...items]);
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  };

  /* Coller une image depuis le presse-papiers */
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      /* Si on est en train d'éditer du texte, laisser Tiptap gérer */
      if (isEditingText(e.target)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      const host = hostRef.current;
      if (!host) return;
      const hr = host.getBoundingClientRect();
      const center = toWorld(hr.left + hr.width / 2, hr.top + hr.height / 2);
      const items: CanvasItem[] = [];
      let dx = 0, dy = 0;
      for (const file of files) {
        try {
          const it = await fileToImageItem(file, { x: center.x + dx, y: center.y + dy });
          items.push(it);
          dx += 24; dy += 24;
        } catch { /* nope */ }
      }
      if (items.length) {
        setItems((arr) => [...arr, ...items]);
        setSelectedIds(new Set(items.map((i) => i.id)));
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const updateItem = (id: string, patch: Partial<CanvasTextItem> | Partial<CanvasImageItem>) => {
    setItems((arr) => arr.map((it) => (it.id === id ? ({ ...it, ...patch } as CanvasItem) : it)));
  };

  const deleteItem = (id: string) => {
    setItems((arr) => arr.filter((it) => it.id !== id));
    setSelectedIds((cur) => { if (!cur.has(id)) return cur; const n = new Set(cur); n.delete(id); return n; });
  };

  const cursor =
    panning || spaceHeld ? 'grabbing'
    : tool === 'text' ? 'text'
    : tool === 'pen' || tool === 'eraser' ? 'crosshair'
    : 'default';

  return (
    <div
      ref={hostRef}
      className={`note-canvas tool-${tool}${spaceHeld ? ' space-held' : ''}`}
      style={{ cursor }}
      onMouseDown={onCanvasMouseDown}
      onWheel={onWheel}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div
        className={`canvas-world${jumping ? ' jump-anim' : ''}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        <DrawingLayer strokes={strokes} drafting={drafting} />
        {items.map((it) => {
          if (it.kind === 'text') {
            return (
              <TextItem
                key={it.id}
                item={it}
                selected={isSelected(it.id)}
                zoom={zoom}
                onSelect={() => selectOne(it.id)}
                onChange={(patch) => updateItem(it.id, patch)}
                onDelete={() => deleteItem(it.id)}
                onEditorReady={(ed) => registerEditor(it.id, ed)}
              />
            );
          }
          if (it.kind === 'image') {
            return (
              <ImageItem
                key={it.id}
                item={it}
                selected={isSelected(it.id)}
                zoom={zoom}
                onSelect={() => selectOne(it.id)}
                onChange={(patch) => updateItem(it.id, patch)}
                onDelete={() => deleteItem(it.id)}
              />
            );
          }
          return null;
        })}
      </div>

      {marquee && (
        <div
          className="canvas-marquee"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      {soleSelectedText && activeEditor && (
        <TextFormatBar editor={activeEditor} />
      )}

      {soleSelectedText && bgPillAnchor && (
        <BlockBgPill
          item={soleSelectedText}
          anchor={bgPillAnchor}
          onSetBg={(c) => setStickyBg(soleSelectedText.id, c)}
        />
      )}

      <div className="canvas-right-stack">
        <CanvasToc
          headings={headings}
          open={tocOpen}
          onToggle={() => setTocOpen((v) => !v)}
          onJump={jumpToItem}
        />
        <PostitMenu
          open={postitOpen}
          onToggle={() => setPostitOpen((v) => !v)}
          onAdd={addPostit}
        />
      </div>

      <CanvasToolbar
        tool={tool}
        setTool={setTool}
        zoom={zoom}
        onZoomReset={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        penColor={penColor}
        setPenColor={setPenColor}
        penWidth={penWidth}
        setPenWidth={setPenWidth}
        onImportImage={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.multiple = true;
          input.onchange = async () => {
            const files = Array.from(input.files ?? []);
            if (!files.length) return;
            const host = hostRef.current;
            if (!host) return;
            const hr = host.getBoundingClientRect();
            const center = toWorld(hr.left + hr.width / 2, hr.top + hr.height / 2);
            const created: CanvasItem[] = [];
            let dx = 0, dy = 0;
            for (const file of files) {
              try {
                const it = await fileToImageItem(file, { x: center.x + dx, y: center.y + dy });
                created.push(it);
                dx += 24; dy += 24;
              } catch { /* skip */ }
            }
            if (created.length) {
              setItems((arr) => [...arr, ...created]);
              setSelectedIds(new Set(created.map((i) => i.id)));
            }
          };
          input.click();
        }}
      />

      {items.length === 0 && (
        <div className="canvas-empty">
          Clique l'icône <strong>Texte</strong> (ou <kbd>T</kbd>), puis pose ton premier texte.
        </div>
      )}
    </div>
  );
}

/* Plus proche distance carrée d'un point à un segment, puis test rayon */
function strokeNearPoint(stroke: CanvasStroke, x: number, y: number, radius: number): boolean {
  const r2 = radius * radius;
  const pts = stroke.points;
  if (pts.length === 1) {
    const dx = pts[0][0] - x, dy = pts[0][1] - y;
    return dx * dx + dy * dy <= r2;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const abx = bx - ax, aby = by - ay;
    const apx = x - ax, apy = y - ay;
    const ab2 = abx * abx + aby * aby || 1;
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * abx, cy = ay + t * aby;
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

function isEmptyDoc(doc: JSONContent | undefined): boolean {
  if (!doc?.content || doc.content.length === 0) return true;
  if (doc.content.length === 1) {
    const only = doc.content[0];
    const isBlockShell = only.type === 'paragraph' || only.type === 'heading';
    if (isBlockShell && (!only.content || only.content.length === 0)) return true;
  }
  return false;
}

function isEditingText(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}
