import path from 'path';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { createUpload, getUploadForUser, listUploadsForUser } from '../services/uploadService';
import { ingestUploadFile } from '../services/ingestService';

const ALLOWED_EXTENSIONS = new Set(['.log', '.txt']);
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// In-memory storage: the file is parsed into log_entries within this same
// request and never needs to touch disk. This also makes the app deployable
// on serverless platforms (e.g. Vercel) with no writable/persistent filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('Only .log and .txt files are allowed'));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

uploadsRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded (expected field name "file")' });
      return;
    }

    const contents = req.file.buffer.toString('utf-8');
    const totalLines = contents.split('\n').filter((line) => line.trim().length > 0).length;

    const record = await createUpload(req.userId!, req.file.originalname, null, totalLines);
    await ingestUploadFile(record.id, req.file.buffer);
    const finalRecord = await getUploadForUser(req.userId!, record.id);
    res.status(201).json(finalRecord);
  })
);

uploadsRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const records = await listUploadsForUser(req.userId!);
    res.json(records);
  })
);

uploadsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const uploadId = Number(req.params.id);
    if (Number.isNaN(uploadId)) {
      res.status(400).json({ error: 'Invalid upload id' });
      return;
    }
    const record = await getUploadForUser(req.userId!, uploadId);
    if (!record) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }
    res.json(record);
  })
);

// Catches multer errors (bad file type, over size limit) and reports them as 400s
// instead of falling through to the generic 500 handler.
uploadsRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError || err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});
