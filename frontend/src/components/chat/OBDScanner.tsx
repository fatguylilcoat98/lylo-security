/**
 * OBDScanner.tsx — The Good Neighbor Guard / LYLO
 * Built by Christopher Hughes · Sacramento, CA
 * Created with the help of AI collaborators (Claude · GPT · Gemini · Groq)
 * Truth · Safety · We Got Your Back
 *
 * Mechanic Persona — "Scan My Car" OBD Integration
 * Supports: OBDLink MX+, EX, CX, LX (Bluetooth)
 * Status: UI + flow complete. Real Bluetooth data: wire up via obdlink-service.ts
 */

import { useState } from "react";

// ─── DTC Code Database (sample — expand for production) ──────────────────────
const DTC_DATABASE: Record<string, {
  title: string;
  plain: string;
  severity: "ok" | "soon" | "now" | "stop";
  costLow: number;
  costHigh: number;
  shopQuestions: string[];
}> = {
  "P0300": {
    title: "Random/Multiple Cylinder Misfire",
    plain: "Your engine is misfiring — one or more cylinders aren't firing right. This means the engine isn't running cleanly and could cause damage if ignored.",
    severity: "now",
    costLow: 150,
    costHigh: 600,
    shopQuestions: [
      "Which cylinder(s) are misfiring and did you do a compression test?",
      "Did you check the spark plugs, coils, and injectors first before anything else?",
      "Is this covered under any powertrain warranty?"
    ]
  },
  "P0420": {
    title: "Catalyst System Efficiency Below Threshold",
    plain: "Your catalytic converter isn't cleaning exhaust gases as well as it should. The car will still run but it's polluting more than it should and will fail emissions.",
    severity: "soon",
    costLow: 400,
    costHigh: 2400,
    shopQuestions: [
      "Is this definitely the catalytic converter or could it be an O2 sensor first?",
      "Can you check the O2 sensors before recommending a cat replacement?",
      "What brand of catalytic converter are you installing — OEM or aftermarket?"
    ]
  },
  "P0171": {
    title: "System Too Lean (Bank 1)",
    plain: "Your engine is getting too much air and not enough fuel. Could be a vacuum leak, dirty mass airflow sensor, or weak fuel pump.",
    severity: "soon",
    costLow: 50,
    costHigh: 800,
    shopQuestions: [
      "Did you check for vacuum leaks first before anything else?",
      "What's the fuel trim reading at idle vs. at cruise?",
      "Did you clean the MAF sensor before recommending replacement?"
    ]
  },
  "P0401": {
    title: "EGR Flow Insufficient",
    plain: "The exhaust gas recirculation system isn't flowing properly. This affects emissions and can cause rough idling or reduced performance.",
    severity: "soon",
    costLow: 100,
    costHigh: 500,
    shopQuestions: [
      "Is the EGR valve stuck or is it a clogged passage?",
      "Can you clean the EGR valve first before replacing it?",
      "Will this cause it to fail smog?"
    ]
  },
  "P0442": {
    title: "Small Evaporative Emission Leak",
    plain: "A small leak in your fuel vapor system — most likely a loose gas cap. Simple fix most of the time.",
    severity: "ok",
    costLow: 0,
    costHigh: 150,
    shopQuestions: [
      "Can I try tightening or replacing the gas cap first before any repair?",
      "Did you do a smoke test to find the exact leak location?",
      "Will this cause me to fail emissions?"
    ]
  },
  "P0128": {
    title: "Coolant Temperature Below Thermostat Regulating Temperature",
    plain: "Your engine isn't reaching normal operating temperature. Usually means the thermostat is stuck open and needs replacing.",
    severity: "soon",
    costLow: 100,
    costHigh: 300,
    shopQuestions: [
      "Is the thermostat definitely the issue or could it be the coolant temp sensor?",
      "Are you replacing the thermostat with OEM spec or aftermarket?",
      "Should the coolant be flushed at the same time?"
    ]
  },
  "P0455": {
    title: "Large Evaporative Emission Leak",
    plain: "A significant leak in your fuel vapor containment system. Larger than a loose gas cap — could be a cracked hose or faulty purge valve.",
    severity: "soon",
    costLow: 50,
    costHigh: 400,
    shopQuestions: [
      "Did you do a smoke test to pinpoint the leak?",
      "Is the purge valve or vent valve the likely culprit?",
      "Will this cause a smog failure?"
    ]
  },
  "P0505": {
    title: "Idle Control System Malfunction",
    plain: "Your engine's idle speed control isn't working properly — rough idle, stalling at stops, or erratic RPM at idle.",
    severity: "soon",
    costLow: 100,
    costHigh: 500,
    shopQuestions: [
      "Did you clean the throttle body first?",
      "Is the IAC valve dirty or failed?",
      "Could this be a vacuum leak causing the idle issue?"
    ]
  }
};

