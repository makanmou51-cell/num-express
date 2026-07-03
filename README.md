# num express

SaaS de **numéros virtuels** pour recevoir des **codes SMS de vérification**
(WhatsApp, Telegram, Instagram, etc.). Les numéros sont approvisionnés via
l'API **Grizzly SMS** ; les utilisateurs paient en **Mobile Money / carte** via
**FedaPay** et dépensent un **solde en F CFA**.

## Stack

- **Next.js 16** (App Router, Server Actions) + **React 19** + **Tailwind v4**
- **Prisma 7** (SQLite en dev, PostgreSQL en prod)
- Auth maison : mots de passe **bcrypt**, sessions **JWT** (jose) en cookie httpOnly
- Paiement abstrait (`PaymentProvider`) — implémentation **FedaPay**, secours **manuel**

## Architecture

```
src/
  app/
    (auth)/            login, register + actions
    (app)/             espace connecté : dashboard, buy, numbers, wallet
    api/
      activations/[id]/status   polling du code SMS
      payments/fedapay/webhook  confirmation des recharges
  lib/
    grizzly/           client API Grizzly + catalogue (prix + marge)
    payments/          abstraction de paiement (fedapay, manual)
    activations.ts     achat / remboursement / suivi
    wallet.ts          grand-livre transactionnel (solde atomique)
    auth/              hash, sessions, getCurrentUser
    pricing.ts         conversion devise -> F CFA + marge
prisma/schema.prisma   User, Activation, Transaction
```

## Démarrage

1. **Dépendances** (déjà installées) :
   ```bash
   npm install
   ```

2. **Variables d'environnement** : copier `.env.example` en `.env` puis remplir.
   Un `.env` de dev est déjà fourni (provider de paiement `manual`).
   - `AUTH_SECRET` : générer avec
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `GRIZZLY_API_KEY` : votre clé depuis le compte Grizzly (requise pour le
     catalogue et les achats réels).

3. **Base de données** :
   ```bash
   npx prisma migrate dev
   ```

4. **Lancer** :
   ```bash
   npm run dev
   ```
   → http://localhost:3000

## Modèle de prix

Prix public = `coût_Grizzly × FX_TO_XOF × MARGIN_MULTIPLIER + MARGIN_FLAT_XOF`,
arrondi au multiple supérieur (`PRICE_ROUND_XOF`), borné par `MIN_PRICE_XOF`.
Tout est paramétrable dans `.env` (voir `src/lib/pricing.ts`).

## Flux d'achat

1. L'utilisateur choisit un service puis un pays (`/buy/[service]`).
2. `purchaseNumber` revalide l'offre, vérifie le solde, achète le numéro chez
   Grizzly (`getNumber`), débite le wallet et crée l'activation (atomique).
3. La page `/numbers/[id]` interroge `/api/activations/[id]/status` toutes les
   5 s ; dès que le SMS arrive, le code s'affiche.
4. En cas d'annulation/expiration sans code, l'utilisateur est **remboursé**.

## Paiement (recharge)

- `manual` (dev) : redirige vers `/wallet/simulate` pour confirmer sans
  encaissement réel.
- `fedapay` : crée une transaction + lien de paiement, confirme via le webhook
  `transaction.approved` (`/api/payments/fedapay/webhook`). Configurez l'URL du
  webhook dans le dashboard FedaPay et renseignez `FEDAPAY_WEBHOOK_SECRET`.

## Parrainage (affiliation)

- Chaque utilisateur a un `referralCode` et un lien `…/register?ref=CODE`.
- Un filleul inscrit via ce lien est rattaché au parrain (`referredById`).
- À chaque **achat** d'un filleul, le parrain reçoit une commission
  (`AFFILIATE_COMMISSION_RATE`, % éditable en admin) créditée sur son solde.
- Page `/affiliate` : lien, nombre de filleuls, commissions gagnées.

## E-mail (vérification & réinitialisation)

- Inscription → e-mail de vérification (`/verify?token=…`). Bannière + bouton
  « renvoyer » sur le tableau de bord.
- `/forgot` → e-mail de réinitialisation (`/reset?token=…`, valable 1 h).
- Mailer configurable : `MAIL_PROVIDER=log` (journalise le lien en dev) ou
  `resend` (envoi réel, `RESEND_API_KEY`).
- Achat conditionné à un e-mail vérifié si `REQUIRE_EMAIL_VERIFICATION=1`.

## Back-office admin (`/admin`)

- Accès réservé au rôle `ADMIN`. **Bootstrap** : mettez votre e-mail dans
  `ADMIN_EMAILS` → vous êtes promu admin à la connexion (portable Postgres).
- Vue d'ensemble (utilisateurs, ventes, recharges, passif, commissions),
  liste/recherche d'utilisateurs, **recharge/ajustement manuel** de solde,
  promotion de rôle, et **réglages** de marge/commission stockés en base
  (table `Setting`, surcharge le `.env`, effet immédiat).

## Cron — remboursement des activations expirées

Route protégée `GET/POST /api/cron/expire-activations` (en-tête
`x-cron-secret` ou `?secret=`, valeur `CRON_SECRET`). Elle annule chez Grizzly
et rembourse les activations restées sans code au-delà du délai.
À planifier toutes les ~5 min, par ex. avec **Vercel Cron** :

```json
// vercel.json
{ "crons": [{ "path": "/api/cron/expire-activations?secret=VOTRE_SECRET", "schedule": "*/5 * * * *" }] }
```

## Passage en production

- Basculer `datasource db` sur `postgresql` dans `prisma/schema.prisma`, mettre
  à jour `DATABASE_URL`, relancer `prisma migrate deploy`.
- Définir `PAYMENT_PROVIDER=fedapay`, `FEDAPAY_ENVIRONMENT=live` et les clés.
- Définir `APP_URL` sur le domaine public (callbacks + webhook).
- Régler la marge (`MARGIN_*`, `FX_TO_XOF`) selon votre marché.

> ⚠️ L'usage de numéros virtuels peut enfreindre les CGU de certains services
> (ex. WhatsApp) et entraîner des bannissements. À encadrer dans vos CGU.
