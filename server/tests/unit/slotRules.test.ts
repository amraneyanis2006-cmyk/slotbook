import { describe, expect, it } from 'vitest';
import { findOverlap, overlaps, validateSlot } from '../../src/rules/slotRules.js';

const NOW = new Date('2026-11-10T08:00:00+07:00');
const ADVISING = { id: 1, durationMin: 30, isActive: true };
const FUTURE = 'The slot must start in the future.';
const HOURS = 'Slots must be within opening hours (08:00–18:00).';

const fieldsOf = (date: string, startTime: string, service: typeof ADVISING | null = ADVISING) => {
  const result = validateSlot({ serviceId: 1, date, startTime }, service, NOW);
  return 'fields' in result ? result.fields : null;
};

describe('validateSlot (F-03, BR-06)', () => {
  it('UNIT-01: rejects past, off-step, out-of-hours and inactive-service slots with the specified messages; accepts valid ones', () => {
    expect(fieldsOf('2026-11-09', '09:00')).toEqual({ startTime: FUTURE });
    expect(fieldsOf('2026-11-10', '09:10')?.startTime).toBeDefined();
    expect(fieldsOf('2026-11-11', '07:45')).toEqual({ startTime: HOURS });
    expect(fieldsOf('2026-11-11', '17:45')).toEqual({ startTime: HOURS });
    expect(fieldsOf('2026-11-11', '09:30', { ...ADVISING, isActive: false })).toEqual({ serviceId: 'Choose an active service.' });
    expect(fieldsOf('2026-11-11', '09:30', null)).toEqual({ serviceId: 'Choose an active service.' });
    expect(fieldsOf('11/11/2026', '09:30')?.date).toBeDefined();
    // Binding order (F-03 §2): past AND outside opening hours reports only the "future" message.
    expect(fieldsOf('2026-11-09', '07:00')).toEqual({ startTime: FUTURE });

    expect(validateSlot({ serviceId: 1, date: '2026-11-10', startTime: '09:30' }, ADVISING, NOW)).toEqual({
      startAt: new Date('2026-11-10T02:30:00.000Z'),
      endAt: new Date('2026-11-10T03:00:00.000Z'),
    });
    expect(validateSlot({ serviceId: 1, date: '2026-11-10', startTime: '17:30' }, ADVISING, NOW)).toEqual({
      startAt: new Date('2026-11-10T10:30:00.000Z'),
      endAt: new Date('2026-11-10T11:00:00.000Z'),
    });
  });
});

describe('overlaps / findOverlap (F-03, BR-07)', () => {
  const at = (hhmm: string) => new Date(`2026-11-10T${hhmm}:00+07:00`);
  const open = { startAt: at('09:00'), endAt: at('09:30'), status: 'OPEN' as const };
  const cancelled = { startAt: at('10:00'), endAt: at('10:30'), status: 'CANCELLED' as const };

  it('UNIT-02: overlapping ranges collide, touching edges do not, cancelled slots are ignored', () => {
    expect(overlaps({ startAt: at('09:15'), endAt: at('09:45') }, open)).toBe(true);
    expect(overlaps({ startAt: at('09:30'), endAt: at('10:00') }, open)).toBe(false);

    expect(findOverlap({ startAt: at('09:15'), endAt: at('09:45') }, [open, cancelled])).toBe(open);
    expect(findOverlap({ startAt: at('09:30'), endAt: at('10:00') }, [open, cancelled])).toBeNull();
    expect(findOverlap({ startAt: at('10:00'), endAt: at('10:30') }, [open, cancelled])).toBeNull();
  });
});

describe('checkSlotChange (F-07 §2, BR-14)', () => {
  it('UNIT-11: SLOT_NOT_EDITABLE first (cancelled, started, wrong status for close/reopen), then SLOT_HAS_BOOKING for edit/close only', async () => {
    const { checkSlotChange } = await import('../../src/rules/slotRules.js');
    const slot = (startMin: number, status: 'OPEN' | 'CLOSED' | 'CANCELLED' = 'OPEN') =>
      ({ status, startAt: new Date(NOW.getTime() + startMin * 60_000) });

    for (const action of ['edit', 'close', 'reopen', 'cancel'] as const) {
      expect(checkSlotChange(action, slot(60, 'CANCELLED'), false, NOW)).toBe('SLOT_NOT_EDITABLE');
      expect(checkSlotChange(action, slot(0), false, NOW)).toBe('SLOT_NOT_EDITABLE'); // starts exactly now
      expect(checkSlotChange(action, slot(-1, action === 'reopen' ? 'CLOSED' : 'OPEN'), true, NOW)).toBe('SLOT_NOT_EDITABLE');
    }
    expect(checkSlotChange('edit', slot(1), false, NOW)).toBeNull(); // one minute ahead: still changeable
    expect(checkSlotChange('edit', slot(60, 'CLOSED'), false, NOW)).toBeNull();
    expect(checkSlotChange('close', slot(60), false, NOW)).toBeNull();
    expect(checkSlotChange('close', slot(60, 'CLOSED'), false, NOW)).toBe('SLOT_NOT_EDITABLE');
    expect(checkSlotChange('reopen', slot(60, 'CLOSED'), false, NOW)).toBeNull();
    expect(checkSlotChange('reopen', slot(60), false, NOW)).toBe('SLOT_NOT_EDITABLE');
    expect(checkSlotChange('edit', slot(60), true, NOW)).toBe('SLOT_HAS_BOOKING');
    expect(checkSlotChange('close', slot(60), true, NOW)).toBe('SLOT_HAS_BOOKING');
    expect(checkSlotChange('cancel', slot(60), true, NOW)).toBeNull();
    expect(checkSlotChange('cancel', slot(60, 'CLOSED'), false, NOW)).toBeNull();
  });
});
