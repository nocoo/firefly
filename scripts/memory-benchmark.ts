#!/usr/bin/env bun
// ---------------------------------------------------------------------------
// Memory Benchmark Script for Autoresearch
// Measures heap memory usage after simulating typical workload
// ---------------------------------------------------------------------------

import { spawn, execSync } from "node:child_process";
import http from "node:http";

const PORT = 7099;
const BASE_URL = `http://localhost:${PORT}`;
const WARMUP_REQUESTS = 5;
const MEASURE_REQUESTS = 20;
const STARTUP_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchWithTimeout(url, 2000);
      if (res.status >= 200 && res.status < 500) {
        return Date.now() - start;
      }
    } catch {
      // Server not ready yet
    }
    await sleep(500);
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

function findNodeProcessPid(): number | null {
  try {
    // Find the node process listening on our port
    const lsofOutput = execSync(`lsof -i :${PORT} -t 2>/dev/null || true`, { encoding: "utf-8" });
    const pids = lsofOutput.trim().split("\n").filter(Boolean);
    if (pids.length > 0) {
      return parseInt(pids[0], 10);
    }
  } catch {
    // Fallback: find any next start process
  }
  
  try {
    const psOutput = execSync(`pgrep -f "next start" | head -1`, { encoding: "utf-8" });
    const pid = parseInt(psOutput.trim(), 10);
    if (!isNaN(pid)) return pid;
  } catch {
    // No process found
  }
  
  return null;
}

function getProcessMemory(pid: number): { rssMB: number; vszMB: number } | null {
  try {
    // macOS: ps -o rss=,vsz= gives RSS and VSZ in KB
    const output = execSync(`ps -o rss=,vsz= -p ${pid}`, { encoding: "utf-8" });
    const parts = output.trim().split(/\s+/);
    if (parts.length >= 2) {
      const rssKB = parseInt(parts[0], 10);
      const vszKB = parseInt(parts[1], 10);
      return {
        rssMB: Math.round(rssKB / 1024 * 100) / 100,
        vszMB: Math.round(vszKB / 1024 * 100) / 100,
      };
    }
  } catch {
    // Process may have exited
  }
  return null;
}

// ---------------------------------------------------------------------------
// Request Simulation
// ---------------------------------------------------------------------------

// Typical blog routes to test
const ROUTES = [
  "/",                          // Homepage
  "/robots.txt",                // Static
  "/sitemap.xml",               // Dynamic sitemap
  "/feed.xml",                  // RSS feed
];

async function simulateRequests(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    for (const route of ROUTES) {
      try {
        await fetchWithTimeout(`${BASE_URL}${route}`, REQUEST_TIMEOUT_MS);
      } catch {
        // Ignore errors during simulation
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Starting memory benchmark...");
  
  // Kill any existing process on the port
  try {
    execSync(`lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true`, { encoding: "utf-8" });
    await sleep(500);
  } catch {
    // No process to kill
  }
  
  // Start the server using npx next start directly (not through bun run)
  // This gives us a more direct process to measure
  const serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  let serverOutput = "";
  
  serverProcess.stdout?.on("data", (data) => {
    serverOutput += data.toString();
  });
  
  serverProcess.stderr?.on("data", (data) => {
    serverOutput += data.toString();
  });

  try {
    // Wait for server to be ready
    console.log("Waiting for server to start...");
    const startupTimeMs = await waitForServer(BASE_URL, STARTUP_TIMEOUT_MS);
    console.log(`Server started in ${startupTimeMs}ms`);

    // Wait a bit for initial setup
    await sleep(3000);

    // Find the actual node process PID
    const nodePid = findNodeProcessPid();
    if (!nodePid) {
      console.error("Could not find Node.js process PID");
      process.exit(1);
    }
    console.log(`Found Node.js process PID: ${nodePid}`);

    // Get baseline memory
    const baselineMemory = getProcessMemory(nodePid);
    console.log(`Baseline memory: ${baselineMemory?.rssMB}MB RSS`);

    // Warmup requests
    console.log(`Running ${WARMUP_REQUESTS} warmup request cycles...`);
    await simulateRequests(WARMUP_REQUESTS);

    // Wait for GC
    await sleep(2000);

    // Measure requests
    console.log(`Running ${MEASURE_REQUESTS} measurement request cycles...`);
    await simulateRequests(MEASURE_REQUESTS);

    // Wait for processing to settle
    await sleep(2000);

    // Get final memory
    const finalMemory = getProcessMemory(nodePid);
    if (!finalMemory) {
      console.error("Could not read final memory");
      process.exit(1);
    }

    // Try to get cache stats via curl (requires building with proper exports)
    // For now, just output memory metrics
    
    console.log("\n--- Memory Benchmark Results ---");
    console.log(`METRIC rss_mb=${finalMemory.rssMB}`);
    console.log(`METRIC vsz_mb=${finalMemory.vszMB}`);
    console.log(`METRIC startup_time_ms=${startupTimeMs}`);
    
    // Also log baseline for reference
    if (baselineMemory) {
      console.log(`INFO baseline_rss_mb=${baselineMemory.rssMB}`);
      console.log(`INFO memory_growth_mb=${(finalMemory.rssMB - baselineMemory.rssMB).toFixed(2)}`);
    }
    
    // RSS is our primary metric for memory optimization
    console.log(`METRIC heap_used_mb=${finalMemory.rssMB}`);

  } finally {
    // Cleanup
    try {
      process.kill(-serverProcess.pid!, "SIGTERM");
    } catch {
      serverProcess.kill("SIGTERM");
    }
    await sleep(500);
    if (!serverProcess.killed) {
      try {
        process.kill(-serverProcess.pid!, "SIGKILL");
      } catch {
        serverProcess.kill("SIGKILL");
      }
    }
    
    // Extra cleanup: kill any remaining processes on the port
    try {
      execSync(`lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true`);
    } catch {
      // Ignore
    }
  }
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
