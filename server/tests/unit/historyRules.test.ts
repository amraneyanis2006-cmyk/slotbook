import { describe, expect, it } from 'vitest';
import { isValidTransition, toHistoryView } from '../../src/rules/historyRules.js';

describe('history rules (F-10 §2)', () => {
  it('UNIT-09: only the five F-10 transitions are valid; rows ordered by createdAt then id; entries carry name and role only', () => {
    expect(isValidTransition(null, 'BOOKED')).toBe(true);
    expect(isValidTransition('BOOKED', 'CANCELLED')).toBe(true);
    expect(isValidTransition('BOOKED', 'COMPLETED')).toBe(true);
    expect(isValidTransition('BOOKED', 'NO_SHOW')).toBe(true);
    expect(isValidTransition('CANCELLED', 'BOOKED')).toBe(false);
    expect(isValidTransition('BOOKED', 'BOOKED')).toBe(false);
    expect(isValidTransition(null, 'CANCELLED')).toBe(false);
    expect(isValidTransition('NO_SHOW', 'COMPLETED')).toBe(false);

    const at = new Date('2030-06-03T02:00:00.000Z');
    const actor = { id: 7, name: 'Anan Wong', role: 'STAFF' as const, email: 'staff.anan@slotbook.test' };
    const rows = [
      { id: 12, createdAt: at, fromStatus: 'BOOKED' as const, toStatus: 'CANCELLED' as const, reason: 'Staff illness', actor },
      { id: 11, createdAt: at, fromStatus: null, toStatus: 'BOOKED' as const, reason: null, actor: { ...actor, id: 3, name: 'Ploy Chai', role: 'CUSTOMER' as const } },
      { id: 10, createdAt: new Date(at.getTime() - 60_000), fromStatus: null, toStatus: 'BOOKED' as const, reason: null, actor },
    ];
    const view = toHistoryView(rows);
    expect(view.map((e) => e.to)).toEqual(['BOOKED', 'BOOKED', 'CANCELLED']);
    expect(view[1]).toEqual({ at, from: null, to: 'BOOKED', actor: { name: 'Ploy Chai', role: 'CUSTOMER' }, reason: null });
    expect(view[2]).toEqual({ at, from: 'BOOKED', to: 'CANCELLED', actor: { name: 'Anan Wong', role: 'STAFF' }, reason: 'Staff illness' });
    expect(JSON.stringify(view)).not.toMatch(/@|"id"/);
  });
});
