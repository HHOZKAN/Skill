import { Node, mergeAttributes, ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import MentionChip from '../../components/canvas/MentionChip';
import MentionMenu, { type MentionMenuRef } from '../../components/MentionMenu';
import { useStore } from '../../store/useStore';
import { positionPopup } from './popupPosition';

/* Clé de plugin dédiée : voir slashCommand.ts pour l'explication (deux
   Suggestion sans clé explicite entrent en collision). */
const mentionPluginKey = new PluginKey('noteMention');

export interface MentionItem {
  treeId: string;
  nodeId: string;
  label: string;
  treeLabel: string;
}

export interface NoteMentionOptions {
  onNavigate: (treeId: string, nodeId: string) => void;
}

const MAX_RESULTS = 40;

function searchNodes(query: string): MentionItem[] {
  const q = query.trim().toLowerCase();
  const items: MentionItem[] = [];
  for (const tree of useStore.getState().trees) {
    const treeLabel = tree.name || 'Sans titre';
    for (const node of tree.nodes) {
      const label = node.name || 'Sans titre';
      if (q && !label.toLowerCase().includes(q) && !treeLabel.toLowerCase().includes(q)) continue;
      items.push({ treeId: tree.id, nodeId: node.id, label, treeLabel });
    }
  }
  return items.slice(0, MAX_RESULTS);
}

/* Mention inline vers une autre note de l'atlas — tapée avec "@", affichée
   comme une puce cliquable qui saute vers la note visée. */
export const NoteMention = Node.create<NoteMentionOptions>({
  name: 'noteMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { onNavigate: () => {} };
  },

  addAttributes() {
    return {
      treeId: { default: null },
      nodeId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-note-mention]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-note-mention': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionChip);
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<MentionItem>({
        editor: this.editor,
        pluginKey: mentionPluginKey,
        char: '@',
        allowSpaces: false,
        startOfLine: false,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: 'noteMention', attrs: { treeId: props.treeId, nodeId: props.nodeId } },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
        items: ({ query }) => searchNodes(query),
        render: () => {
          let component: ReactRenderer<MentionMenuRef> | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: (props: SuggestionProps<MentionItem>) => {
              component = new ReactRenderer(MentionMenu, { props, editor: props.editor });
              popup = document.createElement('div');
              popup.className = 'slash-popup';
              popup.appendChild(component.element);
              document.body.appendChild(popup);
              positionPopup(popup, props.clientRect);
            },
            onUpdate: (props: SuggestionProps<MentionItem>) => {
              component?.updateProps(props);
              if (popup) positionPopup(popup, props.clientRect);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') return false;
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              popup?.remove();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
