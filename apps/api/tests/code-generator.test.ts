import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateShortCode, generateSchoolCode, roleToPrefixCode,
  generateMatricule, generateNumeroRecu, generateTransactionRef,
} from '../src/utils/code-generator';

test('roleToPrefixCode — mappe chaque rôle vers le bon préfixe', () => {
  assert.equal(roleToPrefixCode('SUPER_ADMIN'), 'SUP');
  assert.equal(roleToPrefixCode('ADMIN'), 'ADM');
  assert.equal(roleToPrefixCode('TEACHER'), 'TCH');
  assert.equal(roleToPrefixCode('PARENT'), 'PAR');
  assert.equal(roleToPrefixCode('STUDENT'), 'STU');
});

test('roleToPrefixCode — rôle inconnu retombe sur USR plutôt que de planter', () => {
  assert.equal(roleToPrefixCode('ROLE_INEXISTANT'), 'USR');
});

test('generateShortCode — respecte le format PREFIX-XXX-HEXHEX', () => {
  const code = generateShortCode('STU', 'Malonga', 'Nadège');
  assert.match(code, /^STU-[A-Z0-9]{3}-[0-9A-F]{4}$/);
});

test('generateShortCode — fonctionne sans prénom (nom seul)', () => {
  const code = generateShortCode('ADM', 'Ossebi');
  assert.match(code, /^ADM-[A-Z0-9]{3}-[0-9A-F]{4}$/);
});

test('generateShortCode — deux appels donnent des codes différents', () => {
  const codes = new Set(Array.from({ length: 20 }, () => generateShortCode('TCH', 'Nguesso', 'Paul')));
  // Sur 20 tirages avec 65536 combinaisons possibles pour le suffixe hex,
  // une collision serait extrêmement improbable — on vérifie qu'on n'a
  // pas un générateur cassé qui renvoie toujours la même chose.
  assert.ok(codes.size > 1, 'generateShortCode ne doit pas toujours renvoyer le même code');
});

test('generateShortCode — ignore les caractères non alphabétiques du nom/prénom', () => {
  // Ne doit pas planter sur des accents, apostrophes, espaces
  const code = generateShortCode('STU', "N'Guessan", 'Marie-Ange');
  assert.match(code, /^STU-[A-Z0-9]{3}-[0-9A-F]{4}$/);
});

test('generateSchoolCode — format SCH-XXX-NNNN, numéro sur 4 chiffres', () => {
  assert.equal(generateSchoolCode('Lycée Savorgnan de Brazza', 1), 'SCH-LYC-0001');
  assert.equal(generateSchoolCode('CS Bacongo', 42), 'SCH-CSB-0042');
});

test('generateSchoolCode — complète avec des X si le nom est trop court', () => {
  assert.equal(generateSchoolCode('EP', 5), 'SCH-EPX-0005');
});

test('generateMatricule — format ANNEE-INITIALES-SEQUENCE', () => {
  const m = generateMatricule('2025-2026', 'Malonga', 'Nadège', 12);
  assert.match(m, /^2025-[A-Z0-9]{3}-0012$/);
});

test('generateMatricule — deux élèves différents à la même séquence ont des matricules différents', () => {
  const m1 = generateMatricule('2025-2026', 'Malonga', 'Nadège', 1);
  const m2 = generateMatricule('2025-2026', 'Obami', 'Jean', 1);
  assert.notEqual(m1, m2, 'les initiales doivent différencier deux élèves de noms différents');
});

test('generateNumeroRecu — format REC-ANNEE-HEX, sans le tiret de l\'année scolaire', () => {
  const recu = generateNumeroRecu('2025-2026');
  assert.match(recu, /^REC-20252026-[0-9A-F]{6}$/);
});

test('generateTransactionRef — commence toujours par TXN- et est unique', () => {
  const refs = new Set(Array.from({ length: 10 }, () => generateTransactionRef()));
  assert.equal(refs.size, 10, 'chaque référence de transaction doit être unique');
  for (const r of refs) assert.match(r, /^TXN-/);
});
