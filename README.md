# Constellations — atlas des savoirs

Application de prise de notes spatiale : un canvas libre où l'on cartographie
ses connaissances constellation par constellation (texte riche, post-its,
images, dessin, cadres, liens entre notes), avec un mode révision pour
parcourir les blocs marqués « Référence » ou « Evidence ».

Stack : **Vite · React 19 · TypeScript · Zustand · Tiptap**. Persistance
locale (localStorage) avec **synchronisation cloud optionnelle** via Supabase.

---

## Développement local

```bash
npm install
npm run dev        # http://localhost:5173
```

Sans configuration Supabase, l'app fonctionne **100 % en local** (localStorage),
sans compte ni synchronisation — idéal pour développer.

Scripts utiles :

| Commande            | Rôle                                    |
| ------------------- | --------------------------------------- |
| `npm run dev`       | serveur de dev (HMR)                    |
| `npm run build`     | build de production (`tsc -b` + Vite)   |
| `npm run typecheck` | vérification TypeScript seule           |
| `npm run lint`      | ESLint                                  |
| `npm run preview`   | prévisualise le build de production     |

---

## Base de données (Supabase)

La sauvegarde cloud + l'accès protégé par authentification s'activent en
renseignant deux variables d'environnement. Une seule mise en place :

1. Créez un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → exécutez le contenu de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   (table par utilisateur + politiques RLS + bucket d'images).
3. **Authentication → Providers** → activez **Email** (connexion par lien magique).
4. **Settings → API** → copiez l'URL du projet et la clé `anon public`.
5. Copiez `.env.example` en `.env.local` et renseignez :

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

Une fois configuré : chaque utilisateur se connecte par e-mail et ne voit que
**ses** données (isolation stricte via Row Level Security). Les images sont
uploadées dans un bucket dédié — seule leur URL est stockée en base.

> La clé `anon` est publique par conception : la sécurité repose entièrement
> sur les politiques RLS de la migration, pas sur le secret de la clé.

---

## Déploiement (Vercel)

1. Sur [vercel.com](https://vercel.com), importez le dépôt GitHub.
2. Le framework Vite est détecté automatiquement
   (build `npm run build`, dossier `dist` — voir [`vercel.json`](vercel.json)).
3. **Settings → Environment Variables** : ajoutez `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY`.
4. Dans Supabase, **Authentication → URL Configuration** : ajoutez l'URL de
   production Vercel aux *Redirect URLs* (pour les liens magiques).

Chaque push sur `main` redéploie la production ; chaque Pull Request obtient un
déploiement de prévisualisation.

---

## Workflow Git

Voir [`docs/WORKFLOW.md`](docs/WORKFLOW.md). En résumé :

- `main` = production (protégée, toujours déployable).
- Une branche par fonctionnalité : `feat/…`, `fix/…`, `chore/…`.
- On ouvre une **Pull Request** vers `main` ; le CI (lint · typecheck · build)
  doit passer avant fusion.
