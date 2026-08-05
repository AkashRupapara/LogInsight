import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface UploadRecord {
  id: number;
  filename: string;
  status: 'processing' | 'complete' | 'failed';
  total_lines: number;
  parsed_lines: number;
  uploaded_at: string;
}

export function UploadPage() {
  const { user, logout } = useAuth();
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
    <div className="page">
      <header className="page-header">
        <h1>LogInsight</h1>
        <p>
          Signed in as {user?.email} · <button onClick={logout}>Log out</button>
        </p>
      </header>

      <section className="upload-box">
        <input ref={fileInputRef} type="file" accept=".log,.txt" />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Uploading & analyzing…' : 'Upload log file'}
        </button>
        {error && <p className="form-error">{error}</p>}
      </section>

      <section>
        <h2>Your uploads</h2>
        {uploads.length === 0 && <p>No uploads yet.</p>}
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
                <td>{u.status}</td>
                <td>
                  {u.parsed_lines} / {u.total_lines}
                </td>
                <td>{new Date(u.uploaded_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
