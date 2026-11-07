// Server time for every business rule; tests freeze it with setNow().
let frozen: Date | null = null;

export const now = (): Date => (frozen ? new Date(frozen) : new Date());
export const setNow = (date: Date | null): void => { frozen = date; };
