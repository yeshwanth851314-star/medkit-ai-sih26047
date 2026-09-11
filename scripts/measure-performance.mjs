import { chromium } from "@playwright/test";
import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on("error", () => retry());
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Timeout waiting for production server on " + url));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

async function run() {
  console.log("Starting production server on port " + PORT + "...");
  const server = spawn("npx.cmd", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    stdio: "pipe",
    shell: true,
  });

  server.stdout.on("data", (d) => console.log("[next-start]", d.toString().trim()));
  server.stderr.on("data", (d) => console.error("[next-start-err]", d.toString().trim()));

  try {
    await waitForServer(BASE_URL + "/api/health");
    console.log("Production server is healthy at " + BASE_URL);

    const browser = await chromium.launch({ headless: true, channel: "chrome" });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set onboarding flags
    await page.addInitScript(() => {
      window.localStorage.setItem("medkit_doctor_onboarding_completed", "true");
      window.localStorage.setItem("medkit_doctor_onboarding_completed:doctor-101", "true");
      window.localStorage.setItem("medkit_kiosk_onboarding_completed", "true");
    });

    const routes = [
      { name: "Landing Page", path: "/", protected: false },
      { name: "Clinician Login", path: "/login", protected: false },
      { name: "Patient Kiosk Intake", path: "/intake/new", protected: false },
      { name: "Doctor Patient Directory", path: "/doctor/patients", protected: true },
      { name: "New Clinical Case Form", path: "/doctor/cases/new?patientId=11111111-1111-4111-8111-111111111111", protected: true },
      { name: "Representative Case Detail", path: "/doctor/cases/c1111111-1111-4111-8111-111111111111", protected: true },
    ];

    const measurements = [];

    async function login() {
      await page.goto(BASE_URL + "/login");
      await page.fill('input[type="email"]', "doctor@medkit.ai");
      await page.fill('input[type="password"]', "doctor123");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/doctor\/patients/);
    }

    let isLoggedIn = false;

    for (const r of routes) {
      if (r.protected && !isLoggedIn) {
        console.log("Authenticating doctor session for protected routes...");
        await login();
        isLoggedIn = true;
      }

      console.log("Measuring " + r.name + " (" + r.path + ")...");

      // Inject observer for LCP & CLS before navigation
      await page.addInitScript(() => {
        window.__perfMetrics = { lcp: 0, cls: 0 };
        try {
          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              window.__perfMetrics.lcp = entry.startTime;
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });

          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (!entry.hadRecentInput) {
                window.__perfMetrics.cls += entry.value;
              }
            }
          }).observe({ type: "layout-shift", buffered: true });
        } catch (e) {
          console.error("Observer init error:", e);
        }
      });

      await page.goto(BASE_URL + r.path, { waitUntil: "load" });
      await page.waitForTimeout(1200); // Allow LCP observer to settle

      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] || {};
        const lcpVal = window.__perfMetrics?.lcp || (nav.domContentLoadedEventEnd || 0);
        return {
          lcpMs: Math.round(lcpVal),
          cls: Number((window.__perfMetrics?.cls || 0).toFixed(4)),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEventMs: Math.round(nav.loadEventEnd || 0),
          domNodeCount: document.querySelectorAll("*").length,
          transferSizeBytes: nav.transferSize || 0,
        };
      });

      measurements.push({
        route: r.path,
        name: r.name,
        protected: r.protected,
        lcpSeconds: Number((metrics.lcpMs / 1000).toFixed(3)),
        cls: metrics.cls,
        domContentLoadedMs: metrics.domContentLoadedMs,
        loadEventMs: metrics.loadEventMs,
        domNodeCount: metrics.domNodeCount,
        lcpTargetPassed: metrics.lcpMs / 1000 <= 2.5,
        clsTargetPassed: metrics.cls <= 0.10,
      });
    }

    await browser.close();

    const output = {
      measuredAt: new Date().toISOString(),
      environment: "production-local-build (next start)",
      targets: {
        lcpMaxSeconds: 2.5,
        clsMax: 0.10,
        fieldInpStatus: "NOT YET AVAILABLE (Pre-deployment; requires production field RUM)",
      },
      summary: {
        totalRoutesMeasured: measurements.length,
        allLcpPass: measurements.every((m) => m.lcpTargetPassed),
        allClsPass: measurements.every((m) => m.clsTargetPassed),
      },
      routes: measurements,
    };

    fs.writeFileSync(
      path.resolve("docs/evidence/performance/lab-results.json"),
      JSON.stringify(output, null, 2)
    );
    console.log("Saved lab-results.json successfully!");
  } finally {
    console.log("Shutting down production server...");
    server.kill();
    // On windows ensure next child process killed
    try {
      spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"]);
    } catch {}
  }
}

run().catch((err) => {
  console.error("Error during performance measurement:", err);
  process.exit(1);
});
