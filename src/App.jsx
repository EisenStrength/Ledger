import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Home, Plus, TrendingUp, Camera, X, Mic, Search, Sparkles, Trash2, ArrowUpRight, Copy, Check, ChevronLeft, Dumbbell, Scale, AlertCircle } from "lucide-react";

const C = { bg: "#EDECEA", card: "#FFFFFF", accent: "#8576A6", accentSoft: "#F0EBF8", accentTrack: "#E4DFED", text: "#1C1B1F", textMid: "#6B6970", textDim: "#9B9BA0", textFaint: "#C4C2C8", border: "rgba(0,0,0,0.055)", danger: "#C0544A", success: "#4A8C6A", shadow: "0 2px 10px rgba(0,0,0,0.055)" };
const F = { body: "'Inter',system-ui,-apple-system,sans-serif" };
const R = { card: 18, btn: 12, pill: 100 };
const PROFILE = { weight: 80, targetWeight: 90, targets: { kcal: 3300, protein: 180, carbs: 430, fat: 90 } };
const DEFAULT_ITEMS = [{ id: "bs", name: "Breakfast Shake", kcal: 475, protein: 45, carbs: 56, fat: 8.5 }, { id: "bsm", name: "Breakfast Shake (modified)", kcal: 610, protein: 59, carbs: 71, fat: 11 }, { id: "pl", name: "Pasta Lunch", kcal: 620, protein: 36, carbs: 98, fat: 9 }];

const FOOD_PROMPT = (items) => `Vegetarian nutrition database. User: 80kg powerlifter, 3300kcal/180p/430c/90f targets. Saved items: ${items.map(i => `${i.name.toLowerCase()}: ${i.kcal}kcal/${i.protein}p/${i.carbs}c/${i.fat}f`).join("; ")}. Return JSON: {"name":"string","kcal":number,"protein":number,"carbs":number,"fat":number,"note":"string"}`;
const SUGGEST_PROMPT = `Direct vegetarian nutrition coach. Given remaining macros suggest 2-3 specific foods.`;
const COACH_PROMPT = `Direct strength coach. Summary of day.`;
const PRODUCT_PROMPT = `Find nutritional info per standard serving. Return JSON.`;
const RECIPE_PROMPT = `Vegetarian nutrition calculator. Return JSON.`;
const PHYSIQUE_PROMPT = `Strength coach reviewing a progress photo.`;

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d + "T00:00").toLocaleDateString("en-AU", { month: "short", day: "numeric" });
const fmtFull = () => new Date().toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric" });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const lsGet = (k, fb = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

const callClaude = async (system, userContent, maxTokens = 400) => {
    const body = { model: "claude-3-5-sonnet-20240620", max_tokens: maxTokens, system, messages: [{ role: "user", content: Array.isArray(userContent) ? userContent : [{ type: "text", text: userContent }] }] };
    try {
        const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        return data.content[0].text.trim();
    } catch (e) {
        throw new Error("AI Service Unavailable");
    }
};

const parseJSON = (t) => {
    const m = t.match(/{[\s\S]*}/);
    if (!m) throw new Error("No JSON found");
    return JSON.parse(m[0]);
};

