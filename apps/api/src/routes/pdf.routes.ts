/**
 * Routes PDF bulletins — retourne HTML print-ready
 * GET /pdf/bulletin/:id?token=xxx
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { parse as parseUrl } from 'url';
import { db } from '../db';
import { eq, count } from 'drizzle-orm';
import { bulletins, bulletinDetails, classSubjects, subjects, students,
         schoolMemberships, globalProfiles, classes, levels, schools, payments } from '../db/schema';
import { verifyAccessToken } from '../utils/jwt';

export function handlePdfRoute(req: IncomingMessage, res: ServerResponse): boolean {
  const url = parseUrl(req.url ?? '', true);
  if (!url.pathname?.startsWith('/pdf/')) return false;

  // ── Route reçu paiement ──────────────────────────────────────
  const recuMatch = url.pathname.match(/^\/pdf\/recu\/([^/]+)$/);
  if (recuMatch) {
    const paymentId = recuMatch[1];
    const token = url.query.token as string | undefined;
    if (!token) { res.writeHead(401); res.end('Token requis'); return true; }
    let decoded: any;
    try { decoded = verifyAccessToken(token); } catch {
      res.writeHead(401); res.end('Token invalide'); return true;
    }
    generateRecuHtml(paymentId, decoded)
      .then((html) => {
        if (!html) { res.writeHead(404); res.end('Paiement introuvable'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=300' });
        res.end(html);
      })
      .catch((err) => { console.error('[PDF recu]', err); res.writeHead(500); res.end('Erreur interne'); });
    return true;
  }

  const match = url.pathname.match(/^\/pdf\/bulletin\/([^/]+)$/);
  if (!match) return false;

  const bulletinId = match[1];
  const token = url.query.token as string | undefined;

  // Vérifier l'authentification
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Token requis');
    return true;
  }

  let decoded: any;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Token invalide');
    return true;
  }

  generateBulletinHtml(bulletinId, decoded)
    .then((html) => {
      if (!html) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Bulletin introuvable');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      });
      res.end(html);
    })
    .catch((err) => {
      console.error('[PDF] Erreur:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Erreur interne');
    });

  return true;
}

// ── Génération HTML ───────────────────────────────────────────

export async function generateBulletinHtml(bulletinId: string, decoded: any): Promise<string | null> {
  // Charger bulletin + détails + relations
  const bulletin = await db.query.bulletins.findFirst({
    where: eq(bulletins.id, bulletinId),
    with: {
      student: {
        with: {
          membership: { with: { profile: true } },
          class: { with: { level: true } },
          attendances: true,
        },
      },
      details: {
        with: {
          classSubject: {
            with: {
              subject: true,
              teacher: { with: { profile: true } },
            },
          },
        },
        orderBy: (d, { desc }) => [desc(d.moyenneMatiere)],
      },
    },
  });

  if (!bulletin) return null;

  // Nombre d'élèves dans la classe pour le rang
  const studentId = (bulletin as any).student?.id;
  const classId   = (bulletin as any).student?.class?.id;
  let classTotalStudents = 0;
  if (classId) {
    const [{ count: cnt }] = await db.select({ count: count() }).from(students).where(eq(students.classId, classId));
    classTotalStudents = Number(cnt);
  }

  // Absences du trimestre (filtrées par trimestre via dates approximatives)
  const allAttendances = (bulletin as any).student?.attendances ?? [];
  const absencesCount  = allAttendances.filter((a: any) => a.statut === 'ABSENT').length;
  const retardsCount   = allAttendances.filter((a: any) => a.statut === 'RETARD').length;

  const student  = (bulletin as any).student;
  const profile  = student?.membership?.profile;
  const cls      = student?.class;
  const lvl      = cls?.level;

  // Charger l'école via le bulletin
  let schoolName  = 'sulungukutu';
  let schoolColor = '#1a1a2e';

  if (student?.membership?.schoolId) {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, student.membership.schoolId),
    });
    if (school) {
      schoolName  = school.nom;
      schoolColor = (school as any).accentColor ?? '#1a1a2e';
    }
  }

  const details = (bulletin as any).details ?? [];
  const total   = details.reduce((s: number, d: any) => s + Number(d.coefficient), 0);

  const mentionLabel: Record<string, string> = {
    EXCELLENT:    'Excellent',
    TRES_BIEN:    'Très Bien',
    BIEN:         'Bien',
    ASSEZ_BIEN:   'Assez Bien',
    PASSABLE:     'Passable',
    INSUFFISANT:  'Insuffisant',
  };

  const mentionColor: Record<string, string> = {
    EXCELLENT:    '#16a34a',
    TRES_BIEN:    '#2563eb',
    BIEN:         '#0891b2',
    ASSEZ_BIEN:   '#d97706',
    PASSABLE:     '#ea580c',
    INSUFFISANT:  '#dc2626',
  };

  const moy   = Number(bulletin.moyenneGenerale ?? 0).toFixed(2);
  const mc    = mentionColor[bulletin.mention ?? ''] ?? '#6b7280';
  const ml    = mentionLabel[bulletin.mention ?? ''] ?? '—';
  const tri   = bulletin.trimestre === 'T1' ? '1er Trimestre'
              : bulletin.trimestre === 'T2' ? '2ème Trimestre'
              : '3ème Trimestre';

  const detailRows = details.map((d: any) => {
    const m    = Number(d.moyenneMatiere ?? 0);
    const bg   = m >= 14 ? '#f0fdf4' : m >= 10 ? '#eff6ff' : '#fff7ed';
    const col  = m >= 14 ? '#15803d' : m >= 10 ? '#1d4ed8' : '#c2410c';
    const barW = Math.round((m / 20) * 100);
    const barCol = m >= 14 ? '#16a34a' : m >= 10 ? '#2563eb' : '#dc2626';
    const prof = d.classSubject?.teacher?.profile;
    const nom  = d.classSubject?.subject?.nom ?? '—';
    const coef = Number(d.coefficient ?? 1).toFixed(0);
    const pts  = Number(d.pointsObtenus ?? 0).toFixed(2);
    const app  = d.appreciation ?? '—';
    return `
    <tr>
      <td class="td-left">
        <strong>${nom}</strong>
        ${prof ? `<div class="prof">Prof. ${prof.prenom} ${prof.nom}</div>` : ''}
        <div class="bar-wrap"><div class="bar-fill" style="width:${barW}%;background:${barCol}"></div></div>
      </td>
      <td class="td-center">${coef}</td>
      <td class="td-center" style="background:${bg};color:${col};font-weight:700">
        ${m.toFixed(2)}<span class="sur20">/20</span>
      </td>
      <td class="td-center">${pts}</td>
      <td class="td-left italic">${app}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bulletin — ${profile?.prenom ?? ''} ${profile?.nom ?? ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    background: #fff;
  }

  @page { size: A4; margin: 12mm 14mm; }

  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* ── Print button ── */
  .print-btn {
    position: fixed; top: 16px; right: 16px; z-index: 999;
    background: ${schoolColor}; color: #fff;
    border: none; border-radius: 8px;
    padding: 10px 22px; font-size: 13px;
    cursor: pointer; font-weight: 600;
    box-shadow: 0 2px 8px rgba(0,0,0,.25);
  }
  .print-btn:hover { opacity: .9; }

  .page {
    max-width: 794px;
    margin: 0 auto;
    padding: 16px;
    background: #fff;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid ${schoolColor};
    padding-bottom: 10px;
    margin-bottom: 12px;
  }
  .school-name {
    font-size: 20px;
    font-weight: 800;
    color: ${schoolColor};
    letter-spacing: -.3px;
  }
  .school-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .bulletin-title {
    text-align: right;
  }
  .bulletin-title h2 {
    font-size: 15px;
    font-weight: 700;
    color: ${schoolColor};
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .bulletin-title p { font-size: 10px; color: #6b7280; margin-top: 2px; }

  /* ── Info élève ── */
  .student-card {
    display: flex;
    gap: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
  }
  .avatar {
    width: 52px; height: 52px;
    border-radius: 50%;
    background: ${schoolColor};
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800;
    flex-shrink: 0;
  }
  .student-info { flex: 1; }
  .student-name { font-size: 15px; font-weight: 700; }
  .student-meta { display: flex; gap: 18px; margin-top: 4px; flex-wrap: wrap; }
  .meta-item { font-size: 10px; color: #4b5563; }
  .meta-label { font-weight: 600; color: #6b7280; }

  /* ── Résumé ── */
  .summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .sum-card {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    text-align: center;
  }
  .sum-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .4px; font-weight: 600; }
  .sum-value { font-size: 22px; font-weight: 800; line-height: 1.2; margin-top: 2px; }
  .sum-sub { font-size: 9px; color: #9ca3af; }

  /* ── Table des matières ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
  }
  thead tr {
    background: ${schoolColor};
    color: #fff;
  }
  thead th {
    padding: 7px 8px;
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .3px;
    text-transform: uppercase;
  }
  thead th:first-child { text-align: left; padding-left: 10px; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody tr:hover { background: #eff6ff; }
  .td-left { padding: 7px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  .td-center { padding: 7px 8px; text-align: center; border-bottom: 1px solid #e5e7eb; }
  .prof { font-size: 9px; color: #9ca3af; font-weight: 400; margin-top: 1px; }
  .sur20 { font-size: 9px; color: #9ca3af; font-weight: 400; }
  .italic { font-style: italic; color: #6b7280; font-size: 10px; }
  .bar-wrap { height: 3px; background: #e5e7eb; border-radius: 99px; margin-top: 4px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 99px; }
  tfoot td { padding: 7px 8px; font-weight: 700; background: #f1f5f9; border-top: 2px solid ${schoolColor}; }
  tfoot .td-left { padding-left: 10px; }

  /* ── Appréciation générale ── */
  .appreciation-box {
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 14px;
  }
  .appreciation-title { font-size: 10px; font-weight: 700; color: #374151; margin-bottom: 4px; }
  .appreciation-line { height: 18px; border-bottom: 1px solid #e5e7eb; margin-bottom: 4px; }

  /* ── Signatures ── */
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 16px;
  }
  .sig-box {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px;
    text-align: center;
  }
  .sig-title { font-size: 10px; font-weight: 700; color: #374151; margin-bottom: 30px; }
  .sig-line { border-top: 1px solid #9ca3af; margin: 0 10px; }
  .sig-label { font-size: 9px; color: #9ca3af; margin-top: 4px; }

  /* ── Footer ── */
  .footer {
    margin-top: 16px;
    text-align: center;
    font-size: 9px;
    color: #9ca3af;
    border-top: 1px solid #e5e7eb;
    padding-top: 8px;
  }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨 Imprimer / Sauver PDF</button>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="school-name">${schoolName}</div>
      <div class="school-sub">Année scolaire ${bulletin.anneeScolaire ?? '—'}</div>
    </div>
    <div class="bulletin-title">
      <h2>Bulletin Scolaire</h2>
      <p>${tri}</p>
      <p style="margin-top:4px;font-weight:600;color:${schoolColor}">
        ${bulletin.statut === 'PUBLIE' ? '✓ Officiel' : '⚠ Provisoire'}
      </p>
    </div>
  </div>

  <!-- Info élève -->
  <div class="student-card">
    <div class="avatar">${(profile?.prenom?.[0] ?? '?').toUpperCase()}${(profile?.nom?.[0] ?? '').toUpperCase()}</div>
    <div class="student-info">
      <div class="student-name">${profile?.prenom ?? ''} ${(profile?.nom ?? '').toUpperCase()}</div>
      <div class="student-meta">
        <span class="meta-item"><span class="meta-label">Matricule : </span>${student?.matricule ?? '—'}</span>
        <span class="meta-item"><span class="meta-label">Classe : </span>${cls?.nom ?? '—'} (${lvl?.nom ?? '—'})</span>
        ${profile?.email ? `<span class="meta-item"><span class="meta-label">Email : </span>${profile.email}</span>` : ''}
      </div>
    </div>
  </div>

  <!-- Résumé -->
  <div class="summary">
    <div class="sum-card" style="border-top:3px solid ${mc}">
      <div class="sum-label">Moyenne Générale</div>
      <div class="sum-value" style="color:${mc}">${moy}</div>
      <div class="sum-sub">sur 20</div>
    </div>
    <div class="sum-card" style="border-top:3px solid ${mc}">
      <div class="sum-label">Mention</div>
      <div class="sum-value" style="font-size:13px;color:${mc}">${ml}</div>
      <div class="sum-sub">&nbsp;</div>
    </div>
    <div class="sum-card" style="border-top:3px solid ${schoolColor}">
      <div class="sum-label">Classement</div>
      <div class="sum-value" style="color:${schoolColor}">${bulletin.rang ?? '—'}<span style="font-size:11px;font-weight:400;color:#9ca3af">/${classTotalStudents || '?'}</span></div>
      <div class="sum-sub">dans la classe</div>
    </div>
    <div class="sum-card" style="border-top:3px solid ${absencesCount > 5 ? '#dc2626' : '#6b7280'}">
      <div class="sum-label">Absences</div>
      <div class="sum-value" style="color:${absencesCount > 5 ? '#dc2626' : '#374151'}">${absencesCount}</div>
      <div class="sum-sub">${retardsCount > 0 ? retardsCount + ' retard(s)' : 'aucun retard'}</div>
    </div>
  </div>

  <!-- Table des matières -->
  <table>
    <thead>
      <tr>
        <th style="width:30%;text-align:left;padding-left:10px">Matière</th>
        <th style="width:8%">Coef.</th>
        <th style="width:12%">Moyenne</th>
        <th style="width:12%">Points</th>
        <th>Appréciation du professeur</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows || '<tr><td colspan="5" class="td-center" style="color:#9ca3af;padding:16px">Aucune matière évaluée</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td class="td-left">TOTAL / MOYENNE GÉNÉRALE</td>
        <td class="td-center">${total}</td>
        <td class="td-center" style="font-size:14px;color:${mc}">${moy}/20</td>
        <td class="td-center">${details.reduce((s: number, d: any) => s + Number(d.pointsObtenus ?? 0), 0).toFixed(2)}</td>
        <td class="td-left" style="color:${mc};font-style:italic">${ml}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Appréciation générale -->
  <div class="appreciation-box">
    <div class="appreciation-title">Appréciation générale du conseil de classe :</div>
    <div class="appreciation-line"></div>
    <div class="appreciation-line"></div>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-title">Le Directeur</div>
      <div class="sig-line"></div>
      <div class="sig-label">Signature & Cachet</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Le Professeur Principal</div>
      <div class="sig-line"></div>
      <div class="sig-label">Signature</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Le Parent / Tuteur</div>
      <div class="sig-line"></div>
      <div class="sig-label">Lu et approuvé</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    Document généré par sulungukutu — ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    &nbsp;|&nbsp; ${schoolName} &nbsp;|&nbsp; ${tri} ${bulletin.anneeScolaire ?? ''}
  </div>

</div>
</body>
</html>`;
}

// ── Génération HTML reçu de paiement ─────────────────────────
async function generateRecuHtml(paymentId: string, _decoded: any): Promise<string | null> {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      student: {
        with: {
          membership: { with: { profile: true } },
          class:      { with: { level: true } },
        },
      },
    },
  });
  if (!payment) return null;

  const student  = (payment as any).student;
  const profile  = student?.membership?.profile;
  const cls      = student?.class;

  // École
  let schoolName  = 'sulungukutu';
  let schoolColor = '#6366f1';
  let schoolAddr  = '';
  let schoolTel   = '';
  if (student?.membership?.schoolId) {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, student.membership.schoolId),
    });
    if (school) {
      schoolName  = school.nom;
      schoolColor = (school as any).accentColor ?? '#6366f1';
      schoolAddr  = school.adresse ?? '';
      schoolTel   = school.telephone ?? '';
    }
  }

  const MOIS_SCOLAIRES: Record<number,string> = {
    1:'Septembre', 2:'Octobre', 3:'Novembre', 4:'Décembre',
    5:'Janvier',   6:'Février', 7:'Mars',     8:'Avril', 9:'Mai',
  };
  const moisLabel = MOIS_SCOLAIRES[payment.mois] ?? `Mois ${payment.mois}`;

  const statutLabel: Record<string,string> = {
    PAYE:'Payé', IMPAYE:'Impayé', EN_ATTENTE:'En attente', EXONERE:'Exonéré',
  };
  const statutColor: Record<string,string> = {
    PAYE:'#16a34a', IMPAYE:'#dc2626', EN_ATTENTE:'#d97706', EXONERE:'#6b7280',
  };
  const statut = payment.statut as string;
  const datePaiement = payment.datePaiement
    ? new Date(payment.datePaiement).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
    : '—';
  const recuNum = `REC-${payment.id.slice(0,8).toUpperCase()}`;
  const dateGen = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reçu de paiement — ${recuNum}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#f8fafc; color:#1e293b; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { max-width:680px; margin:0 auto; background:#fff; min-height:100vh; }
  @media print { body { background:#fff; } .page { box-shadow:none; } .no-print { display:none; } }

  /* Header */
  .header { background:${schoolColor}; color:#fff; padding:36px 40px 28px; position:relative; overflow:hidden; }
  .header::after { content:''; position:absolute; top:-40px; right:-40px; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,.08); }
  .header::before { content:''; position:absolute; bottom:-60px; right:60px; width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,.05); }
  .school-name { font-size:22px; font-weight:900; letter-spacing:-.03em; }
  .school-meta { font-size:12px; opacity:.75; margin-top:4px; }
  .recu-badge { margin-top:20px; display:inline-block; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.3); border-radius:8px; padding:6px 14px; font-size:13px; font-weight:700; letter-spacing:.05em; }

  /* Body */
  .body { padding:36px 40px; }

  /* Statut banner */
  .statut-banner { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-radius:12px; margin-bottom:32px; background:${(statusColor => statusColor + '14')(statutColor[statut] ?? '#6366f1')}; border:1.5px solid ${(statusColor => statusColor + '30')(statutColor[statut] ?? '#6366f1')}; }
  .statut-text { font-size:15px; font-weight:800; color:${statutColor[statut] ?? '#6366f1'}; }
  .statut-dot { width:10px; height:10px; border-radius:50%; background:${statutColor[statut] ?? '#6366f1'}; margin-right:10px; }

  /* Info grid */
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:28px; }
  .info-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 18px; }
  .info-label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
  .info-value { font-size:14px; font-weight:700; color:#1e293b; }

  /* Details table */
  .details-table { width:100%; border-collapse:collapse; margin-bottom:28px; }
  .details-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; border-bottom:2px solid #e2e8f0; }
  .details-table td { padding:14px; font-size:13px; color:#374151; border-bottom:1px solid #f1f5f9; }
  .details-table tr:last-child td { border-bottom:none; }
  .details-table .highlight { font-weight:700; color:#1e293b; }

  /* Signature */
  .sig-row { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:40px; }
  .sig-box { text-align:center; }
  .sig-label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; margin-bottom:16px; }
  .sig-line { height:1px; background:#cbd5e1; margin:32px 0 8px; }
  .sig-sub { font-size:11px; color:#94a3b8; }

  /* Footer */
  .footer { border-top:1px solid #e2e8f0; margin-top:40px; padding:20px 40px; text-align:center; font-size:11px; color:#94a3b8; }

  /* Print button */
  .no-print { text-align:center; padding:16px; background:#f8fafc; border-top:1px solid #e2e8f0; }
  .print-btn { background:${schoolColor}; color:#fff; border:none; border-radius:8px; padding:10px 24px; font-size:13px; font-weight:700; cursor:pointer; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="school-name">${schoolName}</div>
    <div class="school-meta">${schoolAddr}${schoolAddr && schoolTel ? ' · ' : ''}${schoolTel}</div>
    <div class="recu-badge">REÇU N° ${recuNum}</div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Statut -->
    <div class="statut-banner">
      <div style="display:flex;align-items:center;">
        <div class="statut-dot"></div>
        <span class="statut-text">${statutLabel[statut] ?? statut}</span>
      </div>
      <span style="font-size:12px;color:#64748b;font-weight:600;">${datePaiement !== '—' ? `Payé le ${datePaiement}` : 'Non payé'}</span>
    </div>

    <!-- Infos grille -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Élève</div>
        <div class="info-value">${profile?.prenom ?? ''} ${profile?.nom ?? ''}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Classe</div>
        <div class="info-value">${cls?.nom ?? '—'}${cls?.level?.nom ? ` · ${cls.level.nom}` : ''}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Période</div>
        <div class="info-value">${moisLabel} ${payment.anneeScolaire}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Année scolaire</div>
        <div class="info-value">${payment.anneeScolaire}</div>
      </div>
    </div>

    <!-- Tableau détails -->
    <table class="details-table">
      <thead>
        <tr>
          <th>Désignation</th>
          <th>Période</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="highlight">Frais de scolarité</td>
          <td>${moisLabel} ${payment.anneeScolaire}</td>
          <td style="color:${statutColor[statut] ?? '#6366f1'};font-weight:700;">${statutLabel[statut] ?? statut}</td>
        </tr>
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="sig-row">
      <div class="sig-box">
        <div class="sig-label">Signature du caissier</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Cachet de l'établissement</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Signature du parent</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Lu et approuvé</div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    Reçu généré le ${dateGen} · ${schoolName} · sulungukutu
  </div>

  <!-- Print button (hidden on print) -->
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button>
  </div>

</div>
</body>
</html>`;
}

