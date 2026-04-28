import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router";
import { Home, PlusCircle, TrendingUp, Camera, X, ChevronRight, Activity, Scale, Dumbbell, Sparkles, Trash2, ArrowUpRight, Copy, Check, User, Image as ImageIcon } from "lucide-react";

// ============ CONFIG ============
const PROFILE = {
  weight: 80, targetWeight: 90, height: "6'0\"", age: 32,
  targets: { kcal: 3300, protein: 180, carbs: 430, fat: 90 },
};

const RECIPES = {
  "breakfast shake": { name: "Breakfast Shake", kcal: 475, protein: 45, carbs: 56, fat: 8.5 },
  "breakfast shake modified": { name: "Breakfast Shake (modified)", kcal: 610, protein: 59, carbs: 71, fat: 11 },
  "pasta lunch": { name: "Pasta Lunch", kcal: 620, protein: 36, carbs: 98, fat: 9 },
};

const SYSTEM_PROMPT = `You are a vegetarian nutrition coach.
USER: 80kg, 6'0", 32yo vegetarian powerlifter targeting 90kg.
TARGETS: 3300 kcal | 180g protein | 430g carbs | 90g fat

SAVED RECIPES (use exact values):
- breakfast shake: 475/45p/56c/8.5f
- breakfast shake modified: 610/59p/71c/11f
- pasta lunch: 620/36p/98c/9f

Estimate generously. Vegetarian only.

Respond ONLY with valid JSON, no markdown:
{"name":"short name","kcal":number,"protein":number,"carbs":number,"fat":number,"note":"max 12 word coaching tip"}`;

const SUGGEST_PROMPT = `Vegetarian nutrition coach. Given remaining macros, suggest 2-3 specific foods with quantities to close the biggest gap. Format: "Food (Xg) — Y kcal, Zg protein". Max 4 lines. Plain text.`;

const COACH_PROMPT = `Direct strength coach. User: 80kg 6'0 vegetarian, target 3300/180p/430c/90f, goal 90kg.
Given today's totals + log, write:
- 1 line: how the day went
- 1-2 lines: biggest gap or win  
- 1 line: tomorrow's focus
Direct. Numbers. Plain text. Max 5 short lines.`;

const PHYSIQUE_PROMPT = `You are a strength coach analysing a progress photo for a 32yo male vegetarian powerlifter currently 80kg, 6'0", targeting 90kg muscular bodyweight.

Be honest, direct, observational. No flattery, no fluff.

Analyse:
1. Visible muscle development (which areas show development, which lag)
2. Body composition impression (lean / athletic / slight softness / etc — be measured, not clinical)
3. Posture / structural notes if relevant
4. One clear training priority based on what you see

Format: 4 short paragraphs, plain text. Max 120 words total. Direct tone.`;

// ============ UTILS ============
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtFullDate = () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const callClaude = async (system, user, max = 300, image = null) => {
  const userContent = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
        { type: "text", text: user },
      ]
    : user;
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: max,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  return data.content[0].text.trim();
};

// ============ STORE ============
const useStore = () => {
  const [log, setLog] = useState([]);
  const [weights, setWeights] = useState([]);
  const [lifts, setLifts] = useState([]);
  const [history, setHistory] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const todayKey = `day:${today()}`;
        const todayRaw = localStorage.getItem(todayKey);
        const weightsRaw = localStorage.getItem("weights");
        const liftsRaw = localStorage.getItem("lifts");

        if (todayRaw) setLog(JSON.parse(todayRaw));
        if (weightsRaw) setWeights(JSON.parse(weightsRaw));
        if (liftsRaw) setLifts(JSON.parse(liftsRaw));

        // Load history from all day: keys
        const histObj = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("day:") && k !== todayKey) {
            try {
              const v = localStorage.getItem(k);
              if (v) histObj[k.replace("day:", "")] = JSON.parse(v);
            } catch {}
          }
        }
        setHistory(histObj);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try { localStorage.setItem(`day:${today()}`, JSON.stringify(log)); } catch {}
    })();
  }, [log, loaded]);

  const totals = log.reduce((a, i) => ({
    kcal: a.kcal + i.kcal, protein: a.protein + i.protein,
    carbs: a.carbs + i.carbs, fat: a.fat + i.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const remaining = {
    kcal: PROFILE.targets.kcal - totals.kcal,
    protein: PROFILE.targets.protein - totals.protein,
    carbs: PROFILE.targets.carbs - totals.carbs,
    fat: PROFILE.targets.fat - totals.fat,
  };

  const addLogItem = (item) => setLog(prev => [...prev, { ...item, id: Date.now() }]);
  const removeLogItem = (id) => setLog(prev => prev.filter(i => i.id !== id));

  const closeDay = async () => {
    if (log.length === 0) return;
    const dayKey = today();
    setHistory(prev => ({ ...prev, [dayKey]: { log, totals, date: dayKey } }));
    setLog([]);
  };

  const addWeight = async (val) => {
    const w = parseFloat(val);
    if (isNaN(w)) return;
    const next = [...weights.filter(x => x.date !== today()), { date: today(), weight: w }]
      .sort((a, b) => a.date.localeCompare(b.date));
    setWeights(next);
    try { localStorage.setItem("weights", JSON.stringify(next)); } catch {}
  };

  const addLift = async (lift, weight, reps) => {
    const w = parseFloat(weight), r = parseInt(reps);
    if (isNaN(w) || isNaN(r)) return;
    const next = [...lifts, { date: today(), lift, weight: w, reps: r, id: Date.now() }];
    setLifts(next);
    try { localStorage.setItem("lifts", JSON.stringify(next)); } catch {}
  };

  return { log, weights, lifts, history, loaded, totals, remaining, addLogItem, removeLogItem, closeDay, addWeight, addLift };
};

// ============ SHARED UI ============
const PageHeader = ({ eyebrow, title, right }) => (
  <div className="px-6 pt-8 pb-4 flex justify-between items-end">
    <div>
      <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-2">{eyebrow}</div>
      <h1 className="text-[34px] leading-none font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.02em" }}>
        {title}
      </h1>
    </div>
    {right}
  </div>
);

