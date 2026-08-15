/**
 * Route /mail-log — visualiser les emails envoyés en mode DEV
 * Accessible seulement si SMTP_HOST n'est pas configuré (mode dev)
 */
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

const MAIL_LOG_FILE = path.join(process.cwd(), 'data', 'mail-log.json');

export function handleMailViewer(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '';
  if (!url.startsWith('/mail-log')) return false;

  // Seulement en mode dev (pas de SMTP configuré)
  const isSmtpConfigured = !!process.env.SMTP_HOST && !!process.env.SMTP_USER;
  if (isSmtpConfigured) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Viewer désactivé en production (SMTP configuré)' }));
    return true;
  }

  if (url === '/mail-log/clear' && req.method === 'DELETE') {
    try {
      fs.writeFileSync(MAIL_LOG_FILE, '[]', 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur' }));
    }
    return true;
  }

  // GET /mail-log → JSON brut
  if (url === '/mail-log/json') {
    try {
      const data = fs.existsSync(MAIL_LOG_FILE)
        ? fs.readFileSync(MAIL_LOG_FILE, 'utf-8')
        : '[]';
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    } catch {
      res.writeHead(500); res.end('[]');
    }
    return true;
  }

  // GET /mail-log → interface HTML
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>sulungukutu — Boîte mail DEV</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed);
              padding: 20px 28px; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 18px; font-weight: 800; color: white; letter-spacing: -.02em; }
    .header p  { font-size: 12px; color: rgba(255,255,255,.7); margin-top: 2px; }
    .badge-dev { background: rgba(255,255,255,.2); color: white;
                 font-size: 10px; font-weight: 700; padding: 2px 8px;
                 border-radius: 20px; letter-spacing: .05em; }
    .toolbar { padding: 12px 28px; display: flex; align-items: center; gap: 12px;
               background: #1e293b; border-bottom: 1px solid #334155; }
    .toolbar input { flex: 1; background: #0f172a; border: 1px solid #334155;
                     border-radius: 8px; padding: 7px 12px; color: #e2e8f0;
                     font-size: 13px; outline: none; }
    .toolbar input:focus { border-color: #6366f1; }
    .btn-clear { background: #dc2626; color: white; border: none; border-radius: 8px;
                 padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-refresh { background: #334155; color: #e2e8f0; border: none; border-radius: 8px;
                   padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .count { font-size: 12px; color: #64748b; white-space: nowrap; }
    .main { display: flex; height: calc(100vh - 110px); }
    .list { width: 340px; flex-shrink: 0; overflow-y: auto;
            border-right: 1px solid #334155; background: #1e293b; }
    .mail-item { padding: 14px 16px; border-bottom: 1px solid #334155; cursor: pointer;
                 transition: background .1s; position: relative; }
    .mail-item:hover { background: #263040; }
    .mail-item.active { background: #1d3461; border-left: 3px solid #6366f1; }
    .mail-item .to   { font-size: 13px; font-weight: 600; color: #e2e8f0;
                       overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mail-item .subj { font-size: 12px; color: #94a3b8; margin-top: 2px;
                       overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mail-item .meta { display: flex; gap: 8px; margin-top: 6px; align-items: center; }
    .mail-item .date { font-size: 11px; color: #475569; }
    .type-badge { font-size: 10px; font-weight: 600; padding: 1px 7px;
                  border-radius: 10px; text-transform: uppercase; letter-spacing: .04em; }
    .type-invitation { background: #312e81; color: #a5b4fc; }
    .type-bulletin   { background: #14532d; color: #86efac; }
    .type-password-reset { background: #7c2d12; color: #fdba74; }
    .type-payment-reminder { background: #713f12; color: #fde68a; }
    .type-generic    { background: #1e293b; color: #64748b; border: 1px solid #334155; }
    .preview { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .preview-header { padding: 16px 24px; border-bottom: 1px solid #334155;
                      background: #1e293b; flex-shrink: 0; }
    .preview-header .to { font-size: 14px; font-weight: 700; color: #e2e8f0; }
    .preview-header .subj { font-size: 13px; color: #94a3b8; margin-top: 3px; }
    .creds { margin-top: 10px; background: #0f172a; border-radius: 8px;
             padding: 10px 14px; border: 1px solid #334155; }
    .creds h4 { font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
                color: #64748b; margin-bottom: 8px; }
    .cred-row { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
    .cred-key { font-size: 11px; color: #64748b; width: 120px; flex-shrink: 0; }
    .cred-val { font-size: 13px; font-weight: 700; color: #a5b4fc;
                font-family: monospace; cursor: text; user-select: all; }
    .preview-body { flex: 1; overflow: auto; }
    .preview-body iframe { width: 100%; height: 100%; border: none; background: white; }
    .empty { display: flex; flex-direction: column; align-items: center;
             justify-content: center; height: 100%; color: #475569; gap: 12px; }
    .empty svg { width: 48px; height: 48px; opacity: .3; }
    .empty p { font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="display:flex;align-items:center;gap:10px">
        <h1>📬 Boîte mail DEV</h1>
        <span class="badge-dev">DEV ONLY</span>
      </div>
      <p>Emails simulés par sulungukutu (SMTP non configuré)</p>
    </div>
  </div>
  <div class="toolbar">
    <input id="search" placeholder="Rechercher par destinataire, sujet..." oninput="filterMails()" />
    <span class="count" id="count">0 email(s)</span>
    <button class="btn-refresh" onclick="loadMails()">↺ Rafraîchir</button>
    <button class="btn-clear" onclick="clearMails()">🗑 Vider</button>
  </div>
  <div class="main">
    <div class="list" id="list">
      <div class="empty"><p>Chargement...</p></div>
    </div>
    <div class="preview" id="preview">
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
        </svg>
        <p>Sélectionnez un email</p>
      </div>
    </div>
  </div>
  <script>
    let allMails = [];
    let selectedIdx = -1;

    async function loadMails() {
      try {
        const res = await fetch('/mail-log/json');
        allMails = await res.json();
        renderList(allMails);
      } catch(e) { console.error(e); }
    }

    function typeClass(t) {
      return 'type-' + (t ?? 'generic').replace(':FAILED','').replace('-','');
    }
    function typeLabel(t) {
      const labels = { 'invitation':'Invitation', 'bulletin':'Bulletin',
        'password-reset':'Reset', 'payment-reminder':'Paiement', 'generic':'Email' };
      return labels[t?.replace(':FAILED','')] ?? t ?? 'Email';
    }

    function renderList(mails) {
      document.getElementById('count').textContent = mails.length + ' email(s)';
      const list = document.getElementById('list');
      if (!mails.length) {
        list.innerHTML = '<div class="empty"><p>Aucun email pour l\'instant</p></div>';
        return;
      }
      list.innerHTML = mails.map((m, i) => {
        const d = new Date(m.sentAt).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        const failed = m.type?.includes('FAILED') ? ' ⚠️' : '';
        return \`<div class="mail-item\${i===selectedIdx?' active':''}" onclick="selectMail(\${i})">
          <div class="to">\${m.to}\${failed}</div>
          <div class="subj">\${m.subject}</div>
          <div class="meta">
            <span class="type-badge \${typeClass(m.type)}">\${typeLabel(m.type)}</span>
            <span class="date">\${d}</span>
          </div>
        </div>\`;
      }).join('');
    }

    function selectMail(i) {
      selectedIdx = i;
      const m = allMails[i];
      renderList(filterSearch());

      let credsHtml = '';
      if (m.credentials && Object.keys(m.credentials).length) {
        const rows = Object.entries(m.credentials).map(([k,v]) =>
          \`<div class="cred-row"><span class="cred-key">\${k}</span><span class="cred-val">\${v}</span></div>\`
        ).join('');
        credsHtml = \`<div class="creds"><h4>🔑 Identifiants</h4>\${rows}</div>\`;
      }

      document.getElementById('preview').innerHTML = \`
        <div class="preview-header">
          <div class="to">À : \${m.to}</div>
          <div class="subj">\${m.subject}</div>
          \${credsHtml}
        </div>
        <div class="preview-body">
          <iframe srcdoc="\${m.html.replace(/"/g,'&quot;')}"></iframe>
        </div>
      \`;
    }

    function filterSearch() {
      const q = document.getElementById('search')?.value?.toLowerCase() ?? '';
      return q ? allMails.filter(m =>
        m.to?.toLowerCase().includes(q) || m.subject?.toLowerCase().includes(q)
      ) : allMails;
    }

    function filterMails() {
      renderList(filterSearch());
    }

    async function clearMails() {
      if (!confirm('Vider tous les emails ?')) return;
      await fetch('/mail-log/clear', { method: 'DELETE' });
      allMails = []; selectedIdx = -1;
      renderList([]);
      document.getElementById('preview').innerHTML =
        '<div class="empty"><p>Boîte vidée</p></div>';
    }

    loadMails();
    setInterval(loadMails, 10000); // auto-refresh 10s
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
  return true;
}

