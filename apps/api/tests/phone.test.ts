import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../src/utils/phone';

test('normalizePhone — formats équivalents donnent le même résultat', () => {
  const variants = [
    '+242 06 123 45 67',
    '06-123-45-67',
    '06 123 45 67',
    '242061234567',
    '+242061234567',
    '06.123.45.67',
  ];
  const results = variants.map(normalizePhone);
  for (const r of results) {
    assert.equal(r, results[0], `"${r}" devrait être identique à "${results[0]}"`);
  }
});

test('normalizePhone — retire le préfixe pays +242', () => {
  assert.equal(normalizePhone('+242061234567'), normalizePhone('061234567'));
});

test('normalizePhone — réintroduit le 0 initial perdu en format international sans 0', () => {
  // Format international courant : pays + numéro SANS le 0 initial (8 chiffres locaux)
  const withoutLeadingZero = normalizePhone('+242 6 12 34 567'); // 8 chiffres après le préfixe
  assert.equal(withoutLeadingZero.length, 9, 'doit réintroduire le 0 pour revenir à 9 chiffres');
  assert.equal(withoutLeadingZero[0], '0');
});

test('normalizePhone — ignore espaces, tirets et points', () => {
  assert.equal(normalizePhone('06 123 45 67'), normalizePhone('06-123-45-67'));
  assert.equal(normalizePhone('06 123 45 67'), normalizePhone('06.123.45.67'));
});

test('normalizePhone — ne modifie pas un numéro déjà propre', () => {
  assert.equal(normalizePhone('061234567'), '061234567');
});

test('normalizePhone — chaîne vide reste vide (pas de crash)', () => {
  assert.equal(normalizePhone(''), '');
});
