import { Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { getUploadForUser } from '../services/uploadService';
import { getEntries, getSummary, getTimeline } from '../services/analyticsService';

export const logsRouter = Router({ mergeParams: true });

logsRouter.use(requireAuth);

// Confirms the upload exists and belongs to the caller before any analytics query runs.
logsRouter.use(
  asyncHandler(async (req: AuthenticatedRequest, res, next) => {
    const uploadId = Number(req.params.uploadId);
    if (Number.isNaN(uploadId)) {
      res.status(400).json({ error: 'Invalid upload id' });
      return;
    }
    const upload = await getUploadForUser(req.userId!, uploadId);
    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }
    next();
  })
);

logsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const summary = await getSummary(Number(req.params.uploadId));
    res.json(summary);
  })
);

logsRouter.get(
  '/timeline',
  asyncHandler(async (req, res) => {
    const timeline = await getTimeline(Number(req.params.uploadId));
    res.json(timeline);
  })
);

logsRouter.get(
  '/entries',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const entries = await getEntries(Number(req.params.uploadId), limit, offset);
    res.json(entries);
  })
);
