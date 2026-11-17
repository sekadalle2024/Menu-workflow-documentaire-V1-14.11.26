# Structure de la Base de Données SQLite - E-audit

**Date**: 17 novembre 2026  
**Version de la DB**: v17  
**Type**: SQLite (better-sqlite3)  
**Mode**: WAL (Write-Ahead Logging)

---

## 📋 Vue d'ensemble

E-audit utilise une base de données SQLite unique située à `<dataPath>/aionui.db` pour stocker toutes les données de l'application :
- Comptes utilisateurs
- Conversations de chat
- Messages
- Logs d'audit (v17+)

La base de données est gérée par le main process et accessible via IPC Bridge depuis le renderer process.

---

## 🗄️ Tables Principales

### Table `users` - Comptes Utilisateurs

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- Format: user_<timestamp> ou system_default_user
  username TEXT UNIQUE NOT NULL,          -- Nom d'utilisateur unique (email ou pseudo)
  email TEXT UNIQUE,                      -- Email optionnel (UNIQUE)
  password_hash TEXT NOT NULL,            -- Hash bcrypt du mot de passe
  avatar_path TEXT,                       -- Chemin vers l'avatar
  jwt_secret TEXT,                        -- Secret JWT par utilisateur (v6+)
  role TEXT NOT NULL DEFAULT 'user',      -- 'admin' ou 'user' (v17+)
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'blocked', 'suspended' (v17+)
  blocked_at INTEGER,                     -- Timestamp du blocage (v17+)
  blocked_by TEXT,                        -- ID de l'admin qui a bloqué (v17+)
  blocked_reason TEXT,                    -- Raison du blocage (v17+)
  created_at INTEGER NOT NULL,            -- Timestamp de création
  updated_at INTEGER NOT NULL,            -- Timestamp de dernière modification
  last_login INTEGER                      -- Timestamp de dernière connexion
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);        -- v17+
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);            -- v17+
```

**Champs clés** :
- `id` : Identifiant unique (UUID-like)
- `username` : Login unique (peut être email ou pseudo)
- `email` : Email optionnel mais unique si fourni
- `password_hash` : Hash bcrypt du mot de passe (jamais stocké en clair)
- `jwt_secret` : Secret JWT personnalisé par utilisateur (permet d'invalider tous les tokens d'un utilisateur)
- `role` : Distinction admin/utilisateur standard (ajouté v17)
- `status` : État du compte (active, blocked, suspended) (ajouté v17)

**Utilisateur système** :
- ID : `system_default_user`
- Créé automatiquement au démarrage si inexistant
- Utilisé en mode Desktop (sans login)

---

### Table `conversations` - Conversations de Chat

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,                              -- ID unique de la conversation
  user_id TEXT NOT NULL,                            -- 🔑 CLÉ D'ISOLATION PAR UTILISATEUR
  name TEXT NOT NULL,                               -- Titre de la conversation
  type TEXT NOT NULL CHECK(type IN (                -- Type d'agent
    'gemini', 'acp', 'codex', 
    'openclaw-gateway', 'nanobot', 'n8n'
  )),
  extra TEXT NOT NULL,                              -- JSON : données spécifiques au type
  model TEXT,                                       -- JSON : modèle Gemini (type=gemini uniquement)
  status TEXT CHECK(status IN (                     -- Statut de la conversation
    'pending', 'running', 'finished'
  )),
  source TEXT,                                      -- Source : 'telegram', 'lark', 'dingtalk', 'aionui'
  channel_chat_id TEXT,                             -- ID du canal/groupe (isolation multi-tenant)
  created_at INTEGER NOT NULL,                      -- Timestamp de création
  updated_at INTEGER NOT NULL,                      -- Timestamp de dernière modification
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
```

**Isolation des données** :
- Chaque conversation est liée à un `user_id` unique
- `FOREIGN KEY` avec `ON DELETE CASCADE` : si l'utilisateur est supprimé, toutes ses conversations sont automatiquement supprimées
- Toutes les requêtes incluent systématiquement `WHERE user_id = ?`

