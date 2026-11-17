# Documentation de Compréhension du Projet E-audit

**Date de création**: 17 novembre 2026  
**Version du projet**: E-audit v1.8.25  
**Version de la base de données**: v17

---

## 📚 Vue d'ensemble

Ce dossier contient une documentation complète répondant aux questions fondamentales sur l'architecture, le système de sauvegarde et l'isolation des données dans E-audit (anciennement AIONUI).

---

## 📑 Documents Disponibles

### [01 - Structure de la Base de Données SQLite](./01_STRUCTURE_DATABASE_SQLITE.md)

**Contenu** :
- Vue d'ensemble de la base de données SQLite
- Structure détaillée des 4 tables principales :
  - `users` - Comptes utilisateurs
  - `conversations` - Sessions de chat
  - `messages` - Messages individuels
  - `audit_log` - Logs d'audit (v17+)
- Relations entre les tables (Foreign Keys CASCADE)
- Index de performance
- Opérations CRUD de base
- Optimisations (WAL mode, Foreign Keys)

**Questions répondues** :
- ✅ Quelles sont les tables dans la database SQLite ?
- ✅ Quelle est leur structure exacte ?
- ✅ Comment les données sont-elles reliées ?

---

### [02 - Système de Sauvegarde des Tables](./02_SYSTEME_SAUVEGARDE_TABLES.md)

**Contenu** :
- Types de tables gérées :
  - Tables générées par n8n (workflows)
  - Tables modifiées via menu contextuel
- Flux complet de sauvegarde :
  - N8N : JSON → Markdown → SQLite
  - Menu contextuel : HTML → Markdown → SQLite
- Traversée du Shadow DOM
- Conversion HTML ↔ Markdown
- Optimisations (debouncing, batch, cache)

**Questions répondues** :
- ✅ Comment fonctionne le système de sauvegarde des tables générées en front end depuis n8n ?
- ✅ Comment fonctionnent les CRUD operations sur les cellules et les lignes via le menu contextuel ?
- ✅ Comment les modifications sont-elles persistées ?

---

### [03 - Isolation des Données entre Utilisateurs](./03_ISOLATION_DONNEES_UTILISATEURS.md)

**Contenu** :
- Système d'identifiants :
  - User ID (UID) : `user_<timestamp>`
  - Session ID : `conv_<timestamp>_<random>`
  - Message ID : `msg_<timestamp>_<random>`
- Mécanismes d'isolation :
  - Filtrage systématique par `user_id`
  - Foreign Keys CASCADE
  - Authentification JWT
  - Middleware de vérification
- Audit Trail (v17+)
- Gestion des rôles et statuts

**Questions répondues** :
- ✅ Comment les données entre utilisateurs sont-elles isolées ?
- ✅ Chaque utilisateur a-t-il un UID unique ?
- ✅ Comment fonctionnent les sessions (Session ID) ?
- ✅ Comment les messages sont-ils identifiés (Message ID) ?

---

### [04 - Structure des Messages et Format JSON](./04_STRUCTURE_MESSAGES_JSON.md)

**Contenu** :
- Format du champ `content` (JSON sérialisé)
- Types de contenu supportés :
  - Texte simple
  - Tableaux Markdown
  - Fichiers/Pièces jointes
  - Images (URL ou base64)
  - Messages système
  - Données N8N
- Sérialisation/Désérialisation
- Gestion des tableaux modifiés
- Exemples réels de stockage

**Questions répondues** :
- ✅ Quelle est la structure des messages dans la database SQLite ?
- ✅ Les tableaux d'un message sont-ils sauvegardés en JSON dans la même cellule ?
- ✅ Comment le contenu complexe (tableaux, fichiers) est-il stocké ?

---

## 🎯 Réponses aux Questions Principales

### Question 1 : Tables de la Database SQLite

**Réponse** : 4 tables principales

| Table | Rôle | Champs clés |
|-------|------|-------------|
| `users` | Comptes utilisateurs | `id`, `username`, `email`, `password_hash`, `role`, `status` |
| `conversations` | Sessions de chat | `id`, `user_id`, `name`, `type`, `extra` (JSON) |
| `messages` | Messages individuels | `id`, `conversation_id`, `content` (JSON), `position`, `status` |
| `audit_log` | Logs d'audit (v17+) | `id`, `user_id`, `target_user_id`, `action`, `details` (JSON) |

**Voir détails** : [01_STRUCTURE_DATABASE_SQLITE.md](./01_STRUCTURE_DATABASE_SQLITE.md)

---

### Question 2 : Système de Sauvegarde des Tables

**Réponse** : Deux flux distincts

#### A. Tables N8N (Automatique)
```
Workflow N8N (JSON)
    ↓
Parser automatique (détection array)
    ↓
Conversion JSON → Markdown
    ↓
Message créé avec content = Markdown
    ↓
Sauvegarde dans SQLite via addMessage()
```

#### B. Tables Menu Contextuel (Manuelle)
```
Utilisateur modifie tableau (clic droit)
    ↓
syncTable() détecté (blur/action)
    ↓
Traverse Shadow DOM → trouve data-message-id
    ↓
Conversion HTML → Markdown
    ↓
IPC: database.updateMessageContent
    ↓
Mise à jour SQLite (UPDATE messages SET content = ...)
```

