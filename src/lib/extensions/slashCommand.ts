import { Extension, ReactRenderer } from '@tiptap/react';
import type { Editor, Range } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import SlashMenu, { type SlashMenuRef } from '../../components/SlashMenu';
import { positionPopup } from './popupPosition';

/* Clé de plugin dédiée : sans ça, deux extensions basées sur @tiptap/suggestion
   (celle-ci et noteMention) retombent sur la même clé par défaut et
   ProseMirror refuse d'enregistrer le second plugin ("Adding different
   instances of a keyed plugin"). */
const slashPluginKey = new PluginKey('slashCommand');

export interface SlashItem {
  title: string;
  description: string;
  icon: string;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Texte', description: 'Paragraphe simple', icon: '¶',
    keywords: ['texte', 'paragraphe', 'text', 'p'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Titre', description: 'Grand titre de section', icon: 'H1',
    keywords: ['titre', 'h1', 'heading', 'grand'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Sous-titre', description: 'Titre de sous-section', icon: 'H2',
    keywords: ['sous-titre', 'soustitre', 'h2', 'heading'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Petit titre', description: 'Titre de niveau 3', icon: 'H3',
    keywords: ['petit titre', 'h3', 'heading'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Liste à puces', description: 'Énumération simple', icon: '•',
    keywords: ['liste', 'puces', 'bullet', 'ul'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Liste numérotée', description: 'Liste ordonnée 1. 2. 3.', icon: '1.',
    keywords: ['liste numérotée', 'numéroter', 'ordered', 'ol', 'numero'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Case à cocher', description: 'Todo, exercice à faire', icon: '☑',
    keywords: ['case', 'cocher', 'todo', 'task', 'checkbox'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Code', description: 'Bloc de code coloré', icon: '</>',
    keywords: ['code', 'snippet', 'bloc'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Callout', description: 'Point clé à retenir', icon: '💡',
    keywords: ['callout', 'info', 'note', 'important', 'cle'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setCallout('info').run(),
  },
  {
    title: 'Avertissement', description: 'Mise en garde, attention', icon: '⚠️',
    keywords: ['avertissement', 'attention', 'warn', 'danger', 'warning'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setCallout('warn').run(),
  },
  {
    title: 'Citation', description: 'Extrait, citation', icon: '"',
    keywords: ['citation', 'quote', 'blockquote'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Séparateur', description: 'Ligne horizontale', icon: '—',
    keywords: ['séparateur', 'separateur', 'divider', 'hr', 'ligne'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Lier à une compétence', description: 'Référencer une autre note de l’atlas', icon: '◆',
    keywords: ['lien', 'lier', 'compétence', 'référence', 'mention', 'atlas'],
    /* Insère "@" et rend la main : le déclencheur de mention (voir noteMention.ts)
       s'ouvre alors exactement comme si l'utilisateur l'avait tapé lui-même. */
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('@').run(),
  },
];

function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }) => filterItems(query),
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: (props: SuggestionProps<SlashItem>) => {
              component = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              popup = document.createElement('div');
              popup.className = 'slash-popup';
              popup.appendChild(component.element);
              document.body.appendChild(popup);
              positionPopup(popup, props.clientRect);
            },
            onUpdate: (props: SuggestionProps<SlashItem>) => {
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
