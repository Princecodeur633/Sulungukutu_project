/**
 * Routes d'export — séparées de GraphQL car elles retournent des binaires
 * Montées sur /export/:type dans le serveur principal
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { parse as parseUrl } from 'url';
import { parse as parseQs }  from 'querystring';
import { db }                from '../db';
import { exportService }     from '../services/export.service';
import { generateBulletinHtml } from './pdf.routes';
import { authenticateHttpRequest, requireHttpClassInSchool, sendHttpAuthError, HttpAuthError } from '../middleware/http-auth';
import type { JWTPayload } from '../utils/jwt';
import { enforceRateLimit } from '../middleware/rate-limit';
import { bulletins, students, classes } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import * as zlib from 'zlib';

type Handler = (req: IncomingMessage, res: ServerResponse, decoded: JWTPayload) => Promise<void>;

const FE_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:3000';

function addCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', FE_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}



function sendError(res: ServerResponse, code: number, msg: string) {
  addCorsHeaders(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg }));
}

function sendFile(res: ServerResponse, buffer: Buffer, filename: string) {
  addCorsHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
    'Content-Length': buffer.length.toString(),
  });
  res.end(buffer);
}

/**
 * GET /export/students?classId=xxx&className=xxx&schoolName=xxx
 */
const exportStudents: Handler = async (req, res, decoded) => {
  const qs = parseQs(parseUrl(req.url ?? '').query ?? '');
  const classId    = String(qs.classId   ?? '');
  const className  = String(qs.className ?? 'Classe');
  const schoolName = String(qs.school    ?? 'École');

  if (!classId) return sendError(res, 400, 'classId requis');
  if (!(await assertClassInScope(res, classId, decoded))) return;

  try {
    const buffer = await exportService.exportStudentList(db as any, classId, className, schoolName);
    sendFile(res, buffer, `Eleves_${className}`);
  } catch (err: any) {
    sendError(res, 500, err.message);
  }
};

/**
 * GET /export/grades?classId=xxx&trimestre=T1&className=xxx&schoolName=xxx
 */
const exportGrades: Handler = async (req, res, decoded) => {
  const qs = parseQs(parseUrl(req.url ?? '').query ?? '');
  const classId    = String(qs.classId   ?? '');
  const trimestre  = String(qs.trimestre ?? 'T1') as 'T1' | 'T2' | 'T3';
  const className  = String(qs.className ?? 'Classe');
  const schoolName = String(qs.school    ?? 'École');

  if (!classId) return sendError(res, 400, 'classId requis');
  if (!(await assertClassInScope(res, classId, decoded))) return;

  try {
    const buffer = await exportService.exportGrades(db as any, classId, trimestre, className, schoolName);
    sendFile(res, buffer, `Notes_${className}_${trimestre}`);
  } catch (err: any) {
    sendError(res, 500, err.message);
  }
};

/**
 * GET /export/payments?classId=xxx&anneeScolaire=2024-2025&className=xxx&schoolName=xxx
 */
const exportPayments: Handler = async (req, res, decoded) => {
  const qs = parseQs(parseUrl(req.url ?? '').query ?? '');
  const classId       = String(qs.classId        ?? '');
  const anneeScolaire = String(qs.anneeScolaire   ?? '2024-2025');
  const className     = String(qs.className       ?? 'Classe');
  const schoolName    = String(qs.school          ?? 'École');

  if (!classId) return sendError(res, 400, 'classId requis');
  if (!(await assertClassInScope(res, classId, decoded))) return;

  try {
    const buffer = await exportService.exportPayments(db as any, classId, anneeScolaire, className, schoolName);
    sendFile(res, buffer, `Paiements_${className}_${anneeScolaire}`);
  } catch (err: any) {
    sendError(res, 500, err.message);
  }
};

/**
 * Vérifie que la classe demandée appartient à l'école de l'utilisateur
 * ET que l'appelant est staff (admin / enseignant / super-admin).
 */
async function assertClassInScope(res: ServerResponse, classId: string, decoded: JWTPayload): Promise<boolean> {
  try {
    await requireHttpClassInSchool(decoded, classId, true);
    return true;
  } catch (err) {
    if (err instanceof HttpAuthError) {
      sendError(res, err.status, err.message);
      return false;
    }
    sendError(res, 500, 'Erreur interne');
    return false;
  }
}

/**
 * Router principal export
 */
