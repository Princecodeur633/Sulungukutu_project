import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFriendlyUniqueError } from '../src/utils/db-errors';

test('withFriendlyUniqueError — laisse passer un résultat normal', async () => {
  const result = await withFriendlyUniqueError(async () => 42);
  assert.equal(result, 42);
});

test('withFriendlyUniqueError — transforme une violation sur le téléphone en message clair', async () => {
  await assert.rejects(
    () => withFriendlyUniqueError(async () => {
      const err: any = new Error('duplicate key value violates unique constraint "global_profiles_phone_unique"');
      err.code = '23505';
      err.constraint = 'global_profiles_phone_unique';
      throw err;
    }),
    (err: any) => {
      assert.match(err.message, /téléphone.*déjà associé/i);
      return true;
    }
  );
});

test('withFriendlyUniqueError — transforme une violation sur l\'email en message clair', async () => {
  await assert.rejects(
    () => withFriendlyUniqueError(async () => {
      const err: any = new Error('duplicate key value violates unique constraint "global_profiles_email_unique"');
      err.code = '23505';
      err.constraint = 'global_profiles_email_unique';
      throw err;
    }),
    (err: any) => {
      assert.match(err.message, /email.*déjà associé/i);
      return true;
    }
  );
});

test('withFriendlyUniqueError — laisse passer les autres erreurs sans les transformer', async () => {
  await assert.rejects(
    () => withFriendlyUniqueError(async () => { throw new Error('erreur réseau'); }),
    (err: any) => {
      assert.equal(err.message, 'erreur réseau');
      return true;
    }
  );
});
