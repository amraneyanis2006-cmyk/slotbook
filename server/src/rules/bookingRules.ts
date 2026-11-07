// BR-10 booking reference. The seed (F-00) uses it now; F-04 (Issue #5) adds the other booking rules and UNIT-03.
export const formatReference = (year: number, seq: number): string => {
  if (!Number.isInteger(seq) || seq < 1 || seq > 999_999) throw new RangeError(`Booking sequence out of range: ${seq}`);
  return `BK-${year}-${String(seq).padStart(6, '0')}`;
};