export function handleExport(req: IncomingMessage, res: ServerResponse): boolean {
  const url = parseUrl(req.url ?? '').pathname ?? '';

  if (!url.startsWith('/export/')) return false;

  // Gérer preflight CORS OPTIONS
  if (req.method === 'OPTIONS') {
    addCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  // Rate limiting — jusqu'ici appliqué uniquement au endpoint GraphQL
  // (via buildContext) ; ces routes HTTP brutes n'étaient couvertes par
  // AUCUNE limite, alors qu'elles génèrent des exports Excel/ZIP coûteux.
  try {
    enforceRateLimit({
      url: req.url ?? '',
      headers: { get: (h: string) => (req.headers[h.toLowerCase()] as string) ?? null },
    });
  } catch {
    sendError(res, 429, 'Trop de requêtes — réessayez dans une minute.');
    return true;
  }

  authenticateHttpRequest(req)
    .then((decoded) => {
      const route = url.replace('/export/', '');
      switch (route) {
        case 'students':      return exportStudents(req, res, decoded);
        case 'grades':        return exportGrades(req, res, decoded);
        case 'payments':      return exportPayments(req, res, decoded);
        case 'bulletins-zip': return exportBulletinsZip(req, res, decoded);
        default:
          sendError(res, 404, `Route /export/${route} introuvable`);
          return;
      }
    })
    .catch((err) => {
      if (sendHttpAuthError(res, err)) return;
      sendError(res, 500, 'Erreur interne');
    });

  return true;
}

// ── Export ZIP bulletins d'une classe ────────────────────────
async function exportBulletinsZip(
  req: IncomingMessage,
  res: ServerResponse,
  decoded: JWTPayload
): Promise<void> {
  const url   = parseUrl(req.url ?? '', true);
  const classId    = url.query.classId    as string | undefined;
  const trimestre  = url.query.trimestre  as string | undefined;
  const anneeScolaire = url.query.anneeScolaire as string | undefined;

  if (!classId || !trimestre || !anneeScolaire) {
    sendError(res, 400, 'classId, trimestre et anneeScolaire sont requis'); return;
  }

  // Avant : le token était vérifié, mais rien ne contrôlait que `classId`
  // appartenait bien à l'école de l'appelant — un admin pouvait télécharger
  // le ZIP de bulletins d'une autre école en changeant juste l'ID de classe.
  if (!(await assertClassInScope(res, classId, decoded))) return;

  try {
    // Récupérer tous les bulletins publiés de la classe pour ce trimestre
    const classStudents = await db.query.students.findMany({
      where: eq(students.classId, classId),
      columns: { id: true },
    });
    if (classStudents.length === 0) {
      sendError(res, 404, 'Aucun élève dans cette classe'); return;
    }

    const studentIds = classStudents.map((s) => s.id);
    const classBulletins = await db.query.bulletins.findMany({
      where: and(
        inArray(bulletins.studentId, studentIds),
        eq(bulletins.trimestre,     trimestre as any),
        eq(bulletins.anneeScolaire, anneeScolaire),
        eq(bulletins.statut,        'PUBLIE'),
      ),
      columns: { id: true },
    });

    if (classBulletins.length === 0) {
      sendError(res, 404, `Aucun bulletin publié pour ${trimestre} ${anneeScolaire}`); return;
    }

    // Générer chaque HTML en parallèle
    const htmlFiles = await Promise.all(
      classBulletins.map(async (b) => {
        const html = await generateBulletinHtml(b.id, decoded);
        return { id: b.id, html: html ?? '' };
      })
    );

    // Construire un ZIP valide (format ZIP local file headers)
    const zipParts: Buffer[] = [];
    const centralDir: Buffer[] = [];
    let offset = 0;

    for (const file of htmlFiles) {
      if (!file.html) continue;
      const filename  = `bulletin_${file.id.slice(0,8)}.html`;
      const content   = Buffer.from(file.html, 'utf8');
      const compressed = zlib.deflateRawSync(content);
      const crc        = crc32(content);
      const now        = dosDateTime();

      // Local file header
      const nameLen = Buffer.byteLength(filename, 'utf8');
      const local = Buffer.allocUnsafe(30 + nameLen);
      local.writeUInt32LE(0x04034b50, 0);   // signature
      local.writeUInt16LE(20, 4);            // version needed
      local.writeUInt16LE(0, 6);             // flags
      local.writeUInt16LE(8, 8);             // compression (deflate)
      local.writeUInt16LE(now.time, 10);     // mod time
      local.writeUInt16LE(now.date, 12);     // mod date
      local.writeUInt32LE(crc, 14);          // crc32
      local.writeUInt32LE(compressed.length, 18); // compressed size
      local.writeUInt32LE(content.length, 22);    // uncompressed size
      local.writeUInt16LE(nameLen, 26);      // filename length
      local.writeUInt16LE(0, 28);            // extra length
      local.write(filename, 30, 'utf8');

      zipParts.push(local, compressed);

      // Central directory entry
      const central = Buffer.allocUnsafe(46 + nameLen);
      central.writeUInt32LE(0x02014b50, 0);  // signature
      central.writeUInt16LE(20, 4);           // version made by
      central.writeUInt16LE(20, 6);           // version needed
      central.writeUInt16LE(0, 8);            // flags
      central.writeUInt16LE(8, 10);           // compression
      central.writeUInt16LE(now.time, 12);
      central.writeUInt16LE(now.date, 14);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(compressed.length, 20);
      central.writeUInt32LE(content.length, 24);
      central.writeUInt16LE(nameLen, 28);
      central.writeUInt16LE(0, 30);           // extra length
      central.writeUInt16LE(0, 32);           // comment length
      central.writeUInt16LE(0, 34);           // disk start
      central.writeUInt16LE(0, 36);           // internal attrs
      central.writeUInt32LE(0, 38);           // external attrs
      central.writeUInt32LE(offset, 42);      // local header offset
      central.write(filename, 46, 'utf8');

      centralDir.push(central);
      offset += local.length + compressed.length;
    }

    const centralBuf  = Buffer.concat(centralDir);
    const eocd        = Buffer.allocUnsafe(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(centralDir.length, 8);
    eocd.writeUInt16LE(centralDir.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    const zip = Buffer.concat([...zipParts, centralBuf, eocd]);
    const filename = `bulletins_${trimestre}_${anneeScolaire.replace('/', '-')}.zip`;

    res.writeHead(200, {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      zip.length.toString(),
    });
    res.end(zip);

  } catch (err) {
    console.error('[Export ZIP bulletins]', err);
    sendError(res, 500, 'Erreur lors de la génération du ZIP');
  }
}

function crc32(buf: Buffer): number {
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
crc32.table = null as any;

function dosDateTime() {
  const d = new Date();
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