**Voir détails** : [02_SYSTEME_SAUVEGARDE_TABLES.md](./02_SYSTEME_SAUVEGARDE_TABLES.md)

---

### Question 3 : Isolation des Données

**Réponse** : Isolation stricte à 3 niveaux

#### Niveau 1 : Utilisateurs
- Chaque utilisateur a un **User ID unique** : `user_<timestamp>`
- Toutes les requêtes incluent `WHERE user_id = ?`
- Un utilisateur ne peut JAMAIS voir les données d'un autre

#### Niveau 2 : Sessions (Conversations)
- Chaque conversation a une **Session ID unique** : `conv_<timestamp>_<random>`
- Liée à un seul `user_id` via FOREIGN KEY CASCADE
- Si l'utilisateur est supprimé, toutes ses conversations le sont aussi

#### Niveau 3 : Messages
- Chaque message a un **Message ID unique** : `msg_<timestamp>_<random>`
- Lié à une seule `conversation_id` via FOREIGN KEY CASCADE
- Isolation indirecte : `messages → conversations → users`

**Voir détails** : [03_ISOLATION_DONNEES_UTILISATEURS.md](./03_ISOLATION_DONNEES_UTILISATEURS.md)

---

### Question 4 : Structure des Messages et Tableaux

**Réponse** : Format JSON dans la même cellule

