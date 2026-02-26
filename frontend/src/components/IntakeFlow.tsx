import React, { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IntakeOption {
  label: string;
  text: string;
  emoji: string;
}
interface IntakeQuestion {
  id: string;
  round: number;
  question: string;
  subtext?: string;
  options: IntakeOption[];
  more_options?: { label: string; emoji: string }[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  required?: boolean;
}
interface IntakeFlowProps {
  userEmail: string;
  apiUrl: string;
  round: 1 | 2;
  onComplete: (profile: Record<string, string>) => void;
  onSkip?: () => void;
  existingProfile?: Record<string, string>;
}

// ─── LYLO neon-dark design tokens ─────────────────────────────────────────────
const C = {
  bg:      "#0a0a0a",
  surface: "#111111",
  border:  "#1f1f1f",
  green:   "#39FF14",
  greenDim:"rgba(57,255,20,0.12)",
  greenGlow:"rgba(57,255,20,0.35)",
  text:    "#f0f0f0",
  muted:   "#888",
  dim:     "#444",
};

// ─── Animated progress bar ────────────────────────────────────────────────────
const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={{ width: "100%", marginBottom: 8 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 10, letterSpacing: 2, color: C.muted,
        fontFamily: "'Courier New', monospace", marginBottom: 6,
      }}>
        <span>QUESTION {current} OF {total}</span>
        <span style={{ color: C.green }}>{pct}%</span>
      </div>
      <div style={{
        height: 2, background: C.border, borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${C.green}, #00ff88)`,
          borderRadius: 2,
          transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `0 0 8px ${C.greenGlow}`,
        }} />
      </div>
    </div>
  );
};

