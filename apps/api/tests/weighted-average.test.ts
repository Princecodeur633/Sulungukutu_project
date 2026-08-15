import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightedAverage } from '../src/types/domain';

test('weightedAverage — moyenne simple, coefficients égaux', () => {
  const result = weightedAverage([
    { valeur: 10, coefficient: 1 },
    { valeur: 20, coefficient: 1 },
  ]);
  assert.equal(result, 15);
});

test('weightedAverage — coefficients différents pèsent correctement (cas réel bulletin)', () => {
  // Maths coef 4 à 16, Français coef 4 à 12, EPS coef 1 à 18
  // Moyenne = (16*4 + 12*4 + 18*1) / (4+4+1) = (64+48+18)/9 = 130/9 = 14.44
  const result = weightedAverage([
    { valeur: 16, coefficient: 4 },
    { valeur: 12, coefficient: 4 },
    { valeur: 18, coefficient: 1 },
  ]);
  assert.equal(result, 14.44);
});

test('weightedAverage — valeurs en string (comme renvoyées par Postgres numeric) sont gérées', () => {
  const result = weightedAverage([
    { valeur: '10.5', coefficient: '2' },
    { valeur: '15.5', coefficient: '2' },
  ]);
  assert.equal(result, 13);
});

test('weightedAverage — ignore les notes null/undefined sans fausser la moyenne', () => {
  const withInvalid = weightedAverage([
    { valeur: 10, coefficient: 2 },
    { valeur: null as any, coefficient: 3 },
    { valeur: 20, coefficient: 2 },
  ]);
  const withoutInvalid = weightedAverage([
    { valeur: 10, coefficient: 2 },
    { valeur: 20, coefficient: 2 },
  ]);
  assert.equal(withInvalid, withoutInvalid, 'une note invalide ne doit pas être comptée dans le total des coefficients');
  assert.equal(withInvalid, 15);
});

test('weightedAverage — tableau vide renvoie null (pas 0, pas NaN)', () => {
  assert.equal(weightedAverage([]), null);
});

test('weightedAverage — uniquement des notes invalides renvoie null', () => {
  assert.equal(weightedAverage([{ valeur: null as any, coefficient: 2 }]), null);
});

test('weightedAverage — coefficient total nul renvoie null (évite une division par zéro)', () => {
  assert.equal(weightedAverage([{ valeur: 10, coefficient: 0 }]), null);
});

test('weightedAverage — arrondit à 2 décimales', () => {
  const result = weightedAverage([
    { valeur: 10, coefficient: 3 },
    { valeur: 11, coefficient: 7 },
  ]);
  // (10*3 + 11*7) / 10 = (30+77)/10 = 10.7
  assert.equal(result, 10.7);
});
