# Collection Bruno — num express API

Teste les endpoints de num express avec **[Bruno](https://www.usebruno.com)**,
l'alternative open-source à Postman. Les requêtes sont **versionnées** dans ce
dossier (fichiers `.bru`), donc toute l'équipe partage les mêmes tests.

## Ouvrir la collection
1. Installe l'appli Bruno (`winget install Bruno.Bruno`).
2. Dans Bruno : **Open Collection** → choisis ce dossier `bruno/`.
3. En haut à droite, sélectionne l'environnement : **Production** ou **Local**.

## Variables (onglet Environnements)
- `baseUrl` — déjà renseigné (prod = `num-express.com`, local = `localhost:3000`).
- `cronSecret` — la valeur de `CRON_SECRET` (`.env` / Vercel), pour les requêtes **Cron**.
- `authCookie` — ton cookie de session, pour les requêtes **Connexion-requise**.
  (Connecte-toi sur le site → F12 → Application → Cookies → copie `nom=valeur`.)

`cronSecret` et `authCookie` sont marqués **secret** : leurs valeurs ne sont
**pas** committées dans Git.

## Dossiers
| Dossier | Contenu | Attendu |
|---|---|---|
| **Sante** | Pages publiques (accueil, inscription, connexion, conditions) | `200` |
| **Webhooks** | Un `GET` sur un webhook de paiement | `405` (POST signé uniquement) |
| **Connexion-requise** | Prix, pays, recharges en attente | `200` avec `authCookie`, sinon `401` |
| **Cron** | Balayages manuels (réconciliation, expiration) | `200` avec `cronSecret`, sinon `401` |

## Lancer tous les tests d'un coup
Dans Bruno : clic droit sur la collection → **Run** (ou installe le CLI
`npm i -g @usebruno/cli` puis `bru run --env Production`).
