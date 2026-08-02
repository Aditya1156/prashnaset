// Sweeps the live site's public pages for console errors and verifies the
// Supabase key inlined into the client bundle is pure ASCII (a non-ASCII
// byte there breaks every browser fetch with an ISO-8859-1 header error).
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://prashnaset.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()} :: ${String(e)}`));

// Capture the client bundles so we can inspect the inlined env values.
const scripts = [];
page.on("response", async (res) => {
  const url = res.url();
  if (url.endsWith(".js") && res.status() === 200) {
    try {
      const body = await res.text();
      if (body.includes("sb_publishable_") || body.includes("supabase.co")) scripts.push({ url, body });
    } catch {
      /* streamed/aborted bodies are not readable — ignore */
    }
  }
});

for (const path of ["/", "/signin", "/signup", "/reset"]) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  console.log(`${path} -> HTTP ok, title: ${await page.title()}`);
}

let badBytes = 0;
let sawKey = false;
for (const { url, body } of scripts) {
  for (const match of body.matchAll(/sb_publishable_[A-Za-z0-9_\-]*/g)) {
    sawKey = true;
    const nonAscii = [...match[0]].filter((c) => c.charCodeAt(0) > 127);
    if (nonAscii.length) {
      badBytes += nonAscii.length;
      console.log(`NON-ASCII in key inside ${url}: ${JSON.stringify(nonAscii)}`);
    }
  }
}

console.log(`bundle key found: ${sawKey}, non-ascii chars in key: ${badBytes}`);
console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "zero console errors");
await browser.close();
process.exit(errors.length === 0 && badBytes === 0 ? 0 : 1);
