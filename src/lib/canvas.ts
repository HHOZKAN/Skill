import type { NoteCanvas, NoteData, CanvasItem, PacerCode } from '../types';
import type { JSONContent } from '@tiptap/react';

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function newId(prefix = 'it'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/* Légère bascule aléatoire pour le rendu "post-it" — figée à la création */
export function randomTilt(): number {
  return Math.round((Math.random() * 6 - 3) * 10) / 10;
}

export const STICKY_COLORS = [
  { color: '#fef9c3', title: 'Jaune' },
  { color: '#fce7f3', title: 'Rose' },
  { color: '#dbeafe', title: 'Bleu' },
  { color: '#dcfce7', title: 'Vert' },
  { color: '#fed7aa', title: 'Orange' },
];

/* Méthode PACER (Procédural / Analogue / Conceptuel / Evidence / Référence) :
   nature de l'info lue, et le traitement à lui appliquer pour bien la retenir. */
export const PACER_INFO: Record<PacerCode, { label: string; color: string; hint: string }> = {
  P: { label: 'Procédural', color: '#f59e0b', hint: 'Pratiquer dès que possible — sinon ne pas chercher à mémoriser' },
  A: { label: 'Analogue', color: '#a855f7', hint: 'Critiquer : en quoi c’est similaire / différent de ce que tu sais déjà' },
  C: { label: 'Conceptuel', color: '#2a6fdb', hint: 'Cartographier : relier ce concept aux autres, pas de notes linéaires' },
  E: { label: 'Evidence', color: '#16a34a', hint: 'Stocker maintenant, répéter plus tard en t’en servant pour argumenter' },
  R: { label: 'Référence', color: '#64748b', hint: 'Stocker et réviser en rappel actif espacé (flashcards)' },
};

/* Id de vidéo YouTube à partir d'une URL (watch, youtu.be, shorts, embed) — null si le lien n'est pas YouTube */
export function extractYouTubeId(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (host !== 'youtube.com') return null;
  if (u.pathname === '/watch') return u.searchParams.get('v');
  if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
  if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
  return null;
}

/* Nom de domaine lisible pour l'aperçu d'un lien générique */
export function getUrlDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export interface CanvasHeading {
  itemId: string;
  level: number;
  text: string;
  sortY: number;
}

/* Sommaire du canvas : parcourt tous les blocs texte, en extrait les titres,
   triés par position verticale du bloc (ordre de lecture approximatif) */
export function extractHeadings(items: CanvasItem[]): CanvasHeading[] {
  const out: CanvasHeading[] = [];
  for (const it of items) {
    if (it.kind !== 'text') continue;
    let order = 0;
    const walk = (node: JSONContent) => {
      if (node.type === 'heading') {
        const text = (node.content ?? []).map((c) => c.text ?? '').join('').trim();
        if (text) {
          out.push({ itemId: it.id, level: (node.attrs?.level as number) ?? 1, text, sortY: it.y + order * 0.01 });
          order += 1;
        }
      }
      node.content?.forEach(walk);
    };
    walk(it.content);
  }
  return out.sort((a, b) => a.sortY - b.sortY);
}

const MAX_IMAGE_WIDTH = 520;

export function fileToImageItem(
  file: File,
  position: { x: number; y: number },
): Promise<CanvasItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result as string;
      const probe = new window.Image();
      probe.onload = () => {
        const scale = probe.naturalWidth > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / probe.naturalWidth : 1;
        const w = Math.round(probe.naturalWidth * scale);
        const h = Math.round(probe.naturalHeight * scale);
        resolve({
          kind: 'image',
          id: newId('img'),
          x: position.x,
          y: position.y,
          w,
          h,
          src,
          alt: file.name,
        });
      };
      probe.onerror = () => reject(new Error('image-decode-failed'));
      probe.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function getOrMigrateCanvas(note: NoteData | undefined): NoteCanvas {
  if (note?.canvas) return note.canvas;
  const legacy = note?.content;
  if (legacy && typeof legacy === 'object') {
    return {
      items: [
        {
          kind: 'text',
          id: newId('mig'),
          x: 80,
          y: 80,
          w: 640,
          content: legacy,
        } as CanvasItem,
      ],
      strokes: [],
    };
  }
  return { items: [], strokes: [] };
}