const useStore = () => {
    const [log, setLog] = useState([]);
    const [weights, setWeights] = useState([]);
    const [lifts, setLifts] = useState([]);
    const [history, setHistory] = useState({});
    const [items, setItems] = useState(DEFAULT_ITEMS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const tk = `day:${todayStr()}`;
        const hist = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith("day:") && k !== tk) {
                const v = lsGet(k);
                if (v) hist[k.replace("day:", "")] = v;
            }
        }
        setLog(lsGet(tk, []));
        setWeights(lsGet("weights", []));
        setLifts(lsGet("lifts", []));
        setHistory(hist);
        setItems(lsGet("custom-items", DEFAULT_ITEMS));
        setLoaded(true);
    }, []);

    useEffect(() => { if (loaded) lsSet(`day:${todayStr()}`, log); }, [log, loaded]);

    const totals = log.reduce((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    const remaining = { kcal: PROFILE.targets.kcal - totals.kcal, protein: PROFILE.targets.protein - totals.protein, carbs: PROFILE.targets.carbs - totals.carbs, fat: PROFILE.targets.fat - totals.fat };
    const addItem = (item) => setLog(p => [...p, { ...item, id: uid() }]);
    const removeItem = (id) => setLog(p => p.filter(i => i.id !== id));
    const closeDay = () => { if (!log.length) return; const dk = todayStr(); setHistory(p => ({ ...p, [dk]: { log, totals, date: dk } })); lsSet(`day:${dk}`, { log, totals, date: dk, closed: true }); setLog([]); };
    const addWeight = (v) => { const w = parseFloat(v); if (isNaN(w)) return; const next = [...weights.filter(x => x.date !== todayStr()), { date: todayStr(), weight: w }].sort((a, b) => a.date.localeCompare(b.date)); setWeights(next); lsSet("weights", next); };
    const addLift = (l, w, r) => { const wn = parseFloat(w), rn = parseInt(r); if (isNaN(wn) || isNaN(rn)) return; const next = [...lifts, { date: todayStr(), lift: l, weight: wn, reps: rn, id: uid() }]; setLifts(next); lsSet("lifts", next); };
    const saveItems = (x) => { setItems(x); lsSet("custom-items", x); };
    const score = Math.round((Math.min(totals.kcal / PROFILE.targets.kcal, 1) * 35) + (Math.min(totals.protein / PROFILE.targets.protein, 1) * 35));

    return { log, weights, lifts, history, items, loaded, totals, remaining, score, addItem, removeItem, closeDay, addWeight, addLift, saveItems };
};

const Card = ({ children, style = {}, onClick }) => (
    <div onClick={onClick} style={{ background: C.card, borderRadius: R.card, boxShadow: C.shadow, border: `1px solid ${C.border}`, overflow: "hidden", ...style, ...(onClick ? { cursor: "pointer" } : {}) }}>
        {children}
    </div>
);

const MiniRing = ({ pct, size = 44, stroke = 3.5 }) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c - (Math.min(pct, 100) / 100) * c;
    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.accentTrack} strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct > 100 ? C.danger : C.accent} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.body, fontSize: 10, fontWeight: 600, color: C.text }}>{Math.round(Math.min(pct, 100))}%</div>
        </div>
    );
};

const HBar = ({ pct }) => (
    <div style={{ height: 8, background: C.accentTrack, borderRadius: 4, overflow: "hidden", marginTop: 6 }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: C.accent, borderRadius: 4, transition: "width 0.5s ease" }} />
    </div>
);

const PageShell = ({ children }) => <div style={{ height: "100%", overflowY: "auto", paddingBottom: 90, background: C.bg }}>{children}</div>;

const BackHeader = ({ title, right }) => {
    const nav = useNavigate();
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => nav("/")} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 4px 4px 0", display: "flex", alignItems: "center" }}>
                    <ChevronLeft size={22} color={C.text} strokeWidth={2} />
                </button>
                <span style={{ fontFamily: F.body, fontSize: 22, fontWeight: 600, color: C.text }}>{title}</span>
            </div>
            {right}
        </div>
    );
};

