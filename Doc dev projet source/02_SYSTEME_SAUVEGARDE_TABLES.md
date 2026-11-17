# Système de Sauvegarde des Tables - E-audit

**Date**: 17 novembre 2026  
**Version**: 1.0  
**Statut**: ✅ Implémenté

---

## 🎯 Vue d'ensemble

Le système de sauvegarde des tables dans E-audit gère deux types de tables :

1. **Tables générées par n8n** : Résultats de workflows affichés dans le chat
2. **Tables modifiées par le menu contextuel** : Édition manuelle via clic droit

Les modifications sont sauvegardées en temps réel dans la base de données SQLite, permettant la persistance après actualisation de la page.

---

## 📊 Types de Tables

### 1. Tables N8N (Générées Automatiquement)

**Source** : Réponse d'un workflow n8n  
**Format** : JSON converti en tableau Markdown  
**Sauvegarde** : Automatique lors de la réception du message

```typescript
// Exemple de réponse n8n
{
  "data": [
    { "nom": "Alice", "age": 30, "ville": "Paris" },
    { "nom": "Bob", "age": 25, "ville": "Lyon" }
  ]
}

// Converti en Markdown
| nom   | age | ville |
|-------|-----|-------|
| Alice | 30  | Paris |
| Bob   | 25  | Lyon  |
```

**Parser N8N** : `src/process/task/N8nAgentManager.ts`

```typescript
// Détection automatique des tableaux dans la réponse
function parseN8nResponse(response: any): string {
  if (Array.isArray(response.data) && response.data.length > 0) {
    // Extraire les colonnes
    const columns = Object.keys(response.data[0]);
    
    // Créer l'en-tête
    const header = `| ${columns.join(' | ')} |`;
    const separator = `| ${columns.map(() => '---').join(' | ')} |`;
    
    // Créer les lignes
    const rows = response.data.map(row => 
      `| ${columns.map(col => row[col]).join(' | ')} |`
    );
    
    return [header, separator, ...rows].join('\n');
  }
  
  return JSON.stringify(response, null, 2);
}
```

**Sauvegarde** : Automatique via `addMessage()` dans `ConversationManageWithDB`

```typescript
// Le message contenant le tableau est sauvegardé dans SQLite
const message: TMessage = {
  id: `msg_${Date.now()}`,
  conversation_id: conversationId,
  type: 'text',
  position: 'left',
  status: 'finish',
  content: {
    content: markdownTable, // Tableau en format Markdown
    type: 'text'
  },
  createdAt: Date.now()
};

// Sauvegarde dans SQLite
await addMessage(message);
```

### 2. Tables Modifiées par Menu Contextuel

**Source** : Modification manuelle par l'utilisateur (clic droit)  
**Actions** : 
- ✅ Enable Editing (édition de cellules)
- ✅ Insert Row (ajout de ligne)
- ✅ Insert Column (ajout de colonne)
- ✅ Delete Row (suppression de ligne)
- ✅ Delete Column (suppression de colonne)

**Sauvegarde** : Immédiate après chaque modification

---

## 🔄 Flux de Sauvegarde - Tables N8N

### 1. Workflow N8N → Parser → Markdown

```
┌─────────────────┐
│  Workflow N8N   │
│  (Exécution)    │
└────────┬────────┘
         │
         │ HTTP POST /webhook/xxx
         │ {"data": [...]}
         ▼
┌─────────────────┐
│ N8nAgentManager │
│  parseResponse  │
└────────┬────────┘
         │
         │ Détecte Array → Conversion
         │
         ▼
┌─────────────────┐
│ Markdown Table  │
│ | col1 | col2 | │
│ |------|------| │
│ | val1 | val2 | │
└────────┬────────┘
         │
         │ addMessage()
         ▼
┌─────────────────┐
│  SQLite DB      │
│  messages.      │
│  content        │
└─────────────────┘
```

### 2. Code Détaillé

**Fichier** : `src/process/task/N8nAgentManager.ts`

