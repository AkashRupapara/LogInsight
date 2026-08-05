import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogTable, type Anomaly, type LogEntry } from './LogTable';

const entries: LogEntry[] = [
  {
    id: 1,
    ts: '2026-08-04T09:00:00Z',
    username: 'jsmith',
    src_ip: '10.0.1.15',
    domain: 'example.com',
    action: 'Allowed',
    url_category: 'General',
  },
  {
    id: 2,
    ts: '2026-08-04T09:05:00Z',
    username: 'jsmith',
    src_ip: '10.0.1.16',
    domain: 'malicious.example',
    action: 'Blocked',
    url_category: 'Malware Sites',
  },
  {
    id: 3,
    ts: '2026-08-04T09:10:00Z',
    username: 'agarcia',
    src_ip: '10.0.1.17',
    domain: 'news.example',
    action: 'Allowed',
    url_category: 'News',
  },
];

const anomalies: Anomaly[] = [
  {
    id: 100,
    log_entry_id: 2,
    rule_type: 'malware_category',
    description: 'Malware-category hit',
    confidence: 0.95,
    severity: 'high',
  },
];

function anomaliesByEntryMap(): Map<number, Anomaly[]> {
  const map = new Map<number, Anomaly[]>();
  for (const a of anomalies) {
    map.set(a.log_entry_id, [...(map.get(a.log_entry_id) ?? []), a]);
  }
  return map;
}

function rowDomains(): string[] {
  const rows = screen.getAllByRole('row').slice(1); // drop header row
  return rows
    .filter((row) => within(row).queryAllByRole('cell').length > 0)
    .map((row) => within(row).getAllByRole('cell')[3].textContent ?? '');
}

describe('LogTable', () => {
  it('shows only anomalous rows when "Show anomalies only" is checked', () => {
    render(<LogTable entries={entries} anomaliesByEntry={anomaliesByEntryMap()} />);

    expect(rowDomains()).toHaveLength(3);

    fireEvent.click(screen.getByLabelText(/show anomalies only/i));

    expect(rowDomains()).toEqual(['malicious.example']);
  });

  it('reverses order when the Time header is clicked twice', () => {
    render(<LogTable entries={entries} anomaliesByEntry={anomaliesByEntryMap()} />);

    // Default sort is time ascending.
    expect(rowDomains()).toEqual(['example.com', 'malicious.example', 'news.example']);

    fireEvent.click(screen.getByText('Time'));

    expect(rowDomains()).toEqual(['news.example', 'malicious.example', 'example.com']);
  });
});
