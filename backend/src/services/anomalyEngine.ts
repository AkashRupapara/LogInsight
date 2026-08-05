import type { ParsedLogEntry } from './zscalerParser';

export type StoredLogEntry = ParsedLogEntry & { id: number };

export interface AnomalyCandidate {
  log_entry_id: number;
  rule_type: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
}

const RATE_SPIKE_WINDOW_MS = 60 * 1000;
const RATE_SPIKE_THRESHOLD = 5;
const LARGE_TRANSFER_BYTES = 10 * 1024 * 1024; // 10MB
const OFF_HOURS_START = 0;
const OFF_HOURS_END = 5;
const SUSPICIOUS_CATEGORIES = new Set(['Malware Sites', 'Phishing', 'Botnet']);

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function severityFromConfidence(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

/** Flags bursts of requests from the same source IP within a short rolling window. */
export function detectRateSpikes(entries: StoredLogEntry[]): AnomalyCandidate[] {
  const candidates: AnomalyCandidate[] = [];
  const byIp = new Map<string, StoredLogEntry[]>();

  for (const entry of entries) {
    const list = byIp.get(entry.src_ip) ?? [];
    list.push(entry);
    byIp.set(entry.src_ip, list);
  }

  for (const [ip, ipEntries] of byIp) {
    const sorted = [...ipEntries].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );

    // Track the largest burst each entry was ever part of, rather than emitting
    // a candidate per sliding-window step - otherwise one burst produces a
    // separate near-duplicate anomaly for every step it overlaps.
    const maxWindowCount = new Array(sorted.length).fill(0);

    let windowStart = 0;
    for (let i = 0; i < sorted.length; i++) {
      const windowEndTime = new Date(sorted[i].ts).getTime();
      while (
        windowStart < i &&
        windowEndTime - new Date(sorted[windowStart].ts).getTime() > RATE_SPIKE_WINDOW_MS
      ) {
        windowStart++;
      }
      const windowCount = i - windowStart + 1;
      for (let j = windowStart; j <= i; j++) {
        if (windowCount > maxWindowCount[j]) maxWindowCount[j] = windowCount;
      }
    }

    for (let idx = 0; idx < sorted.length; idx++) {
      const windowCount = maxWindowCount[idx];
      if (windowCount < RATE_SPIKE_THRESHOLD) continue;

      const confidence = clampConfidence(windowCount / (RATE_SPIKE_THRESHOLD * 2));
      candidates.push({
        log_entry_id: sorted[idx].id,
        rule_type: 'rate_spike',
        description: `${windowCount} requests from ${ip} within ${RATE_SPIKE_WINDOW_MS / 1000}s (threshold: ${RATE_SPIKE_THRESHOLD})`,
        confidence,
        severity: severityFromConfidence(confidence),
      });
    }
  }

  return candidates;
}

/** Flags requests the proxy itself blocked, especially malware/threat hits. */
export function detectBlockedOrMalware(entries: StoredLogEntry[]): AnomalyCandidate[] {
  const candidates: AnomalyCandidate[] = [];

  for (const entry of entries) {
    if (entry.malware_category) {
      candidates.push({
        log_entry_id: entry.id,
        rule_type: 'malware_category',
        description: `Blocked request categorized as malware (${entry.malware_category}${entry.threat_name ? `: ${entry.threat_name}` : ''})`,
        confidence: 0.95,
        severity: 'high',
      });
    } else if (entry.action === 'Blocked') {
      candidates.push({
        log_entry_id: entry.id,
        rule_type: 'blocked_request',
        description: `Request blocked by proxy${entry.reason ? ` (${entry.reason})` : ''}`,
        confidence: 0.7,
        severity: 'medium',
      });
    }
  }

  return candidates;
}

/** Flags large data transfers happening outside normal business hours. */
export function detectOffHoursLargeTransfer(entries: StoredLogEntry[]): AnomalyCandidate[] {
  const candidates: AnomalyCandidate[] = [];

  for (const entry of entries) {
    const hour = new Date(entry.ts).getUTCHours();
    const isOffHours = hour >= OFF_HOURS_START && hour <= OFF_HOURS_END;
    if (!isOffHours || entry.bytes_res < LARGE_TRANSFER_BYTES) continue;

    const confidence = clampConfidence(0.5 + entry.bytes_res / (LARGE_TRANSFER_BYTES * 4));
    candidates.push({
      log_entry_id: entry.id,
      rule_type: 'off_hours_large_transfer',
      description: `${(entry.bytes_res / (1024 * 1024)).toFixed(1)}MB transferred at ${hour}:00 UTC, outside typical business hours`,
      confidence,
      severity: severityFromConfidence(confidence),
    });
  }

  return candidates;
}

/** Flags requests to categories that are rare or inherently suspicious across the whole upload. */
export function detectRareCategories(entries: StoredLogEntry[]): AnomalyCandidate[] {
  const candidates: AnomalyCandidate[] = [];
  const categoryCounts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.url_category) continue;
    categoryCounts.set(entry.url_category, (categoryCounts.get(entry.url_category) ?? 0) + 1);
  }

  for (const entry of entries) {
    if (!entry.url_category) continue;
    const count = categoryCounts.get(entry.url_category) ?? 0;

    if (SUSPICIOUS_CATEGORIES.has(entry.url_category)) {
      candidates.push({
        log_entry_id: entry.id,
        rule_type: 'suspicious_category',
        description: `Request to a category flagged as suspicious: "${entry.url_category}"`,
        confidence: 0.85,
        severity: 'high',
      });
    } else if (entries.length >= 10 && count === 1) {
      candidates.push({
        log_entry_id: entry.id,
        rule_type: 'rare_category',
        description: `Category "${entry.url_category}" seen only once in this upload (${entries.length} entries total)`,
        confidence: 0.35,
        severity: 'low',
      });
    }
  }

  return candidates;
}

export function detectAnomalies(entries: StoredLogEntry[]): AnomalyCandidate[] {
  return [
    ...detectRateSpikes(entries),
    ...detectBlockedOrMalware(entries),
    ...detectOffHoursLargeTransfer(entries),
    ...detectRareCategories(entries),
  ];
}
