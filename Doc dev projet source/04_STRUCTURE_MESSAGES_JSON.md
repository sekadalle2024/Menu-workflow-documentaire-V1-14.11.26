# Structure des Messages et Format JSON - E-audit

**Date**: 17 novembre 2026  
**Version**: 1.0  
**Statut**: ✅ Documentation Complète

---

## 🎯 Vue d'ensemble

Dans E-audit, les messages sont stockés dans la table `messages` de la base de données SQLite. Le champ `content` contient un objet JSON sérialisé qui peut représenter différents types de contenu : texte simple, tableaux Markdown, fichiers, images, etc.

---

## 📊 Structure de la Table `messages`

### Schéma SQL

```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,                    -- ID unique du message
  conversation_id TEXT NOT NULL,          -- Lié à une conversation
  msg_id TEXT,                            -- ID du message source (optionnel)
  type TEXT NOT NULL,                     -- Type de contenu
  content TEXT NOT NULL,                  -- 🔑 JSON : contenu du message
  position TEXT CHECK(position IN (       -- Position visuelle
    'left', 'right', 'center', 'pop'
  )),
  status TEXT CHECK(status IN (           -- Statut du message
    'finish', 'pending', 'error', 'work'
  )),
  created_at INTEGER NOT NULL,            -- Timestamp de création
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

### Champs Clés

| Champ | Type | Description | Exemple |
|-------|------|-------------|---------|
| `id` | TEXT | ID unique du message | `msg_1738838400000_a7s8d9f0g` |
| `conversation_id` | TEXT | ID de la conversation | `conv_1738838400000_k3j9x2m7p` |
| `msg_id` | TEXT | ID source (optionnel) | `gemini-msg-123` |
| `type` | TEXT | Type de contenu | `text`, `image`, `file`, `system` |
| `content` | TEXT | **JSON sérialisé** | `{"content":"Hello","type":"text"}` |
| `position` | TEXT | Position visuelle | `left` (bot), `right` (user) |
| `status` | TEXT | Statut du message | `finish`, `pending`, `error` |
| `created_at` | INTEGER | Timestamp | `1738838400000` |

---

## 🔑 Format JSON du Champ `content`

Le champ `content` est une chaîne JSON sérialisée qui contient l'objet de contenu réel. Voici les différents formats possibles.

### 1. Message Texte Simple

**Structure TypeScript** :

```typescript
interface TextContent {
  content: string;    // Le texte du message
  type: 'text';       // Type fixe
}
```

**Exemple JSON (avant sérialisation)** :

```json
{
  "content": "Bonjour, comment puis-je vous aider ?",
  "type": "text"
}
```

**Stockage en DB (après sérialisation)** :

```sql
INSERT INTO messages (id, conversation_id, type, content, position, status, created_at)
VALUES (
  'msg_1738838400000_abc',
  'conv_1738838400000_xyz',
  'text',
  '{"content":"Bonjour, comment puis-je vous aider ?","type":"text"}',
  'left',
  'finish',
  1738838400000
);
```

### 2. Message avec Tableau Markdown

Les tableaux sont stockés en format Markdown dans le champ `content`.

**Structure TypeScript** :

```typescript
interface TableContent {
  content: string;    // Tableau en format Markdown
  type: 'text';       // Type 'text' car Markdown = texte
}
```

**Exemple JSON** :

```json
{
  "content": "Voici les résultats:\n\n| Nom | Âge | Ville |\n|-----|-----|-------|\n| Alice | 30 | Paris |\n| Bob | 25 | Lyon |\n| Charlie | 35 | Marseille |",
  "type": "text"
}
```

**Visualisation du Markdown** :

```markdown
Voici les résultats:

