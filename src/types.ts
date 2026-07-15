export type NodeState = 'todo' | 'doing' | 'done';

export interface ConstellationNode {
  id: string;
  name: string;
  x: number;
  y: number;
  state: NodeState;
}

export interface ConstellationLink {
  id: string;
  from: string;
  to: string;
}

import type { JSONContent } from '@tiptap/react';

export type CanvasTextItem = {
  kind: 'text';
  id: string;
  x: number;
  y: number;
  w: number;
  h?: number;
  bg?: string | null;
  rotate?: number;
  link?: string | null;
  pacer?: PacerCode | null;
  autoWidth?: boolean;
  autoHeight?: boolean;
  content: JSONContent;
};

/* Méthode PACER : nature de l'information, pour choisir le bon traitement */
export type PacerCode = 'P' | 'A' | 'C' | 'E' | 'R';

export type CanvasImageItem = {
  kind: 'image';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  alt?: string;
};

/* Cadre : regroupe visuellement les blocs qu'il englobe, qu'on peut déplacer
   ou replier ensemble — et, en option, réviser comme un seul sujet regroupant
   tout son contenu (plutôt que bloc par bloc) */
export type CanvasFrameItem = {
  kind: 'frame';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  collapsed?: boolean;
  reviewEnabled?: boolean;
};

/* Forme simple (rectangle, ellipse) pour du schéma rapide */
export type CanvasShapeItem = {
  kind: 'shape';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rect' | 'ellipse';
  fill: string;
};

export type CanvasItem = CanvasTextItem | CanvasImageItem | CanvasFrameItem | CanvasShapeItem;

export interface CanvasStroke {
  id: string;
  color: string;
  width: number;
  points: [number, number][];
}

/* Flèche reliant deux blocs du canvas (suit leurs déplacements) */
export interface CanvasConnector {
  id: string;
  from: string;
  to: string;
}

export interface NoteCanvas {
  items: CanvasItem[];
  strokes: CanvasStroke[];
  connectors?: CanvasConnector[];
  pan?: { x: number; y: number };
  zoom?: number;
}

export interface NoteData {
  canvas?: NoteCanvas;
  content?: JSONContent | null;
}

export interface Tree {
  id: string;
  name: string;
  createdAt: number;
  gx: number;
  gy: number;
  nodes: ConstellationNode[];
  links: ConstellationLink[];
  notes: Record<string, NoteData>;
}

export interface AppState {
  trees: Tree[];
}

export type Route =
  | { view: 'home' }
  | { view: 'tree'; treeId: string }
  | { view: 'note'; treeId: string; nodeId: string }
  | { view: 'review' };
