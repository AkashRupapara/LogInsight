import fs from 'fs';
import { getPool } from '../db/pool';
import { parseZscalerLine } from './zscalerParser';
import { detectAnomalies, type StoredLogEntry } from './anomalyEngine';

export async function ingestUploadFile(uploadId: number, filePath: string): Promise<void> {
  const pool = getPool();
  const contents = fs.readFileSync(filePath, 'utf-8');
  const lines = contents.split('\n').filter((line) => line.trim().length > 0);

  const client = await pool.connect();
  const storedEntries: StoredLogEntry[] = [];

  try {
    await client.query('BEGIN');

    for (const line of lines) {
      try {
        const entry = parseZscalerLine(line);
        const result = await client.query<{ id: number }>(
          `INSERT INTO log_entries
             (upload_id, ts, username, department, src_ip, dst_ip, url, domain, http_method,
              action, reason, url_category, malware_category, threat_name, bytes_req, bytes_res,
              resp_code, user_agent, raw_line)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
           RETURNING id`,
          [
            uploadId,
            entry.ts,
            entry.username,
            entry.department,
            entry.src_ip,
            entry.dst_ip,
            entry.url,
            entry.domain,
            entry.http_method,
            entry.action,
            entry.reason,
            entry.url_category,
            entry.malware_category,
            entry.threat_name,
            entry.bytes_req,
            entry.bytes_res,
            entry.resp_code,
            entry.user_agent,
            entry.raw_line,
          ]
        );
        storedEntries.push({ ...entry, id: result.rows[0].id });
      } catch {
        // Skip malformed lines - they don't block ingestion of the rest of the file.
      }
    }

    const anomalies = detectAnomalies(storedEntries);
    for (const anomaly of anomalies) {
      await client.query(
        `INSERT INTO anomalies (log_entry_id, upload_id, rule_type, description, confidence, severity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          anomaly.log_entry_id,
          uploadId,
          anomaly.rule_type,
          anomaly.description,
          anomaly.confidence,
          anomaly.severity,
        ]
      );
    }

    await client.query(
      `UPDATE uploads SET status = 'complete', parsed_lines = $2 WHERE id = $1`,
      [uploadId, storedEntries.length]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await pool.query(`UPDATE uploads SET status = 'failed' WHERE id = $1`, [uploadId]);
    throw err;
  } finally {
    client.release();
  }
}
