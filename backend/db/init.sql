-- LogInsight database schema
-- Applied automatically by the postgres container on first boot
-- (mounted into /docker-entrypoint-initdb.d/ via docker-compose.yml).

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'complete', 'failed')),
    total_lines INTEGER NOT NULL DEFAULT 0,
    parsed_lines INTEGER NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_entries (
    id BIGSERIAL PRIMARY KEY,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL,
    username TEXT,
    department TEXT,
    src_ip TEXT NOT NULL,
    dst_ip TEXT,
    url TEXT,
    domain TEXT,
    http_method TEXT,
    action TEXT NOT NULL CHECK (action IN ('Allowed', 'Blocked')),
    reason TEXT,
    url_category TEXT,
    malware_category TEXT,
    threat_name TEXT,
    bytes_req INTEGER NOT NULL DEFAULT 0,
    bytes_res INTEGER NOT NULL DEFAULT 0,
    resp_code INTEGER,
    user_agent TEXT,
    raw_line TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_log_entries_upload_ts ON log_entries (upload_id, ts);
CREATE INDEX IF NOT EXISTS idx_log_entries_upload_src_ip ON log_entries (upload_id, src_ip);

CREATE TABLE IF NOT EXISTS anomalies (
    id SERIAL PRIMARY KEY,
    log_entry_id BIGINT NOT NULL REFERENCES log_entries(id) ON DELETE CASCADE,
    upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL,
    description TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_upload ON anomalies (upload_id);