```typescript
async sendMessage(params: TSendMessageParams): Promise<void> {
  try {
    // 1. Extraire les données de la conversation
    const conversation = this.conversation;
    const n8nData = conversation.extra.n8nData;
    
    if (!n8nData?.webhook) {
      throw new Error('No webhook configured for this conversation');
    }
    
    // 2. Envoyer le message à n8n
    const response = await fetch(n8nData.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.input,
        conversationId: conversation.id,
        userId: conversation.userId
      })
    });
    
    const data = await response.json();
    
    // 3. Parser la réponse (détection automatique des tableaux)
    const content = this.parseResponse(data);
    
    // 4. Créer le message de réponse
    const responseMessage: TMessage = {
      id: `msg_${Date.now()}`,
      conversation_id: conversation.id,
      type: 'text',
      position: 'left',
      status: 'finish',
      content: {
        content, // Contient le tableau Markdown si détecté
        type: 'text'
      },
      createdAt: Date.now()
    };
    
    // 5. Sauvegarder dans la base de données
    await addMessage(responseMessage);
    
    // 6. Notifier le renderer
    sendToRenderer('message:received', responseMessage);
    
  } catch (error) {
    console.error('[N8nAgent] Error:', error);
    this.sendErrorMessage(error.message);
  }
}

private parseResponse(data: any): string {
  // Détection de tableau
  if (data.table && Array.isArray(data.table)) {
    return this.arrayToMarkdownTable(data.table);
  }
  
  // Détection de array dans data
  if (data.data && Array.isArray(data.data) && data.data.length > 0) {
    return this.arrayToMarkdownTable(data.data);
  }
  
  // Détection de array direct
  if (Array.isArray(data) && data.length > 0) {
    return this.arrayToMarkdownTable(data);
  }
  
  // Format texte par défaut
  if (typeof data === 'string') {
    return data;
  }
  
  // JSON formaté en fallback
  return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
}

private arrayToMarkdownTable(data: any[]): string {
  if (data.length === 0) return '';
  
  // Extraire les colonnes
  const columns = Object.keys(data[0]);
  
  // Créer l'en-tête
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  
  // Créer les lignes
  const rows = data.map(row => {
    const cells = columns.map(col => {
      const value = row[col];
      // Échapper les pipes dans les valeurs
      return String(value ?? '').replace(/\|/g, '\\|');
    });
    return `| ${cells.join(' | ')} |`;
  });
  
  return '\n' + [header, separator, ...rows].join('\n') + '\n';
}
```

---

## 🔄 Flux de Sauvegarde - Tables Menu Contextuel

### 1. Architecture Complète

```
┌────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS                        │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  TableContextMenu                                    │ │
│  │  - Détecte clic droit sur tableau                    │ │
│  │  - Affiche menu contextuel                           │ │
│  │  - Effectue modifications DOM                        │ │
│  └──────────────────┬───────────────────────────────────┘ │
│                     │                                      │
│                     │ syncTable()                          │
│                     ▼                                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  useTablePersistence                                 │ │
│  │  - Traverse Shadow DOM                               │ │
│  │  - Trouve data-message-id                            │ │
│  │  - Convert HTML → Markdown                           │ │
│  └──────────────────┬───────────────────────────────────┘ │
│                     │                                      │
│                     │ IPC: database.updateMessageContent   │
│                     ▼                                      │
└────────────────────────────────────────────────────────────┘
                     │
                     │ IPC Bridge
                     │
┌────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS                          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  databaseBridge.updateMessageContent                 │ │
│  │  - Récupère le message existant                      │ │
│  │  - Met à jour le content                             │ │
│  │  - Sauvegarde dans SQLite                            │ │
│  └──────────────────┬───────────────────────────────────┘ │
│                     │                                      │
│                     ▼                                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  SQLite Database                                     │ │
│  │  UPDATE messages SET content = ? WHERE id = ?        │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 2. Détection de la Conversation et du Message

**Fichier** : `src/renderer/components/TableContextMenu.tsx`

```typescript
const [conversationId, setConversationId] = useState<string | null>(null);