// ─── Single question card ─────────────────────────────────────────────────────
const QuestionCard = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  isFirst,
}: {
  question: IntakeQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (id: string, value: string) => void;
  isFirst: boolean;
}) => {
  const [selected, setSelected] = useState<string>("");
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef  = useRef<HTMLTextAreaElement>(null);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setAnimIn(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auto-focus custom input when shown
  useEffect(() => {
    if (showCustom) {
      setTimeout(() => {
        inputRef.current?.focus();
        textRef.current?.focus();
      }, 100);
    }
  }, [showCustom]);

  const handleOptionClick = (text: string) => {
    setSelected(text);
    setShowCustom(false);
    setCustomVal("");
    // Small delay so user sees selection before advancing
    setTimeout(() => onAnswer(question.id, text), 280);
  };

  const handleCustomSubmit = () => {
    const val = customVal.trim();
    if (!val) return;
    setSelected(val);
    onAnswer(question.id, val);
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  // For name-only question (no options, just text input)
  const isNameQuestion = question.options.length === 0 && question.allowCustom;

  return (
    <div style={{
      opacity:   animIn ? 1 : 0,
      transform: animIn ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.4,0,0.2,1)",
      display: "flex", flexDirection: "column", gap: 0,
      minHeight: "100%",
    }}>
      {/* Progress */}
      <ProgressBar current={questionNumber} total={totalQuestions} />

      {/* Question */}
      <div style={{ marginTop: 28, marginBottom: 8 }}>
        <p style={{
          fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.3,
          margin: 0, letterSpacing: "-0.3px",
        }}>
          {question.question}
        </p>
        {question.subtext && (
          <p style={{ fontSize: 13, color: C.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
            {question.subtext}
          </p>
        )}
      </div>

      {/* Name-only question */}
      {isNameQuestion && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder={question.customPlaceholder || "Type your answer..."}
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCustomSubmit()}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "16px 18px", fontSize: 17, fontWeight: 600,
              background: C.surface, color: C.text,
              border: `1.5px solid ${customVal ? C.green : C.border}`,
              borderRadius: 14, outline: "none",
              transition: "border-color 0.2s",
              caretColor: C.green,
            }}
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customVal.trim()}
            style={{
              padding: "15px 0", fontSize: 15, fontWeight: 800,
              background: customVal.trim() ? C.green : C.border,
              color: customVal.trim() ? "#000" : C.dim,
              border: "none", borderRadius: 14, cursor: customVal.trim() ? "pointer" : "default",
              transition: "all 0.2s",
              boxShadow: customVal.trim() ? `0 0 20px ${C.greenGlow}` : "none",
              letterSpacing: 1,
            }}
          >
            THAT'S ME →
          </button>
        </div>
      )}

      {/* A / B / C options */}
      {!isNameQuestion && !showCustom && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {question.options.map((opt) => {
            const isSelected = selected === opt.text;
            return (
              <button
                key={opt.label}
                onClick={() => handleOptionClick(opt.text)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px", textAlign: "left",
                  background: isSelected ? C.greenDim : C.surface,
                  border: `1.5px solid ${isSelected ? C.green : C.border}`,
                  borderRadius: 14, cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: isSelected ? `0 0 0 1px ${C.greenGlow}, inset 0 0 12px ${C.greenDim}` : "none",
                  transform: isSelected ? "scale(1.01)" : "scale(1)",
                }}
              >
                {/* Letter badge */}
                <span style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isSelected ? C.green : C.border,
                  color: isSelected ? "#000" : C.muted,
                  fontSize: 12, fontWeight: 900, fontFamily: "'Courier New', monospace",
                  transition: "all 0.15s",
                }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 16 }}>{opt.emoji}</span>
                <span style={{
                  fontSize: 15, fontWeight: 600, color: C.text, flex: 1,
                }}>
                  {opt.text}
                </span>
                {isSelected && (
                  <span style={{ color: C.green, fontSize: 16 }}>✓</span>
                )}
              </button>
            );
          })}

          {/* More options (collapsible) */}
          {question.more_options && question.more_options.length > 0 && (
            <>
              {!showMore ? (
                <button
                  onClick={() => setShowMore(true)}
                  style={{
                    padding: "12px 18px", fontSize: 13, fontWeight: 600,
                    background: "transparent", color: C.muted,
                    border: `1px dashed ${C.border}`, borderRadius: 12,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  + See more options
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {question.more_options.map((opt) => {
                    const isSelected = selected === opt.label;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => handleOptionClick(opt.label)}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "14px 18px", textAlign: "left",
                          background: isSelected ? C.greenDim : "transparent",
                          border: `1px solid ${isSelected ? C.green : C.dim}`,
                          borderRadius: 12, cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{opt.emoji}</span>
                        <span style={{
                          fontSize: 14, fontWeight: 600, color: C.text, flex: 1
                        }}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Option D — type your own */}
          {question.allowCustom && (
            <button
              onClick={() => setShowCustom(true)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 18px", textAlign: "left",
                background: C.surface, border: `1.5px dashed ${C.dim}`,
                borderRadius: 14, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <span style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: C.border, color: C.muted,
                fontSize: 12, fontWeight: 900, fontFamily: "'Courier New', monospace",
              }}>
                D
              </span>
              <span style={{ fontSize: 16 }}>✏️</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.muted }}>
                {question.customPlaceholder || "Type my own answer"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Custom text input (after clicking D) */}
      {showCustom && (
        <div style={{
          marginTop: 20, display: "flex", flexDirection: "column", gap: 10,
          animation: "fadeIn 0.2s ease",
        }}>
          <textarea
            ref={textRef as any}
            autoFocus
            placeholder={question.customPlaceholder || "Type your answer..."}
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "14px 16px", fontSize: 15, fontWeight: 500,
              background: C.surface, color: C.text,
              border: `1.5px solid ${customVal ? C.green : C.border}`,
              borderRadius: 14, outline: "none", resize: "none",
              transition: "border-color 0.2s", lineHeight: 1.5,
              caretColor: C.green, fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setShowCustom(false); setCustomVal(""); }}
              style={{
                flex: 1, padding: "13px 0", fontSize: 14, fontWeight: 700,
                background: "transparent", color: C.muted,
                border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <button
              onClick={handleCustomSubmit}
              disabled={!customVal.trim()}
              style={{
                flex: 2, padding: "13px 0", fontSize: 14, fontWeight: 800,
                background: customVal.trim() ? C.green : C.border,
                color: customVal.trim() ? "#000" : C.dim,
                border: "none", borderRadius: 12,
                cursor: customVal.trim() ? "pointer" : "default",
                transition: "all 0.2s",
                boxShadow: customVal.trim() ? `0 0 16px ${C.greenGlow}` : "none",
                letterSpacing: 0.5,
              }}
            >
              LOCK IT IN →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Complete Screen ──────────────────────────────────────────────────────────
const CompleteScreen = ({ name, round }: { name: string; round: 1 | 2 }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", textAlign: "center", padding: "40px 0",
      opacity: show ? 1 : 0, transform: show ? "scale(1)" : "scale(0.9)",
      transition: "all 0.5s cubic-bezier(0.4,0,0.2,1)",
    }}>
      {/* Neon pulse circle */}
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: C.greenDim,
        border: `2px solid ${C.green}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, marginBottom: 24,
        boxShadow: `0 0 40px ${C.greenGlow}, 0 0 80px ${C.greenDim}`,
        animation: "pulse 2s ease-in-out infinite",
      }}>
        ✓
      </div>
      <p style={{ fontSize: 11, letterSpacing: 4, color: C.green, margin: "0 0 12px", fontFamily: "'Courier New', monospace" }}>
        PROFILE {round === 1 ? "STARTED" : "COMPLETE"}
      </p>
      <h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 10px", lineHeight: 1.2 }}>
        {name ? `Your council knows you now, ${name}.` : "Your council knows you now."}
      </h2>
      <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, maxWidth: 280, margin: 0 }}>
        {round === 1
          ? "Every answer sharpens how they talk to you. This is how LYLO becomes family."
          : "Your council has everything it needs. They'll remember this."}
      </p>
    </div>
  );
};

// ─── Main IntakeFlow Component ────────────────────────────────────────────────
export const IntakeFlow: React.FC<IntakeFlowProps> = ({
  userEmail, apiUrl, round, onComplete, onSkip, existingProfile = {}
}) => {
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [profile, setProfile] = useState<Record<string, string>>(existingProfile);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [slideDir, setSlideDir] = useState<"in" | "out">("in");

  // Load questions from backend
  useEffect(() => {
    fetch(`${apiUrl}/intake-questions/${round}`)
      .then(r => r.json())
      .then(data => {
        setQuestions(data.questions || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load questions. Check your connection.");
        setLoading(false);
      });
  }, [apiUrl, round]);

  const saveAnswer = async (id: string, value: string): Promise<boolean> => {
    const updated = { ...profile, [id]: value };
    setProfile(updated);

    try {
      const fd = new FormData();
      fd.append("user_email",   userEmail);
      fd.append("question_id",  id);
      fd.append("value",        value);
      fd.append("full_profile", JSON.stringify(updated));

      const res = await fetch(`${apiUrl}/user-intake`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e) {
      console.warn("[IntakeFlow] Save failed, continuing anyway:", e);
      // Don't block the user — save to localStorage as backup
      try {
        localStorage.setItem(`lylo_intake_${userEmail}`, JSON.stringify(updated));
      } catch {}
      return false;
    }
  };

  const handleAnswer = async (id: string, value: string) => {
    setSaving(true);
    await saveAnswer(id, value);
    setSaving(false);

    if (currentIdx < questions.length - 1) {
      setSlideDir("out");
      setTimeout(() => {
        setCurrentIdx(i => i + 1);
        setSlideDir("in");
      }, 200);
    } else {
      // All questions answered
      const finalProfile = { ...profile, [id]: value };
      setDone(true);
      setTimeout(() => onComplete(finalProfile), 2200);
    }
  };

  const currentQuestion = questions[currentIdx];

  // Container style
  const containerStyle: React.CSSProperties = {
    minHeight: "100dvh",
    background: C.bg,
    display: "flex",
    flexDirection: "column",
    padding: "env(safe-area-inset-top, 20px) 20px env(safe-area-inset-bottom, 20px)",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
  };

  // Ambient glow
  const glowStyle: React.CSSProperties = {
    position: "fixed",
    top: "-20%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${C.greenDim} 0%, transparent 70%)`,
    pointerEvents: "none",
    zIndex: 0,
  };

  if (loading) return (
    <div style={{ ...containerStyle, justifyContent: "center", alignItems: "center" }}>
      <div style={{ glowStyle } as any} />
      <div style={{
        width: 36, height: 36, border: `2px solid ${C.green}`,
        borderTopColor: "transparent", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );

  if (error) return (
    <div style={{ ...containerStyle, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <p style={{ color: "#ef4444", fontSize: 15 }}>{error}</p>
      <button onClick={() => window.location.reload()}
        style={{ marginTop: 16, padding: "12px 24px", background: C.green, color: "#000",
          border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
        Retry
      </button>
    </div>
  );

  return (
    <div style={containerStyle}>
      {/* Ambient glow */}
      <div style={glowStyle} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, paddingTop: 4, paddingBottom: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: C.green,
              boxShadow: `0 0 8px ${C.green}`,
              animation: "pulse 2s ease-in-out infinite",
            }} />
            <span style={{
              fontSize: 10, letterSpacing: 3, color: C.green,
              fontFamily: "'Courier New', monospace", fontWeight: 700,
            }}>
              LYLO OS — {round === 1 ? "QUICK START" : "PROFILE SYNC"}
            </span>
          </div>
          {onSkip && (
            <button onClick={onSkip} style={{
              fontSize: 12, color: C.dim, background: "none",
              border: "none", cursor: "pointer", padding: "4px 8px",
              fontWeight: 600,
            }}>
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div style={{
        flex: 1, position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        paddingTop: 8,
        opacity: saving ? 0.7 : 1,
        transition: "opacity 0.15s",
      }}>
        {done ? (
          <CompleteScreen
            name={profile.preferred_name || profile.round1_preferred_name || ""}
            round={round}
          />
        ) : currentQuestion ? (
          <div
            key={currentIdx}
            style={{
              flex: 1,
              opacity: slideDir === "in" ? 1 : 0,
              transform: slideDir === "in" ? "translateX(0)" : "translateX(-20px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentIdx + 1}
              totalQuestions={questions.length}
              onAnswer={handleAnswer}
              isFirst={currentIdx === 0}
            />
          </div>
        ) : null}
      </div>

      {/* Saving indicator */}
      {saving && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: "8px 16px",
          fontSize: 11, color: C.muted, letterSpacing: 1,
          fontFamily: "'Courier New', monospace",
          display: "flex", alignItems: "center", gap: 8, zIndex: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: C.green,
            animation: "pulse 1s ease-in-out infinite",
          }} />
          SAVING...
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { -webkit-tap-highlight-color: transparent; }
        textarea, input { font-family: inherit; }
        button:active { transform: scale(0.97) !important; }
      `}</style>
    </div>
  );
};

export default IntakeFlow;