**Types d'agents supportés** :
| Type | Description | Champs spécifiques |
|------|-------------|--------------------|
| `gemini` | Google Gemini AI | `model` (JSON) |
| `acp` | Agent Communication Protocol | - |
| `codex` | Génération de code (legacy) | - |
| `openclaw-gateway` | OpenClaw integration | - |
| `nanobot` | Bot léger | - |
| `n8n` | Automation workflows | `extra.n8nData` (workflowId, executionId) |

**Format du champ `extra`** (JSON) :
```typescript
// Exemple pour Gemini
{
  "systemInstruction": "You are a helpful assistant",
  "tools": [],
  "modelId": "gemini-2.0-flash-exp"
}

// Exemple pour n8n
{
  "n8nData": {
    "workflowId": "wf-456",
    "executionId": "exec-789",
    "webhook": "http://localhost:3458/webhook/..."
  }
}
```

---

### Table `messages` - Messages de Chat

```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                              -- ID unique du message
  conversation_id TEXT NOT NULL,                    -- Lié à une conversation
  msg_id TEXT,                                      -- ID du message source (optionnel)
  type TEXT NOT NULL,                               -- Type de contenu
  content TEXT NOT NULL,                            -- JSON : contenu du message
  position TEXT CHECK(position IN (                 -- Position visuelle
    'left', 'right', 'center', 'pop'
  )),
  status TEXT CHECK(status IN (                     -- Statut du message
    'finish', 'pending', 'error', 'work'
  )),
  created_at INTEGER NOT NULL,                      -- Timestamp de création
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_msg_id ON messages(msg_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
```

**Isolation des données** :
- Les messages sont isolés par `conversation_id`
- Isolation indirecte par utilisateur : `messages → conversations → users`
- `FOREIGN KEY` avec `ON DELETE CASCADE` : si la conversation est supprimée, tous ses messages sont automatiquement supprimés

**Format du champ `content`** (JSON) :

```typescript
// Message texte simple
{
  "content": "Bonjour, comment ça va ?",
  "type": "text"
}

// Message avec tableau Markdown
{
  "content": "Résultats:\n\n| Nom | Age |\n|-----|-----|\n| Alice | 30 |\n| Bob | 25 |",
  "type": "text"
}

// Message avec pièce jointe
{
  "content": "Voir le fichier",
  "files": [
    {
      "name": "document.pdf",
      "path": "/uploads/user_123/document.pdf",
      "size": 102400,
      "type": "application/pdf"
    }
  ]
}
```

**Positions des messages** :
- `left` : Message de l'assistant/bot
- `right` : Message de l'utilisateur
- `center` : Message système (notifications, erreurs)
- `pop` : Message popup/modal

**Statuts des messages** :
- `finish` : Message complètement reçu
- `pending` : Message en attente de traitement
- `error` : Erreur lors du traitement
- `work` : Message en cours de traitement (streaming)

---

