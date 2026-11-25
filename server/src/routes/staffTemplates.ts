import { Router, type Request, type Response } from 'express';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createTemplate, deleteTemplate, generate, listTemplates, updateTemplate } from '../services/templateService.js';

export const staffTemplatesRouter = Router();
staffTemplatesRouter.use(requireAuth, requireRole('STAFF'));

const tid = (raw: string) => {
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  if (id < 1) throw new AppError(404, 'NOT_FOUND', 'Template not found.');
  return id;
};
const body = (raw: unknown) => (raw && typeof raw === 'object' ? raw as Record<string, unknown> : {});
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => {
  fn(req, res).catch(next);
};

// F-14 §3: the session staff member's own templates only (BR-08, BR-09).
staffTemplatesRouter.get('/', wrap(async (req, res) => { res.json({ templates: await listTemplates(req.user!.id) }); }));
staffTemplatesRouter.post('/', wrap(async (req, res) => { res.status(201).json({ template: await createTemplate(req.user!.id, body(req.body)) }); }));
staffTemplatesRouter.put('/:id', wrap(async (req, res) => { res.json({ template: await updateTemplate(req.user!.id, tid(req.params.id), body(req.body)) }); }));
staffTemplatesRouter.delete('/:id', wrap(async (req, res) => { await deleteTemplate(req.user!.id, tid(req.params.id)); res.status(204).end(); }));
staffTemplatesRouter.post('/:id/generate', wrap(async (req, res) => { res.json(await generate(req.user!.id, tid(req.params.id), body(req.body))); }));
