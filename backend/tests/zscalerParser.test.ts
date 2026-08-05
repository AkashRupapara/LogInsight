import { parseZscalerLine } from '../src/services/zscalerParser';

describe('parseZscalerLine', () => {
  it('parses a well-formed Zscaler log line', () => {
    const line =
      '2026-08-04T09:15:23Z,jsmith,Engineering,10.0.1.15,93.184.216.34,https://example.com/path,GET,Allowed,,General,,,512,4096,200,Mozilla/5.0';

    const entry = parseZscalerLine(line);

    expect(entry.username).toBe('jsmith');
    expect(entry.src_ip).toBe('10.0.1.15');
    expect(entry.action).toBe('Allowed');
    expect(entry.domain).toBe('example.com');
    expect(entry.bytes_res).toBe(4096);
  });

  it('throws on a line with the wrong number of fields', () => {
    expect(() => parseZscalerLine('not,enough,fields')).toThrow();
  });
});
