import { getPool } from '../db/pool';

export interface Upload {
  id: number;
  user_id: number;
  filename: string;
  file_path: string;
  status: 'processing' | 'complete' | 'failed';
  total_lines: number;
  parsed_lines: number;
  uploaded_at: string;
}

export async function createUpload(
  userId: number,
  filename: string,
  filePath: string,
  totalLines: number
): Promise<Upload> {
  const pool = getPool();
  const result = await pool.query<Upload>(
    `INSERT INTO uploads (user_id, filename, file_path, total_lines)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, filename, filePath, totalLines]
  );
  return result.rows[0];
}

export async function listUploadsForUser(userId: number): Promise<Upload[]> {
  const pool = getPool();
  const result = await pool.query<Upload>(
    `SELECT * FROM uploads WHERE user_id = $1 ORDER BY uploaded_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getUploadForUser(userId: number, uploadId: number): Promise<Upload | undefined> {
  const pool = getPool();
  const result = await pool.query<Upload>(
    `SELECT * FROM uploads WHERE id = $1 AND user_id = $2`,
    [uploadId, userId]
  );
  return result.rows[0];
}