| Nom     | Âge | Ville     |
|---------|-----|-----------|
| Alice   | 30  | Paris     |
| Bob     | 25  | Lyon      |
| Charlie | 35  | Marseille |
```

**Stockage en DB** :

```sql
INSERT INTO messages (id, conversation_id, type, content, position, status, created_at)
VALUES (
  'msg_1738838401000_def',
  'conv_1738838400000_xyz',
  'text',
  '{"content":"Voici les résultats:\n\n| Nom | Âge | Ville |\n|-----|-----|-------|\n| Alice | 30 | Paris |\n| Bob | 25 | Lyon |\n| Charlie | 35 | Marseille |","type":"text"}',
  'left',
  'finish',
  1738838401000
);
```

**Note importante** : Les tableaux sont stockés **directement dans le champ `content` en format Markdown**, pas dans une structure séparée.

### 3. Message avec Fichiers/Pièces Jointes

**Structure TypeScript** :

```typescript
interface FileContent {
  content: string;           // Texte descriptif
  type: 'text';              // Type de base
  files?: Array<{            // Liste des fichiers
    name: string;            // Nom du fichier
    path: string;            // Chemin du fichier
    size: number;            // Taille en octets
    type: string;            // MIME type
    url?: string;            // URL de téléchargement (optionnel)
  }>;
}
```

**Exemple JSON** :

```json
{
  "content": "Voici le rapport demandé",
  "type": "text",
  "files": [
    {
      "name": "rapport_2026.pdf",
      "path": "/uploads/user_123/rapport_2026.pdf",
      "size": 1024000,
      "type": "application/pdf"
    }
  ]
}
```

**Stockage en DB** :

```sql
INSERT INTO messages (id, conversation_id, type, content, position, status, created_at)
VALUES (
  'msg_1738838402000_ghi',
  'conv_1738838400000_xyz',
  'text',
  '{"content":"Voici le rapport demandé","type":"text","files":[{"name":"rapport_2026.pdf","path":"/uploads/user_123/rapport_2026.pdf","size":1024000,"type":"application/pdf"}]}',
  'right',
  'finish',
  1738838402000
);
```

### 4. Message avec Images

Les images peuvent être encodées en base64 ou référencées par URL.

**Structure TypeScript** :

```typescript
interface ImageContent {
  content: string;           // Texte descriptif ou vide
  type: 'image';             // Type spécifique
  url?: string;              // URL de l'image
  base64?: string;           // Image en base64
  width?: number;            // Largeur (optionnel)
  height?: number;           // Hauteur (optionnel)
}
```

**Exemple JSON (URL)** :

```json
{
  "content": "Capture d'écran du dashboard",
  "type": "image",
  "url": "/uploads/user_123/screenshot.png",
  "width": 1920,
  "height": 1080
}
```

**Exemple JSON (Base64)** :

```json
{
  "content": "Logo de l'entreprise",
  "type": "image",
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "width": 200,
  "height": 100
}
```

### 5. Message Système

Messages générés automatiquement par le système (notifications, erreurs, etc.).

**Structure TypeScript** :

```typescript
interface SystemContent {
  content: string;           // Message système
  type: 'system';            // Type spécifique
  level?: 'info' | 'warning' | 'error' | 'success';
}
```

**Exemple JSON** :

```json
{
  "content": "La conversation a été créée avec succès",
  "type": "system",
  "level": "success"
}
```

**Stockage en DB** :

```sql
INSERT INTO messages (id, conversation_id, type, content, position, status, created_at)
VALUES (
  'msg_1738838403000_jkl',
  'conv_1738838400000_xyz',
  'system',
  '{"content":"La conversation a été créée avec succès","type":"system","level":"success"}',
  'center',
  'finish',
  1738838403000
);
```

### 6. Message avec Données N8N

Messages provenant de workflows n8n avec métadonnées supplémentaires.

**Structure TypeScript** :

```typescript
interface N8nContent {
  content: string;           // Contenu (souvent un tableau Markdown)
  type: 'text';              // Type de base
  n8nData?: {                // Métadonnées n8n
    workflowId: string;      // ID du workflow
    executionId: string;     // ID de l'exécution
    webhook?: string;        // URL du webhook
  };
}
```

**Exemple JSON** :

```json
{
  "content": "Résultats du workflow:\n\n| Tâche | Statut |\n|-------|--------|\n| Task1 | Done |\n| Task2 | Done |\n| Task3 | Pending |",
  "type": "text",
  "n8nData": {
    "workflowId": "wf_12345",
    "executionId": "exec_67890",
    "webhook": "http://localhost:3458/webhook/abc123"
  }
}
```

---

## 🔄 Sérialisation et Désérialisation

### Conversion TMessage ↔ IMessageRow

**Fichier** : `src/process/database/types.ts`

```typescript
/**
 * Convertir un TMessage en row de base de données
 */
