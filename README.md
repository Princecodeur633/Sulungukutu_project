# 🎓 sulungukutu — Plateforme de gestion scolaire

Plateforme numérique complète pour la gestion d'établissements scolaires en Afrique subsaharienne.
Développée par **Kassy Gloire Exaucé**.

---

## 🏗️ Architecture

```
sulungukutu/
├── apps/
│   ├── api/          # Backend GraphQL (Node.js + graphql-yoga + Drizzle ORM)
│   └── web/          # Frontend Next.js 14 (App Router + Apollo Client)
├── README.md
└── package.json      # Monorepo pnpm workspaces
```

---

## 👥 Rôles utilisateurs

| Rôle | Accès | Description |
|------|-------|-------------|
| `SUPER_ADMIN` | `/superadmin` | Gestion de toutes les écoles |
| `ADMIN` | `/admin` | Gestion complète d'un établissement |
| `TEACHER` | `/teacher` | Notes, présences, bulletins |
| `PARENT` | `/parent` | Suivi de ses enfants |
| `STUDENT` | `/student` | Consultation de ses résultats |

---

## 🚀 Installation rapide

### Prérequis

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)
- PostgreSQL local **ou** compte [Neon](https://neon.tech) (gratuit)

### 1. Cloner et installer

```bash
git clone <repo>
cd sulungukutu
pnpm install
```

### 2. Variables d'environnement

```bash
# Backend
cp apps/api/.env.example apps/api/.env
# Remplir DATABASE_URL avec votre connexion PostgreSQL

# Frontend
cp apps/web/.env.example apps/web/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
```

### 3. Initialiser la base de données

```bash
# Option A : push direct (développement)
pnpm db:push

# Option B : migrations (recommandé)
pnpm db:generate
pnpm db:migrate
```

### 4. Seeder les données de démonstration

```bash
pnpm db:seed
```

Ce seed crée :
- 1 Super Admin (`isSuperAdmin`) + 1 Admin + 4 Enseignants + 1 Parent + 6 Élèves
- Collège provisionné : 4 niveaux, 8 classes, matières du référentiel national
- Notes T1/T2, bulletins T1 publiés, présences 5 jours, emplois du temps
- 6 messages de conversation, 5 notifications, 3 annonces
- 9 mensualités par élève (T1 soldé, un acompte partiel pour Thomas)
- Couleur d'accent de l'établissement (`accentColor`)

### 5. Lancer le développement

```bash
pnpm dev
# API  → http://localhost:4000/graphql
# Web  → http://localhost:3000
```

---

## 🔑 Comptes de démonstration (après `db:seed`)

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Super Admin | superadmin@sulungukutu.com | SuperAdmin@2024! |
| Admin | admin@demo-school.edu | Admin@Demo2024! |
| Enseignant | teacher@demo-school.edu | Teacher@Demo2024! |
| Parent | parent@demo-school.edu | Parent@Demo2024! |
| Élève | student@demo-school.edu | Student@Demo2024! |

> En mode développement, les boutons de connexion rapide sont affichés sur la page login.

---

## 🔧 Commandes utiles

```bash
# Développement
pnpm dev                          # Lance API + Web en parallèle
pnpm --filter api dev             # API seule
pnpm --filter web dev             # Web seul

# Base de données
pnpm db:generate                  # Générer les migrations
pnpm db:migrate                   # Appliquer les migrations
pnpm db:push                      # Push direct (dev sans migration)
pnpm db:seed                      # Peupler avec les données de démo
pnpm db:studio                    # Drizzle Studio (interface BDD)

# Production
pnpm build                        # Build API + Web
pnpm --filter api start           # Démarrer API compilée
pnpm --filter api start:prod      # Démarrer avec migration auto
```

---

## 📋 Fonctionnalités

### Admin
- Dashboard avec KPIs temps réel (élèves, enseignants, paiements, présences)
- Onboarding guidé pour les nouvelles écoles
- Gestion des niveaux, classes, matières, emplois du temps
- Inscription et suivi des élèves (avec comptes parents automatiques)
- Invitation des enseignants par email
- Génération et publication des bulletins trimestriels
- Suivi des paiements de scolarité (mensualités)
- Messagerie interne + annonces ciblées
- Journal d'audit complet
- Exports Excel (élèves, notes, paiements)

### Enseignant
- Saisie des notes par matière et trimestre (devoir, contrôle, examen)
- Marquage des présences (avec statistiques)
- Consultation des bulletins
- Messagerie avec parents et administration

### Parent
- Suivi en temps réel des résultats et présences de ses enfants
- Consultation des bulletins publiés
- Suivi des paiements
- Messagerie avec l'école

### Élève
- Consultation de ses notes et bulletin
- Suivi de ses présences
- Messagerie interne

### Super Admin
- Vue consolidée de toutes les écoles
- Gestion des accès et statuts des membres
- Statistiques globales

---

## 🔐 Sécurité

- **Isolation multi-école** : chaque mutation vérifie que l'acteur appartient à l'école qu'il modifie (le `schoolId` du JWT n'est jamais pris tel quel depuis le client)
- **PDF / exports / imports** : authentification HTTP + contrôle d'accès (élève, parent, staff) ; cache `private, no-store`
- **Révocation de session** : après un changement de mot de passe, les JWT déjà émis sont invalidés (`passwordChangedAt` vs `iat`)
- **Reset mot de passe** : lien signé valable 1 h (`/auth/reset-password?token=`) ; reset admin en présentiel pour les comptes sans email
- **Rate limiting** : 120 req/min par IP en production, 10 tentatives de login / 5 min (en mémoire — pas partagé entre instances)
- **Middleware Next.js** : validation JWT + contrôle de rôle (y compris `SUPER_ADMIN` sur `/admin`)
- **Tokens** : access token 7 j + refresh token 30 j ; le frontend renouvelle automatiquement en cas d'`UNAUTHENTICATED`. Stockage localStorage + cookie `SameSite=Strict` (`Secure` en HTTPS)

