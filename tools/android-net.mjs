// Reads a packet capture of the Android emulator (started with `-tcpdump file.pcap`) and lists every host the emulator
// looked up or opened a TLS connection to in a time window, with the bytes sent to each. It is the check that does not
// depend on the app's own "What left this phone" list: the capture is made by the emulator, outside Android.
//
// What it can show: where traffic went and how much. What it cannot show: the words inside, which are encrypted. Those
// are shown by the app's list and by the second check in Kotlin (tools/android-e2e.mjs).
//
// Usage: node tools/android-net.mjs <capture.pcap> [--from=<ms since 1970>] [--to=<ms>] [--uid-bytes=<sent>,<received>]
//        Writes docs/evidence/android-net.json.
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const file = process.argv[2];
const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
let from = Number(arg('from', 0)), to = Number(arg('to', Infinity));
if (!file) { console.error('usage: node tools/android-net.mjs <capture.pcap> [--from=ms] [--to=ms]'); process.exit(2); }

// Hosts Spare Key is built to reach, and why. Anything else in the window is listed as "other" with its bytes, so a
// host that should not be there cannot hide in a total.
const EXPECTED = [
  [/^firebasevertexai\.googleapis\.com$|^generativelanguage\.googleapis\.com$/, 'Gemini through Firebase AI Logic (the plan, from finding types)'],
  [/^(content-)?firebaseappcheck\.googleapis\.com$/, 'App Check (shows it is the real app)'],
  [/^firebaseremoteconfig\.googleapis\.com$|^firebaseinstallations\.googleapis\.com$/, 'Remote Config and its install id (settings)'],
  [/^spare-key-app\.(web\.app|firebaseapp\.com)$/, 'Spare Key site (the App Check bridge page)'],
  [/(^|\.)recaptcha\.net$|^www\.google\.com$|^www\.gstatic\.com$|^recaptchaenterprise\.googleapis\.com$/, 'reCAPTCHA Enterprise (for App Check)'],
];
// Reporting hosts that must not appear: usage statistics, crash reports, ad and analytics collectors.
const FORBIDDEN = /firebaselogging|crashlytics|app-measurement|google-analytics|doubleclick|firebase-settings\.crashlytics|datatransport/i;

const buf = readFileSync(file);
const magic = buf.readUInt32LE(0);
const le = magic === 0xa1b2c3d4 || magic === 0xa1b23c4d;
if (!le && buf.readUInt32BE(0) !== 0xa1b2c3d4) { console.error('not a pcap file'); process.exit(2); }
const nanos = magic === 0xa1b23c4d;
const u32 = o => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
const linkType = u32(20);

const ipNames = new Map();    // remote address -> every host name a lookup gave for it (Google hosts share addresses)
const named = (ip, n) => (ipNames.get(ip) || ipNames.set(ip, new Set()).get(ip)).add(n);
const hosts = new Map();      // host -> { first, lookups, connections, sent, received }
const flows = new Map();      // one connection (remote address and port, local port) -> { sent, received, first, name }
const host = h => hosts.get(h) || hosts.set(h, { first: 0, lookups: 0, connections: 0 }).get(h);
const isLocal = a => /^(10\.|127\.|fe80:|fec0:|ff0|::1$|224\.|239\.|255\.)/.test(a) || a === '0.0.0.0' || a === '::';
const v6 = (b, o) => Array.from({ length: 8 }, (_, i) => b.readUInt16BE(o + i * 2).toString(16)).join(':').replace(/(^|:)0(:0)+(:|$)/, '::');

