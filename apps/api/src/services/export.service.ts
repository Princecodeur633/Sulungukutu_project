/**
 * Service d'export — génère des fichiers Excel pour :
 *  - Liste des élèves d'une classe
 *  - Relevé de notes d'une classe
 *  - État des paiements
 *  - Bulletins (résumé)
 *  - Journal d'activité
 */

import ExcelJS from 'exceljs';
import { eq, and, sql } from 'drizzle-orm';
import {
  students, schoolMemberships, classes, grades,
  payments, bulletins, auditLogs, subjects, classSubjects,
} from '../db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema';

type DB = PostgresJsDatabase<typeof schema>;

// ── Styles réutilisables ─────────────────────────────────────
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3730A3' }, // indigo-700
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true, color: { argb: 'FFFFFFFF' }, size: 11,
};
const BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
};
const ALT_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill   = HEADER_FILL;
    cell.font   = HEADER_FONT;
    cell.border = BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  row.height = 28;
}

function styleDataRow(row: ExcelJS.Row, isAlt: boolean) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (isAlt) cell.fill = ALT_FILL;
    cell.border    = BORDER;
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });
  row.height = 22;
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, cols: number) {
  // Ligne titre
  ws.mergeCells(1, 1, 1, cols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value     = title;
  titleCell.font      = { bold: true, size: 14, color: { argb: 'FF1E1B4B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  ws.getRow(1).height = 36;

  // Sous-titre
  ws.mergeCells(2, 1, 2, cols);
  const subCell = ws.getCell(2, 1);
  subCell.value     = subtitle;
  subCell.font      = { italic: true, size: 10, color: { argb: 'FF64748B' } };
  subCell.alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;

  ws.addRow([]); // Ligne vide
}

// ── Export 1 : Liste des élèves ──────────────────────────────
export async function exportStudentList(
  db: DB,
  classId: string,
  className: string,
  schoolName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator     = 'sulungukutu';
  wb.lastModifiedBy = 'sulungukutu';
  wb.created     = new Date();

  const ws = wb.addWorksheet(`Liste — ${className}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  ws.columns = [
    { key: 'num',       width: 5  },
    { key: 'matricule', width: 14 },
    { key: 'nom',       width: 20 },
    { key: 'prenom',    width: 20 },
    { key: 'sexe',      width: 8  },
    { key: 'naissance', width: 14 },
    { key: 'email',     width: 28 },
    { key: 'phone',     width: 14 },
    { key: 'parent',    width: 28 },
    { key: 'tel_parent',width: 14 },
  ];

  addTitle(ws, `Liste des élèves — ${className}`, `${schoolName} · ${new Date().toLocaleDateString('fr-FR')}`, 10);

  const headerRow = ws.addRow(['N°', 'Matricule', 'Nom', 'Prénom', 'Sexe', 'Date Naiss.', 'Email', 'Téléphone', 'Parent', 'Tél. Parent']);
  styleHeaderRow(headerRow);

  const data = await db.query.students.findMany({
    where: eq(students.classId, classId),
    orderBy: (s, { asc }) => [asc(s.matricule)],
    with: {
      membership: { with: { profile: true } },
      parents: { with: { parent: { with: { profile: true } } } },
    },
  });

  data.forEach((student, idx) => {
    const p     = (student as any).membership?.profile;
    const par   = (student as any).parents?.[0]?.parent?.profile;
    const row   = ws.addRow([
      idx + 1,
      student.matricule,
      p?.nom     ?? '',
      p?.prenom  ?? '',
      student.sexe === 'M' ? 'Masculin' : student.sexe === 'F' ? 'Féminin' : '',
      student.dateNaissance ? new Date(student.dateNaissance).toLocaleDateString('fr-FR') : '',
      p?.email   ?? '',
      p?.phone   ?? '',
      par ? `${par.prenom} ${par.nom}` : '',
      par?.phone ?? '',
    ]);
    styleDataRow(row, idx % 2 === 1);
  });

  // Total
  const totalRow = ws.addRow([`Total : ${data.length} élèves`, '', '', '', '', '', '', '', '', '']);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, 10);
  totalRow.getCell(1).font = { bold: true, italic: true, color: { argb: 'FF64748B' } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Export 2 : Relevé de notes ───────────────────────────────
export async function exportGrades(
  db: DB,
  classId: string,
  trimestre: 'T1' | 'T2' | 'T3',
  className: string,
  schoolName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Notes ${trimestre} — ${className}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Récupérer les matières de la classe
  const classSubs = await db.query.classSubjects.findMany({
    where: eq(classSubjects.classId, classId),
    orderBy: (cs, { asc }) => [asc(cs.id)],
    with: { subject: true },
  });

  const subjectNames = classSubs.map((cs: any) => cs.subject?.nom ?? '?');
  const coeffs       = classSubs.map((cs: any) => Number(cs.coefficient));
  const totalCols    = 3 + subjectNames.length + 2; // N° Nom Prenom + matières + Moy + Rang

  ws.columns = [
    { key: 'num',    width: 5 },
    { key: 'nom',    width: 20 },
    { key: 'prenom', width: 18 },
    ...subjectNames.map((_, i) => ({ key: `sub${i}`, width: 12 })),
    { key: 'moy',  width: 10 },
    { key: 'rang', width: 8 },
  ];

  addTitle(ws, `Relevé de notes — ${className} — ${trimestre}`, `${schoolName} · ${new Date().toLocaleDateString('fr-FR')}`, totalCols);

  // Ligne coefficients
  const coefRow = ws.addRow(['', '', 'Coefficient', ...coeffs, '', '']);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, 3);
  coefRow.getCell(3).alignment = { horizontal: 'right' };
  coefRow.eachCell((c) => { c.font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } }; });

  // Entête
  const headerRow = ws.addRow(['N°', 'Nom', 'Prénom', ...subjectNames, 'Moyenne', 'Rang']);
  styleHeaderRow(headerRow);

  // Données élèves
  const classStudents = await db.query.students.findMany({
    where: eq(students.classId, classId),
    orderBy: (s, { asc }) => [asc(s.matricule)],
    with: { membership: { with: { profile: true } } },
  });

  // Récupérer toutes les notes du trimestre pour cette classe
  const allGrades = await db.query.grades.findMany({
    where: and(
      eq(grades.trimestre, trimestre),
      sql`${grades.classSubjectId} = ANY(${classSubs.map((cs: any) => cs.id)})`,
    ),
  });

  const rows: number[][] = [];

  classStudents.forEach((student, idx) => {
    const profile = (student as any).membership?.profile;
    const moyennes: (number | string)[] = [];
    let totalPts  = 0;
    let totalCoef = 0;

    classSubs.forEach((cs: any, ci) => {
      const studentGrades = allGrades.filter(
        (g) => g.studentId === student.id && g.classSubjectId === cs.id
      );
      if (studentGrades.length === 0) {
        moyennes.push('—');
      } else {
        const avg = studentGrades.reduce((a, g) => a + Number(g.valeur), 0) / studentGrades.length;
        moyennes.push(parseFloat(avg.toFixed(2)));
        totalPts  += avg * coeffs[ci];
        totalCoef += coeffs[ci];
      }
    });

    const moy = totalCoef > 0 ? parseFloat((totalPts / totalCoef).toFixed(2)) : null;
    rows.push([idx + 1, profile?.nom ?? '', profile?.prenom ?? '', ...moyennes as any, moy ?? '—', '—'] as any);
  });

  // Calculer les rangs
  const moysWithIdx = rows
    .map((r, i) => ({ idx: i, moy: typeof r[r.length - 2] === 'number' ? r[r.length - 2] as number : -1 }))
    .sort((a, b) => b.moy - a.moy);
  moysWithIdx.forEach((item, rank) => {
    if (item.moy >= 0) rows[item.idx][rows[item.idx].length - 1] = rank + 1;
  });

  rows.forEach((row, idx) => {
    const wsRow = ws.addRow(row);
    styleDataRow(wsRow, idx % 2 === 1);
    // Coloriser les moyennes
    row.slice(3, 3 + subjectNames.length).forEach((val, ci) => {
      if (typeof val !== 'number') return;
      const cell = wsRow.getCell(4 + ci);
      cell.font = {
        bold: true,
        color: { argb: val >= 14 ? 'FF059669' : val >= 10 ? 'FFD97706' : 'FFDC2626' },
      };
    });
    // Coloriser la moyenne générale
    const moyCell = wsRow.getCell(4 + subjectNames.length);
    if (typeof row[row.length - 2] === 'number') {
      const moy = row[row.length - 2] as number;
      moyCell.font = { bold: true, color: { argb: moy >= 14 ? 'FF059669' : moy >= 10 ? 'FFD97706' : 'FFDC2626' } };
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Export 3 : État des paiements ────────────────────────────
export async function exportPayments(
  db: DB,
  classId: string,
  anneeScolaire: string,
  className: string,
  schoolName: string
): Promise<Buffer> {
  const MOIS_LABELS = ['', 'Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai'];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Paiements — ${className}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  const totalCols = 2 + 9 + 1; // Nom + Prénom + 9 mois + Total impayés
  ws.columns = [
    { key: 'nom',    width: 20 },
    { key: 'prenom', width: 18 },
    ...Array.from({ length: 9 }, (_, i) => ({ key: `m${i+1}`, width: 8 })),
    { key: 'total', width: 14 },
  ];

  addTitle(ws, `État des paiements — ${className} — ${anneeScolaire}`, `${schoolName} · ${new Date().toLocaleDateString('fr-FR')}`, totalCols);

  const headerRow = ws.addRow(['Nom', 'Prénom', ...MOIS_LABELS.slice(1), 'Nb Impayés']);
  styleHeaderRow(headerRow);

  const classStudents = await db.query.students.findMany({
    where: eq(students.classId, classId),
    orderBy: (s, { asc }) => [asc(s.matricule)],
    with: { membership: { with: { profile: true } } },
  });

  const allPayments = await db.query.payments.findMany({
    where: and(
      eq(payments.anneeScolaire, anneeScolaire),
    ),
  });

  classStudents.forEach((student, idx) => {
    const profile = (student as any).membership?.profile;
    const studentPayments = allPayments.filter((p) => p.studentId === student.id);

    const monthStatuses = Array.from({ length: 9 }, (_, i) => {
      const p = studentPayments.find((pay) => pay.mois === i + 1);
      return p?.statut ?? 'IMPAYE';
    });

    const unpaidCount = monthStatuses.filter((s) => s === 'IMPAYE').length;

    const row = ws.addRow([
      profile?.nom    ?? '',
      profile?.prenom ?? '',
      ...monthStatuses.map((s) => s === 'PAYE' ? '✓' : s === 'EXONERE' ? 'Exo' : '✗'),
      unpaidCount > 0 ? unpaidCount : '—',
    ]);
    styleDataRow(row, idx % 2 === 1);

    // Coloriser chaque mois
    monthStatuses.forEach((statut, mi) => {
      const cell = row.getCell(3 + mi);
      cell.alignment = { horizontal: 'center' };
      cell.font = {
        bold: true,
        color: {
          argb: statut === 'PAYE'    ? 'FF059669' :
                statut === 'EXONERE' ? 'FFD97706' : 'FFDC2626',
        },
      };
    });

    // Total
    const totalCell = row.getCell(12);
    if (unpaidCount > 0) {
      totalCell.font      = { bold: true, color: { argb: 'FFDC2626' } };
      totalCell.alignment = { horizontal: 'center' };
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── REST endpoint helper ─────────────────────────────────────
export const exportService = {
  exportStudentList,
  exportGrades,
  exportPayments,
};