---

## 🏛️ Stack technique

| Couche | Technologie |
|--------|-------------|
| Runtime | Node.js 20 |
| API | graphql-yoga 5, GraphQL |
| ORM | Drizzle ORM (PostgreSQL) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Frontend | Next.js 14 (App Router) |
| UI | Tailwind CSS 3 |
| Client GQL | Apollo Client 3 |
| Exports | ExcelJS (.xlsx) |
| Emails | Nodemailer (Resend/Gmail) |
| Cron jobs | node-cron (rappels paiements) |
| Déploiement | Railway (API) + Vercel (Web) |

---

## 🌐 Déploiement production

### Base de données — Neon (recommandé, gratuit)

1. Créer un projet sur [neon.tech](https://neon.tech)
2. Copier la `DATABASE_URL` (format `postgresql://...neon.tech/...?sslmode=require`)

### Backend — Railway

1. Créer un projet sur [railway.app](https://railway.app)
2. Connecter le repo GitHub, choisir **Root Directory** : `apps/api`
3. Railway détecte `railway.json` automatiquement
4. Ajouter les variables d'environnement :

```
DATABASE_URL=postgresql://...neon.tech/...?sslmode=require
JWT_SECRET=<openssl rand -hex 64>
REFRESH_TOKEN_SECRET=<openssl rand -hex 64>
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-app.vercel.app
SUPER_ADMIN_EMAIL=superadmin@votredomaine.com
SUPER_ADMIN_PASSWORD=MotDePasseForte@2025!

# Email (Resend recommandé)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx
SMTP_FROM="sulungukutu <noreply@votredomaine.com>"
```

5. Au premier déploiement, lancer en **one-off job** :
   ```bash
   npm run db:seed
   ```

### Frontend — Vercel

1. Importer le repo sur [vercel.com](https://vercel.com)
2. **Root Directory** : `apps/web`
3. **Framework** : Next.js (auto-détecté)
4. Variables d'environnement :

```
NEXT_PUBLIC_API_URL=https://your-api.railway.app/graphql
NEXT_PUBLIC_WS_URL=wss://your-api.railway.app/graphql
```

5. Déployer

> ⚠️ Les WebSockets (subscriptions temps réel) nécessitent Railway Pro ou Render.
> En plan gratuit, le polling Apollo remplace les subscriptions automatiquement.

---

## 📁 Structure des fichiers clés

```
apps/api/src/
├── db/
│   ├── schema.ts          # Schéma Drizzle (toutes les tables)
│   ├── seed.ts            # Données de démonstration
│   └── index.ts           # Connexion DB (Neon ou PostgreSQL local)
├── middleware/
│   ├── auth.ts            # Contexte GraphQL + JWT
│   ├── permissions.ts     # requireAdmin, requireSchoolMember...
│   └── rate-limit.ts      # Rate limiting en mémoire
├── resolvers/             # Un dossier par domaine métier
├── schema/
│   └── appsync-schema.gql # Schéma GraphQL (55 queries, 59 mutations)
└── services/
    ├── bulletin.service.ts # Calcul des moyennes
    ├── export.service.ts   # Génération Excel
    ├── email.service.ts    # Templates + envoi SMTP
    └── payment.service.ts  # Logique paiements/bulletins

apps/web/src/
├── app/                   # Pages Next.js (App Router)
│   ├── admin/             # 16 pages administrateur
│   ├── teacher/           # 6 pages enseignant
│   ├── parent/            # 5 pages parent
│   ├── student/           # 7 pages élève
│   ├── superadmin/        # 4 pages super admin
│   └── auth/              # 3 pages authentification
├── components/
│   ├── ui/                # Toast, ConfirmModal, OnboardingBanner...
│   ├── notifications/     # NotificationBell, NotificationList
│   └── layout/            # Sidebars, MobileSidebarWrapper
├── hooks/                 # useActionToast, useApolloErrors
└── lib/
    ├── apollo/            # Client Apollo + tokenStorage
    └── graphql/           # Queries, mutations, subscriptions
```

