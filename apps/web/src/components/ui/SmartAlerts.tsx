'use client';
import React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, UserX, CreditCard, TrendingDown,
  ChevronRight, X, Bell
} from 'lucide-react';

interface Alert {
  id: string;
  type: 'absence' | 'payment' | 'grade' | 'info';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  href?: string;
  count?: number;
}

function buildAlerts(dash: any): Alert[] {
  if (!dash) return [];
  const alerts: Alert[] = [];

  // Absences répétées
  const absenceRate = dash.totalStudents > 0
    ? ((dash.absentToday ?? 0) / dash.totalStudents) * 100 : 0;
  if (absenceRate > 20) alerts.push({
    id: 'absences-high', type: 'absence', priority: 'high',
    title: `${Math.round(absenceRate)}% d'absences aujourd'hui`,
    message: `${dash.absentToday} élèves absents sur ${dash.totalStudents} — taux anormalement élevé`,
    href: '/admin/students', count: dash.absentToday,
  });

  // Impayés
  const unpaidRate = dash.totalStudents > 0
    ? ((dash.unpaidThisMonth ?? 0) / dash.totalStudents) * 100 : 0;
  if (unpaidRate > 15) alerts.push({
    id: 'payments-due', type: 'payment', priority: 'high',
    title: `${dash.unpaidThisMonth} paiements en retard`,
    message: `${Math.round(unpaidRate)}% des familles n'ont pas réglé ce mois-ci`,
    href: '/admin/payments', count: dash.unpaidThisMonth,
  });

  // Classes sans enseignants
  if (dash.totalClasses > 0 && dash.totalTeachers === 0) alerts.push({
    id: 'no-teachers', type: 'info', priority: 'medium',
    title: 'Aucun enseignant inscrit',
    message: 'Invitez des enseignants pour qu\'ils accèdent à la plateforme',
    href: '/admin/teachers',
  });

  // École sans élèves
  if (dash.totalStudents < 5 && dash.totalClasses > 0) alerts.push({
    id: 'few-students', type: 'info', priority: 'low',
    title: `Seulement ${dash.totalStudents} élève${dash.totalStudents > 1 ? 's' : ''} inscrit${dash.totalStudents > 1 ? 's' : ''}`,
    message: 'Ajoutez des élèves ou utilisez l\'import CSV pour remplir vos classes rapidement',
    href: '/admin/students',
  });

  return alerts.slice(0, 4);
}

const ALERT_STYLES = {
  absence: { icon: UserX,        bg: 'var(--err-bg)',  border: 'rgba(220,38,38,.2)',  color: 'var(--err)',  label: 'Absences' },
  payment: { icon: CreditCard,   bg: 'var(--warn-bg)', border: 'rgba(217,119,6,.2)',  color: 'var(--warn)', label: 'Paiements' },
  grade:   { icon: TrendingDown, bg: 'var(--info-bg)', border: 'rgba(37,99,235,.2)',  color: 'var(--info)', label: 'Notes' },
  info:    { icon: Bell,         bg: 'var(--bg-subtle)',border: 'var(--bd)',           color: 'var(--tx-secondary)', label: 'Info' },
};

export function SmartAlerts({ dash }: { dash: any }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const alerts = buildAlerts(dash).filter(a => !dismissed.has(a.id));

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map(alert => {
        const style = ALERT_STYLES[alert.type];
        const Icon  = style.icon;
        return (
          <div key={alert.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 10,
            background: style.bg, border: `1px solid ${style.border}`,
            animation: 'alertIn .2s ease',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: style.color + '20',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={15} style={{ color: style.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-primary)' }}>{alert.title}</p>
              <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {alert.message}
              </p>
            </div>
            {alert.href && (
              <Link href={alert.href} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 600, color: style.color, flexShrink: 0,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                Voir <ChevronRight size={12} />
              </Link>
            )}
            <button onClick={() => setDismissed(s => new Set([...s, alert.id]))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)', padding: 2, flexShrink: 0 }}>
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
