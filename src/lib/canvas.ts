import type { NoteCanvas, NoteData, CanvasItem } from '../types';
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