export function messageToRow(message: TMessage): IMessageRow {
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    msg_id: message.msg_id,
    type: message.type,
    content: JSON.stringify(message.content),  // ← Sérialisation JSON
    position: message.position,
    status: message.status,
    created_at: message.createdAt || Date.now(),
  };
}

/**
 * Convertir une row de base de données en TMessage
 */
export function rowToMessage(row: IMessageRow): TMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    msg_id: row.msg_id,
    type: row.type as TMessage['type'],
    content: JSON.parse(row.content),  // ← Désérialisation JSON
    position: row.position,
    status: row.status,
    createdAt: row.created_at,
  } as TMessage;
}
```

### Exemple Complet

**1. Création d'un message (TypeScript)** :

```typescript
const message: TMessage = {
  id: `msg_${Date.now()}`,
  conversation_id: 'conv_123',
  type: 'text',
  position: 'right',
  status: 'finish',
  content: {
    content: 'Bonjour!',
    type: 'text'
  },
  createdAt: Date.now()
};
```

**2. Conversion en row de DB** :

```typescript
const row = messageToRow(message);

// Résultat:
{
  id: 'msg_1738838400000',
  conversation_id: 'conv_123',
  msg_id: undefined,
  type: 'text',
  content: '{"content":"Bonjour!","type":"text"}',  // ← JSON stringifié
  position: 'right',
  status: 'finish',
  created_at: 1738838400000
}
```

**3. Insertion en DB** :

```typescript
db.prepare(`
  INSERT INTO messages (id, conversation_id, type, content, position, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  row.id,
  row.conversation_id,
  row.type,
  row.content,  // JSON stringifié
  row.position,
  row.status,
  row.created_at
);
```

**4. Récupération depuis la DB** :

```typescript
const row = db.prepare('SELECT * FROM messages WHERE id = ?').get('msg_1738838400000');

// Résultat:
{
  id: 'msg_1738838400000',
  conversation_id: 'conv_123',
  msg_id: null,
  type: 'text',
  content: '{"content":"Bonjour!","type":"text"}',  // Toujours stringifié
  position: 'right',
  status: 'finish',
  created_at: 1738838400000
}
```

**5. Conversion en TMessage** :

```typescript
const message = rowToMessage(row);

// Résultat:
{
  id: 'msg_1738838400000',
  conversation_id: 'conv_123',
  msg_id: undefined,
  type: 'text',
  position: 'right',
  status: 'finish',
  content: {
    content: 'Bonjour!',  // ← JSON parsé
    type: 'text'
  },
  createdAt: 1738838400000
}
```

---

## 🔧 Gestion des Tableaux Modifiés

### Problème

Quand un utilisateur modifie un tableau via le menu contextuel, le HTML est modifié dans le DOM. Il faut reconvertir en Markdown et sauvegarder.

### Solution

**1. Détection de la modification** :

```typescript
// src/renderer/components/TableContextMenu.tsx
const syncTable = useCallback(() => {
  if (!conversationId || !targetTable) return;
  
  // Appeler le hook de persistance
  void syncTableToDatabase(targetTable, conversationId);
}, [conversationId, targetTable, syncTableToDatabase]);
```

**2. Conversion HTML → Markdown** :

```typescript
// src/renderer/hooks/useTablePersistence.ts
function tableToMarkdown(table: HTMLTableElement): string {
  const rows: string[] = [];
  
  // En-tête
  const thead = table.querySelector('thead');
  if (thead) {
    const headerRow = thead.querySelector('tr');
    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll('th, td'))
        .map((cell) => cell.textContent?.trim() || '')
        .join(' | ');
      rows.push(`| ${headers} |`);
      
      // Séparateur
      const separator = Array.from(headerRow.querySelectorAll('th, td'))
        .map(() => '---')
        .join(' | ');
      rows.push(`| ${separator} |`);
    }
  }
  
  // Corps
  const tbody = table.querySelector('tbody');
  const bodyRows = tbody ? tbody.querySelectorAll('tr') : table.querySelectorAll('tr');
  
  bodyRows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td, th'))
      .map((cell) => cell.textContent?.trim() || '')
      .join(' | ');
    rows.push(`| ${cells} |`);
  });
  
  return '\n' + rows.join('\n') + '\n';
}
```

**3. Mise à jour du message en DB** :

```typescript
// Main process - databaseBridge.ts
ipcBridge.database.updateMessageContent.provider(({ messageId, conversationId, content }) => {
  const db = getDatabase();
  
  // Récupérer le message existant
  const messages = db.getConversationMessages(conversationId, 0, 10000);
  const existingMessage = messages.data?.find((msg) => msg.id === messageId);
  
  if (!existingMessage) {
    return Promise.resolve({ success: false, error: 'Message not found' });
  }
  
  // Mettre à jour le content
  const updatedMessage = {
    ...existingMessage,
    content: {
      ...existingMessage.content,
      content,  // Nouveau Markdown
    },
  };
  
  // Sauvegarder en DB
  db.prepare(`
    UPDATE messages 
    SET content = ?
    WHERE id = ? AND conversation_id = ?
  `).run(
    JSON.stringify(updatedMessage.content),  // ← Sérialisation
    messageId,
    conversationId
  );
  
  return Promise.resolve({ success: true });
});
```

---

## 📦 Exemples Réels de Stockage

### Exemple 1 : Message Texte Simple

**En mémoire (TypeScript)** :

```typescript
const message: TMessage = {
  id: 'msg_1738838400000_abc',
  conversation_id: 'conv_123',
  type: 'text',
  position: 'right',
  status: 'finish',
  content: {
    content: 'Bonjour, comment allez-vous ?',
    type: 'text'
  },
  createdAt: 1738838400000
};
```

**En base de données (SQLite row)** :

| Colonne | Valeur |
|---------|--------|
| `id` | `msg_1738838400000_abc` |
| `conversation_id` | `conv_123` |
| `type` | `text` |
| `content` | `{"content":"Bonjour, comment allez-vous ?","type":"text"}` |
| `position` | `right` |
| `status` | `finish` |
| `created_at` | `1738838400000` |

### Exemple 2 : Message avec Tableau

**En mémoire (TypeScript)** :

```typescript
const message: TMessage = {
  id: 'msg_1738838401000_def',
  conversation_id: 'conv_123',
  type: 'text',
  position: 'left',
  status: 'finish',
  content: {
    content: '| Produit | Prix | Stock |\n|---------|------|-------|\n| Laptop | 1200€ | 5 |\n| Souris | 25€ | 50 |',
    type: 'text'
  },
  createdAt: 1738838401000
};
```

**En base de données (SQLite row)** :

| Colonne | Valeur |
|---------|--------|
| `id` | `msg_1738838401000_def` |
| `conversation_id` | `conv_123` |
| `type` | `text` |
| `content` | `{"content":"| Produit | Prix | Stock |\n|---------|------|-------|\n| Laptop | 1200€ | 5 |\n| Souris | 25€ | 50 |","type":"text"}` |
| `position` | `left` |
| `status` | `finish` |
| `created_at` | `1738838401000` |

**Visualisation** :

| Produit | Prix | Stock |
|---------|------|-------|
| Laptop | 1200€ | 5 |
| Souris | 25€ | 50 |

### Exemple 3 : Message N8N avec Tableau

**En mémoire (TypeScript)** :

```typescript
const message: TMessage = {
  id: 'msg_1738838402000_ghi',
  conversation_id: 'conv_123',
  type: 'text',
  position: 'left',
  status: 'finish',
  content: {
    content: 'Résultats du workflow:\n\n| Tâche | Statut | Durée |\n|-------|--------|-------|\n| Extraction | Done | 2s |\n| Transformation | Done | 5s |\n| Chargement | Done | 3s |',
    type: 'text',
    n8nData: {
      workflowId: 'wf_12345',
      executionId: 'exec_67890',
      webhook: 'http://localhost:3458/webhook/abc123'
    }
  },
  createdAt: 1738838402000
};
```

**En base de données (SQLite row)** :

| Colonne | Valeur |
|---------|--------|
| `id` | `msg_1738838402000_ghi` |
| `conversation_id` | `conv_123` |
| `type` | `text` |
| `content` | `{"content":"Résultats du workflow:\n\n| Tâche | Statut | Durée |\n|-------|--------|-------|\n| Extraction | Done | 2s |\n| Transformation | Done | 5s |\n| Chargement | Done | 3s |","type":"text","n8nData":{"workflowId":"wf_12345","executionId":"exec_67890","webhook":"http://localhost:3458/webhook/abc123"}}` |
| `position` | `left` |
| `status` | `finish` |
| `created_at` | `1738838402000` |

**Note** : Les métadonnées `n8nData` sont stockées **dans le même JSON** que le contenu.

---

## 🔍 Requêtes Courantes

### Récupérer tous les messages d'une conversation

```typescript
const messages = db.prepare(`
  SELECT * FROM messages
  WHERE conversation_id = ?
  ORDER BY created_at ASC
`).all('conv_123');

// Convertir en objets TMessage
const messageObjects = messages.map(rowToMessage);
```

### Rechercher des messages contenant un tableau

```typescript
// Recherche par pattern Markdown de tableau
const messagesWithTables = db.prepare(`
  SELECT * FROM messages
  WHERE conversation_id = ?
    AND content LIKE '%|%|%'
    AND content LIKE '%|---|%'
  ORDER BY created_at ASC
`).all('conv_123');
```

### Compter les messages par type

```typescript
const stats = db.prepare(`
  SELECT type, COUNT(*) as count
  FROM messages
  WHERE conversation_id = ?
  GROUP BY type
`).all('conv_123');

// Résultat:
// [
//   { type: 'text', count: 45 },
//   { type: 'image', count: 3 },
//   { type: 'system', count: 2 }
// ]
```

---

## 📝 Résumé

### Points Clés

1. **Champ `content` en JSON** : Le contenu des messages est stocké en JSON sérialisé
2. **Format unifié** : Tous les types de contenu utilisent le même schéma de base
3. **Tableaux en Markdown** : Les tableaux sont stockés directement dans `content.content` en format Markdown
4. **Pas de structure séparée** : Il n'y a pas de table dédiée pour les tableaux (tout est dans `messages.content`)
5. **Sérialisation automatique** : Les fonctions `messageToRow()` et `rowToMessage()` gèrent la conversion
6. **Extensibilité** : Le format JSON permet d'ajouter facilement de nouveaux types de contenu

### Structure de Stockage

```
messages (table SQLite)
├─ id (TEXT)
├─ conversation_id (TEXT)
├─ type (TEXT)
├─ content (TEXT - JSON stringifié) ← 🔑 TOUT LE CONTENU EST ICI
│   └─ Après parsing JSON:
│       ├─ content (string) ← Texte ou Markdown
│       ├─ type (string) ← 'text', 'image', 'system'
│       ├─ files? (array) ← Pièces jointes optionnelles
│       ├─ n8nData? (object) ← Métadonnées N8N optionnelles
│       └─ ... (extensible)
├─ position (TEXT)
├─ status (TEXT)
└─ created_at (INTEGER)
```

### Fichiers Sources

- `src/process/database/schema.ts` : Schéma de la table `messages`
- `src/process/database/types.ts` : Types TypeScript et fonctions de conversion
- `src/common/chatLib.ts` : Type `TMessage` (interface)
- `src/renderer/hooks/useTablePersistence.ts` : Conversion HTML → Markdown
- `src/process/task/N8nAgentManager.ts` : Parser N8N (JSON → Markdown)
