/**
 * Service Email — sulungukutu
 *
 * 2 modes:
 *  - SMTP configuré → envoie réellement (via nodemailer)
 *  - SMTP absent → mode DEV: sauvegarde dans data/mail-log.json + console
 *
 * Variables d'env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import nodemailer, { Transporter } from 'nodemailer';
import fs from 'fs';
import path from 'path';

// ── Chemin du fichier log mail ──────────────────────────────────
const MAIL_LOG_DIR  = path.join(process.cwd(), 'data');
const MAIL_LOG_FILE = path.join(MAIL_LOG_DIR, 'mail-log.json');

function ensureLogDir() {
  if (!fs.existsSync(MAIL_LOG_DIR)) fs.mkdirSync(MAIL_LOG_DIR, { recursive: true });
}

function appendMailLog(entry: {
  to: string; subject: string; html: string;
  sentAt: string; type: string; credentials?: Record<string, string>;
}) {
  ensureLogDir();
  let logs: any[] = [];
  try {
    if (fs.existsSync(MAIL_LOG_FILE)) {
      logs = JSON.parse(fs.readFileSync(MAIL_LOG_FILE, 'utf-8'));
    }
  } catch {}
  logs.unshift(entry); // plus récent en premier
  if (logs.length > 500) logs = logs.slice(0, 500); // limite
  fs.writeFileSync(MAIL_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

// ── Configuration SMTP ─────────────────────────────────────────
const isConfigured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

let transporter: Transporter | null = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log(`📧 Email: SMTP configuré (${process.env.SMTP_HOST})`);
} else {
  console.log(`📧 Email: mode DEV — logs dans data/mail-log.json`);
}

const FROM    = process.env.SMTP_FROM    ?? '"sulungukutu" <noreply@sulungukutu.local>';
const APP_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

// ── Template HTML de base ──────────────────────────────────────
function baseLayout(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 28px 36px; }
    .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.02em; }
    .header p  { color: rgba(255,255,255,0.75); margin: 4px 0 0; font-size: 13px; }
    .body      { padding: 28px 36px; color: #334155; line-height: 1.6; }
    .body h2   { color: #1e293b; font-size: 17px; margin: 0 0 12px; }
    .body p    { margin: 0 0 14px; font-size: 14px; }
    .highlight { background: #f0f9ff; border-left: 4px solid #4f46e5; border-radius: 4px; padding: 12px 16px; margin: 16px 0; }
    .cred-box  { background: #1e293b; color: #e2e8f0; border-radius: 10px; padding: 16px 20px; margin: 16px 0; font-family: monospace; }
    .cred-box .label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .cred-box .value { color: #f1f5f9; font-size: 16px; font-weight: 700; margin: 2px 0 12px; }
    .btn  { display: inline-block; background: #4f46e5; color: white !important; padding: 11px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 12px 0; }
    .footer { background: #f8fafc; padding: 16px 36px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
    .badge { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-ok  { background: #f0fdf4; color: #16a34a; }
    .badge-err { background: #fef2f2; color: #dc2626; }
    .badge-warn { background: #fffbeb; color: #d97706; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #f8fafc; padding: 8px 12px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 sulungukutu</h1>
      <p>${title}</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">sulungukutu • Gestion scolaire intelligente<br/>Cet email est automatique, ne pas répondre.</div>
  </div>
</body>
</html>`;
}

// ── Envoi générique ────────────────────────────────────────────
async function send(options: {
  to: string; subject: string; html: string;
  type?: string; credentials?: Record<string, string>;
}): Promise<boolean> {
  const logEntry = {
    to:          options.to,
    subject:     options.subject,
    html:        options.html,
    type:        options.type ?? 'generic',
    credentials: options.credentials,
    sentAt:      new Date().toISOString(),
  };

  if (!transporter) {
    // Mode DEV: sauvegarde dans fichier JSON
    appendMailLog(logEntry);
    console.log(`\n📧 [EMAIL DEV] → ${options.to}`);
    console.log(`   Sujet  : ${options.subject}`);
    if (options.credentials) {
      console.log(`   ┌─ Credentials ─────────────────────────`);
      for (const [k, v] of Object.entries(options.credentials)) {
        console.log(`   │  ${k.padEnd(12)}: ${v}`);
      }
      console.log(`   └───────────────────────────────────────`);
    }
    console.log(`   📁 Sauvegardé dans: data/mail-log.json\n`);
    return true;
  }

  try {
    await transporter.sendMail({
      from:    FROM,
      to:      options.to,
      subject: options.subject,
      html:    options.html,
    });
    // Loguer aussi les vrais envois (sans HTML)
    appendMailLog({ ...logEntry, html: '[HTML omis - email réel envoyé]' });
    return true;
  } catch (err: any) {
    console.error('📧 Erreur envoi email:', err.message);
    // Fallback: sauvegarder quand même
    appendMailLog({ ...logEntry, type: logEntry.type + ':FAILED' });
    return false;
  }
}

// ── Template: Invitation utilisateur ──────────────────────────
export async function sendInvitation(params: {
  to: string; prenom: string; nom: string;
  role: string; schoolName: string;
  tempPassword: string; loginUrl?: string;
}): Promise<boolean> {
  const roleLabels: Record<string, string> = {
    ADMIN:   'Administrateur',
    TEACHER: 'Enseignant',
    PARENT:  'Parent',
    STUDENT: 'Élève',
  };
  const roleLabel = roleLabels[params.role] ?? params.role;
  const url = params.loginUrl ?? `${APP_URL}/login`;

  const html = baseLayout(`
    <h2>Bienvenue sur sulungukutu !</h2>
    <p>Bonjour <strong>${params.prenom} ${params.nom}</strong>,</p>
    <p>Vous avez été invité(e) en tant que <strong>${roleLabel}</strong> dans l'établissement <strong>${params.schoolName}</strong>.</p>
    <div class="cred-box">
      <div class="label">Email de connexion</div>
      <div class="value">${params.to}</div>
      <div class="label">Mot de passe temporaire</div>
      <div class="value">${params.tempPassword}</div>
    </div>
    <p><strong>Important :</strong> Changez votre mot de passe dès votre première connexion.</p>
    <a href="${url}" class="btn">Se connecter maintenant →</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">Si vous n'attendiez pas cet email, ignorez-le.</p>
  `, `Invitation — ${params.schoolName}`);

  return send({
    to:      params.to,
    subject: `[${params.schoolName}] Votre accès sulungukutu — ${roleLabel}`,
    html,
    type: 'invitation',
    credentials: { email: params.to, 'mot de passe': params.tempPassword, rôle: roleLabel },
  });
}

// ── Template: Réinitialisation mot de passe ────────────────────
export async function sendPasswordReset(params: {
  to: string; prenom: string; token?: string; newPassword?: string;
}): Promise<boolean> {
  let bodyHtml: string;
  let creds: Record<string, string>;

  if (params.newPassword) {
    // Mode direct : nouveau mot de passe généré
    bodyHtml = `
    <h2>Nouveau mot de passe</h2>
    <p>Bonjour <strong>${params.prenom}</strong>,</p>
    <p>Votre mot de passe sulungukutu a été réinitialisé. Voici vos nouveaux identifiants :</p>
    <div class="cred-box">
      <div class="label">Email</div>
      <div class="value">${params.to}</div>
      <div class="label">Nouveau mot de passe</div>
      <div class="value">${params.newPassword}</div>
    </div>
    <p><strong>Important :</strong> Changez ce mot de passe après votre prochaine connexion.</p>
    <a href="${APP_URL}/login" class="btn">Se connecter →</a>
    `;
    creds = { email: params.to, 'nouveau mot de passe': params.newPassword };
  } else {
    const url = `${APP_URL}/reset-password?token=${params.token}`;
    bodyHtml = `
    <h2>Réinitialisation de mot de passe</h2>
    <p>Bonjour <strong>${params.prenom}</strong>,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe sulungukutu.</p>
    <div class="highlight">
      <p style="margin:0">Ce lien expire dans <strong>24 heures</strong>.</p>
    </div>
    <a href="${url}" class="btn">Réinitialiser mon mot de passe →</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">
      Si vous n'avez pas fait cette demande, ignorez cet email.
    </p>
    `;
    creds = { email: params.to, 'lien reset': url };
  }

  const html = baseLayout(bodyHtml, 'Réinitialisation de mot de passe');

  return send({
    to:          params.to,
    subject:     'sulungukutu — Réinitialisation de votre mot de passe',
    html,
    type:        'password-reset',
    credentials: creds,
  });
}

// ── Template: Bulletin publié ──────────────────────────────────
export async function sendBulletinNotification(params: {
  to: string; parentPrenom: string; studentPrenom: string;
  trimestre: string; anneeScolaire: string; schoolName: string;
  moyenne: string; mention: string;
}): Promise<boolean> {
  const url = `${APP_URL}/parent/dashboard`;

  const mentionColor =
    parseFloat(params.moyenne) >= 14 ? 'badge-ok' :
    parseFloat(params.moyenne) >= 10 ? 'badge-warn' : 'badge-err';

  const html = baseLayout(`
    <h2>Bulletin disponible</h2>
    <p>Bonjour <strong>${params.parentPrenom}</strong>,</p>
    <p>Le bulletin de <strong>${params.studentPrenom}</strong> pour le <strong>${params.trimestre}</strong> (${params.anneeScolaire}) est maintenant disponible.</p>
    <div class="highlight">
      <p style="margin:0 0 8px">Moyenne générale :
        <span class="badge ${mentionColor}" style="font-size:16px;padding:4px 12px">${params.moyenne}/20</span>
      </p>
      <p style="margin:0">Mention : <strong>${params.mention}</strong></p>
    </div>
    <a href="${url}" class="btn">Consulter le bulletin →</a>
  `, `Bulletin ${params.trimestre} — ${params.schoolName}`);

  return send({
    to:      params.to,
    subject: `[${params.schoolName}] Bulletin ${params.trimestre} de ${params.studentPrenom} disponible`,
    html,
    type: 'bulletin',
  });
}

// ── Template: Rappel de paiement ──────────────────────────────
export async function sendBulletinGenerationReminder(params: {
  to: string; adminPrenom: string; schoolName: string;
  trimestre: string; anneeScolaire: string; pendingCount: number;
}): Promise<boolean> {
  const url = `${APP_URL}/admin/bulletins`;
  const html = baseLayout(`
    <h2>Rappel : Bulletins a generer</h2>
    <p>Bonjour <strong>${params.adminPrenom}</strong>,</p>
    <p>La fin du <strong>${params.trimestre}</strong> approche pour l'annee scolaire <strong>${params.anneeScolaire}</strong>.</p>
    <div class="highlight">
      <p style="margin:0"><strong>${params.pendingCount}</strong> eleve(s) n'ont pas encore de bulletin pour ce trimestre.</p>
    </div>
    <a href="${url}" class="btn">Generer les bulletins</a>
  `, `Rappel bulletins ${params.trimestre} — ${params.schoolName}`);
  return send({
    to: params.to,
    subject: `[${params.schoolName}] Rappel : ${params.pendingCount} bulletin(s) a generer — ${params.trimestre}`,
    html, type: "bulletin",
  });
}

export async function sendPaymentReminder(params: {
  to: string; parentPrenom: string; studentPrenom: string;
  moisLabel: string; schoolName: string;
}): Promise<boolean> {
  const url = `${APP_URL}/parent/dashboard`;

  const html = baseLayout(`
    <h2>Rappel de paiement</h2>
    <p>Bonjour <strong>${params.parentPrenom}</strong>,</p>
    <p>Nous vous rappelons que la mensualité du mois de <strong>${params.moisLabel}</strong> pour l'élève <strong>${params.studentPrenom}</strong> est en attente de règlement.</p>
    <a href="${url}" class="btn">Voir les paiements →</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">
      Si vous avez déjà effectué ce paiement, ignorez ce message.
    </p>
  `, `Rappel paiement — ${params.schoolName}`);

  return send({
    to:      params.to,
    subject: `[${params.schoolName}] Rappel paiement — ${params.moisLabel}`,
    html,
    type: 'payment-reminder',
  });
}


// ── Template: Notification absence ────────────────────────────
export async function sendAbsenceNotification(params: {
  to: string; parentPrenom: string; studentPrenom: string;
  date: string; matiere: string; schoolName: string;
}): Promise<boolean> {
  const html = baseLayout(`
    <h2>Absence signalée</h2>
    <p>Bonjour <strong>${params.parentPrenom}</strong>,</p>
    <p>Votre enfant <strong>${params.studentPrenom}</strong> a été marqué(e) absent(e) le <strong>${new Date(params.date).toLocaleDateString('fr-FR')}</strong> en <strong>${params.matiere}</strong>.</p>
    <p>Connectez-vous à sulungukutu pour consulter les détails.</p>
  `, `Absence — ${params.schoolName}`);

  return send({
    to:      params.to,
    subject: `[${params.schoolName}] Absence de ${params.studentPrenom}`,
    html,
    type: 'absence',
  });
}

// ── Export du service ──────────────────────────────────────────
// ── Template: Nouvel enfant ajouté à un compte parent existant ─
// (le parent a déjà un compte — pas de nouveau mot de passe à générer,
//  contrairement à sendInvitation qui est réservée à un tout nouveau compte)
export async function sendChildAdded(params: {
  to: string; prenom: string; nom: string;
  childPrenom: string; childNom: string;
  schoolName: string; loginUrl?: string;
}): Promise<boolean> {
  const url = params.loginUrl ?? `${APP_URL}/login`;

  const html = baseLayout(`
    <h2>Un nouvel enfant a été ajouté à votre compte</h2>
    <p>Bonjour <strong>${params.prenom} ${params.nom}</strong>,</p>
    <p><strong>${params.childPrenom} ${params.childNom}</strong> a été inscrit(e) dans l'établissement <strong>${params.schoolName}</strong> et associé(e) à votre compte parent existant.</p>
    <p>Vous pouvez suivre sa scolarité avec les identifiants que vous utilisez déjà pour vos autres enfants.</p>
    <a href="${url}" class="btn">Accéder à mon espace →</a>
  `, `Nouvel enfant — ${params.schoolName}`);

  return send({
    to:      params.to,
    subject: `[${params.schoolName}] ${params.childPrenom} a été ajouté(e) à votre compte`,
    html,
    type: 'child-added',
  });
}

export const emailService = {
  sendInvitation,
  sendChildAdded,
  sendPasswordReset,
  sendBulletinNotification,
  sendBulletinGenerationReminder,
  sendPaymentReminder,
  sendAbsenceNotification,
  isConfigured,
};

