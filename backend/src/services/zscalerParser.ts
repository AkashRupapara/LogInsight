export interface ParsedLogEntry {
  ts: string;
  username: string | null;
  department: string | null;
  src_ip: string;
  dst_ip: string | null;
  url: string | null;
  domain: string | null;
  http_method: string | null;
  action: 'Allowed' | 'Blocked';
  reason: string | null;
  url_category: string | null;
  malware_category: string | null;
  threat_name: string | null;
  bytes_req: number;
  bytes_res: number;
  resp_code: number | null;
  user_agent: string | null;
  raw_line: string;
}

const FIELD_COUNT = 16;

// CSV field order: timestamp,user,department,srcip,dstip,url,method,action,
// reason,urlcategory,malwarecategory,threatname,bytesreq,bytesres,respcode,useragent
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function nullIfEmpty(value: string): string | null {
  return value.trim().length === 0 ? null : value.trim();
}

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function parseZscalerLine(line: string): ParsedLogEntry {
  const fields = splitCsvLine(line);
  if (fields.length !== FIELD_COUNT) {
    throw new Error(`Expected ${FIELD_COUNT} fields, got ${fields.length}`);
  }

  const [
    timestamp,
    user,
    department,
    srcIp,
    dstIp,
    url,
    method,
    action,
    reason,
    urlCategory,
    malwareCategory,
    threatName,
    bytesReq,
    bytesRes,
    respCode,
    userAgent,
  ] = fields;

  const ts = new Date(timestamp.trim());
  if (Number.isNaN(ts.getTime())) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  if (action.trim() !== 'Allowed' && action.trim() !== 'Blocked') {
    throw new Error(`Invalid action: ${action}`);
  }

  if (srcIp.trim().length === 0) {
    throw new Error('Missing src_ip');
  }

  const parsedUrl = nullIfEmpty(url);

  return {
    ts: ts.toISOString(),
    username: nullIfEmpty(user),
    department: nullIfEmpty(department),
    src_ip: srcIp.trim(),
    dst_ip: nullIfEmpty(dstIp),
    url: parsedUrl,
    domain: extractDomain(parsedUrl),
    http_method: nullIfEmpty(method),
    action: action.trim() as 'Allowed' | 'Blocked',
    reason: nullIfEmpty(reason),
    url_category: nullIfEmpty(urlCategory),
    malware_category: nullIfEmpty(malwareCategory),
    threat_name: nullIfEmpty(threatName),
    bytes_req: Number(bytesReq) || 0,
    bytes_res: Number(bytesRes) || 0,
    resp_code: respCode.trim() ? Number(respCode) : null,
    user_agent: nullIfEmpty(userAgent),
    raw_line: line,
  };
}
