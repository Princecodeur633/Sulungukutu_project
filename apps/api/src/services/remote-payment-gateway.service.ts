/**
 * Passerelle de paiement à distance — simulation en FCFA (XAF).
 *
 * Ce module modélise l'interface qu'un vrai fournisseur (Airtel Money,
 * MTN MoMo, une banque...) devra un jour implémenter. `SimulatedProvider`
 * est l'unique implémentation aujourd'hui ; brancher un vrai fournisseur
 * demain consiste à écrire une nouvelle classe qui respecte la même
 * interface `PaymentGatewayProvider`, sans toucher au reste de l'app.
 */
import { eq } from 'drizzle-orm';
import { paymentTransactions } from '../db/schema';
import { generateTransactionRef } from '../utils/code-generator';
import { normalizePhone } from '../utils/phone';
import { recomputePaymentAggregate } from './payment.service';
import { paymentService } from './payment.service';
import { auditService } from './audit.service';
import type { DB } from '../db';

export type RemotePaymentOutcome =
  | 'VALIDEE'
  | 'ECHOUEE_SOLDE_INSUFFISANT'
  | 'ECHOUEE_NUMERO_INVALIDE'
  | 'ECHOUEE_ERREUR_RESEAU'
  | 'ECHOUEE_DELAI_EXPIRE'
  | 'ANNULEE';

export interface PaymentGatewayProvider {
  /** Initie la transaction côté fournisseur, retourne une référence externe. */
  initiate(input: { montant: number; numeroTelephone: string }): Promise<{ providerRef: string }>;
  /** Résout (de façon asynchrone / simulée) le résultat final de la transaction. */
  resolve(input: { montant: number; numeroTelephone: string }): Promise<RemotePaymentOutcome>;
}

const INVALID_PHONE_REGEX = /^(\+?242)?0?[0-9]{8,10}$/;

/**
 * Fournisseur simulé : ne contacte aucun vrai opérateur. Le résultat est
 * déterminé par des règles simples et reproductibles pour permettre de
 * tester chaque scénario à la demande (numéro/montant "magiques").
 * Hors cas magiques, la simulation aboutit — un vrai opérateur pourra
 * remplacer cette classe sans toucher au reste de l'app.
 */
class SimulatedProvider implements PaymentGatewayProvider {
  async initiate(input: { montant: number; numeroTelephone: string }) {
    return { providerRef: `SIM-${Date.now()}` };
  }

  async resolve(input: { montant: number; numeroTelephone: string }): Promise<RemotePaymentOutcome> {
    const { montant, numeroTelephone } = input;
    const normalized = normalizePhone(numeroTelephone);

    if (!normalized || normalized.length < 8 || !INVALID_PHONE_REGEX.test(normalized)) {
      return 'ECHOUEE_NUMERO_INVALIDE';
    }
    if (normalized.endsWith('0000')) return 'ECHOUEE_ERREUR_RESEAU';
    if (normalized.endsWith('1111')) return 'ECHOUEE_DELAI_EXPIRE';
    if (normalized.endsWith('9999')) return 'ECHOUEE_SOLDE_INSUFFISANT';
    if (montant <= 0) return 'ECHOUEE_SOLDE_INSUFFISANT';

    return 'VALIDEE';
  }
}

const outcomeToFailureCode: Record<string, string | undefined> = {
  ECHOUEE_SOLDE_INSUFFISANT: 'SOLDE_INSUFFISANT',
  ECHOUEE_NUMERO_INVALIDE:   'NUMERO_INVALIDE',
  ECHOUEE_ERREUR_RESEAU:     'ERREUR_RESEAU',
  ECHOUEE_DELAI_EXPIRE:      'DELAI_EXPIRE',
};

export const remotePaymentGateway = {
  provider: new SimulatedProvider() as PaymentGatewayProvider,

  /**
   * Initie un paiement à distance : crée une transaction EN_ATTENTE, puis
   * résout immédiatement le résultat (dans une vraie intégration, ce serait
   * un webhook du fournisseur qui appellerait `resolveTransaction` plus tard).
   */
  initiateRemotePayment: async (
    db: DB,
    input: {
      studentId: string;
      mois: number;
      anneeScolaire: string;
      montant: number;
      numeroTelephone: string;
      schoolId: string;
    }
  ) => {
    const payment = await paymentService.getOrCreatePayment(
      db, input.studentId, input.mois, input.anneeScolaire
    );

    const [transaction] = await db
      .insert(paymentTransactions)
      .values({
        paymentId:       payment.id,
        studentId:       input.studentId,
        montant:         input.montant.toFixed(2),
        devise:          'XAF',
        mode:            'MOBILE_MONEY_SIMULE',
        canal:           'DISTANCE',
        statut:          'EN_ATTENTE',
        numeroTelephone: input.numeroTelephone,
        transactionRef:  generateTransactionRef(),
      })
      .returning();

    await auditService.log(db, {
      schoolId:   input.schoolId,
      actorId:    null,
      action:     'REMOTE_PAYMENT_INITIATED',
      entityType: 'payment_transaction',
      entityId:   transaction.id,
      newValue:   { montant: input.montant, numeroTelephone: input.numeroTelephone },
      description: `Paiement à distance initié : ${input.montant} XAF`,
    });

    // Résolution simulée (dans une vraie intégration : webhook différé)
    const outcome = await remotePaymentGateway.provider.resolve({
      montant: input.montant,
      numeroTelephone: input.numeroTelephone,
    });

    const resolved = await remotePaymentGateway.resolveTransaction(db, transaction.id, outcome, input.schoolId);
    return resolved;
  },

  /** Applique le résultat (venant du provider simulé ou, un jour, d'un vrai webhook). */
  resolveTransaction: async (
    db: DB,
    transactionId: string,
    outcome: RemotePaymentOutcome,
    schoolId: string
  ) => {
    const isSuccess = outcome === 'VALIDEE';
    const failureCode = outcomeToFailureCode[outcome];

    const existing = await db.query.paymentTransactions.findFirst({ where: eq(paymentTransactions.id, transactionId) });
    if (!existing) throw new Error('Transaction introuvable');

    const { generateNumeroRecu } = await import('../utils/code-generator');

    const [updated] = await db
      .update(paymentTransactions)
      .set({
        statut:     isSuccess ? 'VALIDEE' : outcome === 'ANNULEE' ? 'ANNULEE' : 'ECHOUEE',
        codeEchec:  (failureCode as any) ?? null,
        numeroRecu: isSuccess ? generateNumeroRecu(existing.createdAt.getFullYear().toString()) : null,
        updatedAt:  new Date(),
      })
      .where(eq(paymentTransactions.id, transactionId))
      .returning();

    const payment = isSuccess ? await recomputePaymentAggregate(db, updated.paymentId) : null;

    await auditService.log(db, {
      schoolId,
      actorId:    null,
      action:     'REMOTE_PAYMENT_RESOLVED',
      entityType: 'payment_transaction',
      entityId:   transactionId,
      newValue:   { statut: updated.statut, codeEchec: updated.codeEchec },
      description: `Paiement à distance résolu : ${outcome}`,
    });

    return { transaction: updated, payment };
  },
};
