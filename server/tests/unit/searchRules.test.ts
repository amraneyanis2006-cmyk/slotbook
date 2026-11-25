import { describe, expect, it } from 'vitest';
import { validateSearch } from '../../src/rules/searchRules.js';

const DATE = 'Enter a valid date (YYYY-MM-DD).';

describe('validateSearch (F-12 §2)', () => {
  it('UNIT-14: dates required and real, to ≥ from, at most 14 days (from + 13), optional positive ids; a past from is allowed', () => {
    expect(validateSearch({ from: '2030-12-01', to: '2030-12-14' })).toEqual({ from: '2030-12-01', to: '2030-12-14' });
    expect(validateSearch({ from: '2030-12-01', to: '2030-12-01', serviceId: '2', staffId: '1' })).toEqual({ from: '2030-12-01', to: '2030-12-01', serviceId: 2, staffId: 1 });
    expect(validateSearch({ from: '2020-01-01', to: '2020-01-02' })).toEqual({ from: '2020-01-01', to: '2020-01-02' });

    expect(validateSearch({ from: '2030-12-01', to: '2030-12-15' })).toEqual({ fields: { to: 'Search at most 14 days at a time.' } });
    expect(validateSearch({ from: '2030-12-02', to: '2030-12-01' })).toEqual({ fields: { to: 'The end date must be on or after the start date.' } });
    expect(validateSearch({})).toEqual({ fields: { from: DATE, to: DATE } });
    expect(validateSearch({ from: '2030-02-30', to: '12/01/2030' })).toEqual({ fields: { from: DATE, to: DATE } });
    for (const bad of ['0', '-1', 'x', '1.5', '99999999999']) {
      expect(validateSearch({ from: '2030-12-01', to: '2030-12-02', serviceId: bad, staffId: bad }))
        .toEqual({ fields: { serviceId: 'Choose a valid service.', staffId: 'Choose a valid staff member.' } });
    }
  });
});
