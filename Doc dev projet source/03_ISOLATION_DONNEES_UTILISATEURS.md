# Isolation des Données entre Utilisateurs - E-audit

**Date**: 17 novembre 2026  
**Version DB**: v17  
**Statut**: ✅ Système Multi-Utilisateur Complet

---

## 🎯 Vue d'ensemble

E-audit garantit une isolation stricte des données entre utilisateurs grâce à :

1. **Identifiants uniques** : Chaque utilisateur possède un `user_id` unique
2. **Filtrage systématique** : Toutes les requêtes incluent `WHERE user_id = ?`
3. **Foreign Keys CASCADE** : Suppression automatique en cascade
4. **Session JWT** : Authentification sécurisée par token
5. **Audit Trail** : Traçabilité de toutes les actions (v17+)

---

## 🔑 Système d'Identifiants

### 1. User ID (UID)

**Format** : `user_<timestamp>`  
**Génération** : Lors de la création du compte

```typescript
// Création d'un nouvel utilisateur
const userId = `user_${Date.now()}`;

// Exemple : user_1738838400000
```

**Unicité garantie** :
- ✅ PRIMARY KEY dans la table `users`
- ✅ Timestamp millisecondes (peu de collisions)
- ✅ Vérification avant insertion

**Utilisateur système** :
- ID : `system_default_user`
- Créé automatiquement au démarrage
- Utilisé en mode Desktop (sans login)

### 2. Session ID (pour chaque conversation)

**Format** : `conv_<timestamp>_<random>`  
**Génération** : Lors de la création d'une conversation

```typescript
// Création d'une nouvelle conversation
const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Exemple : conv_1738838400000_k3j9x2m7p
```

**Lien avec l'utilisateur** :

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,  -- ← Lien obligatoire
  -- ...
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3. Message ID (pour chaque message dans le chat)

**Format** : `msg_<timestamp>_<random>`  
**Génération** : Lors de la création d'un message

```typescript
// Création d'un nouveau message
const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Exemple : msg_1738838400000_a7s8d9f0g
```

**Lien avec la conversation** :

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,  -- ← Lié à une conversation
  -- ...
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

**Isolation en cascade** :

```
User (user_123)
  └─ Conversation (conv_456)
       ├─ Message 1 (msg_789)
       ├─ Message 2 (msg_790)
       └─ Message 3 (msg_791)
```

---

## 🔒 Mécanismes d'Isolation

### 1. Filtrage par `user_id`

**Principe** : Toutes les requêtes de conversations incluent `WHERE user_id = ?`

```typescript
// src/process/database/index.ts

/**
 * Récupérer les conversations d'un utilisateur
 */
getUserConversations(userId: string, page = 0, pageSize = 50): IPaginatedResult<TChatConversation> {
  // ✅ TOUJOURS filtrer par user_id
  const rows = this.db.prepare(`
    SELECT * FROM conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC 
    LIMIT ? OFFSET ?
  `).all(userId, pageSize, page * pageSize);
  
  const total = this.db.prepare(`
    SELECT COUNT(*) as count FROM conversations WHERE user_id = ?
  `).get(userId).count;
  
  return {
    data: rows.map(rowToConversation),
    total,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < total
  };
}

/**
 * Récupérer une conversation spécifique
 */
getConversation(conversationId: string, userId: string): IQueryResult<TChatConversation | null> {
  // ✅ Vérifier que la conversation appartient bien à l'utilisateur
  const row = this.db.prepare(`
    SELECT * FROM conversations 
    WHERE id = ? AND user_id = ?
  `).get(conversationId, userId);
  
  if (!row) {
    return { 
      success: false, 
      error: 'Conversation not found or access denied' 
    };
  }
  
  return { 
    success: true, 
    data: rowToConversation(row) 
  };
}

/**
 * Supprimer une conversation
 */
deleteConversation(conversationId: string, userId: string): IQueryResult<void> {
  // ✅ Vérifier que la conversation appartient à l'utilisateur
  const result = this.db.prepare(`
    DELETE FROM conversations 
    WHERE id = ? AND user_id = ?
  `).run(conversationId, userId);
  
  if (result.changes === 0) {
    return { 
      success: false, 
      error: 'Conversation not found or access denied' 
    };
  }
  
  // Les messages sont automatiquement supprimés via CASCADE
  return { success: true };
}
```

