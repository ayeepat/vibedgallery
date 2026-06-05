import test from "node:test";
import assert from "node:assert/strict";

import {
  assertPublicHttpUrl,
  SsrfError,
} from "../supabase/functions/_shared/ssrfGuard.ts";

// URLs that must be accepted (plain public http(s) endpoints).
const SAFE = [
  "https://example.com",
  "http://example.com/path?q=1#frag",
  "https://sub.example.co.uk/a/b",
  "https://8.8.8.8/file.html", // public IPv4
  "https://[2606:4700:4700::1111]/x", // public IPv6 (Cloudflare)
  "https://example.com:443/x",
  "http://example.com:80/x",
];

// URLs that must be rejected (SSRF / scheme / port / credential issues).
const UNSAFE = [
  "ftp://example.com",
  "file:///etc/passwd",
  "data:text/html,hi",
  "http://localhost/x",
  "http://app.localhost/x",
  "http://127.0.0.1/x",
  "http://127.0.0.1:8080/admin",
  "http://0.0.0.0/x",
  "http://10.0.0.5/x",
  "http://192.168.1.1/x",
  "http://172.16.0.1/x",
  "http://172.31.255.255/x",
  "http://169.254.169.254/latest/meta-data/", // cloud metadata
  "http://100.64.0.1/x", // CGNAT
  "http://224.0.0.1/x", // multicast
  "http://[::1]/x", // IPv6 loopback
  "http://[::]/x", // IPv6 unspecified
  "http://[fc00::1]/x", // IPv6 unique-local
  "http://[fe80::1]/x", // IPv6 link-local
  "http://[::ffff:127.0.0.1]/x", // IPv4-mapped loopback
  "http://[::ffff:10.0.0.1]/x", // IPv4-mapped private
  "https://user:pass@example.com/x", // embedded credentials
  "https://example.com:8080/x", // non-standard port
  "not a url",
  "",
];

test("assertPublicHttpUrl accepts plain public http(s) URLs", () => {
  for (const u of SAFE) {
    assert.doesNotThrow(() => assertPublicHttpUrl(u), `expected SAFE: ${u}`);
    const parsed = assertPublicHttpUrl(u);
    assert.ok(parsed instanceof URL, `returns a URL for ${u}`);
  }
});

test("assertPublicHttpUrl rejects SSRF / malformed targets", () => {
  for (const u of UNSAFE) {
    assert.throws(
      () => assertPublicHttpUrl(u),
      (err) => err instanceof SsrfError,
      `expected UNSAFE to throw SsrfError: ${JSON.stringify(u)}`
    );
  }
});

test("cloud metadata endpoint is blocked", () => {
  assert.throws(
    () => assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/iam/"),
    SsrfError
  );
});
