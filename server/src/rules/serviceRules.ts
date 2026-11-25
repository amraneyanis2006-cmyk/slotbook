// Pure service-catalogue rules (F-11 §2).

export type ServiceInput = { name?: string; durationMin?: number; isActive?: boolean };
const NAME = 'Enter a name of 3 to 60 characters.';
const DURATION = 'Choose a duration from 15 to 120 minutes in 15-minute steps.';

/** Name trimmed with inner spaces collapsed (3–60), duration 15–120 by 15, isActive boolean; PATCH (partial) needs one field. */
export function validateService(input: Record<string, unknown>, { partial = false } = {}): ServiceInput | { fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const out: ServiceInput = {};
  if (!partial || input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 3 || name.length > 60) fields.name = NAME;
    else out.name = name;
  }
  if (!partial || input.durationMin !== undefined) {
    const d = input.durationMin;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 15 || d > 120 || d % 15 !== 0) fields.durationMin = DURATION;
    else out.durationMin = d;
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') fields.isActive = 'Choose active or inactive.';
    else out.isActive = input.isActive;
  }
  if (Object.keys(fields).length) return { fields };
  if (partial && !Object.keys(out).length) return { fields: { _: 'Change at least one field.' } };
  return out;
}
