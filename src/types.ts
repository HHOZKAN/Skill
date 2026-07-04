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
  content: JSONContent;
};

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

export type CanvasItem = CanvasTextItem | CanvasImageItem;

export interface CanvasStroke {
  id: string;
  color: string;
  width: number;
  points: [number, number][];
}

export interface NoteCanvas {
  items: CanvasItem[];
  strokes: CanvasStroke[];
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
  | { view: 'note'; treeId: string; nodeId: string };