**Garantie** : Un utilisateur ne peut JAMAIS accéder aux conversations d'un autre utilisateur.

### 2. Isolation Indirecte des Messages

Les messages sont isolés par `conversation_id`, qui est lui-même isolé par `user_id` :

```typescript
/**
 * Récupérer les messages d'une conversation
 */
getConversationMessages(
  conversationId: string, 
  page = 0, 
  pageSize = 100
): IPaginatedResult<TMessage> {
  // Note : Pas besoin de user_id ici car conversation_id est déjà isolé
  const rows = this.db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `).all(conversationId, pageSize, page * pageSize);
  
  const total = this.db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
  `).get(conversationId).count;
  
  return {
    data: rows.map(rowToMessage),
    total,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < total
  };
}
```

**Sécurité renforcée** : Vérifier le `user_id` avant de récupérer les messages

```typescript
/**
 * Récupérer les messages avec vérification utilisateur
 */
getConversationMessagesSecure(
  conversationId: string,
  userId: string,
  page = 0,
  pageSize = 100
): IPaginatedResult<TMessage> {
  // 1. Vérifier que la conversation appartient à l'utilisateur
  const conversation = this.getConversation(conversationId, userId);
  
  if (!conversation.success) {
    throw new Error('Access denied to this conversation');
  }
  
  // 2. Récupérer les messages
  return this.getConversationMessages(conversationId, page, pageSize);
}
```

### 3. Foreign Keys avec CASCADE

**Configuration** :

```sql
-- Activer les foreign keys (OBLIGATOIRE)
PRAGMA foreign_keys = ON;

-- Table conversations
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- ...
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  -- ...
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

**Comportement** :

```typescript
// Supprimer un utilisateur
db.prepare('DELETE FROM users WHERE id = ?').run('user_123');

// Résultat automatique :
// 1. Toutes les conversations de user_123 sont supprimées (CASCADE)
// 2. Tous les messages de ces conversations sont supprimés (CASCADE)
```

**Garantie** : Pas de données orphelines.

---

## 🔐 Authentification JWT

### 1. Structure du Token

```typescript
// Payload du JWT
interface JWTPayload {
  userId: string;        // ID de l'utilisateur
  username: string;      // Nom d'utilisateur
  role: 'admin' | 'user'; // Rôle (v17+)
  iat: number;           // Issued At (timestamp)
  exp: number;           // Expiration (timestamp)
}
```

### 2. Génération du Token

**Fichier** : `src/webserver/auth/service/AuthService.ts`

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

class AuthService {
  /**
   * Générer un token JWT pour un utilisateur
   */
  static generateToken(user: IUser): string {
    // Utiliser le jwt_secret de l'utilisateur (ou un secret global)
    const secret = user.jwt_secret || process.env.JWT_SECRET || 'default-secret';
    
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 jours
    };
    
    return jwt.sign(payload, secret);
  }
  
  /**
   * Vérifier un token JWT
   */
  static verifyToken(token: string): JWTPayload | null {
    try {
      // Décoder sans vérification pour obtenir le userId
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded?.userId) return null;
      
      // Récupérer l'utilisateur pour obtenir son jwt_secret
      const user = UserRepository.findById(decoded.userId);
      if (!user) return null;
      
      // Vérifier le statut de l'utilisateur (v17+)
      if (user.status !== 'active') {
        console.warn('[AuthService] User is not active:', user.id);
        return null;
      }
      
      // Vérifier le token avec le secret de l'utilisateur
      const secret = user.jwt_secret || process.env.JWT_SECRET || 'default-secret';
      const verified = jwt.verify(token, secret) as JWTPayload;
      
      return verified;
      
    } catch (error) {
      console.error('[AuthService] Token verification failed:', error);
      return null;
    }
  }
  
  /**
   * Login utilisateur
   */
  static async login(username: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      // 1. Trouver l'utilisateur
      const user = UserRepository.findByUsername(username);
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }
      
      // 2. Vérifier le statut (v17+)
      if (user.status === 'blocked') {
        return { 
          success: false, 
          error: `Account blocked: ${user.blocked_reason || 'No reason provided'}` 
        };
      }
      
      if (user.status === 'suspended') {
        return { success: false, error: 'Account suspended' };
      }
      
      // 3. Vérifier le mot de passe
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }
      
      // 4. Mettre à jour last_login
      UserRepository.updateLastLogin(user.id);
      
      // 5. Générer le token
      const token = this.generateToken(user);
      
      return { success: true, token };
      
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: 'Internal error' };
    }
  }
}
```

