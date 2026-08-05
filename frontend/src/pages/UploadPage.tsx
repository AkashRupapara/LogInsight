import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';

interface UploadRecord {
  id: number;
  filename: string;
  status: 'processing' | 'complete' | 'failed';
  total_lines: number;
  parsed_lines: number;
  uploaded_at: string;
}

function StatusPill({ status }: { status: UploadRecord['status'] }) {
  return <span className={`status-pill status-pill-${status}`}>{status}</span>;
}

export function UploadPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const records = await apiFetch<UploadRecord[]>('/uploads');
    setUploads(records);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load uploads'));
  }, []);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiFetch('/uploads', { method: 'POST', body: formData });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <AppHeader />
      <div className="page">
        <section>
          <h1>Upload a log file</h1>
          <p className="section-hint">
            Upload a Zscaler-style web proxy log (<code>.log</code> or <code>.txt</code>, up to 25MB).
            We parse it into individual requests, scan for anomalies, and build a timeline and
            summary you can drill into on the next screen — usually within a few seconds.
          </p>
          <div className="upload-box">
            <input ref={fileInputRef} type="file" accept=".log,.txt" />
            <button onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading & analyzing…' : 'Upload log file'}
            </button>
            {error && <p className="form-error">{error}</p>}
          </div>
        </section>

        <section>
          <h2>Your uploads</h2>
          {uploads.length === 0 && (
            <p className="empty-state">No uploads yet — upload a log file above to get started.</p>
          )}
          {uploads.length > 0 && (
            <div className="uploads-card">
              <table className="uploads-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Status</th>
                    <th>Lines parsed</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link to={`/uploads/${u.id}`}>{u.filename}</Link>
                      </td>
                      <td>
                        <StatusPill status={u.status} />
                      </td>
                      <td>
                        {u.parsed_lines} / {u.total_lines}
                      </td>
                      <td>{new Date(u.uploaded_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
