import { useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasConnector, CanvasFrameItem, CanvasImageItem, CanvasItem, CanvasShapeItem, CanvasStroke, CanvasTextItem, NoteCanvas as NoteCanvasData, PacerCode } from '../../types';
import type { Editor } from '@tiptap/react';
import { EMPTY_DOC, extractHeadings, fileToImageItem, newId, randomTilt } from '../../lib/canvas';
import { computeSnap, type GuideLine, type GapLine } from '../../lib/snapping';
import { worldRectOf, isFullyInside, type Rect } from '../../lib/geometry';
import TextItem from './TextItem';
import ImageItem from './ImageItem';
import FrameItem from './FrameItem';
import ShapeItem from './ShapeItem';
import DrawingLayer from './DrawingLayer';
import ConnectorLayer from './ConnectorLayer';
import AlignmentGuides from './AlignmentGuides';
import TextFormatBar from './TextFormatBar';
import CanvasToc from './CanvasToc';
import BacklinksPanel from './BacklinksPanel';
import PostitMenu from './PostitMenu';
import PostitAdjustPanel from './PostitAdjustPanel';
import CanvasContextMenu from './CanvasContextMenu';
import CanvasToolbar, { type ShapeKind, type Tool, PEN_COLORS, SHAPE_COLORS } from './CanvasToolbar';

interface Props {
  initial: NoteCanvasData;
  onChange: (next: NoteCanvasData) => void;
  treeId: string;
  nodeId: string;
  onNavigateToNote: (treeId: string, nodeId: string) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const MARQUEE_THRESHOLD = 4;

export default function NoteCanvas({ initial, onChange, treeId, nodeId, onNavigateToNote }: Props) {
  const [items, setItems] = useState<CanvasItem[]>(initial.items);
  const [strokes, setStrokes] = useState<CanvasStroke[]>(initial.strokes);
  const [connectors, setConnectors] = useState<CanvasConnector[]>(initial.connectors ?? []);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<{ x: number; y: number } | null>(null);
  const [pan, setPan] = useState(initial.pan ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initial.zoom ?? 1);
  const [tool, setTool] = useState<Tool>('select');
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(3);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rect');
  const [shapeColor, setShapeColor] = useState<string>(SHAPE_COLORS[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [drafting, setDrafting] = useState<CanvasStroke | null>(null);
  const [editors, setEditors] = useState<Map<string, Editor>>(() => new Map());
  const [tocOpen, setTocOpen] = useState(false);
  const [postitOpen, setPostitOpen] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ left: number; top: number } | null>(null);
  const [snapGuides, setSnapGuides] = useState<GuideLine[]>([]);
  const [snapGaps, setSnapGaps] = useState<GapLine[]>([]);

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

  const setStickyBg = (id: string, color: string | null) => {
    setItems((arr) => arr.map((it) => {
      if (it.id !== id || it.kind !== 'text') return it;
      if (color === null) return { ...it, bg: null };
      return { ...it, bg: color, rotate: it.rotate ?? randomTilt() };
    }));
  };

  const setLink = (id: string, link: string | null) => {
    setItems((arr) => arr.map((it) => (it.id === id && it.kind === 'text' ? { ...it, link } : it)));
  };

  const setPacer = (id: string, pacer: PacerCode | null) => {
    setItems((arr) => arr.map((it) => (it.id === id && it.kind === 'text' ? { ...it, pacer } : it)));
  };

  /* Duplique les blocs sélectionnés, légèrement décalés, et sélectionne les copies */
  const duplicateSelection = () => {
    const ids = selectedIds;
    if (ids.size === 0) return;
    const copies: CanvasItem[] = [];
    itemsRef.current.forEach((it) => {
      if (!ids.has(it.id)) return;
      copies.push({ ...it, id: newId('it'), x: it.x + 24, y: it.y + 24 });
    });
    if (!copies.length) return;
    setItems((arr) => [...arr, ...copies]);
    setSelectedIds(new Set(copies.map((c) => c.id)));
  };

  /* Ordre d'empilement : dernier du tableau = rendu au-dessus */
  const bringToFront = (ids: Set<string>) => {
    setItems((arr) => [...arr.filter((it) => !ids.has(it.id)), ...arr.filter((it) => ids.has(it.id))]);
  };
  const sendToBack = (ids: Set<string>) => {
    setItems((arr) => [...arr.filter((it) => ids.has(it.id)), ...arr.filter((it) => !ids.has(it.id))]);
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

  /* Persistance debouncée */
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSnapshot = useRef<NoteCanvasData>(initial);
  useEffect(() => {
    const snap: NoteCanvasData = { items, strokes, connectors, pan, zoom };
    currentSnapshot.current = snap;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onChangeRef.current(snap), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, strokes, connectors, pan, zoom]);
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      onChangeRef.current(currentSnapshot.current);
    }
  }, []);

