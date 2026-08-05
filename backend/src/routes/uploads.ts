import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { createUpload, getUploadForUser, listUploadsForUser } from '../services/uploadService';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const ALLOWED_EXTENSIONS = new Set(['.log', '.txt']);
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
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

    const contents = fs.readFileSync(req.file.path, 'utf-8');
    const totalLines = contents.split('\n').filter((line) => line.trim().length > 0).length;

    const record = await createUpload(req.userId!, req.file.originalname, req.file.path, totalLines);
    res.status(201).json(record);
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