### Table `audit_log` - Logs d'Audit (v17+)

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,                              -- ID unique du log
  user_id TEXT NOT NULL,                            -- Utilisateur qui effectue l'action
  target_user_id TEXT,                              -- Utilisateur cible (pour actions admin)
  action TEXT NOT NULL,                             -- Type d'action (voir liste ci-dessous)
  resource_type TEXT,                               -- Type de ressource ('user', 'conversation', 'message')
  resource_id TEXT,                                 -- ID de la ressource affectée
  details TEXT,                                     -- JSON : détails supplémentaires
  ip_address TEXT,                                  -- Adresse IP de l'origine
  user_agent TEXT,                                  -- User-Agent du navigateur
  created_at INTEGER NOT NULL,                      -- Timestamp de l'action
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_user_id ON audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
```

**Types d'actions tracées** :
- `login` : Connexion utilisateur
- `logout` : Déconnexion utilisateur
- `failed_login` : Tentative de connexion échouée
- `block_user` : Blocage d'un utilisateur (admin)
- `unblock_user` : Déblocage d'un utilisateur (admin)
- `create_conversation` : Création de conversation
- `delete_conversation` : Suppression de conversation
- `update_message` : Modification de message (ex: table modifiée via menu contextuel)

**Exemple d'entrée d'audit** :

```json
{
  "id": "audit_1738838400000_abc123",
  "user_id": "user_admin_1234",
  "target_user_id": "user_spam_5678",
  "action": "block_user",
  "resource_type": "user",
  "resource_id": "user_spam_5678",
  "details": "{\"reason\": \"Spam detected\", \"previous_status\": \"active\"}",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "created_at": 1738838400000
}
```

---

## 🔐 Mécanisme d'Isolation des Données

### 1. Isolation par Utilisateur

**Principe** : Toutes les données sont filtrées par `user_id`

```typescript
// Exemple de requête sécurisée
getUserConversations(userId: string, page = 0, pageSize = 50) {
  const rows = this.db.prepare(`
    SELECT * FROM conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC LIMIT ? OFFSET ?
  `).all(userId, pageSize, page * pageSize);
  
  return rows.map(rowToConversation);
}
```

**Garanties** :
- ✅ Un utilisateur ne peut JAMAIS accéder aux conversations d'un autre utilisateur
- ✅ Les messages sont isolés par `conversation_id` (qui est isolé par `user_id`)
- ✅ Les `FOREIGN KEY` avec `ON DELETE CASCADE` garantissent la cohérence

### 2. Isolation par Canal (Multi-Tenant)

Pour les intégrations externes (Telegram, Lark, DingTalk), le champ `channel_chat_id` permet d'isoler les conversations :

```typescript
// Trouver la conversation d'un canal spécifique
findChannelConversation(source: string, channelChatId: string, userId: string) {
  const row = this.db.prepare(`
    SELECT * FROM conversations
    WHERE user_id = ? AND source = ? AND channel_chat_id = ?
    ORDER BY updated_at DESC LIMIT 1
  `).get(userId, source, channelChatId);
  
  return row ? rowToConversation(row) : null;
}
```

**Format du `channel_chat_id`** :
- `user:123456789` : Chat privé avec l'utilisateur 123456789
- `group:987654321` : Chat de groupe 987654321

### 3. Sécurité des Requêtes

**Toujours utiliser des requêtes préparées** :

```typescript
// ✅ BON : Requête préparée (protection contre SQL injection)
db.prepare('SELECT * FROM users WHERE username = ?').get(username);

// ❌ MAUVAIS : Concaténation de chaînes (SQL injection possible)
db.exec(`SELECT * FROM users WHERE username = '${username}'`);
```

---

## 📊 Relations entre Tables

```
┌─────────────────┐
│     users       │
│  (Utilisateurs) │
│                 │
│  id (PK)        │
│  username       │
│  email          │
│  role           │
│  status         │
└────────┬────────┘
         │
         │ 1:N (FOREIGN KEY ON DELETE CASCADE)
         │
         ▼
┌─────────────────┐
│ conversations   │
│ (Conversations) │
│                 │
│  id (PK)        │
│  user_id (FK)   │◄──── Toutes les conversations sont liées à un utilisateur
│  name           │
│  type           │
│  extra (JSON)   │
└────────┬────────┘
         │
         │ 1:N (FOREIGN KEY ON DELETE CASCADE)
         │
         ▼
┌─────────────────┐
│    messages     │
│    (Messages)   │
│                 │
│  id (PK)        │
│  conversation_id│◄──── Tous les messages sont liés à une conversation
│  content (JSON) │
│  position       │
│  status         │
└─────────────────┘

Isolation indirecte :
  messages → conversation_id → user_id
  
Si user supprimé → toutes ses conversations supprimées → tous ses messages supprimés
```

**Audit Trail** (v17+) :

```
┌─────────────────┐
│   audit_log     │
│   (Logs)        │
│                 │
│  id (PK)        │
│  user_id (FK)   │◄──── Utilisateur qui effectue l'action
│  target_user_id │◄──── Utilisateur cible (pour actions admin)
│  action         │
│  details (JSON) │
└─────────────────┘
```

---

## 🔧 Opérations de Base

### Créer un Utilisateur

```typescript
const userId = `user_${Date.now()}`;
const now = Date.now();