// Détection automatique de la conversation depuis l'URL
useEffect(() => {
  const url = window.location.href;
  // Pattern : /conversation/[id]
  const match = url.match(/\/conversation\/([^/?#]+)/);
  if (match) {
    setConversationId(match[1]);
    console.log('[TableContextMenu] Conversation ID:', match[1]);
  }
}, []);

// Fonction de synchronisation appelée après chaque modification
const syncTable = useCallback(() => {
  if (!conversationId || !targetTable) {
    console.error('[TableContextMenu] Missing conversationId or targetTable');
    return;
  }
  
  console.log('[TableContextMenu] Syncing table to database...');
  void syncTableToDatabase(targetTable, conversationId);
}, [conversationId, targetTable, syncTableToDatabase]);
```

### 3. Opérations de Modification

**Insert Row** (Ajout de ligne)

```typescript
const insertRowBelow = useCallback(() => {
  if (!targetTable || !selectedCell) return;
  
  // 1. Trouver la ligne actuelle
  const currentRow = selectedCell.closest('tr');
  if (!currentRow) return;
  
  // 2. Compter les colonnes
  const tbody = targetTable.querySelector('tbody');
  const columnCount = currentRow.querySelectorAll('td, th').length;
  
  // 3. Créer une nouvelle ligne vide
  const newRow = document.createElement('tr');
  for (let i = 0; i < columnCount; i++) {
    const newCell = document.createElement('td');
    newCell.textContent = '';
    newRow.appendChild(newCell);
  }
  
  // 4. Insérer après la ligne actuelle
  currentRow.after(newRow);
  
  // 5. Notification + Synchronisation
  showNotification('✅ Row added');
  syncTable(); // ← Sauvegarde immédiate
  hideMenu();
}, [targetTable, selectedCell, showNotification, syncTable, hideMenu]);
```

**Delete Column** (Suppression de colonne)

```typescript
const deleteColumn = useCallback(() => {
  if (!targetTable || !selectedCell) return;
  
  // 1. Trouver l'index de la colonne
  const cellIndex = Array.from(selectedCell.parentElement!.children).indexOf(selectedCell);
  
  // 2. Supprimer l'en-tête
  const thead = targetTable.querySelector('thead');
  if (thead) {
    const headerRow = thead.querySelector('tr');
    if (headerRow) {
      const headerCells = headerRow.querySelectorAll('th, td');
      if (headerCells[cellIndex]) {
        headerCells[cellIndex].remove();
      }
    }
  }
  
  // 3. Supprimer les cellules du tbody
  const tbody = targetTable.querySelector('tbody');
  if (tbody) {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      if (cells[cellIndex]) {
        cells[cellIndex].remove();
      }
    });
  }
  
  // 4. Notification + Synchronisation
  showNotification('✅ Column deleted');
  syncTable(); // ← Sauvegarde immédiate
  hideMenu();
}, [targetTable, selectedCell, showNotification, syncTable, hideMenu]);
```

**Enable Editing** (Édition de cellules)

```typescript
const enableCellEditing = useCallback(() => {
  if (!targetTable) return;
  
  const cells = targetTable.querySelectorAll('td, th');
  
  cells.forEach((cell) => {
    // 1. Rendre la cellule éditable
    cell.contentEditable = 'true';
    cell.classList.add('editable-cell');
    
    // 2. Synchroniser au blur (perte de focus)
    cell.addEventListener('blur', () => {
      console.log('[TableContextMenu] Cell edited, syncing...');
      syncTable(); // ← Sauvegarde différée (au blur)
    });
    
    // 3. Gérer la touche Enter (nouvelle ligne)
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        cell.blur(); // Déclenche le blur → sync
      }
    });
  });
  
  showNotification('✏️ Editing enabled');
  hideMenu();
}, [targetTable, showNotification, syncTable, hideMenu]);
```

### 4. Traversée du Shadow DOM

**Problème** : Les tableaux sont encapsulés dans un Shadow DOM

```html
<div class="markdown-shadow-body" data-message-id="msg_123">
  #shadow-root (open)
    <table>
      <thead>...</thead>
      <tbody>...</tbody>
    </table>