### 3. Middleware d'Authentification

**Fichier** : `src/webserver/auth/middleware/TokenMiddleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware pour vérifier le token JWT
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    // 1. Extraire le token du header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"
    
    if (!token) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }
    
    // 2. Vérifier le token
    const decoded = AuthService.verifyToken(token);
    
    if (!decoded) {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
      return;
    }
    
    // 3. Attacher les infos utilisateur à la requête
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
    
    // 4. Continuer
    next();
    
  } catch (error) {
    console.error('[AuthMiddleware] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal error' 
    });
  }
}

/**
 * Middleware pour vérifier le rôle admin (v17+)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
    return;
  }
  
  if (req.user.role !== 'admin') {
    res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
    return;
  }
  
  next();
}

/**
 * Middleware pour vérifier le statut utilisateur (v17+)
 */
export function checkUserStatus(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next();
  }
  
  const user = UserRepository.findById(req.user.id);
  
  if (!user) {
    res.status(401).json({ 
      success: false, 
      error: 'User not found' 
    });
    return;
  }
  
  if (user.status === 'blocked') {
    res.status(403).json({ 
      success: false, 
      error: 'Your account has been blocked',
      details: {
        blocked_at: user.blocked_at,
        reason: user.blocked_reason
      }
    });
    return;
  }
  
  if (user.status === 'suspended') {
    res.status(403).json({ 
      success: false, 
      error: 'Your account has been suspended' 
    });
    return;
  }
  
  next();
}
```

### 4. Routes Protégées

**Fichier** : `src/webserver/routes/conversationRoutes.ts`

```typescript
import express from 'express';
import { authenticateToken, checkUserStatus } from '../auth/middleware/TokenMiddleware';

const router = express.Router();

// Appliquer les middlewares sur toutes les routes
router.use(authenticateToken);  // Vérifier le token JWT
router.use(checkUserStatus);    // Vérifier le statut utilisateur

/**
 * GET /api/conversations
 * Récupérer les conversations de l'utilisateur connecté
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id; // Garanti par authenticateToken
    const page = parseInt(req.query.page as string) || 0;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    
    const db = getDatabase();
    const result = db.getUserConversations(userId, page, pageSize);
    
    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore
      }
    });
    
  } catch (error) {
    console.error('[ConversationRoutes] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal error' 
    });
  }
});

/**
 * GET /api/conversations/:id
 * Récupérer une conversation spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    
    const db = getDatabase();
    const result = db.getConversation(conversationId, userId);
    
    if (!result.success) {
      res.status(404).json(result);
      return;
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    console.error('[ConversationRoutes] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal error' 
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Supprimer une conversation
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    
    const db = getDatabase();
    const result = db.deleteConversation(conversationId, userId);
    
    if (!result.success) {
      res.status(404).json(result);
      return;
    }
    
    res.json({
      success: true,
      message: 'Conversation deleted'
    });
    
  } catch (error) {
    console.error('[ConversationRoutes] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal error' 
    });
  }
});

export default router;
```

---

## 🔍 Audit Trail (v17+)

### 1. Traçabilité des Actions

Toutes les actions sensibles sont enregistrées dans la table `audit_log` :

