import { describe, expect, it } from 'vitest';
import { validateService } from '../../src/rules/serviceRules.js';

const NAME = 'Enter a name of 3 to 60 characters.';
const DURATION = 'Choose a duration from 15 to 120 minutes in 15-minute steps.';

describe('validateService (F-11 §2)', () => {
  it('UNIT-10: name 3–60 characters after trimming and collapsing spaces; duration 15–120 by 15; PATCH needs one field', () => {
    expect(validateService({ name: '  Visa   letter  ', durationMin: 30 })).toEqual({ name: 'Visa letter', durationMin: 30 });
    expect(validateService({ name: 'abc', durationMin: 15 })).toEqual({ name: 'abc', durationMin: 15 });
    expect(validateService({ name: 'x'.repeat(60), durationMin: 120 })).toEqual({ name: 'x'.repeat(60), durationMin: 120 });

    expect(validateService({ name: 'ab', durationMin: 30 })).toEqual({ fields: { name: NAME } });
    expect(validateService({ name: 'x'.repeat(61), durationMin: 30 })).toEqual({ fields: { name: NAME } });
    expect(validateService({ name: '   ', durationMin: 30 })).toEqual({ fields: { name: NAME } });
    for (const durationMin of [0, 10, 135, 22.5, -15, '30']) {
      expect(validateService({ name: 'Visa letter', durationMin })).toEqual({ fields: { durationMin: DURATION } });
    }
    expect(validateService({})).toEqual({ fields: { name: NAME, durationMin: DURATION } });
    expect(validateService({ name: 'Visa letter', durationMin: 30, isActive: 'yes' })).toEqual({ fields: { isActive: 'Choose active or inactive.' } });

    expect(validateService({}, { partial: true })).toEqual({ fields: { _: 'Change at least one field.' } });
    expect(validateService({ isActive: false }, { partial: true })).toEqual({ isActive: false });
    expect(validateService({ durationMin: 45 }, { partial: true })).toEqual({ durationMin: 45 });
    expect(validateService({ name: ' Visa  letter' }, { partial: true })).toEqual({ name: 'Visa letter' });
  });
});