Les messages sont stockés dans la table `messages` avec un champ `content` en JSON sérialisé :

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  content TEXT NOT NULL,  -- ← JSON sérialisé
  -- ...
);
```

**Exemple de message avec tableau** :

```json
{
  "content": "| Nom | Age |\n|-----|-----|\n| Alice | 30 |\n| Bob | 25 |",
  "type": "text"
}
```

**Stockage en DB** :

| Colonne | Valeur |
|---------|--------|
| `id` | `msg_123` |
| `conversation_id` | `conv_456` |
| `content` | `{"content":"| Nom | Age |\n|-----|-----|\n| Alice | 30 |\n| Bob | 25 |","type":"text"}` |

**Oui, les tableaux sont sauvegardés en JSON dans la même cellule**, en format Markdown à l'intérieur du champ `content.content`.

**Voir détails** : [04_STRUCTURE_MESSAGES_JSON.md](./04_STRUCTURE_MESSAGES_JSON.md)

---

## 🔍 Analyse des Dossiers Sources

Cette documentation a été créée en analysant :

### Dossier `Doc_systeme_sauvegarde`
- `ARCHITECTURE_GENERALE.md` : Vue d'ensemble de l'architecture
- `TABLE_PERSISTENCE_SYSTEM.md` : Système de persistance des tables
- `COMPOSANTS/` : Détails des composants (MessageList, SendBox, etc.)
- `PROCEDURES/` : Procédures de débogage et vérification

### Dossier `Doc_menu_contextuel`
- `PERSISTANCE.md` : Système de persistance du menu contextuel
- `ARCHITECTURE_COMPLETE.md` : Architecture complète du menu contextuel
- `PROBLEMES_ET_SOLUTIONS.md` : Solutions aux problèmes rencontrés

### Dossier `Doc_Saas_Multi_User`
- `ARCHITECTURE_MULTI_UTILISATEUR.md` : Architecture multi-utilisateur complète
- `MEMO_PROGRESSION_COMPLETE.md` : Progression du développement SaaS

### Code Source SQLite
- `src/process/database/schema.ts` : Schéma de la base de données
- `src/process/database/types.ts` : Types TypeScript et conversions
- `src/process/database/index.ts` : Interface de la base de données

---

## 📊 Schéma Récapitulatif Complet

```
┌──────────────────────────────────────────────────────────────┐
│                         UTILISATEUR                          │
│  user_id: user_1738838400000                                 │
│  username: john@example.com                                  │
│  role: user                                                  │
│  status: active                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ 1:N (FOREIGN KEY CASCADE)
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                       CONVERSATION                           │
│  id: conv_1738838400000_k3j9x2m7p                            │
│  user_id: user_1738838400000                                 │
│  name: "Discussion avec Gemini"                              │
│  type: gemini                                                │
│  extra: {"modelId": "gemini-2.0-flash-exp"}                  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ 1:N (FOREIGN KEY CASCADE)
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                         MESSAGES                             │
├──────────────────────────────────────────────────────────────┤
│  Message 1                                                   │
│  id: msg_1738838401000_a7s8d9f0g                             │
│  conversation_id: conv_1738838400000_k3j9x2m7p               │
│  content: {                                                  │
│    "content": "Bonjour!",                                    │
│    "type": "text"                                            │
│  }                                                           │
├──────────────────────────────────────────────────────────────┤
│  Message 2 (avec tableau)                                    │
│  id: msg_1738838402000_b8t9e0g1h                             │
│  conversation_id: conv_1738838400000_k3j9x2m7p               │
│  content: {                                                  │
│    "content": "| Nom | Age |\n|-----|-----|\n| Alice | 30 |",│
│    "type": "text"                                            │
│  }                                                           │
├──────────────────────────────────────────────────────────────┤
│  Message 3 (N8N)                                             │
│  id: msg_1738838403000_c9u0f1h2i                             │
│  conversation_id: conv_1738838400000_k3j9x2m7p               │
│  content: {                                                  │
│    "content": "Résultats:\n\n| Task | Status |\n...",        │
│    "type": "text",                                           │
│    "n8nData": {                                              │
│      "workflowId": "wf_123",                                 │
│      "executionId": "exec_456"                               │
│    }                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔐 Garanties de Sécurité

### Isolation des Données
- ✅ Un utilisateur ne peut JAMAIS accéder aux données d'un autre
- ✅ Toutes les requêtes incluent `WHERE user_id = ?`
- ✅ Foreign Keys CASCADE garantissent la cohérence
- ✅ JWT par utilisateur avec `jwt_secret` personnalisé

### Intégrité des Données
- ✅ Foreign Keys activées (`PRAGMA foreign_keys = ON`)
- ✅ Cascade automatique des suppressions
- ✅ Pas de données orphelines possibles
- ✅ Transactions pour les opérations critiques

### Traçabilité
- ✅ Audit Trail complet (v17+)
- ✅ Toutes les actions sensibles sont loggées
- ✅ IP, User-Agent et détails enregistrés
- ✅ Filtrage par utilisateur, action, date

---

## 🛠️ Fichiers Sources Principaux

### Base de Données
- `src/process/database/schema.ts` - Définition du schéma SQLite
- `src/process/database/types.ts` - Types TypeScript et conversions
- `src/process/database/index.ts` - Classe `AionUIDatabase` (opérations CRUD)
- `src/process/database/migrations.ts` - Migrations de schéma

### Système de Messages
- `src/process/message.ts` - Système de persistance des messages
- `src/renderer/messages/hooks.ts` - Hooks React pour les messages
- `src/renderer/components/MessageList.tsx` - Affichage des messages
- `src/renderer/components/MessageText.tsx` - Rendu Markdown

### Menu Contextuel
- `src/renderer/components/TableContextMenu.tsx` - Menu contextuel sur tableaux
- `src/renderer/hooks/useTablePersistence.ts` - Hook de persistance des tables

### Agents
- `src/process/task/GeminiAgentManager.ts` - Gestionnaire Gemini
- `src/process/task/N8nAgentManager.ts` - Gestionnaire N8N + parser de tableaux
- `src/process/task/ACPAgentManager.ts` - Gestionnaire ACP

### Authentification
- `src/webserver/auth/service/AuthService.ts` - Service d'authentification JWT
- `src/webserver/auth/middleware/TokenMiddleware.ts` - Middlewares JWT
- `src/webserver/auth/repository/UserRepository.ts` - Opérations sur les utilisateurs

---

## 📖 Comment Utiliser cette Documentation

### Pour les Développeurs
1. Lire d'abord le **README** (ce fichier) pour avoir une vue d'ensemble
2. Consulter **01_STRUCTURE_DATABASE_SQLITE.md** pour comprendre le schéma de données
3. Lire **03_ISOLATION_DONNEES_UTILISATEURS.md** pour comprendre la sécurité
4. Consulter les autres documents selon les besoins spécifiques

### Pour les Questions Techniques
- **"Comment sont stockés les tableaux ?"** → [04_STRUCTURE_MESSAGES_JSON.md](./04_STRUCTURE_MESSAGES_JSON.md)
- **"Comment fonctionne le menu contextuel ?"** → [02_SYSTEME_SAUVEGARDE_TABLES.md](./02_SYSTEME_SAUVEGARDE_TABLES.md)
- **"Comment les utilisateurs sont-ils isolés ?"** → [03_ISOLATION_DONNEES_UTILISATEURS.md](./03_ISOLATION_DONNEES_UTILISATEURS.md)
- **"Quelle est la structure de la DB ?"** → [01_STRUCTURE_DATABASE_SQLITE.md](./01_STRUCTURE_DATABASE_SQLITE.md)

### Pour les Tests
- Chaque document contient des exemples de code exécutables
- Les requêtes SQL peuvent être testées directement sur la DB
- Les exemples TypeScript peuvent être intégrés dans les tests

---

## 📌 Version et Maintenance

**Version de la documentation** : 1.0  
**Date de création** : 17 novembre 2026  
**Dernière mise à jour** : 17 novembre 2026  
**Créé par** : Assistant IA (Kiro)  
**Projet** : E-audit (anciennement AIONUI)  
**Version de la DB** : v17  
**Version de l'application** : v1.8.25

Cette documentation doit être mise à jour lors de :
- Modifications du schéma de la base de données
- Ajout de nouvelles tables
- Changements dans le système d'isolation
- Modifications du format des messages
- Évolution du système de sauvegarde

---

## 📞 Contact et Support

Pour toute question ou clarification sur cette documentation :
- Consulter les fichiers sources mentionnés
- Vérifier les dossiers `Doc_*` à la racine du projet
- Lire le fichier `AGENTS.md` pour les conventions de développement