const MacroRing = ({ pct, color, size = 72, stroke = 4 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ebe9e6" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
};

const MacroBar = ({ label, current, target, color, unit = "g" }) => {
  const p = Math.min(100, Math.max(0, (current / target) * 100));
  const over = current > target;
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1.5 text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <span className="text-[#9a9a9a] tracking-wide">{label}</span>
        <span>
          <span className={over ? "text-[#c66b5c]" : "text-[#2d2d2d]"}>{Math.round(current)}</span>
          <span className="text-[#bdbab5]"> / {target}{unit}</span>
        </span>
      </div>
      <div className="h-[3px] bg-[#ebe9e6] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: over ? "#c66b5c" : color, transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
};

const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl border border-black/[0.04] ${onClick ? "cursor-pointer active:scale-[0.99] transition-transform" : ""} ${className}`}>
    {children}
  </div>
);

// ============ SYNC TO COACH MODAL ============
const SyncModal = ({ store, onClose }) => {
  const { log, totals, weights, lifts, history } = store;
  const [copied, setCopied] = useState(false);

  const generateSummary = () => {
    const date = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    let s = `📋 LEDGER SYNC — ${date}\n\n`;

    s += `── TODAY (in progress) ──\n`;
    s += `Calories: ${Math.round(totals.kcal)} / 3300\n`;
    s += `Protein: ${Math.round(totals.protein)}g / 180g\n`;
    s += `Carbs: ${Math.round(totals.carbs)}g / 430g\n`;
    s += `Fat: ${Math.round(totals.fat)}g / 90g\n`;
    if (log.length > 0) {
      s += `\nLog:\n`;
      log.forEach(i => { s += `• ${i.name}: ${i.kcal}kcal (${i.protein}p/${i.carbs}c/${i.fat}f)\n`; });
    }

    if (Object.keys(history).length > 0) {
      s += `\n── LAST 7 DAYS ──\n`;
      const recent = Object.entries(history).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
      recent.forEach(([date, day]) => {
        const t = day.totals || {};
        s += `${fmtDate(date)}: ${Math.round(t.kcal)}kcal · ${Math.round(t.protein)}p\n`;
      });
      const avg = recent.reduce((a, [_, d]) => a + (d.totals?.kcal || 0), 0) / recent.length;
      s += `Avg: ${Math.round(avg)} kcal/day\n`;
    }

    if (weights.length > 0) {
      s += `\n── WEIGHT ──\n`;
      const recent = weights.slice(-5);
      recent.forEach(w => { s += `${fmtDate(w.date)}: ${w.weight}kg\n`; });
      if (weights.length >= 2) {
        const change = (weights[weights.length - 1].weight - weights[0].weight).toFixed(1);
        s += `Change: ${change >= 0 ? "+" : ""}${change}kg total\n`;
      }
    }

    if (lifts.length > 0) {
      s += `\n── RECENT LIFTS ──\n`;
      const recent = lifts.slice(-5);
      recent.forEach(l => { s += `${fmtDate(l.date)} ${l.lift}: ${l.weight}kg × ${l.reps}\n`; });
    }

    s += `\n── ASK ──\n[your question for coach]`;
    return s;
  };

  const summary = generateSummary();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-[430px] bg-[#fafaf9] rounded-t-3xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ animation: "slideUp 0.3s cubic-bezier(.4,0,.2,1)" }}
      >
        <div className="px-6 pt-5 pb-3 flex items-start justify-between border-b border-black/[0.04]">
          <div>
            <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-1">Sync</div>
            <h2 className="text-[22px] font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
              Send to Coach
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-[#9a9a9a]">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-3 text-[12px] text-[#5a5a5a] leading-relaxed">
          Copy this summary, paste into your coach chat, and ask your question. Your coach gets full context on your day, week, weight, and lifts.
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-3">
          <Card className="p-4 bg-[#fbf9f4]">
            <pre className="text-[11px] text-[#3a3a3a] whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {summary}
            </pre>
          </Card>
        </div>

        <div className="px-6 py-4 border-t border-black/[0.04]">
          <button
            onClick={copy}
            className={`w-full py-3.5 rounded-2xl text-[12px] tracking-[0.15em] uppercase transition-all flex items-center justify-center gap-2 ${
              copied ? "bg-[#7a9a8c] text-white" : "bg-[#2d2d2d] text-white active:scale-[0.99]"
            }`}
          >
            {copied ? <><Check size={14} /> Copied — paste in coach chat</> : <><Copy size={14} /> Copy summary</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ HOME PAGE ============
const HomePage = ({ store }) => {
  const navigate = useNavigate();
  const { log, totals, remaining, weights, history } = store;
  const [showSync, setShowSync] = useState(false);
  const latestWeight = weights[weights.length - 1]?.weight ?? PROFILE.weight;
  const kcalPct = (totals.kcal / PROFILE.targets.kcal) * 100;
  const recentLog = [...log].reverse().slice(0, 3);

  return (
    <div className="h-full overflow-y-auto pb-32">
      <PageHeader
        eyebrow={fmtFullDate()}
        title="Today"
        right={
          <button
            onClick={() => setShowSync(true)}
            className="flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase text-[#9a8868] border border-[#9a8868]/30 px-3 py-1.5 rounded-full bg-white"
          >
            <ArrowUpRight size={12} strokeWidth={1.5} /> Coach
          </button>
        }
      />

      <div className="px-6">
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-2">Calories</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[56px] leading-none font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
                  {Math.round(totals.kcal)}
                </span>
                <span className="text-[14px] text-[#9a9a9a]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  / {PROFILE.targets.kcal}
                </span>
              </div>
              <div className={`text-[12px] mt-1 ${remaining.kcal < 0 ? "text-[#c66b5c]" : "text-[#9a8868]"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {remaining.kcal < 0 ? `+${Math.round(Math.abs(remaining.kcal))} over target` : `${Math.round(remaining.kcal)} remaining`}
              </div>
            </div>
            <div className="relative">
              <MacroRing pct={kcalPct} color="#9a8868" size={72} stroke={4} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[14px] font-medium text-[#2d2d2d]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(kcalPct)}%
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <MacroBar label="PROTEIN" current={totals.protein} target={PROFILE.targets.protein} color="#7a9a8c" />
            <MacroBar label="CARBS" current={totals.carbs} target={PROFILE.targets.carbs} color="#c9a368" />
            <MacroBar label="FAT" current={totals.fat} target={PROFILE.targets.fat} color="#b58779" />
          </div>
        </Card>
      </div>

      <div className="px-6 mt-3 grid grid-cols-2 gap-3">
        <Card className="p-4" onClick={() => navigate("/progress")}>
          <div className="flex items-center justify-between mb-2">
            <Scale size={16} strokeWidth={1.5} className="text-[#9a8868]" />
            <ArrowUpRight size={14} className="text-[#bdbab5]" />
          </div>
          <div className="text-[10px] tracking-[0.15em] text-[#9a9a9a] uppercase mb-1">Weight</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
              {latestWeight}
            </span>
            <span className="text-[11px] text-[#9a9a9a]">kg</span>
          </div>
          <div className="text-[10px] text-[#9a8868] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            → {PROFILE.targetWeight}kg goal
          </div>
        </Card>

        <Card className="p-4" onClick={() => navigate("/physique")}>
          <div className="flex items-center justify-between mb-2">
            <User size={16} strokeWidth={1.5} className="text-[#9a8868]" />
            <ArrowUpRight size={14} className="text-[#bdbab5]" />
          </div>
          <div className="text-[10px] tracking-[0.15em] text-[#9a9a9a] uppercase mb-1">Physique</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[24px] font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
              Check
            </span>
          </div>
          <div className="text-[10px] text-[#9a8868] mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            photo analysis
          </div>
        </Card>
      </div>

      <div className="px-6 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase">Recent Today</div>
          <button onClick={() => navigate("/log-meal")} className="text-[11px] text-[#9a8868]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            View all →
          </button>
        </div>

        {recentLog.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-[16px] text-[#bdbab5] italic mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
              empty plate.
            </div>
            <button
              onClick={() => navigate("/log-meal")}
              className="inline-flex items-center gap-2 text-[11px] tracking-[0.15em] uppercase text-[#9a8868] border border-[#9a8868]/30 px-4 py-2 rounded-full"
            >
              Log first meal <ChevronRight size={12} />
            </button>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentLog.map(item => (
              <Card key={item.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[#2d2d2d] truncate">{item.name}</div>
                  <div className="text-[10px] text-[#9a9a9a] mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <span className="text-[#7a9a8c]">{item.protein}p</span>
                    <span className="text-[#bdbab5] mx-1.5">·</span>
                    <span className="text-[#c9a368]">{item.carbs}c</span>
                    <span className="text-[#bdbab5] mx-1.5">·</span>
                    <span className="text-[#b58779]">{item.fat}f</span>
                  </div>
                </div>
                <div className="text-[20px] font-light text-[#2d2d2d] ml-4" style={{ fontFamily: "'Fraunces', serif" }}>
                  {item.kcal}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showSync && <SyncModal store={store} onClose={() => setShowSync(false)} />}
    </div>
  );
};

// ============ LOG MEAL PAGE ============
const MealLoggingPage = ({ store }) => {
  const { log, totals, remaining, addLogItem, removeLogItem, closeDay } = store;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastNote, setLastNote] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [coachReport, setCoachReport] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [imageData, setImageData] = useState(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const addFood = async () => {
    if ((!input.trim() && !imageData) || loading) return;
    const food = input.trim();
    setInput(""); setLoading(true); setLastNote(""); setSuggestion("");

    const recipeMatch = food.toLowerCase();
    if (RECIPES[recipeMatch]) {
      addLogItem(RECIPES[recipeMatch]);
      setLastNote("Saved recipe loaded");
      setLoading(false);
      return;
    }

    try {
      const text = await callClaude(SYSTEM_PROMPT, food ? `Log: ${food}` : "Log this food shown in the image", 300, imageData);
      const p = JSON.parse(text);
      addLogItem({
        name: p.name,
        kcal: Math.round(p.kcal),
        protein: Math.round(p.protein * 10) / 10,
        carbs: Math.round(p.carbs * 10) / 10,
        fat: Math.round(p.fat * 10) / 10,
      });
      setLastNote(p.note || "");
    } catch { setLastNote("Couldn't estimate — try again"); }
    setImageData(null);
    setLoading(false);
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result.split(",")[1];
      setImageData({ media_type: file.type, data });
    };
    reader.readAsDataURL(file);
  };

  const suggestFood = async () => {
    if (suggestLoading) return;
    setSuggestLoading(true); setSuggestion("");
    try {
      const text = await callClaude(SUGGEST_PROMPT,
        `Remaining: ${Math.round(remaining.kcal)} kcal, ${Math.round(remaining.protein)}g protein, ${Math.round(remaining.carbs)}g carbs, ${Math.round(remaining.fat)}g fat. Suggest what to eat next.`,
        250);
      setSuggestion(text);
    } catch { setSuggestion("Error — try again"); }
    setSuggestLoading(false);
  };

  const getCoachReport = async () => {
    if (coachLoading || log.length === 0) return;
    setCoachLoading(true); setCoachReport("");
    try {
      const logText = log.map(i => `${i.name}: ${i.kcal}/${i.protein}p/${i.carbs}c/${i.fat}f`).join("\n");
      const text = await callClaude(COACH_PROMPT,
        `TOTALS: ${Math.round(totals.kcal)}kcal ${Math.round(totals.protein)}p ${Math.round(totals.carbs)}c ${Math.round(totals.fat)}f\nGAPS: ${Math.round(remaining.kcal)}kcal ${Math.round(remaining.protein)}p ${Math.round(remaining.carbs)}c\n\nLOG:\n${logText}`, 400);
      setCoachReport(text);
    } catch { setCoachReport("Error — try again"); }
    setCoachLoading(false);
  };

  const quickAdds = ["breakfast shake", "pasta lunch", "2 scoops whey", "2 eggs + toast", "200g rice", "cottage cheese"];

  return (
    <div className="h-full overflow-y-auto pb-32">
      <PageHeader eyebrow="Log meal" title="What did you eat?" />

      <div className="px-6">
        <Card className="p-4">
          {imageData && (
            <div className="mb-3 flex items-center gap-2 p-2 bg-[#f5f3f0] rounded-lg">
              <Camera size={14} className="text-[#9a8868]" />
              <span className="text-[11px] text-[#5a5a5a] flex-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Image attached</span>
              <button onClick={() => setImageData(null)} className="text-[#9a9a9a]">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addFood()}
              placeholder="Describe a meal..."
              className="flex-1 bg-transparent text-[14px] text-[#2d2d2d] placeholder:text-[#bdbab5] outline-none py-2"
            />
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="p-2 text-[#9a8868] hover:bg-[#f5f3f0] rounded-lg transition-colors">
              <Camera size={18} strokeWidth={1.5} />
            </button>
            <button
              onClick={addFood}
              disabled={loading || (!input.trim() && !imageData)}
              className={`px-4 py-2 rounded-full text-[11px] tracking-[0.15em] uppercase transition-all ${
                (!input.trim() && !imageData) || loading
                  ? "text-[#bdbab5] bg-[#f5f3f0]"
                  : "text-white bg-[#2d2d2d] active:scale-95"
              }`}
            >
              {loading ? "···" : "Add"}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/[0.04]">
            {quickAdds.map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="text-[10px] text-[#7a7a7a] bg-[#f5f3f0] hover:bg-[#ebe9e6] px-2.5 py-1 rounded-full transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {q}
              </button>
            ))}
          </div>
        </Card>

        {lastNote && (
          <div className="mt-3 px-4 py-3 bg-[#f5f1e8] border-l-2 border-[#9a8868] rounded-r-lg">
            <div className="text-[12px] text-[#5a4a30]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {lastNote}
            </div>
          </div>
        )}

        {suggestion && (
          <Card className="mt-3 p-4 bg-[#fbf9f4]">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={12} className="text-[#9a8868]" />
              <div className="text-[10px] tracking-[0.2em] text-[#9a8868] uppercase">Eat next</div>
            </div>
            <div className="text-[12px] text-[#3a3a3a] whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {suggestion}
            </div>
          </Card>
        )}
      </div>

      <div className="px-6 mt-5">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase">Today's totals</div>
            <div className="text-[11px] text-[#9a8868]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {log.length} {log.length === 1 ? "item" : "items"}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "KCAL", val: Math.round(totals.kcal), target: PROFILE.targets.kcal },
              { label: "PROT", val: Math.round(totals.protein), target: PROFILE.targets.protein },
              { label: "CARB", val: Math.round(totals.carbs), target: PROFILE.targets.carbs },
              { label: "FAT", val: Math.round(totals.fat), target: PROFILE.targets.fat },
            ].map(m => (
              <div key={m.label}>
                <div className="text-[9px] tracking-[0.15em] text-[#bdbab5] uppercase mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.label}
                </div>
                <div className="text-[18px] font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
                  {m.val}
                </div>
                <div className="text-[9px] text-[#bdbab5]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  /{m.target}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="px-6 mt-5">
        <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-3">Log</div>
        {log.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-[16px] text-[#bdbab5] italic" style={{ fontFamily: "'Fraunces', serif" }}>
              nothing yet today.
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {[...log].reverse().map(item => (
              <Card key={item.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[#2d2d2d] truncate">{item.name}</div>
                  <div className="text-[10px] text-[#9a9a9a] mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <span className="text-[#7a9a8c]">{item.protein}p</span>
                    <span className="text-[#bdbab5] mx-1.5">·</span>
                    <span className="text-[#c9a368]">{item.carbs}c</span>
                    <span className="text-[#bdbab5] mx-1.5">·</span>
                    <span className="text-[#b58779]">{item.fat}f</span>
                  </div>
                </div>
                <div className="text-[20px] font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
                  {item.kcal}
                </div>
                <button onClick={() => removeLogItem(item.id)} className="text-[#bdbab5] hover:text-[#c66b5c] transition-colors p-1">
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </Card>
            ))}
          </div>
        )}

        {log.length > 0 && (
          <div className="space-y-2 mt-5">
            <button
              onClick={suggestFood}
              disabled={suggestLoading}
              className="w-full py-3.5 bg-[#9a8868] text-white rounded-2xl text-[11px] tracking-[0.15em] uppercase active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
            >
              <Sparkles size={14} strokeWidth={1.5} />
              {suggestLoading ? "Thinking···" : "What to eat next"}
            </button>
            <button
              onClick={getCoachReport}
              disabled={coachLoading}
              className="w-full py-3.5 bg-white border border-black/[0.06] text-[#2d2d2d] rounded-2xl text-[11px] tracking-[0.15em] uppercase active:scale-[0.99] transition-transform"
            >
              {coachLoading ? "Analysing···" : "Daily report"}
            </button>
            <button
              onClick={closeDay}
              className="w-full py-3 text-[10px] tracking-[0.2em] uppercase text-[#bdbab5] hover:text-[#c66b5c] transition-colors"
            >
              Close day
            </button>
          </div>
        )}

        {coachReport && (
          <Card className="mt-3 p-4 bg-[#fbf9f4]">
            <div className="text-[10px] tracking-[0.2em] text-[#9a8868] uppercase mb-2">Coach Report</div>
            <div className="text-[12px] text-[#3a3a3a] whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {coachReport}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ============ PHYSIQUE PAGE ============
const PhysiquePage = ({ store }) => {
  const { weights } = store;
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);
  const latestWeight = weights[weights.length - 1]?.weight ?? PROFILE.weight;

  // Load saved photos
  useEffect(() => {
    (async () => {
      try {
        const r = localStorage.getItem("physique-photos");
        if (r) setPhotos(JSON.parse(r));
      } catch {}
    })();
  }, []);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result.split(",")[1];
      setImageData({ media_type: file.type, data });
      setImagePreview(reader.result);
      setAnalysis("");
    };
    reader.readAsDataURL(file);
  };

  const analyse = async () => {
    if (!imageData || loading) return;
    setLoading(true); setAnalysis("");
    try {
      const text = await callClaude(PHYSIQUE_PROMPT,
        `Current weight: ${latestWeight}kg. Target: ${PROFILE.targetWeight}kg. Analyse this physique photo.`,
        500, imageData);
      setAnalysis(text);

      // Save photo entry (without full base64 to save storage)
      const entry = {
        id: Date.now(),
        date: today(),
        weight: latestWeight,
        analysis: text,
      };
      const updated = [entry, ...photos].slice(0, 20);
      setPhotos(updated);
      try { localStorage.setItem("physique-photos", JSON.stringify(updated)); } catch {}
    } catch { setAnalysis("Analysis failed — try again"); }
    setLoading(false);
  };

  const reset = () => {
    setImageData(null);
    setImagePreview(null);
    setAnalysis("");
  };

  return (
    <div className="h-full overflow-y-auto pb-32">
      <PageHeader eyebrow="Physique" title="Composition check" />

      <div className="px-6">
        {!imagePreview ? (
          <Card className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#f5f1e8] flex items-center justify-center">
              <ImageIcon size={22} strokeWidth={1.5} className="text-[#9a8868]" />
            </div>
            <h3 className="text-[18px] font-light text-[#2d2d2d] mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
              Upload progress photo
            </h3>
            <p className="text-[12px] text-[#7a7a7a] mb-5 leading-relaxed max-w-[280px] mx-auto">
              Front, side, or back. Even lighting works best. You'll get an honest read on muscle development and a training priority.
            </p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 text-[11px] tracking-[0.15em] uppercase text-white bg-[#2d2d2d] px-5 py-3 rounded-full active:scale-95 transition-transform"
            >
              <Camera size={14} /> Choose photo
            </button>
            <p className="text-[10px] text-[#bdbab5] mt-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              private · not stored
            </p>
          </Card>
        ) : (
          <Card className="p-4">
            <div className="relative mb-4">
              <img src={imagePreview} alt="progress" className="w-full rounded-xl max-h-[400px] object-cover" />
              <button
                onClick={reset}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 backdrop-blur"
              >
                <X size={16} />
              </button>
            </div>

            {!analysis && (
              <button
                onClick={analyse}
                disabled={loading}
                className="w-full py-3.5 bg-[#2d2d2d] text-white rounded-2xl text-[11px] tracking-[0.15em] uppercase active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
              >
                <Sparkles size={14} />
                {loading ? "Analysing···" : "Analyse physique"}
              </button>
            )}

            {analysis && (
              <div className="space-y-3">
                <Card className="p-4 bg-[#fbf9f4] border-0">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={12} className="text-[#9a8868]" />
                    <div className="text-[10px] tracking-[0.2em] text-[#9a8868] uppercase">Coach read</div>
                  </div>
                  <div className="text-[12px] text-[#3a3a3a] leading-relaxed whitespace-pre-wrap">
                    {analysis}
                  </div>
                </Card>
                <button
                  onClick={reset}
                  className="w-full py-3 text-[10px] tracking-[0.2em] uppercase text-[#9a9a9a] bg-white border border-black/[0.06] rounded-2xl"
                >
                  Upload another
                </button>
              </div>
            )}
          </Card>
        )}
      </div>

      {photos.length > 0 && (
        <div className="px-6 mt-6">
          <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-3">Past reads</div>
          <div className="space-y-2">
            {photos.slice(0, 5).map(p => (
              <Card key={p.id} className="p-4">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[12px] text-[#2d2d2d]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtDate(p.date)}</span>
                  <span className="text-[11px] text-[#9a9a9a]">{p.weight}kg</span>
                </div>
                <div className="text-[11px] text-[#5a5a5a] leading-relaxed line-clamp-3">
                  {p.analysis}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ PROGRESS PAGE ============
const ProgressPage = ({ store }) => {
  const { weights, lifts, history, addWeight, addLift, totals, log } = store;
  const [section, setSection] = useState("weight");
  const [w, setW] = useState("");
  const [liftName, setLiftName] = useState("Squat");
  const [liftKg, setLiftKg] = useState("");
  const [liftReps, setLiftReps] = useState("");

  const latestWeight = weights[weights.length - 1]?.weight ?? PROFILE.weight;
  const weightChange = weights.length >= 2 ? (weights[weights.length - 1].weight - weights[0].weight).toFixed(1) : "0.0";
  const allLifts = ["Squat", "Bench", "Deadlift", "OHP"];
  const e1rm = (weight, reps) => Math.round(weight * (1 + reps / 30));
  const bestForLift = (name) => {
    const f = lifts.filter(l => l.lift === name);
    if (f.length === 0) return null;
    return f.reduce((b, c) => e1rm(c.weight, c.reps) > e1rm(b.weight, b.reps) ? c : b);
  };
  const liftHistory = lifts.filter(l => l.lift === liftName).slice(-10).reverse();

  const wMin = weights.length ? Math.min(...weights.map(x => x.weight)) - 1 : 78;
  const wMax = weights.length ? Math.max(...weights.map(x => x.weight)) + 1 : 92;
  const range = Math.max(wMax - wMin, 1);

  const sortedHistory = Object.entries(history).sort(([a], [b]) => b.localeCompare(a));
  if (log.length > 0) sortedHistory.unshift([today(), { totals, log, date: today() }]);

  return (
    <div className="h-full overflow-y-auto pb-32">
      <PageHeader eyebrow="Progress" title="Trends" />

      <div className="px-6 mb-4">
        <div className="flex gap-1 p-1 bg-[#f0ede8] rounded-full">
          {[
            { id: "weight", label: "Weight" },
            { id: "train", label: "Lifts" },
            { id: "history", label: "Days" },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex-1 py-2 text-[11px] tracking-[0.1em] uppercase rounded-full transition-all ${
                section === s.id ? "bg-white text-[#2d2d2d] shadow-sm" : "text-[#9a9a9a]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {section === "weight" && (
        <div className="px-6 space-y-4">
          <Card className="p-6">
            <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-2">Body weight</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[56px] leading-none font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
                {latestWeight}
              </span>
              <span className="text-[16px] text-[#9a9a9a]">kg</span>
              <span className="text-[12px] text-[#9a8868] ml-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                → {PROFILE.targetWeight}
              </span>
            </div>
            <div className={`text-[11px] ${parseFloat(weightChange) >= 0 ? "text-[#7a9a8c]" : "text-[#c66b5c]"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {parseFloat(weightChange) >= 0 ? "+" : ""}{weightChange} kg total · {(PROFILE.targetWeight - latestWeight).toFixed(1)} kg to goal
            </div>

            {weights.length >= 2 && (
              <svg width="100%" height="100" viewBox="0 0 320 100" preserveAspectRatio="none" className="mt-5">
                <line x1="0" y1={100 - ((PROFILE.targetWeight - wMin) / range) * 90 - 5} x2="320" y2={100 - ((PROFILE.targetWeight - wMin) / range) * 90 - 5}
                  stroke="#ebe9e6" strokeWidth="1" strokeDasharray="2,3" />
                <polyline
                  fill="none" stroke="#9a8868" strokeWidth="1.5"
                  points={weights.map((wt, i) => {
                    const x = (i / Math.max(weights.length - 1, 1)) * 316 + 2;
                    const y = 100 - ((wt.weight - wMin) / range) * 90 - 5;
                    return `${x},${y}`;
                  }).join(" ")}
                />
                {weights.map((wt, i) => {
                  const x = (i / Math.max(weights.length - 1, 1)) * 316 + 2;
                  const y = 100 - ((wt.weight - wMin) / range) * 90 - 5;
                  return <circle key={i} cx={x} cy={y} r="2.5" fill="white" stroke="#9a8868" strokeWidth="1.5" />;
                })}
              </svg>
            )}
          </Card>

          <Card className="p-4">
            <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-3">Log weight</div>
            <div className="flex gap-2">
              <input
                type="number" step="0.1" inputMode="decimal" value={w} onChange={e => setW(e.target.value)}
                placeholder={`${latestWeight}`}
                className="flex-1 bg-[#f5f3f0] rounded-xl px-4 py-3 text-[14px] outline-none text-[#2d2d2d] placeholder:text-[#bdbab5]"
                onKeyDown={e => { if (e.key === "Enter") { addWeight(w); setW(""); } }}
              />
              <button
                onClick={() => { addWeight(w); setW(""); }}
                disabled={!w}
                className={`px-5 rounded-xl text-[11px] tracking-[0.15em] uppercase transition-all ${
                  !w ? "text-[#bdbab5] bg-[#f5f3f0]" : "text-white bg-[#2d2d2d] active:scale-95"
                }`}
              >
                Save
              </button>
            </div>
          </Card>

          {weights.length > 0 && (
            <Card className="p-4">
              <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-3">History</div>
              {[...weights].reverse().slice(0, 14).map((wt, i, arr) => {
                const prev = arr[i + 1];
                const delta = prev ? (wt.weight - prev.weight).toFixed(1) : null;
                return (
                  <div key={wt.date + i} className="flex justify-between items-center py-2.5 border-b border-black/[0.04] last:border-0">
                    <span className="text-[12px] text-[#7a7a7a]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtDate(wt.date)}</span>
                    <div className="flex gap-3 items-center">
                      {delta && (
                        <span className={`text-[10px] ${parseFloat(delta) >= 0 ? "text-[#7a9a8c]" : "text-[#c66b5c]"}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {parseFloat(delta) >= 0 ? "+" : ""}{delta}
                        </span>
                      )}
                      <span className="text-[14px] text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>{wt.weight}<span className="text-[#9a9a9a] text-[11px]"> kg</span></span>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {section === "train" && (
        <div className="px-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {allLifts.map(name => {
              const best = bestForLift(name);
              return (
                <Card key={name} className="p-4" onClick={() => setLiftName(name)}>
                  <div className="flex items-center justify-between mb-2">
                    <Dumbbell size={14} strokeWidth={1.5} className="text-[#9a8868]" />
                    {liftName === name && <div className="w-1.5 h-1.5 rounded-full bg-[#9a8868]" />}
                  </div>
                  <div className="text-[10px] tracking-[0.15em] text-[#9a9a9a] uppercase mb-1">{name}</div>
                  {best ? (
                    <>
                      <div className="text-[24px] font-light text-[#2d2d2d] leading-none" style={{ fontFamily: "'Fraunces', serif" }}>
                        {best.weight}<span className="text-[14px] text-[#9a9a9a] ml-1">×{best.reps}</span>
                      </div>
                      <div className="text-[10px] text-[#9a8868] mt-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        e1RM {e1rm(best.weight, best.reps)}
                      </div>
                    </>
                  ) : (
                    <div className="text-[18px] text-[#bdbab5] italic" style={{ fontFamily: "'Fraunces', serif" }}>—</div>
                  )}
                </Card>
              );
            })}
          </div>

          <Card className="p-4">
            <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-3">Log {liftName}</div>
            <div className="flex gap-2">
              <input
                type="number" inputMode="decimal" value={liftKg} onChange={e => setLiftKg(e.target.value)} placeholder="kg"
                className="flex-1 bg-[#f5f3f0] rounded-xl px-4 py-3 text-[14px] outline-none text-center text-[#2d2d2d] placeholder:text-[#bdbab5]"
              />
              <span className="self-center text-[#bdbab5]">×</span>
              <input
                type="number" inputMode="numeric" value={liftReps} onChange={e => setLiftReps(e.target.value)} placeholder="reps"
                className="flex-1 bg-[#f5f3f0] rounded-xl px-4 py-3 text-[14px] outline-none text-center text-[#2d2d2d] placeholder:text-[#bdbab5]"
              />
              <button
                onClick={() => { addLift(liftName, liftKg, liftReps); setLiftKg(""); setLiftReps(""); }}
                disabled={!liftKg || !liftReps}
                className={`px-5 rounded-xl text-[11px] tracking-[0.15em] uppercase transition-all ${
                  !liftKg || !liftReps ? "text-[#bdbab5] bg-[#f5f3f0]" : "text-white bg-[#2d2d2d] active:scale-95"
                }`}
              >
                Save
              </button>
            </div>
          </Card>

          {liftHistory.length > 0 ? (
            <Card className="p-4">
              <div className="text-[10px] tracking-[0.2em] text-[#9a9a9a] uppercase mb-3">{liftName} history</div>
              {liftHistory.map((l, i) => (
                <div key={l.id || i} className="flex justify-between items-center py-2.5 border-b border-black/[0.04] last:border-0">
                  <span className="text-[12px] text-[#7a7a7a]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtDate(l.date)}</span>
                  <div className="flex gap-3 items-center">
                    <span className="text-[10px] text-[#bdbab5]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>e1RM {e1rm(l.weight, l.reps)}</span>
                    <span className="text-[14px] text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
                      {l.weight}<span className="text-[#9a9a9a] text-[11px]">kg</span> × {l.reps}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <div className="text-[16px] text-[#bdbab5] italic" style={{ fontFamily: "'Fraunces', serif" }}>
                no {liftName.toLowerCase()} logged yet.
              </div>
            </Card>
          )}
        </div>
      )}

      {section === "history" && (
        <div className="px-6">
          {sortedHistory.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-[16px] text-[#bdbab5] italic" style={{ fontFamily: "'Fraunces', serif" }}>
                no closed days yet.
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedHistory.slice(0, 30).map(([date, day]) => {
                const t = day.totals || {};
                const pct = Math.round((t.kcal / PROFILE.targets.kcal) * 100);
                const proteinPct = Math.round((t.protein / PROFILE.targets.protein) * 100);
                const isToday = date === today();
                return (
                  <Card key={date} className="p-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[#2d2d2d]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {isToday ? "Today" : fmtDate(date)}
                        </span>
                        {isToday && <span className="text-[8px] tracking-[0.15em] uppercase text-[#9a8868] bg-[#fbf9f4] px-1.5 py-0.5 rounded">Live</span>}
                      </div>
                      <span className="text-[16px] font-light text-[#2d2d2d]" style={{ fontFamily: "'Fraunces', serif" }}>
                        {Math.round(t.kcal)}
                      </span>
                    </div>
                    <div className="h-[2px] bg-[#ebe9e6] rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: pct >= 95 ? "#7a9a8c" : pct >= 80 ? "#c9a368" : "#c66b5c"
                      }} />
                    </div>
                    <div className="flex gap-3 text-[10px] text-[#9a9a9a]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span className={proteinPct >= 95 ? "text-[#7a9a8c]" : ""}>{Math.round(t.protein)}p</span>
                      <span className="text-[#bdbab5]">·</span>
                      <span>{Math.round(t.carbs)}c</span>
                      <span className="text-[#bdbab5]">·</span>
                      <span>{Math.round(t.fat)}f</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============ APP SHELL ============
function AppContent({ store }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage store={store} />} />
        <Route path="/log-meal" element={<MealLoggingPage store={store} />} />
        <Route path="/physique" element={<PhysiquePage store={store} />} />
        <Route path="/progress" element={<ProgressPage store={store} />} />
      </Routes>

      <nav className="absolute bottom-0 left-0 right-0 backdrop-blur-2xl bg-white/70 border-t border-black/5">
        <div className="flex items-center justify-around px-6 py-3">
          {[
            { path: "/", icon: Home, label: "Home" },
            { path: "/log-meal", icon: PlusCircle, label: "Log" },
            { path: "/physique", icon: User, label: "Physique" },
            { path: "/progress", icon: TrendingUp, label: "Progress" },
          ].map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 transition-colors py-1.5 ${
                  active ? "text-[#2d2d2d]" : "text-[#9a9a9a]"
                }`}
              >
                <Icon size={22} strokeWidth={1.5} />
                <span className="text-[9px] tracking-[0.1em] uppercase">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default function App() {
  const store = useStore();

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=JetBrains+Mono:wght@300;400;500&family=Manrope:wght@300;400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    `;
    document.head.appendChild(style);

    return () => {
      try { document.head.removeChild(link); } catch {}
      try { document.head.removeChild(style); } catch {}
    };
  }, []);

  if (!store.loaded) {
    return (
      <div className="size-full min-h-screen bg-gradient-to-br from-[#f5f3f0] to-[#e8e6e3] flex items-center justify-center">
        <div className="text-[11px] tracking-[0.2em] text-[#9a9a9a]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          LOADING···
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="size-full min-h-screen bg-gradient-to-br from-[#f5f3f0] to-[#e8e6e3] flex items-center justify-center" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <div className="w-full max-w-[430px] h-[100vh] max-h-[932px] bg-[#fafaf9] shadow-2xl overflow-hidden relative">
          <AppContent store={store} />
        </div>
      </div>
    </BrowserRouter>
  );
}
