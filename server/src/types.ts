import type { Role } from '@prisma/client';

/** The only user shape the API ever returns: no passwordHash, no isActive. */
export type PublicUser = { id: number; name: string; email: string; role: Role };

export const toPublicUser = ({ id, name, email, role }: PublicUser): PublicUser => ({ id, name, email, role });

declare global {
  namespace Express {
    interface Request { user?: PublicUser }
  }
}

declare module 'express-session' {
  interface SessionData { userId: number }
}
