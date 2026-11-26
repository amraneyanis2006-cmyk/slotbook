import { describe, expect, it } from 'vitest';
import { planTemplateRun, validateTemplate, weekdayOf } from '../../src/rules/templateRules.js';

const NOW = new Date('2031-04-07T10:00:00+07:00'); // Monday
const services = new Map([
  [1, { durationMin: 30, isActive: true }], [2, { durationMin: 45, isActive: true }], [3, { durationMin: 60, isActive: false }],
]);
const at = (d: string, t: string) => new Date(`${d}T${t}:00+07:00`);

describe('template rules (F-14 §2, BR-18)', () => {
  it('UNIT-16: accepted and skipped lists with the F-03 reasons, overlaps with existing and accepted slots, date then time order', () => {
    expect([weekdayOf('2031-04-07'), weekdayOf('2031-04-13')]).toEqual([1, 7]);
    const entries = [
      { weekday: 1, startTime: '09:00', serviceId: 1 }, // Monday: today 09:00 is past → skipped; next Monday fine
      { weekday: 1, startTime: '17:30', serviceId: 2 }, // ends 18:15 → opening hours
      { weekday: 2, startTime: '13:00', serviceId: 3 }, // inactive service
      { weekday: 2, startTime: '08:00', serviceId: 1 },
      { weekday: 2, startTime: '08:15', serviceId: 1 }, // overlaps the accepted 08:00 of the same run
      { weekday: 3, startTime: '10:00', serviceId: 1 }, // overlaps an existing slot
    ];
    const existing = [{ startAt: at('2031-04-09', '10:15'), endAt: at('2031-04-09', '10:45'), status: 'OPEN' as const }];
    const { accept, skipped } = planTemplateRun(entries, '2031-04-07', '2031-04-14', services, existing, NOW);
    expect(accept.map((a) => `${a.date} ${a.startTime}`)).toEqual(['2031-04-08 08:00', '2031-04-14 09:00']);
    expect(accept[0]).toMatchObject({ serviceId: 1, startAt: at('2031-04-08', '08:00'), endAt: at('2031-04-08', '08:30') });
    expect(skipped).toEqual([
      { date: '2031-04-07', startTime: '09:00', serviceId: 1, reason: 'The slot must start in the future.' },
      { date: '2031-04-07', startTime: '17:30', serviceId: 2, reason: 'Slots must be within opening hours (08:00–18:00).' },
      { date: '2031-04-08', startTime: '08:15', serviceId: 1, reason: 'You already have a slot at this time.' },
      { date: '2031-04-08', startTime: '13:00', serviceId: 3, reason: 'Choose an active service.' },
      { date: '2031-04-09', startTime: '10:00', serviceId: 1, reason: 'You already have a slot at this time.' },
      { date: '2031-04-14', startTime: '17:30', serviceId: 2, reason: 'Slots must be within opening hours (08:00–18:00).' },
    ]);
  });

  it('UNIT-16: template body validation (name, 1–50 entries, weekday, 15-minute time, duplicates)', () => {
    expect(validateTemplate({ name: ' Term  weeks ', entries: [{ weekday: 1, startTime: '09:00', serviceId: 1 }] }))
      .toEqual({ name: 'Term weeks', entries: [{ weekday: 1, startTime: '09:00', serviceId: 1 }] });
    expect(validateTemplate({ name: 'ab', entries: [] })).toEqual({ fields: { name: 'Enter a name of 3 to 60 characters.', entries: 'Add 1 to 50 entries.' } });
    expect(validateTemplate({ name: 'Term', entries: [{ weekday: 8, startTime: '09:10', serviceId: 0 }] }).fields)
      .toEqual({ 'entries.0.weekday': 'Choose a weekday.', 'entries.0.startTime': 'Choose a start time on a 15-minute step (HH:mm).', 'entries.0.serviceId': 'Choose an active service.' });
    expect(validateTemplate({ name: 'Term', entries: [{ weekday: 1, startTime: '09:00', serviceId: 1 }, { weekday: 1, startTime: '09:00', serviceId: 2 }] }).fields)
      .toEqual({ entries: 'Each weekday and time can appear only once.' });
    expect(validateTemplate({ name: 'Term', entries: Array.from({ length: 51 }, (_, i) => ({ weekday: 1 + (i % 7), startTime: '09:00', serviceId: 1 })) }).fields)
      .toEqual({ entries: 'Add 1 to 50 entries.' });
  });
});
