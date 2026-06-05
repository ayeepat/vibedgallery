// Pure ownership-verification token helpers. Split out of verifyOwnership.js
// (which imports the Supabase client) so token generation + the verification
// file builder can be unit-tested without pulling in network/env code.

// Generate a unique verification token: 128 bits of entropy via
// crypto.getRandomValues, hex-encoded. Hex keeps it URL- and filesystem-safe.
export function generateVerificationToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `vg-verify-${hex}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// The exact HTML written into the downloadable verification file. The token is
// escaped defensively even though we only ever generate `vg-verify-<hex>`.
export function buildVerificationHtml(token) {
  const t = escapeHtml(token);
  return `<!DOCTYPE html><html><head><meta name="vibedgallery-verification" content="${t}"></head><body>${t}</body></html>`;
}

// Instructions object surfaced in the Submit UI for both file methods.
export function getVerificationInstructions(siteUrl, token) {
  const base = String(siteUrl || "").replace(/\/$/, "");

  return {
    token,
    txtFile: {
      filename: `${token}.txt`,
      url: `${base}/${token}.txt`,
      content: token,
      instructions: [
        `Create a file called ${token}.txt`,
        `The file content should just be: ${token}`,
        `Place it in your project's /public folder`,
        `Deploy your site`,
        `The file should be accessible at: ${base}/${token}.txt`,
      ],
    },
    htmlFile: {
      filename: `${token}.html`,
      url: `${base}/${token}.html`,
      content: buildVerificationHtml(token),
      instructions: [
        `Create a file called ${token}.html`,
        `Copy the HTML content below into the file`,
        `Place it in your project's /public folder`,
        `Deploy your site`,
        `The file should be accessible at: ${base}/${token}.html`,
      ],
    },
  };
}
