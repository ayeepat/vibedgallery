// Shared SSRF guard for Edge Functions that fetch user-supplied URLs.
//
// The ownership-verification flow fetches an arbitrary URL the submitter
// controls. Without guarding, a caller could point that URL at internal
// services (cloud metadata at 169.254.169.254, localhost, RFC-1918 ranges,
// link-local, etc.) and use the function as a confused deputy to probe the
// private network. This module enforces:
//
//   - scheme allow-list: http / https only
//   - no embedded credentials (user:pass@host)
//   - standard ports only (80 / 443 / default)
//   - the host, whether an IP literal or a DNS name that resolves to one,
//     must be a public/global-unicast address (v4 and v6)
//
// resolveAndAssertPublic() additionally resolves the hostname and rejects if
// ANY resolved record is private, which closes the gap where a public-looking
// name resolves to an internal IP. It is best-effort: if the runtime forbids
// Deno.resolveDns the literal/host checks still apply.

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

// --- IPv4 -------------------------------------------------------------------

function isIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((o) => Number(o) <= 255);
}

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const inRange = (cidr: string, bits: number) =>
    (n >>> (32 - bits)) === (ipv4ToInt(cidr) >>> (32 - bits));

  return (
    inRange("0.0.0.0", 8) ||        // "this" network
    inRange("10.0.0.0", 8) ||       // RFC 1918
    inRange("100.64.0.0", 10) ||    // CGNAT
    inRange("127.0.0.0", 8) ||      // loopback
    inRange("169.254.0.0", 16) ||   // link-local (incl. cloud metadata)
    inRange("172.16.0.0", 12) ||    // RFC 1918
    inRange("192.0.0.0", 24) ||     // IETF protocol assignments
    inRange("192.0.2.0", 24) ||     // TEST-NET-1
    inRange("192.88.99.0", 24) ||   // 6to4 relay anycast
    inRange("192.168.0.0", 16) ||   // RFC 1918
    inRange("198.18.0.0", 15) ||    // benchmarking
    inRange("198.51.100.0", 24) ||  // TEST-NET-2
    inRange("203.0.113.0", 24) ||   // TEST-NET-3
    n >= ipv4ToInt("224.0.0.0")     // multicast + reserved + broadcast (224/3)
  );
}

// --- IPv6 -------------------------------------------------------------------

function expandIPv6(ip: string): string[] | null {
  let host = ip;
  // Strip zone id (fe80::1%eth0) and surrounding brackets.
  host = host.replace(/^\[|\]$/g, "").split("%")[0];

  // IPv4-mapped/embedded (::ffff:1.2.3.4) — normalise the tail.
  const v4tail = host.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4tail && isIPv4(v4tail[1])) {
    const n = ipv4ToInt(v4tail[1]);
    const hi = ((n >>> 16) & 0xffff).toString(16);
    const lo = (n & 0xffff).toString(16);
    host = host.slice(0, v4tail.index) + `${hi}:${lo}`;
  }

  if (!host.includes(":")) return null;

  const halves = host.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  if (halves.length === 1 && head.length !== 8) return null;

  const groups = [
    ...head,
    ...Array(halves.length === 2 ? missing : 0).fill("0"),
    ...tail,
  ];
  if (groups.length !== 8) return null;

  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
  }
  return groups.map((g) => g.toLowerCase().padStart(4, "0"));
}

function isPrivateIPv6(ip: string): boolean {
  const groups = expandIPv6(ip);
  if (!groups) return true; // unparseable → treat as unsafe
  const first = parseInt(groups[0], 16);

  // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96) — classify by the
  // embedded IPv4 so ::ffff:127.0.0.1 / ::ffff:10.0.0.1 are caught.
  const firstFiveZero = groups.slice(0, 5).every((g) => g === "0000");
  if (firstFiveZero && (groups[5] === "ffff" || groups[5] === "0000")) {
    const a = parseInt(groups[6], 16);
    const b = parseInt(groups[7], 16);
    const embedded = `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`;
    if (groups[5] === "ffff") return isPrivateIPv4(embedded);
    // ::/96 compatible: only ::1 and :: are special, both handled below.
  }

  const allZeroExceptLast = groups.slice(0, 7).every((g) => g === "0000");
  if (allZeroExceptLast && (groups[7] === "0000" || groups[7] === "0001")) {
    return true; // :: (unspecified) and ::1 (loopback)
  }
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if (first >= 0xff00) return true; // ff00::/8 multicast
  return false;
}

// --- Public API -------------------------------------------------------------

function isPrivateIpLiteral(host: string): boolean {
  if (isIPv4(host)) return isPrivateIPv4(host);
  if (host.includes(":")) return isPrivateIPv6(host);
  return false; // not an IP literal
}

/**
 * Validate a URL string for outbound fetching. Throws SsrfError on anything
 * that isn't a plain public http(s) endpoint. Returns the parsed URL.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Invalid URL");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfError(`Disallowed scheme: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new SsrfError("Credentials in URL are not allowed");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SsrfError(`Disallowed port: ${url.port}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host.toLowerCase() === "localhost" || host.endsWith(".localhost")) {
    throw new SsrfError("Disallowed host");
  }
  if (isPrivateIpLiteral(host)) {
    throw new SsrfError("Host resolves to a private or reserved address");
  }

  return url;
}

/**
 * Resolve the hostname and assert every record is a public address. Best-effort
 * (no-op if DNS resolution is unavailable in the runtime). Call AFTER
 * assertPublicHttpUrl so literal IPs are already validated.
 */
export async function resolveAndAssertPublic(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // Already an IP literal — assertPublicHttpUrl handled it.
  if (isIPv4(host) || host.includes(":")) return;

  // deno-lint-ignore no-explicit-any
  const resolveDns = (globalThis as any).Deno?.resolveDns;
  if (typeof resolveDns !== "function") return;

  const records: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      const r = await resolveDns(host, type);
      if (Array.isArray(r)) records.push(...r);
    } catch {
      // NXDOMAIN for one family, or unsupported — ignore.
    }
  }
  if (records.length === 0) return; // couldn't resolve; literal checks stand

  for (const ip of records) {
    if (isPrivateIpLiteral(ip)) {
      throw new SsrfError("Host resolves to a private or reserved address");
    }
  }
}
