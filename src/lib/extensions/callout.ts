import { Node, mergeAttributes } from '@tiptap/react';

export type CalloutVariant = 'info' | 'warn';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (variant?: CalloutVariant) => ReturnType;
      toggleCallout: (variant?: CalloutVariant) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info' as CalloutVariant,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-variant') || 'info',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout' }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (variant = 'info') =>
        ({ commands }) =>
          commands.setNode(this.name, { variant }),
      toggleCallout:
        (variant = 'info') =>
        ({ commands }) =>
          commands.toggleNode(this.name, 'paragraph', { variant }),
    };
  },
});
