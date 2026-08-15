'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { AUDIT_LOGS_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { ClipboardList, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  PAYMENT_CREATED:        'Paiement créé',
  PAYMENT_UPDATED:        'Paiement mis à jour',
  PAYMENT_EXONERATED:     'Paiement exonéré',
  BULLETIN_GENERATED:     'Bulletins générés',
  BULLETIN_UPDATED:       'Bulletin modifié',
  BULLETIN_DELETED:       'Bulletin supprimé',
  BULLETIN_PUBLISHED:     'Bulletin publié',
  BULLETIN_ARCHIVED:      'Bulletin archivé',
  USER_CREATED:           'Utilisateur créé',
  USER_UPDATED:           'Utilisateur modifié',
  USER_DELETED:           'Utilisateur supprimé',
  USER_INVITED:           'Invitation envoyée',
  USER_ROLE_CHANGED:      'Rôle modifié',
  GRADE_CREATED:          'Note(s) saisie(s)',
  GRADE_UPDATED:          'Note modifiée',
  GRADE_DELETED:          'Note supprimée',
  ATTENDANCE_MARKED:      'Présences marquées',
  ATTENDANCE_UPDATED:     'Présence modifiée',
  SCHOOL_CREATED:         'École créée',
  SCHOOL_UPDATED:         'École modifiée',
  CLASS_CREATED:          'Classe créée',
  CLASS_UPDATED:          'Classe modifiée',
  CLASS_DELETED:          'Classe supprimée',
  SUBJECT_CREATED:        'Matière créée',
  SUBJECT_UPDATED:        'Matière modifiée',
  SUBJECT_DELETED:        'Matière supprimée',
  CLASS_SUBJECT_ASSIGNED: 'Matière assignée',
  CLASS_SUBJECT_UNASSIGNED:'Matière retirée',
  ANNOUNCEMENT_CREATED:   'Annonce publiée',
  ANNOUNCEMENT_DELETED:   'Annonce supprimée',
};

const ACTION_COLORS: Record<string, string> = {
  PAYMENT_UPDATED:     'badge-success',
  BULLETIN_PUBLISHED:  'badge-success',
  USER_CREATED:        'badge-info',
  GRADE_CREATED:       'badge-info',
  ATTENDANCE_MARKED:   'badge-info',
  USER_DELETED:        'badge-danger',
  BULLETIN_DELETED:    'badge-danger',
  GRADE_DELETED:       'badge-danger',
};

const ENTITY_TYPES = ['', 'student', 'grade', 'attendance', 'payment', 'bulletin', 'class', 'subject', 'announcement'];

export default function AdminAuditLogPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [page, setPage]           = useState(1);
  const [entityType, setEntityType] = useState('');

  const { data, loading } = useQuery(AUDIT_LOGS_QUERY, {
    variables: {
      filter:     { schoolId, ...(entityType ? { entityType } : {}) },
      pagination: { page, limit: 25 },
    },
    skip: !schoolId,
  });

  const logs     = data?.auditLogs?.data ?? [];
  const pageInfo = data?.auditLogs?.pageInfo;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Journal d'activité</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">
          Toutes les actions effectuées dans l'établissement · {pageInfo?.totalCount ?? 0} entrées
        </p>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex items-center gap-3">
        <Filter size={15} className="text-[var(--tx-muted)]" />
        <select
          className="input py-1.5 text-sm w-48"
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
        >
          <option value="">Toutes les entités</option>
          {ENTITY_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <span className="text-sm text-[var(--tx-muted)] ml-auto">
          Page {page} / {pageInfo?.totalPages ?? 1}
        </span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
            <ClipboardList size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Aucune activité enregistrée</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {['Horodatage', 'Action', 'Entité', 'Acteur', 'Description', 'Détail'].map((h) => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                    <td className="table-cell text-xs text-[var(--tx-muted)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${ACTION_COLORS[log.action] ?? 'badge-neutral'} text-xs`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-[var(--tx-muted)]">{log.entityType}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--info-bg)] flex items-center
                                        justify-center text-[var(--tx-primary)] text-xs font-bold flex-shrink-0">
                          {log.actor?.profile?.prenom?.[0] ?? '?'}
                        </div>
                        <span className="text-xs text-[var(--tx-secondary)]">
                          {log.actor?.profile?.prenom} {log.actor?.profile?.nom}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell text-sm text-[var(--tx-secondary)] max-w-xs truncate">
                      {log.description ?? '—'}
                    </td>
                    <td className="table-cell">
                      {(log.oldValue || log.newValue) && (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-[var(--tx-primary)] hover:text-indigo-800">
                            Voir diff
                          </summary>
                          <div className="mt-1 text-xs bg-[var(--bg-subtle)] rounded p-2 font-mono space-y-1">
                            {log.oldValue && (
                              <p className="text-[var(--err)]">
                                − {JSON.stringify(log.oldValue).substring(0, 80)}
                              </p>
                            )}
                            {log.newValue && (
                              <p className="text-[var(--ok)]">
                                + {JSON.stringify(log.newValue).substring(0, 80)}
                              </p>
                            )}
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            {pageInfo && pageInfo.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[var(--bd)] flex items-center justify-between">
                <p className="text-sm text-[var(--tx-muted)]">
                  {pageInfo.totalCount} entrées · Page {page} / {pageInfo.totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={!pageInfo.hasPreviousPage}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pageInfo.hasNextPage}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
