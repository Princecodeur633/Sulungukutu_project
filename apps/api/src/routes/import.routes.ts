/** Route import CSV eleves - POST /import/students?schoolId=xxx&classId=xxx&token=xxx */
import type { IncomingMessage, ServerResponse } from "http";
import { parse as parseUrl } from "url";
import { db } from "../db";
import { eq, and, or, sql } from "drizzle-orm";
import { globalProfiles, schoolMemberships, students, parentStudents, classes } from "../db/schema";
import { verifyAccessToken } from "../utils/jwt";
import { normalizePhone } from "../utils/phone";
import { enforceRateLimit } from "../middleware/rate-limit";
import * as bcrypt from "bcryptjs";

const FE = process.env.FRONTEND_URL ?? "http://localhost:3000";

function gc(p:string,n:string,pr:string):string{
  const c=(s:string)=>s.replace(/[^a-zA-Z]/g,"").toUpperCase().slice(0,3).padEnd(3,"X");
  return p+"-"+c(n)+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
}
function gm(yr:string,n:string,pr:string,i:number):string{
  return yr.slice(0,4)+"-"+(pr[0]||"X").toUpperCase()+(n[0]||"X").toUpperCase()+"-"+String(i).padStart(4,"0");
}
function tp(){return Math.random().toString(36).slice(2,10).toUpperCase();}

export function handleImportRoute(req:IncomingMessage,res:ServerResponse):boolean{
  const url=parseUrl(req.url??"",true);
  if(!url.pathname?.startsWith("/import/students"))return false;
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":FE,"Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"});res.end();return true;}
  if(req.method!=="POST"){res.writeHead(405);res.end();return true;}

  // Rate limiting — absent jusqu'ici sur cette route brute (contrairement
  // au endpoint GraphQL), alors qu'elle génère beaucoup d'écritures en base.
  try {
    enforceRateLimit({
      url: req.url ?? '',
      headers: { get: (h: string) => (req.headers[h.toLowerCase()] as string) ?? null },
    });
  } catch {
    res.writeHead(429,{"Content-Type":"application/json","Access-Control-Allow-Origin":FE});
    res.end(JSON.stringify({error:"Trop de requêtes — réessayez dans une minute."}));
    return true;
  }

  const tok=url.query.token as string,sid=url.query.schoolId as string,cid=url.query.classId as string|undefined;
  if(!tok||!sid){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({error:"token+schoolId requis"}));return true;}

  // AVANT : le token était vérifié comme valide, mais son contenu (rôle,
  // école) n'était JAMAIS utilisé — n'importe quel utilisateur connecté
  // (même un élève) pouvait importer des élèves dans N'IMPORTE QUELLE
  // école en changeant juste le paramètre schoolId. Corrigé : on exige un
  // rôle admin ET que l'école du token corresponde à celle de l'import
  // (le Super Admin passe outre cette dernière vérification).
  let decoded: any;
  try { decoded = verifyAccessToken(tok); } catch {
    res.writeHead(401,{"Content-Type":"application/json"});res.end(JSON.stringify({error:"Token invalide"}));return true;
  }
  if (decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'ADMIN') {
    res.writeHead(403,{"Content-Type":"application/json"});
    res.end(JSON.stringify({error:"Accès refusé — réservé aux administrateurs."}));return true;
  }
  if (decoded.role === 'ADMIN' && decoded.schoolId !== sid) {
    res.writeHead(403,{"Content-Type":"application/json"});
    res.end(JSON.stringify({error:"Vous ne pouvez importer des élèves que dans votre propre établissement."}));return true;
  }

  const ch:Buffer[]=[];req.on("data",(c:Buffer)=>ch.push(c));req.on("end",()=>{processImport(Buffer.concat(ch).toString("utf8"),sid,cid).then(r=>{res.writeHead(200,{"Content-Type":"application/json","Access-Control-Allow-Origin":FE});res.end(JSON.stringify(r));}).catch(e=>{res.writeHead(500,{"Content-Type":"application/json","Access-Control-Allow-Origin":FE});res.end(JSON.stringify({error:e.message}));});});
  return true;
}