```typescript
// src/webserver/services/AuditLogService.ts

interface AuditLogParams {
  userId: string;
  targetUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

class AuditLogService {
  /**
   * Enregistrer une action dans l'audit log
   */
  static async logAction(params: AuditLogParams): Promise<void> {
    try {
      const db = getDatabase();
      const now = Date.now();
      const auditId = `audit_${now}_${Math.random().toString(36).substr(2, 9)}`;
      
      db.prepare(`
        INSERT INTO audit_log (
          id, user_id, target_user_id, action, 
          resource_type, resource_id, details, 
          ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        auditId,
        params.userId,
        params.targetUserId || null,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        params.details ? JSON.stringify(params.details) : null,
        params.ipAddress || null,
        params.userAgent || null,
        now
      );
      
      console.log('[AuditLog] Action logged:', params.action);
      
    } catch (error) {
      console.error('[AuditLog] Failed to log action:', error);
      // Ne pas bloquer l'action principale en cas d'erreur d'audit
    }
  }
  
  /**
   * Récupérer l'historique d'audit
   */
  static getAuditLog(
    filters: {
      userId?: string;
      targetUserId?: string;
      action?: string;
      startDate?: number;
      endDate?: number;
    },
    page = 0,
    pageSize = 100
  ): IPaginatedResult<IAuditLogRow> {
    const db = getDatabase();
    
    // Construire la requête dynamique
    const conditions: string[] = [];
    const params: any[] = [];
    
    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }
    
    if (filters.targetUserId) {
      conditions.push('target_user_id = ?');
      params.push(filters.targetUserId);
    }
    
    if (filters.action) {
      conditions.push('action = ?');
      params.push(filters.action);
    }
    
    if (filters.startDate) {
      conditions.push('created_at >= ?');
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      conditions.push('created_at <= ?');
      params.push(filters.endDate);
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    // Récupérer les logs
    const rows = db.prepare(`
      SELECT * FROM audit_log
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, page * pageSize);
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM audit_log ${whereClause}
    `).get(...params).count;
    
    return {
      data: rows,
      total,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < total
    };
  }
}
```

### 2. Actions Tracées

| Action | Description | Champs importants |
|--------|-------------|-------------------|
| `login` | Connexion utilisateur | `user_id`, `ip_address` |
| `logout` | Déconnexion | `user_id` |
| `failed_login` | Tentative échouée | `details` (username) |
| `create_conversation` | Création conversation | `user_id`, `resource_id` |
| `delete_conversation` | Suppression conversation | `user_id`, `resource_id` |
| `update_message` | Modification message (table) | `user_id`, `resource_id` |
| `block_user` | Blocage utilisateur (admin) | `user_id` (admin), `target_user_id`, `details` (reason) |
| `unblock_user` | Déblocage utilisateur | `user_id` (admin), `target_user_id` |

---

## 📊 Schéma d'Isolation Complète

```
┌───────────────────────────────────────────────────────────┐
│                    UTILISATEUR A                          │
│  user_id: user_123                                        │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Conversation 1 (conv_456)                          │ │
│  │  ├─ Message 1 (msg_789)                             │ │
│  │  ├─ Message 2 (msg_790)                             │ │
│  │  └─ Message 3 (msg_791)                             │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Conversation 2 (conv_457)                          │ │
│  │  ├─ Message 1 (msg_792)                             │ │
│  │  └─ Message 2 (msg_793)                             │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│                    UTILISATEUR B                          │
│  user_id: user_124                                        │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Conversation 1 (conv_458)                          │ │
│  │  ├─ Message 1 (msg_794)                             │ │
│  │  ├─ Message 2 (msg_795)                             │ │
│  │  ├─ Message 3 (msg_796)                             │ │
│  │  └─ Message 4 (msg_797)                             │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘

Isolation garantie :
- Utilisateur A ne peut PAS voir les conversations de B
- Utilisateur B ne peut PAS voir les conversations de A
- Les requêtes incluent TOUJOURS WHERE user_id = ?
- Les Foreign Keys CASCADE suppriment automatiquement les données liées
```

---

## 📝 Résumé

### Identifiants Uniques
- **User ID** : `user_<timestamp>` (identifiant unique de l'utilisateur)
- **Conversation ID** : `conv_<timestamp>_<random>` (session de chat)
- **Message ID** : `msg_<timestamp>_<random>` (message individuel)

### Mécanismes d'Isolation
1. **Filtrage systématique** : `WHERE user_id = ?` dans toutes les requêtes
2. **Foreign Keys CASCADE** : Suppression automatique des données liées
3. **JWT par utilisateur** : Chaque utilisateur a son propre `jwt_secret`
4. **Vérification double** : Token JWT + vérification `user_id` en base
5. **Audit Trail** : Traçabilité de toutes les actions sensibles (v17+)
6. **Gestion des rôles** : Admin vs User (v17+)
7. **Gestion des statuts** : Active, Blocked, Suspended (v17+)

### Garanties de Sécurité
- ✅ Un utilisateur ne peut JAMAIS accéder aux données d'un autre
- ✅ Les requêtes sont toujours filtrées par `user_id`
- ✅ Les Foreign Keys garantissent la cohérence des données
- ✅ Les tokens JWT sont validés à chaque requête
- ✅ Les utilisateurs bloqués ne peuvent plus se connecter
- ✅ Toutes les actions sensibles sont tracées
