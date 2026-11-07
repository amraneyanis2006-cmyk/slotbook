import { describe, expect, it } from 'vitest';
import { sessionOptions } from '../../src/config/session.js';

const SECRET = 'x'.repeat(32);

describe('sessionOptions (F-01)', () => {
  it('UNIT-06: production cookie is Secure, HttpOnly, SameSite=Lax, 8 h rolling; development is not Secure', () => {
    const prod = sessionOptions('production', SECRET);
    expect(prod.cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });
    expect(prod.rolling).toBe(true);
    expect(prod.name).toBe('sid');

    expect(sessionOptions('development', SECRET).cookie?.secure).toBe(false);
  });
});
