# Workflow Git

## Branches

- **`main`** — la production. Toujours déployable (chaque push y déclenche un
  déploiement Vercel). On n'y committe jamais directement : tout passe par une
  Pull Request.
- **Branches de fonctionnalité** — une par sujet, créée depuis `main` :
  - `feat/<sujet>` — nouvelle fonctionnalité (`feat/export-pdf`)
  - `fix/<sujet>` — correction de bug (`fix/rotation-post-it`)
  - `chore/<sujet>` — outillage, dépendances, config (`chore/maj-tiptap`)
  - `docs/<sujet>` — documentation

## Cycle type

```bash
# 1. Partir d'un main à jour
git checkout main
git pull

# 2. Créer la branche de la fonctionnalité
git checkout -b feat/mon-sujet

# 3. Travailler, committer par petits pas
git add -A
git commit -m "feat: ajoute X"

# 4. Publier la branche et ouvrir la PR
git push -u origin feat/mon-sujet
gh pr create --base main --fill      # ou via l'interface GitHub

# 5. Une fois le CI vert et la PR relue → fusion (squash de préférence),
#    puis suppression de la branche.
```

## Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(portée optionnelle): résumé à l'impératif

Corps optionnel expliquant le pourquoi.
```

Types : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`.

## Intégration continue

Le workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) s'exécute
sur chaque Pull Request vers `main` et vérifie :

1. `npm run lint`
2. `npx tsc -b` (typecheck)
3. `npm run build`

Une PR ne devrait être fusionnée que si ces trois étapes passent.

## Protection de `main` (à activer sur GitHub, une fois)

**Settings → Branches → Add branch ruleset** sur `main` :

- Exiger une Pull Request avant fusion.
- Exiger que les checks de statut (le job CI) passent.
- Interdire les pushs directs.
