import { uid } from './uid';
import type { Tree } from '../types';

export function seedTrees(): Tree[] {
  const devNodes = [
    { id: 'n_fond',  name: 'Fondamentaux',    x: 600, y: 540, state: 'done'  as const },
    { id: 'n_html',  name: 'HTML & CSS',       x: 416, y: 372, state: 'done'  as const },
    { id: 'n_js',    name: 'JavaScript',       x: 712, y: 348, state: 'doing' as const },
    { id: 'n_acc',   name: 'Accessibilité',    x: 286, y: 214, state: 'todo'  as const },
    { id: 'n_react', name: 'React',            x: 868, y: 196, state: 'todo'  as const },
    { id: 'n_back',  name: 'Back-end',         x: 560, y: 168, state: 'doing' as const },
    { id: 'n_db',    name: 'Bases de données', x: 432, y: 60,  state: 'todo'  as const },
  ];
  const devLinks = [
    { id: 'l1', from: 'n_fond', to: 'n_html' },
    { id: 'l2', from: 'n_fond', to: 'n_js'   },
    { id: 'l3', from: 'n_html', to: 'n_acc'  },
    { id: 'l4', from: 'n_js',   to: 'n_react'},
    { id: 'l5', from: 'n_js',   to: 'n_back' },
    { id: 'l6', from: 'n_back', to: 'n_db'   },
  ];

  const musicNodes = [
    { id: 'm_solf', name: 'Solfège',       x: 560, y: 470, state: 'doing' as const },
    { id: 'm_rhy',  name: 'Rythme',        x: 388, y: 332, state: 'done'  as const },
    { id: 'm_har',  name: 'Harmonie',      x: 736, y: 312, state: 'todo'  as const },
    { id: 'm_pno',  name: 'Piano',         x: 540, y: 250, state: 'doing' as const },
    { id: 'm_imp',  name: 'Improvisation', x: 760, y: 150, state: 'todo'  as const },
  ];
  const musicLinks = [
    { id: 'ml1', from: 'm_solf', to: 'm_rhy' },
    { id: 'ml2', from: 'm_solf', to: 'm_har' },
    { id: 'ml3', from: 'm_solf', to: 'm_pno' },
    { id: 'ml4', from: 'm_har',  to: 'm_imp' },
  ];

  return [
    { id: uid('tree'), name: 'Développeur', createdAt: Date.now() - 86400000 * 12, gx: -340, gy: -40,  nodes: devNodes,   links: devLinks,   notes: {} },
    { id: uid('tree'), name: 'Musique',     createdAt: Date.now() - 86400000 * 4,  gx: 360,  gy: 120, nodes: musicNodes, links: musicLinks, notes: {} },
  ];
}
