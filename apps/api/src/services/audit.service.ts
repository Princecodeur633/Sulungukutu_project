import { auditLogs } from '../db/schema';
import type { DB } from '../db';

interface AuditLogInput {
  schoolId:    string | null | undefined;
  actorId:     string | null | undefined;
  action:      typeof auditLogs.$inferInsert['action'];
  entityType:  string;
  entityId:    string;
  oldValue?:   Record<string, unknown>;
  newValue?:   Record<string, unknown>;
  description?: string;
}

export const auditService = {
  log: async (db: DB, input: AuditLogInput): Promise<void> => {
    // NOTE: plusieurs resolvers appellent ce service avec `user.schoolId!` alors que
    // les SUPER_ADMIN peuvent légitimement ne pas être rattachés à un établissement.
    // On ne fait plus planter silencieusement l'insertion : on le signale clairement
    // en attendant que chaque resolver soit corrigé pour dériver le bon schoolId
    // (ex: depuis l'entité modifiée plutôt que depuis le compte de l'acteur).
    if (!input.schoolId) {
      console.warn(
        `[AuditService] schoolId manquant pour l'action "${input.action}" (entityType=${input.entityType}, entityId=${input.entityId}, actorId=${input.actorId}). ` +
        `Entrée d'audit NON enregistrée — vérifier le resolver appelant.`
      );
      return;
    }
    // actorId référence school_memberships.id (NOT NULL) : un SUPER_ADMIN agissant
    // sans être rattaché à un membership d'école ne peut donc pas être représenté
    // tel quel dans le journal d'audit actuel. On le signale plutôt que de tenter
    // une insertion qui violerait la contrainte de clé étrangère.
    if (!input.actorId) {
      console.warn(
        `[AuditService] actorId manquant pour l'action "${input.action}" (entityType=${input.entityType}, entityId=${input.entityId}, schoolId=${input.schoolId}). ` +
        `Probablement un SUPER_ADMIN sans membership d'école. Entrée d'audit NON enregistrée.`
      );
      return;
    }
    try {
      await db.insert(auditLogs).values({
        schoolId:    input.schoolId,
        actorId:     input.actorId,
        action:      input.action,
        entityType:  input.entityType,
        entityId:    input.entityId,
        oldValue:    input.oldValue ?? null,
        newValue:    input.newValue ?? null,
        description: input.description ?? null,
      });
    } catch (error) {
      // L'audit ne doit jamais faire planter l'opération principale
      console.error('[AuditService] Erreur lors de l\'enregistrement:', error);
    }
  },
};