</div>
```

**Solution** : `src/renderer/hooks/useTablePersistence.ts`

```typescript
const syncTableToDatabase = useCallback(
  async (table: HTMLTableElement, conversationId: string) => {
    try {
      // 1. Trouver le conteneur du message en traversant le Shadow DOM
      let currentElement: Element | null = table;
      let messageContainer: Element | null = null;
      
      // Remonter l'arbre DOM
      while (currentElement) {
        // Vérifier si on a trouvé le data-message-id
        if (currentElement.hasAttribute('data-message-id')) {
          messageContainer = currentElement;
          break;
        }
        
        // Essayer le parent
        const parent = currentElement.parentElement;
        
        // Si pas de parent, vérifier si on est dans un Shadow DOM
        if (!parent && currentElement.parentNode) {
          const parentNode = currentElement.parentNode;
          
          // Traverser la frontière du Shadow DOM
          if (parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            const shadowRoot = parentNode as ShadowRoot;
            if (shadowRoot.host) {
              currentElement = shadowRoot.host;
              continue;
            }
          }
        }
        
        currentElement = parent;
      }
      
      if (!messageContainer) {
        console.error('[TablePersistence] Message container not found');
        return;
      }
      
      const messageId = messageContainer.getAttribute('data-message-id');
      console.log('[TablePersistence] Found message ID:', messageId);
      
      // 2. Convertir le tableau HTML en Markdown
      const markdownContent = tableToMarkdown(table);
      
      // 3. Appeler l'IPC pour mettre à jour le message
      await ipcBridge.database.updateMessageContent.invoke({
        messageId: messageId!,
        conversationId,
        content: markdownContent
      });
      
      console.log('[TablePersistence] ✅ Table synced successfully');
      
    } catch (error) {
      console.error('[TablePersistence] ❌ Failed to sync table:', error);
    }
  },
  []
);
```

### 5. Conversion HTML → Markdown

```typescript
function tableToMarkdown(table: HTMLTableElement): string {
  const rows: string[] = [];
  
  // 1. Extraire l'en-tête
  const thead = table.querySelector('thead');
  if (thead) {
    const headerRow = thead.querySelector('tr');
    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll('th, td'))
        .map((cell) => cell.textContent?.trim() || '')
        .join(' | ');
      rows.push(`| ${headers} |`);
      
      // Séparateur OBLIGATOIRE pour les tableaux Markdown
      const separator = Array.from(headerRow.querySelectorAll('th, td'))
        .map(() => '---')
        .join(' | ');
      rows.push(`| ${separator} |`);
    }
  }
  
  // 2. Extraire le corps du tableau
  const tbody = table.querySelector('tbody');
  const bodyRows = tbody ? tbody.querySelectorAll('tr') : table.querySelectorAll('tr');
  
  bodyRows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td, th'))
      .map((cell) => {
        const text = cell.textContent?.trim() || '';
        // Échapper les pipes
        return text.replace(/\|/g, '\\|');
      })
      .join(' | ');
    rows.push(`| ${cells} |`);
  });
  
  return '\n' + rows.join('\n') + '\n';
}
```

**Exemple** :

```html
<!-- HTML Input -->
<table>
  <thead>
    <tr><th>Nom</th><th>Âge</th><th>Ville</th></tr>
  </thead>
  <tbody>
    <tr><td>Alice</td><td>30</td><td>Paris</td></tr>
    <tr><td>Bob</td><td>25</td><td>Lyon</td></tr>
  </tbody>