// ─── Mock Bluetooth Scan (replace with real OBDLink service) ─────────────────
async function mockBluetoothScan(): Promise<string[]> {
  // TODO: Replace with real OBDLink Bluetooth connection
  // import { connectOBDLink, readDTCs } from './services/obdlink-service';
  // const device = await connectOBDLink();
  // return await readDTCs(device);
  await new Promise(r => setTimeout(r, 3200));
  const mockCodes = ["P0420", "P0171", "P0442"];
  return mockCodes;
}

// ─── Severity Config ──────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  ok:   { label: "You're Good",      sub: "Monitor it",         color: "#22c55e", bg: "rgba(34,197,94,0.1)",   icon: "✓" },
  soon: { label: "Fix This Soon",    sub: "This week",          color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  icon: "⚠" },
  now:  { label: "Fix This Now",     sub: "Don't wait",         color: "#ef4444", bg: "rgba(239,68,68,0.1)",   icon: "!" },
  stop: { label: "Do Not Drive",     sub: "Call a tow",         color: "#dc2626", bg: "rgba(220,38,38,0.15)",  icon: "✕" },
};

type ScanState = "idle" | "connecting" | "scanning" | "done" | "error" | "no_codes";

interface ScanResult {
  code: string;
  data: typeof DTC_DATABASE[string] | null;
}

interface OBDScannerProps {
  onScanComplete?: (results: ScanResult[]) => void;
  className?: string;
}

