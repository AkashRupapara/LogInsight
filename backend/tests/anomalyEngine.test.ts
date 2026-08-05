import {
  detectRateSpikes,
  detectBlockedOrMalware,
  detectOffHoursLargeTransfer,
  detectRareCategories,
  type StoredLogEntry,
} from '../src/services/anomalyEngine';

function makeEntry(overrides: Partial<StoredLogEntry> = {}): StoredLogEntry {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 1_000_000),
    ts: '2026-08-04T12:00:00Z',
    username: 'jsmith',
    department: 'Engineering',
    src_ip: '10.0.1.15',
    dst_ip: '93.184.216.34',
    url: 'https://example.com',
    domain: 'example.com',
    http_method: 'GET',
    action: 'Allowed',
    reason: null,
    url_category: 'General',
    malware_category: null,
    threat_name: null,
    bytes_req: 100,
    bytes_res: 1000,
    resp_code: 200,
    user_agent: 'Mozilla/5.0',
    raw_line: 'raw',
    ...overrides,
  };
}

describe('detectRateSpikes', () => {
  it('flags a burst of requests from the same IP within the time window', () => {
    const entries = Array.from({ length: 6 }, (_, i) =>
      makeEntry({ id: i, ts: `2026-08-04T12:00:0${i}Z`, src_ip: '10.0.1.15' })
    );

    const candidates = detectRateSpikes(entries);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].rule_type).toBe('rate_spike');
  });

  it('emits exactly one candidate per entry, not one per sliding-window step', () => {
    const entries = Array.from({ length: 6 }, (_, i) =>
      makeEntry({ id: i, ts: `2026-08-04T12:00:0${i}Z`, src_ip: '10.0.1.15' })
    );

    const candidates = detectRateSpikes(entries);
    const entryIds = candidates.map((c) => c.log_entry_id);

    expect(new Set(entryIds).size).toBe(entryIds.length);
  });
});

describe('detectBlockedOrMalware', () => {
  it('flags a request with a malware category as high confidence', () => {
    const entries = [
      makeEntry({ id: 1, action: 'Blocked', malware_category: 'Trojan', threat_name: 'Trojan.Generic' }),
    ];

    const candidates = detectBlockedOrMalware(entries);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].rule_type).toBe('malware_category');
    expect(candidates[0].severity).toBe('high');
  });
});

describe('detectOffHoursLargeTransfer', () => {
  it('flags a large transfer that happens outside business hours', () => {
    const entries = [makeEntry({ id: 1, ts: '2026-08-04T02:30:00Z', bytes_res: 50 * 1024 * 1024 })];

    const candidates = detectOffHoursLargeTransfer(entries);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].rule_type).toBe('off_hours_large_transfer');
  });

  it('does not flag a large transfer during business hours', () => {
    const entries = [makeEntry({ id: 1, ts: '2026-08-04T14:30:00Z', bytes_res: 50 * 1024 * 1024 })];

    expect(detectOffHoursLargeTransfer(entries)).toHaveLength(0);
  });
});

describe('detectRareCategories', () => {
  it('flags a suspicious category regardless of frequency', () => {
    const entries = [makeEntry({ id: 1, url_category: 'Malware Sites' })];

    const candidates = detectRareCategories(entries);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].rule_type).toBe('suspicious_category');
  });
});