</table>
```

```markdown
<!-- Markdown Output -->
| Nom | Âge | Ville |
| --- | --- | --- |
| Alice | 30 | Paris |
| Bob | 25 | Lyon |
```

### 6. Mise à Jour dans SQLite

**Fichier** : `src/process/bridge/databaseBridge.ts`

```typescript
ipcBridge.database.updateMessageContent.provider(
  ({ messageId, conversationId, content }) => {
    try {
      const db = getDatabase();
      
      // 1. Récupérer le message existant
      const messages = db.getConversationMessages(conversationId, 0, 10000);
      const existingMessage = messages.data?.find((msg) => msg.id === messageId);
      
      if (!existingMessage) {
        return Promise.resolve({ 
          success: false, 
          error: 'Message not found' 
        });
      }
      
      // 2. Mettre à jour le contenu
      const updatedMessage = {
        ...existingMessage,
        content: {
          ...existingMessage.content,
          content, // Nouveau contenu Markdown
        },
      };
      
      // 3. Sauvegarder dans SQLite
      db.prepare(`
        UPDATE messages 
        SET content = ?, updated_at = ?
        WHERE id = ? AND conversation_id = ?
      `).run(
        JSON.stringify(updatedMessage.content),
        Date.now(),
        messageId,
        conversationId
      );
      
      console.log('[DatabaseBridge] ✅ Message content updated');
      
      return Promise.resolve({ success: true });
      
    } catch (error) {
      console.error('[DatabaseBridge] ❌ Update failed:', error);
      return Promise.resolve({ 
        success: false, 
        error: String(error) 
      });
    }
  }
);
```

---

## ⚡ Optimisations

### 1. Synchronisation Différée pour l'Édition

Lors de l'édition de cellule, la sauvegarde se fait au `blur` (perte de focus) :

```typescript
cell.addEventListener('blur', () => {
  syncTable(); // Sauvegarde UNIQUEMENT quand l'utilisateur termine l'édition
});
```

**Avantages** :
- ✅ Réduit le nombre d'appels IPC
- ✅ Évite les écritures DB excessives
- ✅ Meilleure performance lors de la frappe rapide

### 2. Batch des Modifications (Système Global)

Le système `ConversationManageWithDB` batch automatiquement les modifications :

```typescript
// src/process/message.ts
class ConversationManageWithDB {
  private stack: Array<['insert' | 'accumulate', TMessage]> = [];
  private timer: NodeJS.Timeout | null = null;
  
  sync(type: 'insert' | 'accumulate', message: TMessage) {
    // Ajouter à la stack
    this.stack.push([type, message]);
    
    // Annuler le timer précédent
    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    // Nouveau timer de 2 secondes
    this.timer = setTimeout(() => {
      this.save2DataBase();
    }, 2000);
  }
  
  private save2DataBase() {
    const db = getDatabase();
    
    // Transaction pour toutes les modifications
    db.transaction(() => {
      this.stack.forEach(([type, message]) => {
        if (type === 'insert') {
          db.insertMessage(message);
        } else if (type === 'accumulate') {
          db.updateMessage(message.id, message);
        }
      });
    })();
    
    // Clear stack
    this.stack = [];
  }
}
```

### 3. Cache des Indices

Le système de messages utilise un cache pour optimiser les recherches :

```typescript
const indexCache = new WeakMap<TMessage[], MessageIndex>();

function getOrBuildIndex(list: TMessage[]): MessageIndex {
  let cached = indexCache.get(list);
  if (!cached) {
    cached = buildMessageIndex(list);
    indexCache.set(list, cached);
  }
  return cached;
}
```

---

## 🔄 Comparaison : N8N vs Menu Contextuel

| Aspect | Tables N8N | Tables Menu Contextuel |
|--------|------------|------------------------|
| **Source** | Workflow n8n (automatique) | Utilisateur (manuel) |
| **Détection** | Parser automatique (JSON→Markdown) | Clic droit sur tableau |
| **Sauvegarde** | Lors de la création du message | Après chaque modification |
| **Route IPC** | Standard (`addMessage`) | Directe (`database.updateMessageContent`) |
| **Timing** | Une fois (création) | Multiple (chaque modif) |
| **Format** | JSON → Markdown (conversion) | HTML → Markdown (conversion) |
| **Complexité** | Faible | Moyenne (Shadow DOM) |

---

## 📝 Résumé

### Tables N8N
1. Workflow n8n retourne des données JSON
2. Parser détecte automatiquement les arrays
3. Conversion en tableau Markdown
4. Sauvegarde dans SQLite via `addMessage()`
5. Affichage dans le chat

### Tables Menu Contextuel
1. Utilisateur clique droit sur un tableau
2. Effectue une modification (ajout/suppression ligne/colonne, édition)
3. `syncTable()` est appelé
4. Traverse le Shadow DOM pour trouver le `data-message-id`
5. Convertit HTML → Markdown
6. IPC `database.updateMessageContent` met à jour SQLite
7. Modification persistée

### Points Clés
- ✅ **Persistance garantie** : Toutes les modifications sont sauvegardées en base
- ✅ **Temps réel** : Sauvegarde immédiate après chaque action
- ✅ **Format unifié** : Markdown pour toutes les tables (cohérence)
- ✅ **Optimisations** : Batch, debouncing, cache d'indices
- ✅ **Shadow DOM** : Gestion correcte des frontières Shadow DOM
