// Normalizes src/data/cves.json (schema: id, product, vuln_class, severity, cvss4, date, advisory_url, credit).
import raw from './cves.json';
export type Cve = { id: string; product: string; vuln_class: string; severity: string; cvss4: number; date?: string; advisory_url: string; credit?: string; credit_type?: string; code_name?: string };
const rules: [RegExp, string, string][] = [
  [/sql/i, 'SQLi', 'sqli'],
  [/xss|cross.?site script/i, 'XSS', 'xss'],
  [/ssrf|server.?side request/i, 'SSRF', 'ssrf'],
  [/idor/i, 'IDOR', 'authbypass'],
  [/auth|idor|access control|bypass|privilege/i, 'auth bypass', 'authbypass'],
];
export const classify = (v: string) => { for (const [re, label, sprite] of rules) if (re.test(v)) return { label, sprite }; return { label: v, sprite: null }; };
export const cves = (raw as Cve[]).map(c => ({ ...c, co: (c.credit_type ?? c.credit) === 'co-discovered', ...classify(c.vuln_class) })).sort((a, b) => b.cvss4 - a.cvss4 || (b.date ?? '').localeCompare(a.date ?? ''));