export default function OBDScanner({ onScanComplete, className = "" }: OBDScannerProps) {
  const [state, setState] = useState<ScanState>("idle");
  const [results, setResults] = useState<ScanResult[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleScan = async () => {
    setState("connecting");
    setResults([]);
    setProgress(0);

    try {
      // Phase 1: Connecting
      await new Promise(r => setTimeout(r, 800));
      setState("scanning");

      // Animate progress
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 8, 90));
      }, 200);

      const codes = await mockBluetoothScan();
      clearInterval(progressInterval);
      setProgress(100);

      await new Promise(r => setTimeout(r, 300));

      if (codes.length === 0) {
        setState("no_codes");
        return;
      }

      const mapped: ScanResult[] = codes.map(code => ({
        code,
        data: DTC_DATABASE[code] || null,
      }));

      setResults(mapped);
      setState("done");
      setExpanded(mapped[0]?.code || null);
      onScanComplete?.(mapped);

    } catch (err) {
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setResults([]);
    setExpanded(null);
    setProgress(0);
  };

  const worstSeverity = results.reduce((worst, r) => {
    const order = { ok: 0, soon: 1, now: 2, stop: 3 };
    const s = r.data?.severity || "ok";
    return order[s] > order[worst] ? s : worst;
  }, "ok" as "ok" | "soon" | "now" | "stop");

  return (
    <div className={`obd-scanner ${className}`} style={styles.container}>

      {/* ── Idle State ── */}
      {state === "idle" && (
        <div style={styles.idleWrap}>
          <div style={styles.adapterBadge}>
            <span style={styles.adapterDot} />
            OBDLink MX+ · EX · CX · LX
          </div>
          <button onClick={handleScan} style={styles.scanBtn}>
            <span style={styles.scanIcon}>⬡</span>
            Scan My Car
          </button>
          <p style={styles.idleHint}>
            Plug your OBDLink adapter into the OBD-II port under your dash, then tap Scan.
          </p>
        </div>
      )}

      {/* ── Connecting ── */}
      {state === "connecting" && (
        <div style={styles.statusWrap}>
          <div style={styles.pulseRing}>
            <div style={styles.pulseCore}>
              <span style={{ fontSize: 22 }}>⬡</span>
            </div>
          </div>
          <p style={styles.statusLabel}>Connecting to OBDLink...</p>
          <p style={styles.statusSub}>Make sure Bluetooth is on and adapter is plugged in</p>
        </div>
      )}

      {/* ── Scanning ── */}
      {state === "scanning" && (
        <div style={styles.statusWrap}>
          <div style={styles.progressWrap}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }} />
          </div>
          <p style={styles.statusLabel}>Reading fault codes...</p>
          <p style={styles.statusSub}>{progress < 50 ? "Initializing diagnostic session" : "Scanning all systems"}</p>
        </div>
      )}

      {/* ── No Codes ── */}
      {state === "no_codes" && (
        <div style={styles.statusWrap}>
          <div style={{ ...styles.severityBadge, background: SEVERITY_CONFIG.ok.bg, borderColor: SEVERITY_CONFIG.ok.color }}>
            <span style={{ color: SEVERITY_CONFIG.ok.color, fontSize: 28 }}>✓</span>
          </div>
          <p style={styles.statusLabel}>No fault codes found</p>
          <p style={styles.statusSub}>Your car's computer isn't reporting any issues right now.</p>
          <button onClick={reset} style={styles.resetBtn}>Scan Again</button>
        </div>
      )}

      {/* ── Error ── */}
      {state === "error" && (
        <div style={styles.statusWrap}>
          <p style={{ ...styles.statusLabel, color: "#ef4444" }}>Couldn't connect</p>
          <p style={styles.statusSub}>Make sure the adapter is plugged in and Bluetooth is enabled.</p>
          <button onClick={reset} style={styles.resetBtn}>Try Again</button>
        </div>
      )}

      {/* ── Results ── */}
      {state === "done" && results.length > 0 && (
        <div style={styles.resultsWrap}>

          {/* Summary bar */}
          <div style={{
            ...styles.summaryBar,
            background: SEVERITY_CONFIG[worstSeverity].bg,
            borderColor: SEVERITY_CONFIG[worstSeverity].color,
          }}>
            <div>
              <p style={{ ...styles.summaryTitle, color: SEVERITY_CONFIG[worstSeverity].color }}>
                {SEVERITY_CONFIG[worstSeverity].icon} {SEVERITY_CONFIG[worstSeverity].label}
              </p>
              <p style={styles.summaryCount}>{results.length} fault code{results.length > 1 ? "s" : ""} found</p>
            </div>
            <button onClick={reset} style={styles.rescanBtn}>Rescan</button>
          </div>

          {/* Code cards */}
          <div style={styles.codeList}>
            {results.map(({ code, data }) => {
              const sev = data?.severity || "ok";
              const cfg = SEVERITY_CONFIG[sev];
              const isOpen = expanded === code;

              return (
                <div key={code} style={styles.codeCard}>
                  {/* Card header */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : code)}
                    style={styles.codeHeader}
                  >
                    <div style={styles.codeLeft}>
                      <span style={{ ...styles.codePill, background: cfg.bg, color: cfg.color, borderColor: cfg.color }}>
                        {code}
                      </span>
                      <div>
                        <p style={styles.codeTitle}>{data?.title || "Unknown Code"}</p>
                        <p style={{ ...styles.codeSeverityLabel, color: cfg.color }}>
                          {cfg.icon} {cfg.label} — {cfg.sub}
                        </p>
                      </div>
                    </div>
                    <span style={{ ...styles.chevron, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▾
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && data && (
                    <div style={styles.codeDetail}>

                      {/* Plain English */}
                      <div style={styles.detailSection}>
                        <p style={styles.detailLabel}>WHAT THIS MEANS</p>
                        <p style={styles.detailText}>{data.plain}</p>
                      </div>

                      {/* Cost range */}
                      <div style={styles.detailSection}>
                        <p style={styles.detailLabel}>TYPICAL REPAIR COST</p>
                        <div style={styles.costRow}>
                          <div style={styles.costBox}>
                            <p style={styles.costAmount}>${data.costLow}</p>
                            <p style={styles.costMeta}>Low end</p>
                          </div>
                          <div style={styles.costDivider}>—</div>
                          <div style={styles.costBox}>
                            <p style={styles.costAmount}>${data.costHigh}</p>
                            <p style={styles.costMeta}>High end</p>
                          </div>
                        </div>
                        <p style={styles.costDisclaimer}>
                          Estimates vary by region and vehicle. Get at least 2 quotes.
                        </p>
                      </div>

                      {/* Shop questions */}
                      <div style={styles.detailSection}>
                        <p style={styles.detailLabel}>QUESTIONS TO ASK THE SHOP</p>
                        <div style={styles.questionList}>
                          {data.shopQuestions.map((q, i) => (
                            <div key={i} style={styles.questionRow}>
                              <span style={styles.questionNum}>{i + 1}</span>
                              <p style={styles.questionText}>{q}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <p style={styles.footerNote}>
            💡 Screenshot this report before you go to the shop. You already know more than most customers walking in.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    fontFamily: "'Orbitron', 'Courier New', monospace",
    color: "#e2e8f0",
  },
  idleWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "16px 0",
  },
  adapterBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    color: "#64748b",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  adapterDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#22c55e",
    display: "inline-block",
    boxShadow: "0 0 6px #22c55e",
  },
  scanBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 28px",
    background: "linear-gradient(135deg, rgba(20,184,166,0.15), rgba(59,130,246,0.15))",
    border: "1px solid rgba(20,184,166,0.4)",
    borderRadius: 8,
    color: "#14b8a6",
    fontSize: 13,
    fontFamily: "'Orbitron', monospace",
    fontWeight: 700,
    letterSpacing: "0.1em",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  scanIcon: {
    fontSize: 18,
    color: "#14b8a6",
  },
  idleHint: {
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 1.6,
    fontFamily: "system-ui, sans-serif",
  },
  statusWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "20px 0",
  },
  pulseRing: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    border: "2px solid rgba(20,184,166,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  pulseCore: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "rgba(20,184,166,0.1)",
    border: "1px solid rgba(20,184,166,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#14b8a6",
  },
  progressWrap: {
    width: "100%",
    maxWidth: 280,
    height: 4,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg, #14b8a6, #3b82f6)",
    borderRadius: 2,
    transition: "width 0.2s ease",
  },
  statusLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontFamily: "'Orbitron', monospace",
    letterSpacing: "0.05em",
  },
  statusSub: {
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
    fontFamily: "system-ui, sans-serif",
  },
  severityBadge: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtn: {
    marginTop: 8,
    padding: "8px 20px",
    background: "transparent",
    border: "1px solid rgba(100,116,139,0.4)",
    borderRadius: 6,
    color: "#64748b",
    fontSize: 11,
    fontFamily: "'Orbitron', monospace",
    cursor: "pointer",
    letterSpacing: "0.08em",
  },
  resultsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
  },
  summaryBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid",
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.05em",
    marginBottom: 2,
  },
  summaryCount: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "system-ui, sans-serif",
  },
  rescanBtn: {
    padding: "6px 14px",
    background: "transparent",
    border: "1px solid rgba(100,116,139,0.3)",
    borderRadius: 6,
    color: "#64748b",
    fontSize: 10,
    fontFamily: "'Orbitron', monospace",
    cursor: "pointer",
    letterSpacing: "0.08em",
  },
  codeList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  codeCard: {
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    overflow: "hidden",
  },
  codeHeader: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  codeLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  codePill: {
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    fontFamily: "'Orbitron', monospace",
    whiteSpace: "nowrap" as const,
  },
  codeTitle: {
    fontSize: 12,
    color: "#cbd5e1",
    marginBottom: 2,
    fontFamily: "system-ui, sans-serif",
    fontWeight: 600,
  },
  codeSeverityLabel: {
    fontSize: 10,
    letterSpacing: "0.05em",
    fontFamily: "'Orbitron', monospace",
  },
  chevron: {
    color: "#475569",
    fontSize: 14,
    transition: "transform 0.2s ease",
  },
  codeDetail: {
    padding: "0 14px 14px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  detailSection: {
    paddingTop: 14,
  },
  detailLabel: {
    fontSize: 9,
    color: "#475569",
    letterSpacing: "0.12em",
    marginBottom: 8,
    fontFamily: "'Orbitron', monospace",
  },
  detailText: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.7,
    fontFamily: "system-ui, sans-serif",
  },
  costRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  costBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "8px 16px",
    textAlign: "center" as const,
  },
  costAmount: {
    fontSize: 18,
    fontWeight: 700,
    color: "#e2e8f0",
    fontFamily: "'Orbitron', monospace",
  },
  costMeta: {
    fontSize: 9,
    color: "#475569",
    letterSpacing: "0.08em",
    marginTop: 2,
    fontFamily: "'Orbitron', monospace",
  },
  costDivider: {
    color: "#334155",
    fontSize: 16,
  },
  costDisclaimer: {
    fontSize: 10,
    color: "#475569",
    fontFamily: "system-ui, sans-serif",
    fontStyle: "italic",
  },
  questionList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  questionRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  questionNum: {
    width: 20,
    height: 20,
    minWidth: 20,
    borderRadius: "50%",
    background: "rgba(20,184,166,0.1)",
    border: "1px solid rgba(20,184,166,0.3)",
    color: "#14b8a6",
    fontSize: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Orbitron', monospace",
    fontWeight: 700,
  },
  questionText: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.6,
    fontFamily: "system-ui, sans-serif",
  },
  footerNote: {
    fontSize: 11,
    color: "#475569",
    textAlign: "center" as const,
    fontFamily: "system-ui, sans-serif",
    fontStyle: "italic",
    lineHeight: 1.6,
    padding: "0 8px",
  },
};
