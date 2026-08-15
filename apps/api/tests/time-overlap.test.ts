import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, timeToMinutes } from '../src/utils/time-overlap';

test('timeToMinutes — conversion HH:MM correcte', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('08:00'), 480);
  assert.equal(timeToMinutes('08:30'), 510);
  assert.equal(timeToMinutes('23:59'), 1439);
});

test('overlaps — deux créneaux identiques se chevauchent', () => {
  assert.equal(overlaps('08:00', '09:00', '08:00', '09:00'), true);
});

test('overlaps — chevauchement partiel détecté (le cas réel qui doit bloquer un enseignant)', () => {
  // Prof déjà en cours de 08:00 à 09:00 ; on tente de l'ajouter 08:30-09:30
  assert.equal(overlaps('08:30', '09:30', '08:00', '09:00'), true);
  // Et l'inverse (ordre des créneaux comparés) doit donner le même résultat
  assert.equal(overlaps('08:00', '09:00', '08:30', '09:30'), true);
});

test('overlaps — créneaux consécutifs (fin = début) ne se chevauchent PAS', () => {
  // 08:00-09:00 puis 09:00-10:00 : légitime, un cours enchaîne sur l'autre
  assert.equal(overlaps('08:00', '09:00', '09:00', '10:00'), false);
});

test('overlaps — créneaux clairement séparés ne se chevauchent pas', () => {
  assert.equal(overlaps('08:00', '09:00', '14:00', '15:00'), false);
});

test('overlaps — un créneau entièrement contenu dans un autre est détecté', () => {
  // Cours de 08:00 à 12:00, on tente d'ajouter 09:00-10:00 au milieu
  assert.equal(overlaps('09:00', '10:00', '08:00', '12:00'), true);
});

test('overlaps — chevauchement d\'une seule minute est détecté', () => {
  assert.equal(overlaps('08:00', '09:01', '09:00', '10:00'), true);
});
