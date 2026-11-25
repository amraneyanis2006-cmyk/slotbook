import { describe, expect, it } from 'vitest';
import { computeDashboard } from '../../src/rules/dashboardRules.js';

const NOW = new Date('2030-12-10T12:00:00+07:00');
const advising = { id: 1, name: 'Academic advising' };
const documents = { id: 2, name: 'Document request' };
const career = { id: 3, name: 'Career counselling' };
const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
type S = Parameters<typeof computeDashboard>[0][number];
type B = 'BOOKED' | 'COMPLETED' | 'NO_SHOW';
const slot = (status: 'OPEN' | 'CLOSED', hours: number, service = advising, booking: B | null = null): S =>
  ({ status, startAt: at(hours), service, booking: booking ? { status: booking } : null });

describe('computeDashboard (F-15 §2)', () => {
  it('UNIT-15: disjoint slot counts, pending = started BOOKED, no-show rate rounded or null, perService ordered', () => {
    const slots: S[] = [
      slot('OPEN', 5), slot('OPEN', -5), slot('CLOSED', 2),
      slot('OPEN', -48, advising, 'COMPLETED'), slot('CLOSED', -30, documents, 'COMPLETED'), slot('OPEN', -24, career, 'NO_SHOW'),
      slot('OPEN', -1, career, 'BOOKED'), slot('OPEN', 3, documents, 'BOOKED'), slot('OPEN', 0, advising, 'COMPLETED'),
      slot('OPEN', -72, documents, 'COMPLETED'), slot('OPEN', -96, documents, 'COMPLETED'),
    ];
    expect(computeDashboard(slots, NOW)).toEqual({
      slots: { total: 11, booked: 8, open: 2, closed: 1 },
      outcomes: { completed: 5, noShow: 1, pending: 1 },
      noShowRate: 0.167,
      perService: [
        { serviceId: 2, name: 'Document request', bookings: 4 },
        { serviceId: 1, name: 'Academic advising', bookings: 2 },
        { serviceId: 3, name: 'Career counselling', bookings: 2 },
      ],
    });
    const none = computeDashboard([slot('OPEN', 4), slot('OPEN', -2, advising, 'BOOKED'), slot('OPEN', 0, advising, 'BOOKED')], NOW);
    expect(none.noShowRate).toBeNull();
    expect(none.outcomes).toEqual({ completed: 0, noShow: 0, pending: 2 }); // starting exactly now counts as started
    const third = [slot('OPEN', -2, advising, 'NO_SHOW'), slot('OPEN', -3, advising, 'COMPLETED'), slot('OPEN', -4, advising, 'COMPLETED')];
    expect(computeDashboard(third, NOW).noShowRate).toBe(0.333);
    expect(computeDashboard([], NOW)).toEqual({
      slots: { total: 0, booked: 0, open: 0, closed: 0 }, outcomes: { completed: 0, noShow: 0, pending: 0 }, noShowRate: null, perService: [],
    });
  });
});
