# Badminton Manager

Application React + Vite pour organiser un tournoi de badminton sur 4 terrains.

## Lancer en local

```bash
npm install
npm run dev
```

## Déployer sur GitHub Pages

1. Créer un dépôt GitHub et y déposer le contenu de ce dossier.
2. Dans le dépôt, ouvrir **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` publie automatiquement le site après chaque push sur `main`.
4. Ouvrir l'URL GitHub Pages affichée dans les paramètres Pages.

## Fonctionnalités

- 4 terrains et attribution automatique des rencontres prêtes à jouer.
- Équipes avec couleurs et poules tirées au sort.
- Un set en 15 points, 2 points d'écart, plafond à 21.
- Classements des poules par victoires, différence de points et points marqués.
- Tableau de classement intégral pour 2, 4, 8, 16, 32 ou 64 équipes.
- Sauvegarde locale automatique et export/import JSON.

## Limites de cette première version

- Le tableau intégral requiert un nombre d'équipes puissance de 2.
- Les couleurs sont réutilisées au-delà de 16 équipes.
- Le tableau final est généré automatiquement et n'est pas encore réorganisable manuellement.
- Le classement final est visible dans les rencontres de classement, mais pas encore sous forme d'une liste numérotée.
- Les données sont stockées localement dans le navigateur (pas de synchronisation multi-appareils).
