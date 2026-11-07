import type { Agent } from 'supertest';
import { setNow } from '../src/utils/clock.js';

/** Logs the agent in as a seeded account (password from SEED_PASSWORD); returns the response. */
export const loginAs = (agent: Agent, email: string) =>
  agent.post('/api/auth/login').send({ email, password: process.env.SEED_PASSWORD });

/** Freezes server time for rule checks; call unfreezeClock() in afterEach. */
export const freezeClock = (iso: string) => setNow(new Date(iso));
export const unfreezeClock = () => setNow(null);