  /* Change d'outil et, si on quitte Relier, oublie le point de départ en attente */
  const changeTool = (t: Tool) => {
    setTool(t);
    if (t !== 'link') { setLinkFrom(null); setLinkPreview(null); }
  };

  /* Raccourcis clavier */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isEditingText(e.target)) { e.preventDefault(); setSpaceHeld(true); }
      if (!isEditingText(e.target)) {
        if (e.key === 'v' || e.key === 'V') changeTool('select');
        if (e.key === 't' || e.key === 'T') changeTool('text');
        if (e.key === 'b' || e.key === 'B') changeTool('pen');
        if (e.key === 'e' || e.key === 'E') changeTool('eraser');
        if (e.key === 'r' || e.key === 'R') changeTool('link');
        if (e.key === 'f' || e.key === 'F') changeTool('frame');
        if (e.key === 's' || e.key === 'S') changeTool('shape');
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && !isEditingText(e.target)) {
        e.preventDefault();
        const ids = selectedIds;
        setItems((arr) => arr.filter((it) => !ids.has(it.id)));
        setConnectors((arr) => arr.filter((c) => !ids.has(c.from) && !ids.has(c.to)));
        clearSelection();
      }
      if ((e.metaKey || e.ctrlKey) && selectedIds.size > 0 && !isEditingText(e.target)) {
        if (e.key === 'd' || e.key === 'D') { e.preventDefault(); duplicateSelection(); }
        else if (e.key === ']') { e.preventDefault(); bringToFront(selectedIds); }
        else if (e.key === '[') { e.preventDefault(); sendToBack(selectedIds); }
      }
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ') setSpaceHeld(false); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* Mode Relier : la ligne de prévisualisation suit la souris jusqu'au second clic */
  useEffect(() => {
    if (tool !== 'link' || !linkFrom) return;
    const onMove = (e: MouseEvent) => setLinkPreview(toWorld(e.clientX, e.clientY));
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [tool, linkFrom]);

  /* Glisser un bloc (texte/image/forme) : accroche aux autres blocs et affiche
     les guides d'alignement + les distances, façon Figma. */
  const dragItemTo = (id: string, x: number, y: number) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it) return;
    const rect = worldRectOf({ ...it, x, y } as CanvasItem);
    const others = itemsRef.current.filter((o) => o.id !== id).map(worldRectOf);
    const snap = computeSnap(rect, others, zoomRef.current);
    setSnapGuides(snap.guides);
    setSnapGaps(snap.gaps);
    updateItem(id, { x: snap.x, y: snap.y });
  };

  const endDrag = () => {
    setSnapGuides([]);
    setSnapGaps([]);
  };

  /* Blocs masqués parce qu'enveloppés dans un cadre replié */
  const hiddenByCollapse = useMemo(() => {
    const hidden = new Set<string>();
    items.forEach((f) => {
      if (f.kind !== 'frame' || !f.collapsed) return;
      const frameRect = worldRectOf(f);
      items.forEach((it) => {
        if (it.id !== f.id && isFullyInside(worldRectOf(it), frameRect)) hidden.add(it.id);
      });
    });
    return hidden;
  }, [items]);

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

  const createFrameAt = (clientX: number, clientY: number, box?: { w: number; h: number }) => {
    const w = toWorld(clientX, clientY);
    const id = newId('fr');
    const next: CanvasFrameItem = box
      ? { kind: 'frame', id, x: w.x, y: w.y, w: Math.max(220, box.w), h: Math.max(120, box.h), title: '' }
      : { kind: 'frame', id, x: w.x - 160, y: w.y - 110, w: 320, h: 220, title: '' };
    /* En tête de tableau : un cadre créé au-dessus d'autres blocs ne doit pas les recouvrir */
    setItems((arr) => [next, ...arr]);
    selectOne(id);
    setTimeout(() => {
      const el = document.querySelector(`[data-item-id="${id}"] .frame-title`) as HTMLElement | null;
      el?.focus();
    }, 30);
  };

  /* Outil Cadre : clic = taille par défaut ; glisser = on dessine la zone */
  const beginFrameCreation = (clientX: number, clientY: number) => {
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
          createFrameAt(hr2.left + (x * zoomRef.current + panRef.current.x), hr2.top + (y * zoomRef.current + panRef.current.y), { w, h });
        }
      } else {
        createFrameAt(clientX, clientY);
      }
      setTool('select');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* Glisser un cadre déplace aussi les blocs qu'il englobe entièrement
     (calculé une fois au début du geste, pas en continu) */
  const startFrameDrag = (frameId: string, clientX0: number, clientY0: number) => {
    const all = itemsRef.current;
    const frame = all.find((it) => it.id === frameId);
    if (!frame) return;
    const frameRect = worldRectOf(frame);
    const groupIds = new Set(
      all.filter((it) => it.id !== frameId && isFullyInside(worldRectOf(it), frameRect)).map((it) => it.id),
    );
    groupIds.add(frameId);
    const origins = new Map(all.filter((it) => groupIds.has(it.id)).map((it) => [it.id, { x: it.x, y: it.y }]));
    const frameOrigin = origins.get(frameId)!;
    const others = all.filter((it) => !groupIds.has(it.id)).map(worldRectOf);
    let dragging = false;
    const onMove = (ev: MouseEvent) => {
      if (!dragging) {
        if (Math.abs(ev.clientX - clientX0) + Math.abs(ev.clientY - clientY0) < MARQUEE_THRESHOLD) return;
        dragging = true;
      }
      const rawX = frameOrigin.x + (ev.clientX - clientX0) / zoomRef.current;
      const rawY = frameOrigin.y + (ev.clientY - clientY0) / zoomRef.current;
      const snap = computeSnap({ x: rawX, y: rawY, w: frameRect.w, h: frameRect.h }, others, zoomRef.current);
      setSnapGuides(snap.guides);
      setSnapGaps(snap.gaps);
      const dx = snap.x - frameOrigin.x;
      const dy = snap.y - frameOrigin.y;
      setItems((arr) => arr.map((it) => {
        const o = origins.get(it.id);
        return o ? { ...it, x: o.x + dx, y: o.y + dy } : it;
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      endDrag();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const createShapeAt = (clientX: number, clientY: number, box?: { w: number; h: number }) => {
    const w = toWorld(clientX, clientY);
    const id = newId('sh');
    const next: CanvasShapeItem = box
      ? { kind: 'shape', id, x: w.x, y: w.y, w: Math.max(30, box.w), h: Math.max(30, box.h), shape: shapeKind, fill: shapeColor }
      : { kind: 'shape', id, x: w.x - 80, y: w.y - 50, w: 160, h: 100, shape: shapeKind, fill: shapeColor };
    setItems((arr) => [...arr, next]);
    selectOne(id);
  };

  /* Outil Formes : clic = taille par défaut ; glisser = on dessine la zone */
  const beginShapeCreation = (clientX: number, clientY: number) => {
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
          createShapeAt(hr2.left + (x * zoomRef.current + panRef.current.x), hr2.top + (y * zoomRef.current + panRef.current.y), { w, h });
        }
      } else {
        createShapeAt(clientX, clientY);
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

    /* Outil Cadre → clic = taille par défaut, glisser = dessine la zone */
    if (tool === 'frame') {
      beginFrameCreation(e.clientX, e.clientY);
      return;
    }

    /* Outil Formes → clic = taille par défaut, glisser = dessine la zone */
    if (tool === 'shape') {
      beginShapeCreation(e.clientX, e.clientY);
      return;
    }

    /* Relier : clic dans le vide annule le point de départ en cours */
    if (tool === 'link') {
      setLinkFrom(null);
      return;
    }

    /* Mode sélection : marquee (Maj = additif) */
    beginMarquee(e.clientX, e.clientY, e.shiftKey);
  };

  /* Clic droit sur un bloc → menu contextuel (dupliquer, premier/arrière-plan).
     Le bloc visé devient la sélection, sauf s'il fait déjà partie d'une
     sélection multiple (on garde alors le groupe entier). */
  const onCanvasContextMenu = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-item-id]') as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    const id = target.getAttribute('data-item-id')!;
    if (!(selectedIds.has(id) && selectedIds.size > 1)) selectOne(id);
    const host = hostRef.current;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    setContextMenu({ left: e.clientX - hr.left, top: e.clientY - hr.top });
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

  const updateItem = (id: string, patch: Partial<CanvasTextItem> | Partial<CanvasImageItem> | Partial<CanvasFrameItem> | Partial<CanvasShapeItem>) => {
    setItems((arr) => arr.map((it) => (it.id === id ? ({ ...it, ...patch } as CanvasItem) : it)));
  };

  const deleteItem = (id: string) => {
    setItems((arr) => arr.filter((it) => it.id !== id));
    setConnectors((arr) => arr.filter((c) => c.from !== id && c.to !== id));
    setSelectedIds((cur) => { if (!cur.has(id)) return cur; const n = new Set(cur); n.delete(id); return n; });
  };

  /* Crée une flèche entre deux blocs (clic sur un premier, puis un second, en mode Relier) */
  const pickForLink = (id: string) => {
    if (!linkFrom) { setLinkFrom(id); return; }
    if (linkFrom !== id) {
      setConnectors((arr) => [...arr, { id: newId('cn'), from: linkFrom, to: id }]);
      changeTool('select');
      return;
    }
    setLinkFrom(null);
  };

  const deleteConnector = (id: string) => {
    setConnectors((arr) => arr.filter((c) => c.id !== id));
  };

  const cursor =
    panning || spaceHeld ? 'grabbing'
    : tool === 'text' ? 'text'
    : tool === 'pen' || tool === 'eraser' || tool === 'link' || tool === 'frame' || tool === 'shape' ? 'crosshair'
    : 'default';

  return (
    <div
      ref={hostRef}
      className={`note-canvas tool-${tool}${spaceHeld ? ' space-held' : ''}`}
      style={{ cursor }}
      onMouseDown={onCanvasMouseDown}
      onContextMenu={onCanvasContextMenu}
      onWheel={onWheel}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div
        className={`canvas-world${jumping ? ' jump-anim' : ''}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        <DrawingLayer strokes={strokes} drafting={drafting} />
        <ConnectorLayer
          items={items}
          connectors={connectors}
          interactive={tool === 'select'}
          linkFrom={linkFrom}
          linkPreview={linkPreview}
          onDelete={deleteConnector}
        />
        <AlignmentGuides guides={snapGuides} gaps={snapGaps} zoom={zoom} />
        {items.map((it) => {
          if (hiddenByCollapse.has(it.id)) return null;
          if (it.kind === 'frame') {
            return (
              <FrameItem
                key={it.id}
                item={it}
                selected={isSelected(it.id)}
                zoom={zoom}
                onSelect={() => selectOne(it.id)}
                onChange={(patch) => updateItem(it.id, patch)}
                onDelete={() => deleteItem(it.id)}
                onDragStart={(cx, cy) => startFrameDrag(it.id, cx, cy)}
              />
            );
          }
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
                linking={tool === 'link'}
                isLinkSource={linkFrom === it.id}
                onLinkPick={() => pickForLink(it.id)}
                onNavigateToNote={onNavigateToNote}
                onDragTo={(x, y) => dragItemTo(it.id, x, y)}
                onDragEnd={endDrag}
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
                linking={tool === 'link'}
                isLinkSource={linkFrom === it.id}
                onLinkPick={() => pickForLink(it.id)}
                onDragTo={(x, y) => dragItemTo(it.id, x, y)}
                onDragEnd={endDrag}
              />
            );
          }
          if (it.kind === 'shape') {
            return (
              <ShapeItem
                key={it.id}
                item={it}
                selected={isSelected(it.id)}
                zoom={zoom}
                onSelect={() => selectOne(it.id)}
                onChange={(patch) => updateItem(it.id, patch)}
                onDelete={() => deleteItem(it.id)}
                onDragTo={(x, y) => dragItemTo(it.id, x, y)}
                onDragEnd={endDrag}
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

      {contextMenu && (
        <CanvasContextMenu
          left={contextMenu.left}
          top={contextMenu.top}
          onDuplicate={duplicateSelection}
          onBringToFront={() => bringToFront(selectedIds)}
          onSendToBack={() => sendToBack(selectedIds)}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div className="canvas-right-stack">
        <CanvasToc
          headings={headings}
          open={tocOpen}
          onToggle={() => setTocOpen((v) => !v)}
          onJump={jumpToItem}
        />
        <BacklinksPanel treeId={treeId} nodeId={nodeId} onNavigate={onNavigateToNote} />
        <PostitMenu
          open={postitOpen}
          onToggle={() => setPostitOpen((v) => !v)}
          onAdd={addPostit}
        />
        {soleSelectedText && (
          <PostitAdjustPanel
            key={soleSelectedText.id}
            item={soleSelectedText}
            onChange={(patch) => updateItem(soleSelectedText.id, patch)}
            onSetBg={(c) => setStickyBg(soleSelectedText.id, c)}
            onSetLink={(l) => setLink(soleSelectedText.id, l)}
            onSetPacer={(p) => setPacer(soleSelectedText.id, p)}
          />
        )}
      </div>

      <CanvasToolbar
        tool={tool}
        setTool={changeTool}
        zoom={zoom}
        onZoomReset={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        penColor={penColor}
        setPenColor={setPenColor}
        penWidth={penWidth}
        setPenWidth={setPenWidth}
        shapeKind={shapeKind}
        setShapeKind={setShapeKind}
        shapeColor={shapeColor}
        setShapeColor={setShapeColor}
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

function isEditingText(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}