function parseCSV(csv: string): { header: string[]; rows: string[][] } {
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("CSV vide");
  const pl = (line: string): string[] => {
    const r: string[] = []; let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { r.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    return [...r, cur.trim()];
  };
  const hdr = pl(lines[0]).map(h => h.toLowerCase().replace(/[_\s\r]/g, ""));
  return { header: hdr, rows: lines.slice(1).map(pl) };
}

async function processImport(csv: string, schoolId: string, classId?: string) {
  const { header, rows } = parseCSV(csv);
  const miss = ['prenom','nom'].filter(c => !header.includes(c));
  if (miss.length) throw new Error('Colonnes manquantes: '+miss.join(', '));
  // Avant : classId n'était jamais vérifié — l'import plantait plus loin
  // sur une variable non définie sans jamais créer le moindre élève.
  if (!classId) throw new Error('classId requis pour importer des élèves');
  const col = (r: string[], n: string) => (r[header.indexOf(n)] ?? '').trim();
  let yr = '2024-2025';
  if (classId) { const c = await db.query.classes.findFirst({where:eq(classes.id,classId)}); if(c) yr=c.anneeScolaire; }
  const res: any[] = [];
  for (let i=0; i<rows.length; i++) {
    const p=rows[i], pr=col(p,'prenom'), nm=col(p,'nom');
    if (!pr||!nm) { res.push({row:i+2,success:false,name:'L'+(i+2),error:'prenom+nom'}); continue; }
    try {
      const slug = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z]/g,'').toLowerCase() || 'x';
      const stuPhone = col(p,'telephone')||col(p,'phone');
      // Avant : sans email fourni, un email "aléatoire" était généré (via
      // Math.random() dans gc()) — DIFFÉRENT à chaque réimport du même
      // élève, donc la dédup ne matchait jamais et créait un doublon à
      // chaque réimport du même fichier. Corrigé : email de repli
      // déterministe (basé sur le nom), + dédup par téléphone si fourni.
      const email=col(p,'email')||`${slug(pr)}.${slug(nm)}@import.sulungukutu.local`;
      const normalizedStuPhone = stuPhone ? normalizePhone(stuPhone) : null;
      let prof=await db.query.globalProfiles.findFirst({
        where: or(
          eq(globalProfiles.email,email),
          normalizedStuPhone
            ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedStuPhone.slice(-8)}`
            : undefined,
        ),
      });
      const pwd=tp(),hash=await bcrypt.hash(pwd,10);
      if(!prof){const[c]=await db.insert(globalProfiles).values({code:gc('STU',nm,pr),nom:nm,prenom:pr,email,phone:stuPhone||undefined,passwordHash:hash}).returning();prof=c;}
      let ms=await db.query.schoolMemberships.findFirst({where:and(eq(schoolMemberships.profileId,prof.id),eq(schoolMemberships.schoolId,schoolId),eq(schoolMemberships.role,'STUDENT'))});
      // Avant : `ms` n'était que RECHERCHÉ, jamais CRÉÉ s'il n'existait pas —
      // et la ligne `students` correspondante n'était JAMAIS créée du tout,
      // faisant planter l'import sur une variable `stu` non définie dès
      // qu'un email de parent était fourni (et silencieusement incomplet
      // sinon : profil + membership créés, mais aucun élève inscrit).
      if(!ms){const[m]=await db.insert(schoolMemberships).values({profileId:prof.id,schoolId,role:'STUDENT',code:gc('STU',nm,pr),status:'ACTIVE'}).returning();ms=m;}
      let stu=await db.query.students.findFirst({where:eq(students.membershipId,ms.id)});
      if(!stu){
        const matricule=gm(yr,nm,pr,i+1);
        const[s]=await db.insert(students).values({membershipId:ms.id,classId,matricule}).returning();
        stu=s;
      }
      const pe=col(p,'parentemail');
      const pph=col(p,'parentphone');
      if(pe||pph){
        const normalizedPhone = pph ? normalizePhone(pph) : null;
        let pp=await db.query.globalProfiles.findFirst({
          where: or(
            pe ? eq(globalProfiles.email,pe) : undefined,
            normalizedPhone
              ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone.slice(-8)}`
              : undefined,
          ),
        });
        if(!pp){
          const ph=await bcrypt.hash(tp(),10);
          // Avant : email obligatoire pour créer le parent (`if(pe)`) — un
          // parent qui n'avait qu'un téléphone n'était jamais créé ni lié,
          // exactement comme dans createStudent avant sa correction.
          const email = pe || `${gc('PAR',col(p,'parentnom')||'P',col(p,'parentprenom')||'').toLowerCase()}@import.sulungukutu.local`;
          const[x]=await db.insert(globalProfiles).values({code:gc('PAR',col(p,'parentnom')||'P',col(p,'parentprenom')||''),nom:col(p,'parentnom')||'Parent',prenom:col(p,'parentprenom')||'',email,phone:pph||undefined,passwordHash:ph}).returning();
          pp=x;
        }
        let pms=await db.query.schoolMemberships.findFirst({where:and(eq(schoolMemberships.profileId,pp.id),eq(schoolMemberships.schoolId,schoolId),eq(schoolMemberships.role,'PARENT'))});
        if(!pms){const[pm]=await db.insert(schoolMemberships).values({profileId:pp.id,schoolId,role:'PARENT',code:gc('PAR',pp.nom,pp.prenom),status:'ACTIVE'}).returning();pms=pm;}
        const lr=col(p,'parentlien').toUpperCase();
        await db.insert(parentStudents).values({parentMembershipId:pms.id,studentId:stu.id,lien:(['PERE','MERE','TUTEUR','AUTRE'].includes(lr)?lr:'TUTEUR')as any}).onConflictDoNothing();
      }
      res.push({row:i+2,success:true,name:pr+' '+nm,tempPassword:pwd});
    } catch(e: any) {
      const msg = e?.code === '23505'
        ? (String(e.constraint ?? '').includes('phone')
            ? 'Ce numéro de téléphone est déjà associé à un autre compte.'
            : String(e.constraint ?? '').includes('email')
              ? 'Cet email est déjà associé à un autre compte.'
              : e.message)
        : e.message;
      res.push({row:i+2,success:false,name:pr+' '+nm,error:msg});
    }
  }
  return {total:rows.length,success:res.filter(r=>r.success).length,errors:res.filter(r=>!r.success).length,results:res};
}
