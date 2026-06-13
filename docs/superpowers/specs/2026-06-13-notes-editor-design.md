# Notes Editor — Design Spec
**Date:** 2026-06-13  
**Statut:** Approuvé

## Contexte

La page de notes actuelle (`NotesPage.tsx`) offre un canvas infini avec dessin SVG à main levée et textes flottants via `contentEditable`. L'objectif est de la remplacer par un éditeur de texte riche par blocs, fluide et structuré, intégré dans le thème spatial de l'application.

## Décisions de design

| Sujet | Décision |
|---|---|
| Paradigme | Éditeur par blocs (style Notion) |
| Interaction principale | Menu slash `/` pour insérer des blocs |
| Thème éditeur | Fond **blanc** — header sombre (cohérent avec le reste de l'app) |
| Bibliothèque | **Tiptap** (React + ProseMirror) |
| Canvas de dessin | Supprimé — remplacé par le bloc Image |

## Interface

### Layout
- **Header** sombre (#0d1117) : bouton retour ←, nom de la compétence, badge d'état (todo/doing/done), bouton annuler ⌘Z
- **Zone d'édition** : fond blanc, largeur max 680px centrée, padding généreux (40px vertical, 56px horizontal)
- **Footer** : fond #fafafa, hint discret (`/` pour insérer · `⌘Z` annuler · `Échap` retour)

### Interactions
- **Menu slash** : taper `/` ouvre un menu flottant blanc avec liste des blocs, navigable au clavier (↑↓ + Entrée), filtrable par texte après `/`
- **Bubble menu** : apparaît lors d'une sélection de texte — gras, italique, souligné, code inline, changement de type de bloc (H1/H2)
- **Raccourci retour** : `Échap` → retour à la vue constellation

## Blocs supportés

| Bloc | Déclencheur slash | Description |
|---|---|---|
| Texte | `/texte` | Paragraphe standard |
| Titre H1 | `/titre` | Grand titre de section |
| Titre H2 | `/sous-titre` | Sous-section |
| Titre H3 | `/h3` | Sous-sous-section |
| Liste à puces | `/liste` | Bullet list |
| Liste numérotée | `/numéroter` | Ordered list |
| Case à cocher | `/todo` | Checkbox — cliquable en lecture |
| Bloc de code | `/code` | Fond gris clair, monospace, coloration syntaxique basique |
| Callout info | `/callout` | Fond bleu clair, bordure bleue — point clé |
| Callout avertissement | `/attention` | Fond jaune, bordure orange |
| Citation | `/citation` | Bordure gauche grise, italique |
| Séparateur | `/séparateur` | Ligne horizontale |
| Image | `/image` | Upload ou glisser-déposer — stocké en base64 dans le JSON Tiptap (pas de serveur requis) |

## Architecture technique

### Packages à installer
```
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/extension-image
@tiptap/extension-placeholder
@tiptap/extension-underline
@tiptap/extension-code-block-lowlight
lowlight
```

> `@tiptap/extension-code-block-lowlight` remplace `CodeBlock` du starter-kit et ajoute la coloration syntaxique via `lowlight` (basé sur highlight.js, ~20KB gzip).

### Fichiers modifiés / créés

| Fichier | Action | Description |
|---|---|---|
| `src/types.ts` | Modifié | `NoteData` : `{ content: JSONContent }` au lieu de `{ texts, strokes }` |
| `src/components/NotesPage.tsx` | Réécrit | Nouveau éditeur Tiptap |
| `src/components/SlashMenu.tsx` | Créé | Composant menu slash (via `@tiptap/suggestion`) |
| `src/components/BubbleMenuBar.tsx` | Créé | Barre de formatage contextuelle |
| `src/styles.css` | Modifié | Styles de l'éditeur (blocs, menu slash, bubble menu) |

### Modèle de données

```typescript
// Avant
interface NoteData {
  texts: NoteText[];
  strokes: NoteStroke[];
}

// Après
interface NoteData {
  content: JSONContent; // format natif Tiptap
}
```

La migration est silencieuse : les anciennes notes avec `texts/strokes` produisent un éditeur vide (les données sont perdues, ce qui est acceptable vu le stade du projet).

### Extension Callout (custom)

Tiptap ne fournit pas de bloc Callout natif. À implémenter comme un nœud custom (`Node.create`) wrappant un paragraphe avec un attribut `type` (info | warn). Rendu via un `<div class="callout callout-info">`.

## Styles clés (fond blanc)

```css
/* Éditeur */
.tiptap-editor { background: #fff; color: #374151; font-size: 14.5px; line-height: 1.8; }

/* Blocs */
h1 { font-size: 26px; font-weight: 700; color: #111827; }
h2 { font-size: 18px; font-weight: 600; color: #1f2937; }
pre  { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
code { background: #f3f4f6; color: #059669; border: 1px solid #e5e7eb; }

/* Callout */
.callout-info { background: #eff6ff; border-left: 3px solid #2a6fdb; color: #1e3a5f; }
.callout-warn { background: #fffbeb; border-left: 3px solid #f59e0b; color: #92400e; }

/* Slash menu */
.slash-menu { background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }

/* Bubble menu */
.bubble-menu { background: #1f2937; border-radius: 8px; }
```

## Ce qui est supprimé

- Canvas SVG de dessin (strokes)
- Textes flottants positionnés manuellement
- Tool rail (pan / text / pen / eraser / gomme)
- Palette de couleurs de crayon
- Undo stack custom → remplacé par l'historique natif Tiptap
