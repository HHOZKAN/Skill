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

export interface NoteStroke {
  id: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface NoteText {
  id: string;
  x: number;
  y: number;
  content: string;
  color: string;
}

export interface NoteData {
  texts: NoteText[];
  strokes: NoteStroke[];
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
