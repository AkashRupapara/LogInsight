#!/usr/bin/env node
/**
 * Generates two example Zscaler-style web proxy log files for LogInsight:
 *   - zscaler_normal.log          baseline traffic, no anomalies
 *   - zscaler_with_anomalies.log  same baseline + 4 deliberately embedded
 *                                 anomalies (one per detection rule)
 *
 * Plain Node.js, no dependencies. Run from the repo root:
 *   node sample-logs/generate-sample-logs.js
 */

const fs = require('fs');
const path = require('path');

// Deterministic PRNG (mulberry32) so re-running produces the same files.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const USERS = [
  { username: 'jsmith', department: 'Engineering', ip: '10.0.1.15' },
  { username: 'agarcia', department: 'Sales', ip: '10.0.2.20' },
  { username: 'khan', department: 'Marketing', ip: '10.0.4.8' },
  { username: 'rlee', department: 'Engineering', ip: '10.0.1.30' },
  { username: 'bwong', department: 'Finance', ip: '10.0.3.5' },
  { username: 'mpatel', department: 'HR', ip: '10.0.5.12' },
  { username: 'tnguyen', department: 'Sales', ip: '10.0.2.44' },
];

const NORMAL_DOMAINS = {
  General: ['example.com', 'wikipedia.example'],
  Business: ['salesforce.example', 'docs.example'],
  News: ['news.example', 'headlines.example'],
  'Social Networking': ['social.example', 'linkedin.example'],
  Shopping: ['shop.example', 'store.example'],
  'Search Engines': ['search.example', 'lookup.example'],
  'Streaming Media': ['video.example', 'music.example'],
};
const NORMAL_CATEGORIES = Object.keys(NORMAL_DOMAINS);

function randomChoice(rnd, arr) {
  return arr[Math.floor(rnd() * arr.length)];
}

function csvLine(fields) {
  return fields.map((f) => (f === null || f === undefined ? '' : String(f))).join(',');
}

function makeLine({ ts, user, dstIp, url, method, action, reason, category, malwareCategory, threatName, bytesReq, bytesRes, respCode }) {
  return csvLine([
    ts.toISOString(),
    user.username,
    user.department,
    user.ip,
    dstIp,
    url,
    method,
    action,
    reason || '',
    category || '',
    malwareCategory || '',
    threatName || '',
    bytesReq,
    bytesRes,
    respCode,
    'Mozilla/5.0',
  ]);
}

function generateNormalEntry(rnd, ts, user) {
  const category = randomChoice(rnd, NORMAL_CATEGORIES);
  const domain = randomChoice(rnd, NORMAL_DOMAINS[category]);
  return makeLine({
    ts,
    user,
    dstIp: '93.184.216.34',
    url: `https://${domain}/${Math.floor(rnd() * 100000).toString(36)}`,
    method: 'GET',
    action: 'Allowed',
    category,
    bytesReq: 100 + Math.floor(rnd() * 2000),
    bytesRes: 500 + Math.floor(rnd() * 50000),
    respCode: 200,
  });
}

function generateBaseline(rnd, dayStart, hours, perUserPerHour) {
  const lines = [];
  for (let h = 0; h < hours; h++) {
    for (const user of USERS) {
      for (let i = 0; i < perUserPerHour; i++) {
        const ts = new Date(dayStart.getTime() + h * 3600_000 + Math.floor(rnd() * 3600) * 1000);
        lines.push({ ts, line: generateNormalEntry(rnd, ts, user) });
      }
    }
  }
  return lines;
}

function generateAnomalies(rnd, dayStart) {
  const lines = [];
  const burstUser = USERS[1]; // agarcia
  const burstStart = new Date(dayStart.getTime() + 10 * 3600_000); // 10:00 UTC

  // 1. Rate spike: 12 requests from the same IP within 40 seconds.
  for (let i = 0; i < 12; i++) {
    const ts = new Date(burstStart.getTime() + i * 3500);
    lines.push({
      ts,
      line: makeLine({
        ts,
        user: burstUser,
        dstIp: '198.51.100.10',
        url: `https://ads.example/${i}`,
        method: 'GET',
        action: 'Allowed',
        category: 'Advertising',
        bytesReq: 128,
        bytesRes: 512,
        respCode: 200,
      }),
    });
  }

  // 2. Blocked / malware hits.
  const malwareUser = USERS[0]; // jsmith
  const malwareTs = new Date(dayStart.getTime() + 13 * 3600_000 + 15 * 60_000);
  lines.push({
    ts: malwareTs,
    line: makeLine({
      ts: malwareTs,
      user: malwareUser,
      dstIp: '198.51.100.20',
      url: 'https://malicious.example/payload.exe',
      method: 'GET',
      action: 'Blocked',
      reason: 'Malware',
      category: 'Malware Sites',
      malwareCategory: 'Trojan',
      threatName: 'Trojan.GenKD.Sample',
      bytesReq: 256,
      bytesRes: 0,
      respCode: 403,
    }),
  });

  const phishUser = USERS[3]; // rlee
  const phishTs = new Date(dayStart.getTime() + 13 * 3600_000 + 40 * 60_000);
  lines.push({
    ts: phishTs,
    line: makeLine({
      ts: phishTs,
      user: phishUser,
      dstIp: '198.51.100.30',
      url: 'https://phish.example/login',
      method: 'POST',
      action: 'Blocked',
      reason: 'Phishing',
      category: 'Phishing',
      bytesReq: 128,
      bytesRes: 0,
      respCode: 403,
    }),
  });

  // 3. Off-hours large transfer (2:30am UTC, ~65MB upload).
  const exfilUser = USERS[4]; // bwong
  const exfilTs = new Date(dayStart.getTime() + 2 * 3600_000 + 30 * 60_000);
  lines.push({
    ts: exfilTs,
    line: makeLine({
      ts: exfilTs,
      user: exfilUser,
      dstIp: '203.0.113.44',
      url: 'https://fileshare.example/archive.zip',
      method: 'POST',
      action: 'Allowed',
      category: 'File Sharing',
      bytesReq: 1024,
      bytesRes: 65 * 1024 * 1024,
      respCode: 200,
    }),
  });

  // 4. Rare category, seen only this once in the file.
  const rareUser = USERS[5]; // mpatel
  const rareTs = new Date(dayStart.getTime() + 15 * 3600_000 + 5 * 60_000);
  lines.push({
    ts: rareTs,
    line: makeLine({
      ts: rareTs,
      user: rareUser,
      dstIp: '198.51.100.40',
      url: 'https://gov-portal.example/forms',
      method: 'GET',
      action: 'Allowed',
      category: 'Government',
      bytesReq: 512,
      bytesRes: 4096,
      respCode: 200,
    }),
  });

  return lines;
}

function writeLog(filePath, entries) {
  const sorted = [...entries].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const contents = sorted.map((e) => e.line).join('\n') + '\n';
  fs.writeFileSync(filePath, contents);
  console.log(`Wrote ${sorted.length} lines to ${filePath}`);
}

function main() {
  const outDir = __dirname;
  const dayStart = new Date('2026-08-03T00:00:00Z');

  const normalRnd = mulberry32(42);
  const normalEntries = generateBaseline(normalRnd, dayStart, 24, 2);
  writeLog(path.join(outDir, 'zscaler_normal.log'), normalEntries);

  const anomalyRnd = mulberry32(42);
  const baseline = generateBaseline(anomalyRnd, dayStart, 24, 2);
  const anomalies = generateAnomalies(anomalyRnd, dayStart);
  writeLog(path.join(outDir, 'zscaler_with_anomalies.log'), [...baseline, ...anomalies]);
}

main();