const AddSheet = ({ store, onClose }) => {
    const [mode, setMode] = useState("text");
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [note, setNote] = useState("");
    const [listening, setListening] = useState(false);
    const inputRef = useRef(null);
    const fileRef = useRef(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, []);

    const doLog = async (text, img = null) => {
        if (!text.trim() && !img) return;
        setLoading(true); setError(""); 
        try {
            const raw = await callClaude(FOOD_PROMPT(store.items), text, 300);
            const p = parseJSON(raw);
            store.addItem({ name: p.name, kcal: Math.round(p.kcal), protein: +p.protein.toFixed(1), carbs: +p.carbs.toFixed(1), fat: +p.fat.toFixed(1) });
            setNote(`✓ Added ${p.name}`);
            setTimeout(onClose, 700);
        } catch (e) { setError("Failed to log"); }
        setLoading(false);
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.card, borderRadius: "20px 20px 0 0", paddingBottom: 32, maxHeight: "88vh", overflowY: "auto" }}>
                <div style={{ padding: "20px" }}>
                    <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. 200g Greek Yogurt" style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${C.border}` }} />
                    <button onClick={() => doLog(input)} style={{ width: "100%", marginTop: "12px", padding: "12px", background: C.accent, color: "white", borderRadius: "8px", border: "none" }}>Log Food</button>
                    {error && <p style={{ color: C.danger }}>{error}</p>}
                </div>
            </div>
        </div>
    );
};

const HomePage = ({ store }) => {
    const { totals, score } = store;
    const [showAdd, setShowAdd] = useState(false);
    return (
        <PageShell>
            <div style={{ padding: "32px 20px" }}>
                <h1 style={{ fontFamily: F.body, fontSize: 34, fontWeight: 700 }}>Today</h1>
                <Card style={{ padding: 20, marginTop: 20 }}>
                    <div style={{ fontSize: 13, color: C.textMid }}>Growth Score</div>
                    <div style={{ fontSize: 48, fontWeight: 700 }}>{score}</div>
                </Card>
                <div style={{ marginTop: 20 }}>
                    <MiniRing pct={(totals.kcal / PROFILE.targets.kcal) * 100} />
                    <p>{totals.kcal} / {PROFILE.targets.kcal} kcal</p>
                </div>
                <button onClick={() => setShowAdd(true)} style={{ width: "100%", marginTop: 20, padding: 16, background: C.accent, color: "white", borderRadius: 12, border: "none" }}>Add Meal</button>
            </div>
            {showAdd && <AddSheet store={store} onClose={() => setShowAdd(false)} />}
        </PageShell>
    );
};

const LogPage = ({ store }) => (
    <PageShell>
        <BackHeader title="Log" />
        <div style={{ padding: "20px" }}>
            {store.log.map(item => (
                <Card key={item.id} style={{ padding: "12px", marginBottom: "8px" }}>
                    {item.name} - {item.kcal}kcal
                </Card>
            ))}
        </div>
    </PageShell>
);

const ProgressPage = ({ store }) => (
    <PageShell>
        <BackHeader title="Progress" />
        <div style={{ padding: "20px" }}>
            <Card style={{ padding: "20px" }}>
                <p>Latest Weight: {store.weights[store.weights.length - 1]?.weight || 80}kg</p>
            </Card>
        </div>
    </PageShell>
);

function Nav() {
    const nav = useNavigate();
    const loc = useLocation();
    return (
        <nav style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "white", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <button onClick={() => nav("/")} style={{ color: loc.pathname === "/" ? C.accent : C.textDim, border: "none", background: "none" }}><Home /></button>
            <button onClick={() => nav("/log-meal")} style={{ color: loc.pathname === "/log-meal" ? C.accent : C.textDim, border: "none", background: "none" }}><Plus /></button>
            <button onClick={() => nav("/progress")} style={{ color: loc.pathname === "/progress" ? C.accent : C.textDim, border: "none", background: "none" }}><TrendingUp /></button>
        </nav>
    );
}

export default function App() {
    const store = useStore();
    if (!store.loaded) return <div>Loading...</div>;
    return (
        <BrowserRouter>
            <div style={{ height: "100vh", background: C.bg, display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", maxWidth: 430, position: "relative", background: "white", overflow: "hidden" }}>
                    <Routes>
                        <Route path="/" element={<HomePage store={store} />} />
                        <Route path="/log-meal" element={<LogPage store={store} />} />
                        <Route path="/progress" element={<ProgressPage store={store} />} />
                    </Routes>
                    <Nav />
                </div>
            </div>
        </BrowserRouter>
    );
}