function dnsName(b, o, depth = 0) {
  const parts = [];
  while (o < b.length && depth < 8) {
    const len = b[o];
    if (!len) return [parts.join('.'), o + 1];
    if ((len & 0xc0) === 0xc0) { const [n] = dnsName(b, ((len & 0x3f) << 8) | b[o + 1], depth + 1); parts.push(n); return [parts.join('.'), o + 2]; }
    parts.push(b.toString('latin1', o + 1, o + 1 + len)); o += 1 + len;
  }
  return [parts.join('.'), o];
}
function dns(b, t) {
  if (b.length < 12) return;
  const answer = !!(b[2] & 0x80), qd = b.readUInt16BE(4), an = b.readUInt16BE(6);
  let o = 12, q = '';
  for (let i = 0; i < qd && o < b.length; i++) { [q, o] = dnsName(b, o); o += 4; }
  if (!q) return;
  if (!answer) { const h = host(q.toLowerCase()); h.lookups++; h.first ||= t; return; }
  for (let i = 0; i < an && o + 10 <= b.length; i++) {
    [, o] = dnsName(b, o);
    const type = b.readUInt16BE(o), len = b.readUInt16BE(o + 8); o += 10;
    if (type === 1 && len === 4) named(Array.from(b.subarray(o, o + 4)).join('.'), q.toLowerCase());
    if (type === 28 && len === 16) named(v6(b, o), q.toLowerCase());
    o += len;
  }
}
/** The server name in a TLS ClientHello, or null. */
function sni(b) {
  if (b.length < 43 || b[0] !== 0x16 || b[5] !== 0x01) return null;
  let o = 43;
  o += 1 + b[o]; if (o + 2 > b.length) return null;                 // session id
  o += 2 + b.readUInt16BE(o); if (o + 1 > b.length) return null;    // cipher suites
  o += 1 + b[o]; if (o + 2 > b.length) return null;                 // compression
  const end = Math.min(b.length, o + 2 + b.readUInt16BE(o)); o += 2;
  while (o + 4 <= end) {
    const type = b.readUInt16BE(o), len = b.readUInt16BE(o + 2); o += 4;
    if (type === 0 && o + 5 <= end) return b.toString('latin1', o + 5, o + 5 + b.readUInt16BE(o + 3)).toLowerCase();
    o += len;
  }
  return null;
}

// The emulator stamps packets with a clock that can be whole hours off (it wrote local time twice over on this PC).
// The file was last written when the last packet arrived, so the gap between the two, in whole hours, is the error.
let lastStamp = 0;
for (let o = 24; o + 16 <= buf.length; o += 16 + u32(o + 8)) lastStamp = u32(o) * 1000;
const clockFix = Math.round((lastStamp - statSync(file).mtimeMs) / 3600000) * 3600000;
from += from ? clockFix : 0; to += Number.isFinite(to) ? clockFix : 0;

let packets = 0, inWindow = 0, quic = 0;
for (let o = 24; o + 16 <= buf.length;) {
  const t = u32(o) * 1000 + Math.floor(u32(o + 4) / (nanos ? 1e6 : 1e3)), caplen = u32(o + 8);
  const p = buf.subarray(o + 16, o + 16 + caplen); o += 16 + caplen; packets++;
  let e = linkType === 1 ? 14 : linkType === 113 ? 16 : linkType === 101 ? 0 : -1;
  if (e < 0 || p.length < e + 20) continue;
  let ether = linkType === 1 ? p.readUInt16BE(12) : linkType === 113 ? p.readUInt16BE(14) : (p[0] >> 4) === 6 ? 0x86dd : 0x0800;
  if (ether === 0x8100) { ether = p.readUInt16BE(e + 2); e += 4; }
  let proto, src, dst, l4, total;
  if (ether === 0x0800) { proto = p[e + 9]; src = Array.from(p.subarray(e + 12, e + 16)).join('.'); dst = Array.from(p.subarray(e + 16, e + 20)).join('.'); l4 = e + (p[e] & 15) * 4; total = p.readUInt16BE(e + 2); }
  else if (ether === 0x86dd && p.length >= e + 40) { proto = p[e + 6]; src = v6(p, e + 8); dst = v6(p, e + 24); l4 = e + 40; total = 40 + p.readUInt16BE(e + 4); }
  else continue;
  if (proto === 17 && p.length >= l4 + 8) {
    const sp = p.readUInt16BE(l4), dp = p.readUInt16BE(l4 + 2);
    if (sp === 53 || dp === 53) { dns(p.subarray(l4 + 8), t); continue; }
    if (dp === 443 && t >= from && t <= to) quic++;
  }
  if (t < from || t > to) continue;
  inWindow++;
  const out = isLocal(src) && !isLocal(dst), back = isLocal(dst) && !isLocal(src);
  if (!out && !back) continue;
  const remote = out ? dst : src;
  const ports = (proto === 6 || proto === 17) && p.length >= l4 + 4 ? [p.readUInt16BE(l4), p.readUInt16BE(l4 + 2)] : [0, 0];
  const key = `${proto} ${remote} ${out ? ports[1] : ports[0]} ${out ? ports[0] : ports[1]}`;
  const s = flows.get(key) || flows.set(key, { ip: remote, sent: 0, received: 0, first: t, connections: 0, name: null }).get(key);
  if (out) s.sent += total; else s.received += total;
  if (proto === 6 && out && p.length >= l4 + 20) {
    if ((p[l4 + 13] & 0x12) === 0x02) s.connections++;                       // SYN
    s.name ||= sni(p.subarray(l4 + (p[l4 + 12] >> 4) * 4));
  }
}

