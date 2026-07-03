# Déploiement de num express sur Vercel

## 0. Prérequis (comptes gratuits)
- [Neon](https://neon.tech) — base PostgreSQL
- [Upstash](https://upstash.com) — Redis (anti-brute-force)
- [Vercel](https://vercel.com) — hébergement
- Un dépôt Git (GitHub recommandé) OU la CLI `vercel`

---

## 1. Base de données Neon
1. Crée un projet sur neon.tech.
2. Copie la **chaîne de connexion "pooled"** (l'hôte contient `-pooler`), avec `?sslmode=require`.
3. Renseigne-la dans ton `.env` local :
   ```
   DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require"
   ```
4. Génère la migration PostgreSQL et applique-la :
   ```bash
   npx prisma migrate dev --name init
   ```
   (à faire une seule fois ; commite le dossier `prisma/migrations` créé.)

## 2. Anti-brute-force Upstash
1. Crée une base Redis sur upstash.com.
2. Copie l'URL REST et le token, dans `.env` :
   ```
   UPSTASH_REDIS_REST_URL="https://...upstash.io"
   UPSTASH_REDIS_REST_TOKEN="..."
   ```
   (Sans ces clés, le rate limiting est simplement désactivé.)

## 3. Secret d'application
Génère un `AUTH_SECRET` fort :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Pousser le code
```bash
git init
git add .
git commit -m "num express"
# crée un repo GitHub puis :
git remote add origin https://github.com/<toi>/num-express.git
git push -u origin main
```
> `.env` est gitignoré : les secrets ne sont PAS poussés (normal). On les met dans Vercel.

## 5. Importer dans Vercel
1. vercel.com → **Add New → Project** → importe le repo GitHub.
2. Framework détecté : **Next.js**. Laisse le reste par défaut (le `vercel.json`
   fournit déjà `buildCommand` avec `prisma migrate deploy`).
3. **Environment Variables** — ajoute (Production) :

| Variable | Valeur |
|---|---|
| `APP_URL` | `https://<ton-projet>.vercel.app` |
| `AUTH_SECRET` | (le secret généré) |
| `DATABASE_URL` | (Neon pooled) |
| `UPSTASH_REDIS_REST_URL` | (Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | (Upstash) |
| `CRON_SECRET` | (une chaîne aléatoire) |
| `ADMIN_EMAILS` | ton e-mail admin |
| `GRIZZLY_API_KEY` | ta clé Grizzly |
| `GRIZZLY_CURRENCY` | `USD` |
| `PAYMENT_PROVIDER` | `leekpay` |
| `LEEKPAY_SECRET_KEY` | `sk_live_...` |
| `LEEKPAY_PUBLIC_KEY` | `pk_live_...` |
| `LEEKPAY_WEBHOOK_SECRET` | (secret webhook du dashboard LeekPay, si dispo) |
| `LEEKPAY_BASE_URL` | `https://leekpay.fr` |
| `MAIL_PROVIDER` | `resend` (recommandé en prod) |
| `RESEND_API_KEY` | (clé Resend) |
| `MAIL_FROM` | `num express <no-reply@ton-domaine>` |
| `REQUIRE_EMAIL_VERIFICATION` | `true` (recommandé) |
| Tarifs (optionnel) | `FX_TO_XOF`, `TIER1_*`, `TIER2_*`, `TIER3_PROFIT_XOF`, `AFFILIATE_COMMISSION_RATE` |

4. **Deploy**.

## 6. Après le premier déploiement
1. **APP_URL** : une fois l'URL `.vercel.app` connue, mets-la dans `APP_URL` puis
   redeploie (nécessaire pour les callbacks/webhook LeekPay corrects).
2. **Webhook LeekPay** : dans le Dashboard LeekPay → API Keys, configure l'URL
   `https://<projet>.vercel.app/api/payments/leekpay/webhook` et, si un secret
   webhook est proposé, mets-le dans `LEEKPAY_WEBHOOK_SECRET`.
3. **Cron** : Vercel lit `vercel.json` et appelle
   `/api/cron/expire-activations` toutes les 5 min avec l'en-tête
   `Authorization: Bearer $CRON_SECRET` (automatique). Rien à faire de plus.
4. **Compte admin** : inscris-toi avec l'e-mail de `ADMIN_EMAILS`, ouvre le lien
   de vérification reçu par e-mail → tu deviens automatiquement admin.

## Notes de sécurité (déjà en place)
- En-têtes HSTS / X-Frame-Options / nosniff / Referrer-Policy / Permissions-Policy.
- Rate limiting login / reset / recharge / achat (Upstash).
- Webhooks : le crédit ne se fait qu'après **re-vérification autoritative** du
  statut ET du montant via l'API du prestataire (payload webhook non fiable).
- Solde : mutations **atomiques** (pas de course), débit conditionnel.
- Admin : rôle jamais dérivé d'un e-mail non vérifié.
- Sessions invalidées à la réinitialisation de mot de passe.
- Provider « manual » (crédit simulé) **impossible en production**.

## Passer à un domaine perso (plus tard)
Vercel → Project → Settings → Domains → ajoute ton domaine, mets à jour `APP_URL`
et l'URL du webhook LeekPay en conséquence.