db.prepare(`
  INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  userId,
  'john@example.com',
  'john@example.com',
  '$2b$10$...', // bcrypt hash
  'user',
  'active',
  now,
  now
);
```

### Créer une Conversation

```typescript
const conversationId = `conv_${Date.now()}`;
const now = Date.now();

db.prepare(`
  INSERT INTO conversations (id, user_id, name, type, extra, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  conversationId,
  'user_123',
  'Ma première conversation',
  'gemini',
  JSON.stringify({ modelId: 'gemini-2.0-flash-exp' }),
  now,
  now
);
```

### Ajouter un Message

```typescript
const messageId = `msg_${Date.now()}`;
const now = Date.now();

db.prepare(`
  INSERT INTO messages (id, conversation_id, type, content, position, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  messageId,
  'conv_123',
  'text',
  JSON.stringify({ content: 'Bonjour!', type: 'text' }),
  'right',
  'finish',
  now
);
```

### Récupérer les Messages d'une Conversation

```typescript
const messages = db.prepare(`
  SELECT * FROM messages
  WHERE conversation_id = ?
  ORDER BY created_at ASC
`).all('conv_123');

// Convertir en objets TMessage
const messageObjects = messages.map(rowToMessage);
```

---

## 📈 Optimisations de Performance

### Index Créés

| Table | Index | Utilité |
|-------|-------|---------|
| `users` | `idx_users_username` | Recherche rapide par nom d'utilisateur (login) |
| `users` | `idx_users_email` | Recherche rapide par email |
| `users` | `idx_users_status` | Filtrage par statut (admin panel) |
| `users` | `idx_users_role` | Filtrage par rôle (admin panel) |
| `conversations` | `idx_conversations_user_id` | Récupération des conversations d'un utilisateur |
| `conversations` | `idx_conversations_user_updated` | Tri par date de modification (liste des conversations) |
| `conversations` | `idx_conversations_type` | Filtrage par type d'agent |
| `messages` | `idx_messages_conversation_id` | Récupération des messages d'une conversation |
| `messages` | `idx_messages_conversation_created` | Tri chronologique des messages |
| `audit_log` | `idx_audit_log_user_id` | Requêtes par utilisateur |
| `audit_log` | `idx_audit_log_action` | Filtrage par type d'action |

### Mode WAL (Write-Ahead Logging)

```sql
PRAGMA journal_mode = WAL;
```

**Avantages** :
- Lecture et écriture simultanées sans blocage
- Meilleures performances en environnement multi-thread
- Récupération après crash améliorée

### Foreign Keys Activées

```sql
PRAGMA foreign_keys = ON;
```

**Garantit** :
- Intégrité référentielle
- Cascade automatique des suppressions
- Prévention des données orphelines

---

## 🔄 Gestion des Versions de Schéma

Le système utilise `PRAGMA user_version` pour tracker la version du schéma :

```typescript
// Obtenir la version actuelle
const version = db.pragma('user_version', { simple: true });

// Mettre à jour la version
db.pragma(`user_version = ${newVersion}`);
```

**Version actuelle** : `17` (définie dans `schema.ts`)

**Migrations** :
- Les migrations sont gérées dans `migrations.ts`
- Chaque migration incrémente le numéro de version
- Les migrations sont appliquées automatiquement au démarrage

---

## 📝 Résumé

### Points Clés

1. **Isolation stricte par utilisateur** : Chaque conversation et message est lié à un `user_id` unique
2. **Foreign Keys avec CASCADE** : Suppression automatique en cascade pour maintenir la cohérence
3. **Format JSON pour flexibilité** : Les champs `extra` et `content` utilisent JSON pour stocker des données structurées
4. **Index optimisés** : Performances optimales pour les requêtes fréquentes
5. **Mode WAL** : Support de la lecture/écriture simultanée
6. **Audit trail complet** : Traçabilité de toutes les actions sensibles (v17+)
7. **Gestion des rôles** : Distinction admin/user pour le contrôle d'accès (v17+)

### Fichiers Sources

- `src/process/database/schema.ts` : Définition du schéma
- `src/process/database/types.ts` : Types TypeScript et fonctions de conversion
- `src/process/database/index.ts` : Classe `AionUIDatabase` avec toutes les opérations
- `src/process/database/migrations.ts` : Gestions des migrations de schéma