// Bytes by host name. A TLS connection is named by the server name it asked for. Anything else (QUIC, which hides the
// name) is named by the lookups that gave its address; when several hosts share the address, all of them are listed.
const rows = new Map();
for (const s of flows.values()) {
  const name = s.name || [...(ipNames.get(s.ip) || [])].sort().join(' or ') || s.ip;
  const r = rows.get(name) || rows.set(name, { host: name, sent: 0, received: 0, connections: 0, first: s.first }).get(name);
  r.sent += s.sent; r.received += s.received; r.connections += s.connections; r.first = Math.min(r.first, s.first);
}
// A row that names several hosts is Spare Key's only when every one of them is.
const why = h => { const uses = h.split(' or ').map(x => EXPECTED.find(([re]) => re.test(x))?.[1] || null); return uses.every(Boolean) ? [...new Set(uses)].join('; ') : null; };
const list = [...rows.values()].sort((a, b) => b.sent - a.sent).map(r => ({ ...r, first: new Date(r.first - clockFix).toISOString(), use: why(r.host) }));
const looked = [...hosts.entries()].filter(([, h]) => h.first >= from && h.first <= to).map(([h]) => h);
const forbidden = [...new Set([...list.flatMap(r => r.host.split(' or ')), ...looked])].filter(h => FORBIDDEN.test(h));
const uid = arg('uid-bytes', '');
const report = {
  at: new Date().toISOString(), capture: file.replace(/\\/g, '/').split('/').pop(), packets, inWindow,
  window: { from: from ? new Date(from - clockFix).toISOString() : null, to: Number.isFinite(to) ? new Date(to - clockFix).toISOString() : null },
  clockFixHours: clockFix / 3600000,
  note: 'Every host the whole emulator reached in the window: Spare Key and Android itself (Google Play services, time and connectivity checks). The capture cannot tell apps apart; the bytes the system counts for Spare Key alone are in appBytes when given.',
  appBytes: uid ? { sent: Number(uid.split(',')[0]), received: Number(uid.split(',')[1]) } : null,
  spareKey: list.filter(r => r.use), other: list.filter(r => !r.use), lookedUp: looked.sort(), forbidden, quicPackets: quic,
};
writeFileSync('docs/evidence/android-net.json', JSON.stringify(report, null, 1));
const kb = n => `${(n / 1024).toFixed(1)} KB`;
console.log(`${packets} packets, ${inWindow} in the window`);
for (const r of report.spareKey) console.log(`  Spare Key  ${r.host.padEnd(44)} sent ${kb(r.sent).padStart(9)}  received ${kb(r.received).padStart(10)}  ${r.use}`);
for (const r of report.other) console.log(`  other      ${r.host.padEnd(44)} sent ${kb(r.sent).padStart(9)}  received ${kb(r.received).padStart(10)}`);
console.log(forbidden.length ? `REPORTING HOSTS SEEN: ${forbidden.join(', ')}` : 'No usage, crash or analytics reporting host was looked up or reached.');
if (report.appBytes) console.log(`Android counts ${kb(report.appBytes.sent)} sent and ${kb(report.appBytes.received)} received for Spare Key itself.`);
process.exit(forbidden.length ? 1 : 0);
