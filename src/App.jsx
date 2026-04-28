import { useState, useEffect, useRef } from “react”;
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from “react-router”;
import { Home, Plus, TrendingUp, Camera, X, Mic, Search, Sparkles, Trash2, ArrowUpRight, Copy, Check, ChevronLeft, Dumbbell, Scale, AlertCircle } from “lucide-react”;

const C={bg:”#EDECEA”,card:”#FFFFFF”,accent:”#8576A6”,accentSoft:”#F0EBF8”,accentTrack:”#E4DFED”,text:”#1C1B1F”,textMid:”#6B6970”,textDim:”#9B9BA0”,textFaint:”#C4C2C8”,border:“rgba(0,0,0,0.055)”,danger:”#C0544A”,success:”#4A8C6A”,shadow:“0 2px 10px rgba(0,0,0,0.055)”};
const F={body:”‘Inter’,system-ui,-apple-system,sans-serif”};
const R={card:18,btn:12,pill:100};
const PROFILE={weight:80,targetWeight:90,targets:{kcal:3300,protein:180,carbs:430,fat:90}};
const DEFAULT_ITEMS=[{id:“bs”,name:“Breakfast Shake”,kcal:475,protein:45,carbs:56,fat:8.5},{id:“bsm”,name:“Breakfast Shake (modified)”,kcal:610,protein:59,carbs:71,fat:11},{id:“pl”,name:“Pasta Lunch”,kcal:620,protein:36,carbs:98,fat:9}];

const FOOD_PROMPT=(items)=>`Vegetarian nutrition database. User: 80kg powerlifter, 3300kcal/180p/430c/90f targets. Saved items (use exact values if matched): ${items.map(i=>`${i.name.toLowerCase()}: ${i.kcal}kcal/${i.protein}p/${i.carbs}c/${i.fat}f`).join("; ")} For branded Australian products use label data. Estimate generously. Vegetarian only. Return ONLY valid JSON: {"name":"string","kcal":number,"protein":number,"carbs":number,"fat":number,"note":"max 10 words"}`;
const SUGGEST_PROMPT=`Direct vegetarian nutrition coach. Given remaining macros suggest 2-3 specific foods with quantities. Each line: • Food (Xg) — Ykcal, Zg protein. Max 4 lines. No intro. Plain text.`;
const COACH_PROMPT=`Direct strength coach. User: 80kg vegetarian powerlifter, 3300kcal/180p/430c/90f daily targets, goal 90kg. Write 4 lines: (1) how day went with numbers (2-3) biggest gap/win + specific action (4) tomorrow's focus. Plain text.`;
const PRODUCT_PROMPT=`Australian nutrition database. Find nutritional info per standard serving for the named product. Use accurate label data for branded products. Vegetarian only. Return ONLY valid JSON: {"name":"brand + product name","kcal":number,"protein":number,"carbs":number,"fat":number,"serving":"description","note":"brief"}`;
const RECIPE_PROMPT=`Vegetarian nutrition calculator. Calculate total macros for a recipe. Return ONLY valid JSON: {"ingredients":[{"name":"string","kcal":number,"protein":number,"carbs":number,"fat":number}],"total":{"kcal":number,"protein":number,"carbs":number,"fat":number},"notes":"one nutritional note"}`;
const PHYSIQUE_PROMPT=`Strength coach reviewing a progress photo. Subject: 32yo male vegetarian powerlifter, 80kg, 6'0", targeting 90kg. Be honest, direct, no flattery. Write 4 short paragraphs (max 100 words total): 1. Visible muscle development 2. Body composition 3. Structural note 4. Training priority. Coach tone. Plain text.`;

const todayStr=()=>new Date().toISOString().slice(0,10);
const fmtDate=(d)=>new Date(d+“T00:00”).toLocaleDateString(“en-AU”,{month:“short”,day:“numeric”});
const fmtFull=()=>new Date().toLocaleDateString(“en-AU”,{weekday:“long”,month:“long”,day:“numeric”});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const lsGet=(k,fb=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};

const callClaude=async(system,userContent,maxTokens=400)=>{
const body={model:“claude-sonnet-4-20250514”,max_tokens:maxTokens,system,messages:[{role:“user”,content:Array.isArray(userContent)?userContent:[{type:“text”,text:userContent}]}]};
let res;
try{res=await fetch(”/api/claude”,{method:“POST”,headers:{“Content-Type”:“application/json”},body:JSON.stringify(body)});if(!res.ok)throw new Error();}
catch{res=await fetch(“https://api.anthropic.com/v1/messages”,{method:“POST”,headers:{“Content-Type”:“application/json”},body:JSON.stringify(body)});}
if(!res.ok)throw new Error(`API ${res.status}`);
const data=await res.json();
if(!data.content?.[0]?.text)throw new Error(“Empty response”);
return data.content[0].text.trim();
};
const parseJSON=(t)=>{const c=t.replace(/`json|`/g,””).trim();const m=c.match(/{[\s\S]*}/);if(!m)throw new Error(“No JSON”);return JSON.parse(m[0]);};

const useStore=()=>{
const[log,setLog]=useState([]);const[weights,setWeights]=useState([]);const[lifts,setLifts]=useState([]);
const[history,setHistory]=useState({});const[items,setItems]=useState(DEFAULT_ITEMS);const[loaded,setLoaded]=useState(false);
useEffect(()=>{
const tk=`day:${todayStr()}`;const hist={};
for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(“day:”)&&k!==tk){const v=lsGet(k);if(v)hist[k.replace(“day:”,””)]=v;}}
setLog(lsGet(tk,[]));setWeights(lsGet(“weights”,[]));setLifts(lsGet(“lifts”,[]));
setHistory(hist);setItems(lsGet(“custom-items”,DEFAULT_ITEMS));setLoaded(true);
},[]);
useEffect(()=>{if(loaded)lsSet(`day:${todayStr()}`,log);},[log,loaded]);
const totals=log.reduce((a,i)=>({kcal:a.kcal+i.kcal,protein:a.protein+i.protein,carbs:a.carbs+i.carbs,fat:a.fat+i.fat}),{kcal:0,protein:0,carbs:0,fat:0});
const remaining={kcal:PROFILE.targets.kcal-totals.kcal,protein:PROFILE.targets.protein-totals.protein,carbs:PROFILE.targets.carbs-totals.carbs,fat:PROFILE.targets.fat-totals.fat};
const addItem=(item)=>setLog(p=>[…p,{…item,id:uid()}]);
const removeItem=(id)=>setLog(p=>p.filter(i=>i.id!==id));
const closeDay=()=>{if(!log.length)return;const dk=todayStr();setHistory(p=>({…p,[dk]:{log,totals,date:dk}}));lsSet(`day:${dk}`,{log,totals,date:dk,closed:true});setLog([]);};
const addWeight=(v)=>{const w=parseFloat(v);if(isNaN(w))return;const next=[…weights.filter(x=>x.date!==todayStr()),{date:todayStr(),weight:w}].sort((a,b)=>a.date.localeCompare(b.date));setWeights(next);lsSet(“weights”,next);};
const addLift=(l,w,r)=>{const wn=parseFloat(w),rn=parseInt(r);if(isNaN(wn)||isNaN(rn))return;const next=[…lifts,{date:todayStr(),lift:l,weight:wn,reps:rn,id:uid()}];setLifts(next);lsSet(“lifts”,next);};
const saveItems=(x)=>{setItems(x);lsSet(“custom-items”,x);};
const score=Math.round((Math.min(totals.kcal/PROFILE.targets.kcal,1)*35)+(Math.min(totals.protein/PROFILE.targets.protein,1)*35)+(Object.keys(history).length>0?Math.min(Object.keys(history).length/7,1)*20:0)+(weights.length>=2&&weights[weights.length-1].weight>weights[0].weight?10:0));
return{log,weights,lifts,history,items,loaded,totals,remaining,score,addItem,removeItem,closeDay,addWeight,addLift,saveItems};
};

const Card=({children,style={},onClick})=>(<div onClick={onClick} style={{background:C.card,borderRadius:R.card,boxShadow:C.shadow,border:`1px solid ${C.border}`,overflow:“hidden”,…style,…(onClick?{cursor:“pointer”}:{})}}>{children}</div>);

const MiniRing=({pct,size=44,stroke=3.5})=>{
const r=(size-stroke)/2,c=2*Math.PI*r,off=c-(Math.min(pct,100)/100)*c;
return(<div style={{position:“relative”,width:size,height:size,flexShrink:0}}><svg width={size} height={size} style={{transform:“rotate(-90deg)”}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.accentTrack} strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct>100?C.danger:C.accent} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} strokeLinecap=“round” style={{transition:“stroke-dashoffset 0.5s ease”}}/></svg><div style={{position:“absolute”,inset:0,display:“flex”,alignItems:“center”,justifyContent:“center”,fontFamily:F.body,fontSize:10,fontWeight:600,color:C.text}}>{Math.round(Math.min(pct,100))}%</div></div>);
};

const HBar=({pct})=>(<div style={{height:8,background:C.accentTrack,borderRadius:4,overflow:“hidden”,marginTop:6}}><div style={{height:“100%”,width:`${Math.min(pct,100)}%`,background:C.accent,borderRadius:4,transition:“width 0.5s ease”}}/></div>);
const PageShell=({children})=>(<div style={{height:“100%”,overflowY:“auto”,paddingBottom:90,background:C.bg}}>{children}</div>);
const BackHeader=({title,right})=>{const nav=useNavigate();return(<div style={{display:“flex”,alignItems:“center”,justifyContent:“space-between”,padding:“20px 20px 4px”}}><div style={{display:“flex”,alignItems:“center”,gap:4}}><button onClick={()=>nav(”/”)} style={{background:“none”,border:“none”,cursor:“pointer”,padding:“4px 4px 4px 0”,display:“flex”,alignItems:“center”}}><ChevronLeft size={22} color={C.text} strokeWidth={2}/></button><span style={{fontFamily:F.body,fontSize:22,fontWeight:600,color:C.text}}>{title}</span></div>{right}</div>);};

const AddSheet=({store,onClose})=>{
const[mode,setMode]=useState(“text”);const[input,setInput]=useState(””);const[loading,setLoading]=useState(false);
const[result,setResult]=useState(null);const[error,setError]=useState(””);const[note,setNote]=useState(””);const[listening,setListening]=useState(false);
const inputRef=useRef(null);const fileRef=useRef(null);
useEffect(()=>{setTimeout(()=>inputRef.current?.focus(),150);},[]);
const doLog=async(text,img=null)=>{
if(!text.trim()&&!img)return;
const match=store.items.find(i=>i.name.toLowerCase().includes(text.toLowerCase())||text.toLowerCase().includes(i.name.toLowerCase().split(” “)[0]));
if(match&&!img){store.addItem(match);setNote(`✓ ${match.name} added`);setInput(””);setTimeout(onClose,700);return;}
setLoading(true);setError(””);setResult(null);
try{const uc=img?[{type:“image”,source:{type:“base64”,media_type:img.type,data:img.data}},{type:“text”,text:text||“Log this food”}]:text;
const raw=await callClaude(FOOD_PROMPT(store.items),uc,300);const p=parseJSON(raw);
store.addItem({name:p.name,kcal:Math.round(p.kcal),protein:+p.protein.toFixed(1),carbs:+p.carbs.toFixed(1),fat:+p.fat.toFixed(1)});
setNote(p.note||`✓ ${p.name} added`);setInput(””);setTimeout(onClose,700);
}catch(e){setError(e.message||“Couldn’t estimate — try again”);}
setLoading(false);
};
const doSearch=async()=>{
if(!input.trim())return;setLoading(true);setError(””);setResult(null);
try{const raw=await callClaude(PRODUCT_PROMPT,`Find: ${input}`,300);setResult(parseJSON(raw));}
catch{setError(“Product not found — try describing it instead”);}
setLoading(false);
};
const startVoice=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setError(“Voice not supported”);return;}const r=new SR();r.lang=“en-AU”;r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>{setListening(false);setError(“Couldn’t hear — try again”);};r.onresult=(e)=>{setInput(e.results[0][0].transcript);setListening(false);};r.start();};
const handleImg=(e)=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>doLog(input||“food in photo”,{type:file.type,data:reader.result.split(”,”)[1]});reader.readAsDataURL(file);};
return(
<div style={{position:“fixed”,inset:0,zIndex:200,background:“rgba(0,0,0,0.3)”,display:“flex”,alignItems:“flex-end”,justifyContent:“center”}} onClick={onClose}>
<div onClick={e=>e.stopPropagation()} style={{width:“100%”,maxWidth:430,background:C.card,borderRadius:“20px 20px 0 0”,paddingBottom:32,maxHeight:“88vh”,overflowY:“auto”}}>
<div style={{display:“flex”,justifyContent:“center”,padding:“12px 0 0”}}><div style={{width:36,height:4,borderRadius:2,background:C.accentTrack}}/></div>
<div style={{padding:“12px 20px 0”}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:16}}>
<span style={{fontFamily:F.body,fontSize:18,fontWeight:600,color:C.text}}>Log food</span>
<button onClick={onClose} style={{background:“none”,border:“none”,cursor:“pointer”,color:C.textDim}}><X size={20}/></button>
</div>
<div style={{display:“flex”,gap:4,background:C.bg,borderRadius:12,padding:3,marginBottom:16}}>
{[{id:“text”,label:“Type”},{id:“search”,label:“Search product”},{id:“photo”,label:“Photo”}].map(m=>(
<button key={m.id} onClick={()=>setMode(m.id)} style={{flex:1,padding:“7px 4px”,background:mode===m.id?C.card:“transparent”,borderRadius:9,border:“none”,cursor:“pointer”,fontFamily:F.body,fontSize:11,fontWeight:500,color:mode===m.id?C.text:C.textDim,transition:“all 0.15s”,boxShadow:mode===m.id?C.shadow:“none”}}>{m.label}</button>
))}
</div>
{mode===“photo”&&(<div><input ref={fileRef} type=“file” accept=“image/*” onChange={handleImg} style={{display:“none”}}/><button onClick={()=>fileRef.current?.click()} style={{width:“100%”,padding:28,background:C.bg,borderRadius:R.card,border:`1.5px dashed ${C.accentTrack}`,cursor:“pointer”,display:“flex”,flexDirection:“column”,alignItems:“center”,gap:8}}><Camera size={26} color={C.accent}/><span style={{fontFamily:F.body,fontSize:14,color:C.textMid}}>Take photo or choose from library</span></button></div>)}
{(mode===“text”||mode===“search”)&&(
<div style={{display:“flex”,gap:8,marginBottom:12}}>
<div style={{flex:1,display:“flex”,alignItems:“center”,gap:8,background:C.bg,borderRadius:R.btn,padding:“11px 14px”}}>
<Search size={15} color={C.textDim}/>
<input ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);setError(””);setResult(null);}} onKeyDown={e=>e.key===“Enter”&&(mode===“search”?doSearch():doLog(input))} placeholder={mode===“search”?“e.g. Coles protein bar”:“e.g. 3 eggs on toast”} style={{flex:1,background:“none”,border:“none”,outline:“none”,fontFamily:F.body,fontSize:14,color:C.text}}/>
{input&&<button onClick={()=>setInput(””)} style={{background:“none”,border:“none”,cursor:“pointer”,padding:0,color:C.textDim}}><X size={13}/></button>}
</div>
<button onClick={startVoice} style={{width:44,height:44,flexShrink:0,borderRadius:R.btn,background:listening?C.danger:C.accentSoft,border:“none”,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”}}><Mic size={18} color={listening?“white”:C.accent}/></button>
</div>
)}
{mode===“text”&&!result&&(<div style={{marginBottom:16}}><div style={{fontFamily:F.body,fontSize:11,fontWeight:500,color:C.textDim,marginBottom:8,textTransform:“uppercase”,letterSpacing:“0.04em”}}>My items</div><div style={{display:“flex”,flexWrap:“wrap”,gap:6}}>{store.items.map(item=>(<button key={item.id} onClick={()=>{store.addItem(item);setNote(`✓ ${item.name} added`);setTimeout(onClose,700);}} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:20,padding:“7px 14px”,fontFamily:F.body,fontSize:13,color:C.text,cursor:“pointer”}}>{item.name}</button>))}</div></div>)}
{result&&(<Card style={{padding:16,background:C.accentSoft,marginBottom:12,boxShadow:“none”,border:`1px solid ${C.accentTrack}`}}><div style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text,marginBottom:3}}>{result.name}</div>{result.serving&&<div style={{fontFamily:F.body,fontSize:12,color:C.textMid,marginBottom:8}}>Per {result.serving}</div>}<div style={{display:“flex”,gap:16,fontFamily:F.body,fontSize:13,marginBottom:14}}><span style={{fontWeight:600,color:C.text}}>{result.kcal} kcal</span><span style={{color:C.accent}}>{result.protein}g P</span><span style={{color:C.textMid}}>{result.carbs}g C · {result.fat}g F</span></div><button onClick={()=>{store.addItem({name:result.name,kcal:Math.round(result.kcal),protein:result.protein,carbs:result.carbs,fat:result.fat});onClose();}} style={{width:“100%”,padding:“11px”,background:C.accent,color:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:14,fontWeight:600,cursor:“pointer”}}>Add to log</button></Card>)}
{note&&<div style={{padding:“10px 14px”,background:”#EEF6F0”,borderRadius:R.btn,fontFamily:F.body,fontSize:13,color:C.success,marginBottom:12}}>{note}</div>}
{error&&<div style={{padding:“10px 14px”,background:”#FDF0EE”,borderRadius:R.btn,fontFamily:F.body,fontSize:13,color:C.danger,marginBottom:12,display:“flex”,gap:8,alignItems:“flex-start”}}><AlertCircle size={15} style={{flexShrink:0,marginTop:1}}/>{error}</div>}
{(mode===“text”||mode===“search”)&&input.trim()&&!result&&(<button onClick={()=>mode===“search”?doSearch():doLog(input)} disabled={loading} style={{width:“100%”,padding:“14px”,background:loading?C.bg:C.accent,color:loading?C.textDim:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:loading?“not-allowed”:“pointer”}}>{loading?“Finding macros…”:mode===“search”?“Search product”:“Add to log”}</button>)}
</div>
</div>
</div>
);
};

const RecipeBuilder=({store,onClose})=>{
const[name,setName]=useState(””);const[portions,setPorts]=useState(“4”);const[ings,setIngs]=useState([{id:uid(),qty:””,name:””}]);
const[loading,setLoading]=useState(false);const[result,setResult]=useState(null);const[error,setError]=useState(””);const[saved,setSaved]=useState(false);
const addIng=()=>setIngs(p=>[…p,{id:uid(),qty:””,name:””}]);
const removeIng=(id)=>setIngs(p=>p.filter(i=>i.id!==id));
const updateIng=(id,f,v)=>setIngs(p=>p.map(i=>i.id===id?{…i,[f]:v}:i));
const calculate=async()=>{
const valid=ings.filter(i=>i.name.trim()&&i.qty.trim());if(!valid.length){setError(“Add at least one ingredient”);return;}
setLoading(true);setError(””);setResult(null);
try{const raw=await callClaude(RECIPE_PROMPT,`Ingredients:\n${valid.map(i=>`- ${i.qty} ${i.name}`).join("\n")}\nPortions: ${portions}`,600);setResult({…parseJSON(raw),portions:parseInt(portions)||1});}
catch(e){setError(e.message||“Calculation failed”);}
setLoading(false);
};
const save=()=>{if(!result||!name.trim())return;const p=result.portions;store.saveItems([…store.items,{id:uid(),name:name.trim(),kcal:Math.round(result.total.kcal/p),protein:+(result.total.protein/p).toFixed(1),carbs:+(result.total.carbs/p).toFixed(1),fat:+(result.total.fat/p).toFixed(1)}]);setSaved(true);setTimeout(onClose,800);};
return(
<div style={{position:“fixed”,inset:0,zIndex:200,background:“rgba(0,0,0,0.3)”,display:“flex”,alignItems:“flex-end”,justifyContent:“center”}} onClick={onClose}>
<div onClick={e=>e.stopPropagation()} style={{width:“100%”,maxWidth:430,background:C.card,borderRadius:“20px 20px 0 0”,maxHeight:“90vh”,overflowY:“auto”,paddingBottom:32}}>
<div style={{display:“flex”,justifyContent:“center”,padding:“12px 0 0”}}><div style={{width:36,height:4,borderRadius:2,background:C.accentTrack}}/></div>
<div style={{padding:“12px 20px 0”}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:20}}>
<span style={{fontFamily:F.body,fontSize:18,fontWeight:600,color:C.text}}>Build recipe</span>
<button onClick={onClose} style={{background:“none”,border:“none”,cursor:“pointer”,color:C.textDim}}><X size={20}/></button>
</div>
{saved&&<div style={{padding:“12px 14px”,background:”#EEF6F0”,borderRadius:R.btn,fontFamily:F.body,fontSize:13,color:C.success,marginBottom:12}}>✓ Saved as “{name}”</div>}
<div style={{background:C.bg,borderRadius:R.card,padding:16,marginBottom:12}}>
<div style={{fontFamily:F.body,fontSize:11,fontWeight:500,color:C.textDim,marginBottom:6,textTransform:“uppercase”,letterSpacing:“0.04em”}}>Recipe name</div>
<input value={name} onChange={e=>setName(e.target.value)} placeholder=“e.g. Tofu & Rice Bowl” style={{width:“100%”,padding:“10px 12px”,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,fontFamily:F.body,fontSize:14,color:C.text,outline:“none”,boxSizing:“border-box”,marginBottom:14}}/>
<div style={{fontFamily:F.body,fontSize:11,fontWeight:500,color:C.textDim,marginBottom:8,textTransform:“uppercase”,letterSpacing:“0.04em”}}>Portions</div>
<div style={{display:“flex”,gap:6}}>{[“2”,“3”,“4”,“5”,“6”,“8”].map(n=>(<button key={n} onClick={()=>setPorts(n)} style={{flex:1,padding:“8px 0”,background:portions===n?C.accent:C.card,color:portions===n?“white”:C.textMid,border:`1px solid ${portions===n?C.accent:C.border}`,borderRadius:8,fontFamily:F.body,fontSize:13,fontWeight:portions===n?600:400,cursor:“pointer”,transition:“all 0.15s”}}>{n}</button>))}</div>
</div>
<div style={{background:C.bg,borderRadius:R.card,padding:16,marginBottom:12}}>
<div style={{fontFamily:F.body,fontSize:11,fontWeight:500,color:C.textDim,marginBottom:12,textTransform:“uppercase”,letterSpacing:“0.04em”}}>Ingredients</div>
{ings.map(ing=>(<div key={ing.id} style={{display:“flex”,gap:8,marginBottom:8,alignItems:“center”}}><input value={ing.qty} onChange={e=>updateIng(ing.id,“qty”,e.target.value)} placeholder=“1kg” style={{width:64,flexShrink:0,padding:“9px 10px”,background:C.card,border:`1px solid ${C.border}`,borderRadius:9,fontFamily:F.body,fontSize:13,color:C.text,outline:“none”}}/><input value={ing.name} onChange={e=>updateIng(ing.id,“name”,e.target.value)} placeholder=“ingredient” style={{flex:1,padding:“9px 10px”,background:C.card,border:`1px solid ${C.border}`,borderRadius:9,fontFamily:F.body,fontSize:13,color:C.text,outline:“none”}}/>{ings.length>1&&<button onClick={()=>removeIng(ing.id)} style={{background:“none”,border:“none”,cursor:“pointer”,color:C.textFaint,padding:4,flexShrink:0}}><X size={14}/></button>}</div>))}
<button onClick={addIng} style={{width:“100%”,padding:“9px”,background:“transparent”,border:`1.5px dashed ${C.accentTrack}`,borderRadius:9,fontFamily:F.body,fontSize:13,color:C.textMid,cursor:“pointer”,marginTop:4}}>+ Add ingredient</button>
</div>
{error&&<div style={{padding:“10px 14px”,background:”#FDF0EE”,borderRadius:R.btn,fontFamily:F.body,fontSize:13,color:C.danger,marginBottom:12,display:“flex”,gap:8}}><AlertCircle size={15} style={{flexShrink:0,marginTop:1}}/>{error}</div>}
{result&&(<Card style={{marginBottom:12,border:`1px solid ${C.accentTrack}`,boxShadow:“none”}}><div style={{padding:16}}><div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textMid,marginBottom:10,textTransform:“uppercase”,letterSpacing:“0.04em”}}>Calculated</div>{result.ingredients?.map((ing,i)=>(<div key={i} style={{display:“flex”,justifyContent:“space-between”,padding:“5px 0”,borderBottom:`1px solid ${C.border}`}}><span style={{fontFamily:F.body,fontSize:13,color:C.textMid}}>{ing.name}</span><span style={{fontFamily:F.body,fontSize:13,color:C.text,fontWeight:500}}>{Math.round(ing.kcal)} kcal</span></div>))}<div style={{marginTop:12,background:C.accentSoft,borderRadius:12,padding:“12px 14px”}}><div style={{fontFamily:F.body,fontSize:11,color:C.accent,fontWeight:600,marginBottom:6,textTransform:“uppercase”,letterSpacing:“0.04em”}}>Per portion (÷{result.portions})</div><div style={{display:“flex”,gap:16,fontFamily:F.body,fontSize:14}}><span style={{fontWeight:700,color:C.text}}>{Math.round(result.total.kcal/result.portions)} kcal</span><span style={{color:C.accent}}>{(result.total.protein/result.portions).toFixed(1)}p</span><span style={{color:C.textMid}}>{(result.total.carbs/result.portions).toFixed(1)}c · {(result.total.fat/result.portions).toFixed(1)}f</span></div></div>{result.notes&&<div style={{fontFamily:F.body,fontSize:12,color:C.textMid,marginTop:10,lineHeight:1.5}}>{result.notes}</div>}</div></Card>)}
{!result?(<button onClick={calculate} disabled={loading||!ings.some(i=>i.name&&i.qty)} style={{width:“100%”,padding:“14px”,background:loading?C.bg:C.accent,color:loading?C.textDim:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:loading?“not-allowed”:“pointer”}}>{loading?“Calculating…”:“Calculate macros”}</button>):(<div style={{display:“flex”,flexDirection:“column”,gap:8}}><button onClick={save} disabled={!name.trim()} style={{width:“100%”,padding:“14px”,background:name.trim()?C.accent:C.bg,color:name.trim()?“white”:C.textDim,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:name.trim()?“pointer”:“default”}}>Save as “{name||“recipe”}”</button><button onClick={()=>setResult(null)} style={{width:“100%”,padding:“11px”,background:“transparent”,border:“none”,fontFamily:F.body,fontSize:13,color:C.textDim,cursor:“pointer”}}>Edit ingredients</button></div>)}
</div>
</div>
</div>
);
};

const SyncModal=({store,onClose})=>{
const{log,totals,weights,lifts,history}=store;const[copied,setCopied]=useState(false);
const summary=(()=>{const date=new Date().toLocaleDateString(“en-AU”,{weekday:“short”,month:“short”,day:“numeric”});let s=`📋 LEDGER SYNC — ${date}\n\n── TODAY ──\n${Math.round(totals.kcal)}kcal · ${Math.round(totals.protein)}p · ${Math.round(totals.carbs)}c · ${Math.round(totals.fat)}f\n`;if(log.length){s+=`\nLog:\n`;log.forEach(i=>{s+=`• ${i.name}: ${i.kcal}kcal (${i.protein}p/${i.carbs}c/${i.fat}f)\n`;});}const rec=Object.entries(history).sort(([a],[b])=>b.localeCompare(a)).slice(0,7);if(rec.length){s+=`\n── LAST 7 DAYS ──\n`;rec.forEach(([d,day])=>{const t=day.totals||{};s+=`${fmtDate(d)}: ${Math.round(t.kcal||0)}kcal · ${Math.round(t.protein||0)}p\n`;});const avg=rec.reduce((a,[_,d])=>a+(d.totals?.kcal||0),0)/rec.length;s+=`Avg: ${Math.round(avg)} kcal/day\n`;}if(weights.length){s+=`\n── WEIGHT ──\n`;weights.slice(-5).forEach(w=>{s+=`${fmtDate(w.date)}: ${w.weight}kg\n`;});if(weights.length>=2){const ch=(weights[weights.length-1].weight-weights[0].weight).toFixed(1);s+=`Change: ${ch>=0?"+":""}${ch}kg\n`;}}if(lifts.length){s+=`\n── RECENT LIFTS ──\n`;lifts.slice(-5).forEach(l=>{s+=`${fmtDate(l.date)} ${l.lift}: ${l.weight}kg × ${l.reps}\n`;});}s+=`\n── MY QUESTION ──\n[type here]`;return s;})();
const copy=async()=>{try{await navigator.clipboard.writeText(summary);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{}};
return(<div style={{position:“fixed”,inset:0,zIndex:200,background:“rgba(0,0,0,0.3)”,display:“flex”,alignItems:“flex-end”,justifyContent:“center”}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{width:“100%”,maxWidth:430,background:C.card,borderRadius:“20px 20px 0 0”,maxHeight:“80vh”,display:“flex”,flexDirection:“column”}}><div style={{display:“flex”,justifyContent:“center”,padding:“12px 0 0”}}><div style={{width:36,height:4,borderRadius:2,background:C.accentTrack}}/></div><div style={{padding:“12px 20px 0”,flex:1,overflow:“hidden”,display:“flex”,flexDirection:“column”}}><div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:8}}><span style={{fontFamily:F.body,fontSize:18,fontWeight:600,color:C.text}}>Send to Coach</span><button onClick={onClose} style={{background:“none”,border:“none”,cursor:“pointer”,color:C.textDim}}><X size={20}/></button></div><p style={{fontFamily:F.body,fontSize:13,color:C.textMid,marginBottom:14,lineHeight:1.5}}>Copy → paste into your coach chat → ask your question.</p><div style={{flex:1,overflowY:“auto”,marginBottom:12}}><div style={{background:C.bg,borderRadius:R.card,padding:14}}><pre style={{fontFamily:”‘Courier New’,monospace”,fontSize:11,color:C.text,whiteSpace:“pre-wrap”,lineHeight:1.7,margin:0}}>{summary}</pre></div></div><button onClick={copy} style={{width:“100%”,padding:“14px”,marginBottom:24,background:copied?C.success:C.accent,color:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”,gap:8,transition:“background 0.2s”}}>{copied?<><Check size={16}/>Copied — paste in chat</>:<><Copy size={16}/>Copy summary</>}</button></div></div></div>);
};

const HomePage=({store})=>{
const navigate=useNavigate();const{log,totals,remaining,weights,history,score,items}=store;
const[showAdd,setShowAdd]=useState(false);const[showSync,setShowSync]=useState(false);const[dismissed,setDismissed]=useState([]);
const latestWeight=weights[weights.length-1]?.weight??PROFILE.weight;
const pcts={kcal:(totals.kcal/PROFILE.targets.kcal)*100,protein:(totals.protein/PROFILE.targets.protein)*100,carbs:(totals.carbs/PROFILE.targets.carbs)*100,fat:(totals.fat/PROFILE.targets.fat)*100};
const insights=[remaining.protein>30&&{id:“p”,icon:<Sparkles size={15} color={C.accent}/>,text:`You're ${Math.round(remaining.protein)}g under protein — easy fix: add a shake`},remaining.kcal>500&&{id:“k”,icon:<TrendingUp size={15} color={C.accent}/>,text:“Calories slightly low for your goal today”},totals.protein>PROFILE.targets.protein*0.95&&{id:“pg”,icon:<Check size={15} color={C.success}/>,text:“Protein target hit — great work”},remaining.kcal<0&&{id:“ko”,icon:<AlertCircle size={15} color={C.danger}/>,text:`Over calorie target by ${Math.round(Math.abs(remaining.kcal))} kcal`}].filter(Boolean).filter(i=>!dismissed.includes(i.id));
const macroRows=[{label:“Calories”,pct:pcts.kcal,cur:Math.round(totals.kcal),max:PROFILE.targets.kcal,unit:“kcal”,gap:Math.round(remaining.kcal)},{label:“Protein”,pct:pcts.protein,cur:Math.round(totals.protein),max:PROFILE.targets.protein,unit:“g”,gap:Math.round(remaining.protein)},{label:“Carbs”,pct:pcts.carbs,cur:Math.round(totals.carbs),max:PROFILE.targets.carbs,unit:“g”,gap:Math.round(remaining.carbs)},{label:“Fats”,pct:pcts.fat,cur:Math.round(totals.fat),max:PROFILE.targets.fat,unit:“g”,gap:Math.round(remaining.fat)}];
const bfItem=items.find(i=>i.name.toLowerCase().includes(“breakfast”)||i.name.toLowerCase().includes(“shake”))||items[0];
return(
<PageShell>
<div style={{padding:“32px 20px 0”,display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”}}>
<div><h1 style={{fontFamily:F.body,fontSize:34,fontWeight:700,color:C.text,margin:0,lineHeight:1.1}}>Today</h1><p style={{fontFamily:F.body,fontSize:14,color:C.textDim,margin:“4px 0 0”}}>{fmtFull()}</p></div>
<button onClick={()=>setShowSync(true)} style={{marginTop:6,display:“flex”,alignItems:“center”,gap:5,padding:“7px 14px”,background:C.card,border:`1px solid ${C.border}`,borderRadius:R.pill,cursor:“pointer”,boxShadow:C.shadow}}><ArrowUpRight size={13} color={C.accent} strokeWidth={2.5}/><span style={{fontFamily:F.body,fontSize:12,fontWeight:500,color:C.textMid}}>Coach</span></button>
</div>
<div style={{padding:“16px 20px 0”}}>
<Card style={{padding:20}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”}}>
<div><div style={{fontFamily:F.body,fontSize:13,color:C.textMid,marginBottom:4}}>Growth Score</div><div style={{fontFamily:F.body,fontSize:48,fontWeight:700,color:C.text,lineHeight:1}}>{score}</div><div style={{fontFamily:F.body,fontSize:12,color:C.textDim,marginTop:4}}>Based on adherence and consistency</div></div>
<div style={{width:72,height:72,borderRadius:“50%”,border:`2.5px solid ${C.accentTrack}`,display:“flex”,alignItems:“center”,justifyContent:“center”,background:C.bg}}><TrendingUp size={24} color={score>60?C.accent:C.textDim} strokeWidth={1.5}/></div>
</div>
</Card>
</div>
{insights.length>0&&(<div style={{padding:“12px 20px 0”,display:“flex”,flexDirection:“column”,gap:8}}>{insights.map(ins=>(<Card key={ins.id} style={{padding:“13px 16px”}}><div style={{display:“flex”,alignItems:“flex-start”,gap:10}}><div style={{width:28,height:28,borderRadius:“50%”,background:C.accentSoft,display:“flex”,alignItems:“center”,justifyContent:“center”,flexShrink:0}}>{ins.icon}</div><span style={{flex:1,fontFamily:F.body,fontSize:14,color:C.text,lineHeight:1.4}}>{ins.text}</span><button onClick={()=>setDismissed(p=>[…p,ins.id])} style={{background:“none”,border:“none”,cursor:“pointer”,color:C.textFaint,flexShrink:0,padding:2}}><X size={16}/></button></div></Card>))}</div>)}
<div style={{padding:“12px 20px 0”}}>
<Card style={{padding:20}}>
<div style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text,marginBottom:16}}>Today’s Targets</div>
<div style={{display:“flex”,flexDirection:“column”,gap:14}}>{macroRows.map(row=>(<div key={row.label} style={{display:“flex”,alignItems:“center”,gap:14}}><MiniRing pct={row.pct}/><div style={{flex:1,minWidth:0}}><div style={{fontFamily:F.body,fontSize:15,fontWeight:500,color:C.text}}>{row.label}</div><div style={{fontFamily:F.body,fontSize:12,color:C.textDim,marginTop:1}}>{row.gap>0?`+${row.gap}${row.unit} to hit target`:row.gap<0?`${Math.abs(row.gap)}${row.unit} over`:“Target hit ✓”}</div></div><div style={{fontFamily:F.body,fontSize:13,color:C.textMid,flexShrink:0,textAlign:“right”}}>{row.cur} / {row.max} {row.unit}</div></div>))}</div>
</Card>
</div>
{bfItem&&!log.some(l=>l.name===bfItem.name)&&(<div style={{padding:“12px 20px 0”}}><Card style={{padding:20}}><div style={{display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”,marginBottom:14}}><span style={{fontFamily:F.body,fontSize:15,fontWeight:500,color:C.text}}>Add your usual breakfast?</span><Sparkles size={16} color={C.accent}/></div><button onClick={()=>store.addItem(bfItem)} style={{width:“100%”,padding:“13px”,background:C.accent,color:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:“pointer”}}>Quick Add</button></Card></div>)}
<div style={{padding:“12px 20px 0”}}>
<div style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text,marginBottom:12}}>Quick Actions</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:10}}>
<Card style={{padding:20,cursor:“pointer”}} onClick={()=>setShowAdd(true)}><Camera size={24} color={C.textMid} strokeWidth={1.5} style={{marginBottom:10}}/><div style={{fontFamily:F.body,fontSize:14,fontWeight:500,color:C.text}}>Scan Meal</div></Card>
<Card style={{padding:20,cursor:“pointer”}} onClick={()=>setShowAdd(true)}><Mic size={24} color={C.textMid} strokeWidth={1.5} style={{marginBottom:10}}/><div style={{fontFamily:F.body,fontSize:14,fontWeight:500,color:C.text}}>Voice Input</div></Card>
</div>
</div>
{showAdd&&<AddSheet store={store} onClose={()=>setShowAdd(false)}/>}
{showSync&&<SyncModal store={store} onClose={()=>setShowSync(false)}/>}
</PageShell>
);
};

const LogPage=({store})=>{
const{log,totals,items,addItem,removeItem,closeDay,saveItems,remaining}=store;
const[showAdd,setShowAdd]=useState(false);const[showRecipe,setShowRecipe]=useState(false);
const[suggestion,setSuggestion]=useState(””);const[coachReport,setCoachReport]=useState(””);
const[loadS,setLoadS]=useState(false);const[loadC,setLoadC]=useState(false);
const[view,setView]=useState(“log”);const[editMode,setEditMode]=useState(false);
const[addingItem,setAddingItem]=useState(false);const[newItem,setNewItem]=useState({name:””,kcal:””,protein:””,carbs:””,fat:””});
const doSuggest=async()=>{setLoadS(true);setSuggestion(””);setCoachReport(””);try{const t=await callClaude(SUGGEST_PROMPT,`Remaining: ${Math.round(remaining.kcal)}kcal, ${Math.round(remaining.protein)}g protein, ${Math.round(remaining.carbs)}g carbs. Suggest next foods.`,300);setSuggestion(t);}catch(e){setSuggestion(`Error: ${e.message}`);}setLoadS(false);};
const doCoach=async()=>{if(!log.length)return;setLoadC(true);setCoachReport(””);setSuggestion(””);try{const logText=log.map(i=>`${i.name}: ${i.kcal}kcal (${i.protein}p/${i.carbs}c/${i.fat}f)`).join(”\n”);const t=await callClaude(COACH_PROMPT,`TOTALS: ${Math.round(totals.kcal)}kcal · ${Math.round(totals.protein)}p · ${Math.round(totals.carbs)}c · ${Math.round(totals.fat)}f\nGAPS: ${Math.round(remaining.kcal)}kcal · ${Math.round(remaining.protein)}p\n\nLOG:\n${logText}`,500);setCoachReport(t);}catch(e){setCoachReport(`Error: ${e.message}`);}setLoadC(false);};
const addCustomItem=()=>{if(!newItem.name||!newItem.kcal)return;saveItems([…items,{id:uid(),name:newItem.name,kcal:Math.round(+newItem.kcal),protein:+parseFloat(newItem.protein||0).toFixed(1),carbs:+parseFloat(newItem.carbs||0).toFixed(1),fat:+parseFloat(newItem.fat||0).toFixed(1)}]);setNewItem({name:””,kcal:””,protein:””,carbs:””,fat:””});setAddingItem(false);};
const suggested=items[0];
return(
<PageShell>
<BackHeader title=“Log Meal” right={<button onClick={()=>setShowAdd(true)} style={{width:34,height:34,borderRadius:“50%”,background:C.accent,border:“none”,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”}}><Plus size={18} color="white" strokeWidth={2.5}/></button>}/>
<div style={{padding:“12px 20px 16px”}}><div style={{display:“flex”,gap:4,background:C.bg,borderRadius:12,padding:3}}>{[{id:“log”,label:“Today”},{id:“items”,label:“My Items”}].map(t=>(<button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,padding:“8px”,background:view===t.id?C.card:“transparent”,borderRadius:9,border:“none”,cursor:“pointer”,fontFamily:F.body,fontSize:13,fontWeight:view===t.id?600:400,color:view===t.id?C.text:C.textDim,transition:“all 0.15s”,boxShadow:view===t.id?C.shadow:“none”}}>{t.label}</button>))}</div></div>
{view===“log”&&(<div style={{padding:“0 20px”}}>
{suggested&&(<div style={{marginBottom:20}}><div style={{display:“flex”,alignItems:“center”,gap:6,marginBottom:10}}><Sparkles size={15} color={C.accent}/><span style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text}}>Suggested for Now</span></div><Card style={{padding:16,cursor:“pointer”,border:`1px solid ${C.accentTrack}`}} onClick={()=>addItem(suggested)}><div style={{display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”}}><div><div style={{fontFamily:F.body,fontSize:15,fontWeight:500,color:C.text,marginBottom:4}}>{suggested.name}</div><div style={{fontFamily:F.body,fontSize:13,color:C.textDim,display:“flex”,gap:8}}><span>{suggested.kcal} kcal</span><span>·</span><span>{suggested.protein}g protein</span></div></div><div style={{width:28,height:28,borderRadius:“50%”,background:C.accentSoft,display:“flex”,alignItems:“center”,justifyContent:“center”}}><Plus size={14} color={C.accent} strokeWidth={2.5}/></div></div></Card></div>)}
{log.length>0&&(<div style={{marginBottom:20}}><div style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text,marginBottom:12}}>Recent</div><div style={{display:“flex”,flexDirection:“column”,gap:8}}>{[…log].reverse().map(item=>(<Card key={item.id} style={{padding:“14px 16px”}}><div style={{display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”}}><div style={{flex:1,minWidth:0}}><div style={{fontFamily:F.body,fontSize:15,fontWeight:500,color:C.text,marginBottom:3,overflow:“hidden”,textOverflow:“ellipsis”,whiteSpace:“nowrap”}}>{item.name}</div><div style={{fontFamily:F.body,fontSize:13,color:C.textDim,display:“flex”,gap:8}}><span>{item.kcal} kcal</span><span>·</span><span>{item.protein}g protein</span></div></div><button onClick={()=>removeItem(item.id)} style={{background:“none”,border:“none”,cursor:“pointer”,color:C.textFaint,padding:“2px 0 0 12px”,flexShrink:0}}><Trash2 size={15} strokeWidth={1.5}/></button></div></Card>))}</div></div>)}
{log.length===0&&(<Card style={{padding:40,textAlign:“center”,marginBottom:20}}><div style={{fontFamily:F.body,fontSize:15,color:C.textDim,marginBottom:12}}>Nothing logged yet today</div><button onClick={()=>setShowAdd(true)} style={{display:“inline-flex”,alignItems:“center”,gap:6,padding:“10px 20px”,background:C.accent,color:“white”,border:“none”,borderRadius:R.pill,fontFamily:F.body,fontSize:14,fontWeight:600,cursor:“pointer”}}><Plus size={14}/>Log food</button></Card>)}
{log.length>0&&(<div style={{display:“flex”,flexDirection:“column”,gap:8,marginBottom:16}}><button onClick={doSuggest} disabled={loadS} style={{width:“100%”,padding:“13px”,background:C.accent,color:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”,gap:8,opacity:loadS?0.7:1}}><Sparkles size={16}/>{loadS?“Thinking…”:“What to eat next”}</button><button onClick={doCoach} disabled={loadC} style={{width:“100%”,padding:“13px”,background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:“pointer”,opacity:loadC?0.7:1,boxShadow:C.shadow}}>{loadC?“Analysing…”:“Daily Report”}</button><button onClick={closeDay} style={{width:“100%”,padding:“11px”,background:“transparent”,border:“none”,fontFamily:F.body,fontSize:13,color:C.textDim,cursor:“pointer”}}>Close day</button></div>)}
{suggestion&&(<Card style={{padding:16,background:C.accentSoft,boxShadow:“none”,border:`1px solid ${C.accentTrack}`,marginBottom:12}}><div style={{display:“flex”,alignItems:“center”,gap:6,marginBottom:8}}><Sparkles size={13} color={C.accent}/><span style={{fontFamily:F.body,fontSize:12,fontWeight:600,color:C.accent,textTransform:“uppercase”,letterSpacing:“0.04em”}}>Eat next</span></div><div style={{fontFamily:F.body,fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:“pre-wrap”}}>{suggestion}</div></Card>)}
{coachReport&&(<Card style={{padding:16,background:C.bg,boxShadow:“none”,border:`1px solid ${C.border}`,marginBottom:12}}><div style={{fontFamily:F.body,fontSize:12,fontWeight:600,color:C.accent,textTransform:“uppercase”,letterSpacing:“0.04em”,marginBottom:8}}>Coach Report</div><div style={{fontFamily:F.body,fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:“pre-wrap”}}>{coachReport}</div></Card>)}
</div>)}
{view===“items”&&(<div style={{padding:“0 20px”}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:12}}><span style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text}}>Most Frequent</span><button onClick={()=>setEditMode(!editMode)} style={{background:“none”,border:“none”,fontFamily:F.body,fontSize:13,color:editMode?C.danger:C.accent,cursor:“pointer”,fontWeight:500}}>{editMode?“Done”:“Edit”}</button></div>
<div style={{display:“flex”,flexDirection:“column”,gap:8,marginBottom:16}}>{items.map(item=>(<Card key={item.id} style={{padding:“14px 16px”}}><div style={{display:“flex”,alignItems:“center”,gap:12}}><div style={{flex:1,minWidth:0}}><div style={{fontFamily:F.body,fontSize:15,fontWeight:500,color:C.text,marginBottom:3}}>{item.name}</div><div style={{fontFamily:F.body,fontSize:13,color:C.textDim,display:“flex”,gap:8}}><span>{item.kcal} kcal</span><span>·</span><span>{item.protein}g protein</span></div></div>{editMode?(<button onClick={()=>saveItems(items.filter(i=>i.id!==item.id))} style={{background:”#FDF0EE”,border:“none”,borderRadius:8,padding:“6px 8px”,cursor:“pointer”,color:C.danger}}><Trash2 size={14} strokeWidth={1.5}/></button>):(<button onClick={()=>addItem(item)} style={{width:30,height:30,borderRadius:“50%”,background:C.accentSoft,border:“none”,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”,flexShrink:0}}><Plus size={15} color={C.accent} strokeWidth={2.5}/></button>)}</div></Card>))}</div>
{!addingItem&&(<div style={{display:“flex”,flexDirection:“column”,gap:8}}><button onClick={()=>setShowRecipe(true)} style={{width:“100%”,padding:“13px”,background:C.accent,color:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”,gap:8}}><Sparkles size={16}/>Build recipe with AI</button><button onClick={()=>setAddingItem(true)} style={{width:“100%”,padding:“13px”,background:C.card,color:C.text,border:`1.5px dashed ${C.border}`,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:500,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”,gap:8,boxShadow:C.shadow}}><Plus size={16}/>Add custom meal</button></div>)}
{addingItem&&(<Card style={{padding:16}}><div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textMid,marginBottom:12,textTransform:“uppercase”,letterSpacing:“0.04em”}}>New item</div>{[{k:“name”,p:“Name”,t:“text”},{k:“kcal”,p:“Calories”},{k:“protein”,p:“Protein (g)”},{k:“carbs”,p:“Carbs (g)”},{k:“fat”,p:“Fat (g)”}].map(f=>(<input key={f.k} type={f.t||“number”} value={newItem[f.k]} onChange={e=>setNewItem(p=>({…p,[f.k]:e.target.value}))} placeholder={f.p} style={{width:“100%”,padding:“10px 12px”,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,fontFamily:F.body,fontSize:14,color:C.text,outline:“none”,marginBottom:8,boxSizing:“border-box”}}/>))}<div style={{display:“flex”,gap:8,marginTop:4}}><button onClick={()=>setAddingItem(false)} style={{flex:1,padding:“11px”,background:C.bg,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:14,color:C.textMid,cursor:“pointer”}}>Cancel</button><button onClick={addCustomItem} disabled={!newItem.name||!newItem.kcal} style={{flex:2,padding:“11px”,background:newItem.name&&newItem.kcal?C.accent:C.bg,color:newItem.name&&newItem.kcal?“white”:C.textDim,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:14,fontWeight:600,cursor:“pointer”}}>Save item</button></div></Card>)}
</div>)}
{showAdd&&<AddSheet store={store} onClose={()=>setShowAdd(false)}/>}
{showRecipe&&<RecipeBuilder store={store} onClose={()=>setShowRecipe(false)}/>}
</PageShell>
);
};

const ProgressPage=({store})=>{
const{weights,lifts,history,totals,log,addWeight,addLift}=store;
const[section,setSection]=useState(“weekly”);const[wInput,setWInput]=useState(””);
const[liftName,setLiftName]=useState(“Squat”);const[liftKg,setLiftKg]=useState(””);const[liftReps,setLiftReps]=useState(””);
const[preview,setPreview]=useState(null);const[imgData,setImgData]=useState(null);const[analysis,setAnalysis]=useState(””);
const[physLoading,setPhysLoading]=useState(false);const[physError,setPhysError]=useState(””);const[pastReads,setPastReads]=useState([]);
const fileRef=useRef(null);
useEffect(()=>{setPastReads(lsGet(“physique-history”,[]));},[] );
const latestWeight=weights[weights.length-1]?.weight??PROFILE.weight;
const weightChange=weights.length>=2?(weights[weights.length-1].weight-weights[0].weight).toFixed(1):“0.0”;
const allLifts=[“Squat”,“Bench”,“Deadlift”,“OHP”];
const e1rm=(w,r)=>Math.round(w*(1+r/30));
const bestLift=(name)=>{const f=lifts.filter(l=>l.lift===name);return f.length?f.reduce((b,c)=>e1rm(c.weight,c.reps)>e1rm(b.weight,b.reps)?c:b):null;};
const liftHist=lifts.filter(l=>l.lift===liftName).slice(-10).reverse();
const recentDays=Object.entries(history).sort(([a],[b])=>b.localeCompare(a)).slice(0,7);
const avgCalPct=recentDays.length?Math.round(recentDays.reduce((a,[*,d])=>a+((d.totals?.kcal||0)/PROFILE.targets.kcal)*100,0)/recentDays.length):0;
const avgProtPct=recentDays.length?Math.round(recentDays.reduce((a,[*,d])=>a+((d.totals?.protein||0)/PROFILE.targets.protein)*100,0)/recentDays.length):0;
const calHitDays=recentDays.filter(([_,d])=>(d.totals?.kcal||0)>=PROFILE.targets.kcal*0.85).length;
const avgKcal=recentDays.length?Math.round(recentDays.reduce((a,[_,d])=>a+(d.totals?.kcal||0),0)/recentDays.length):0;
const wMin=weights.length?Math.min(…weights.map(x=>x.weight))-0.5:79;const wMax=weights.length?Math.max(…weights.map(x=>x.weight))+0.5:91;const range=Math.max(wMax-wMin,1);
const sortedHist=Object.entries(history).sort(([a],[b])=>b.localeCompare(a));if(log.length>0)sortedHist.unshift([todayStr(),{totals,log,date:todayStr()}]);
const handleImg=(e)=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{setPreview(reader.result);setImgData({type:file.type,data:reader.result.split(”,”)[1]});setAnalysis(””);setPhysError(””);};reader.readAsDataURL(file);};
const analysePhysique=async()=>{if(!imgData||physLoading)return;setPhysLoading(true);setPhysError(””);try{const uc=[{type:“image”,source:{type:“base64”,media_type:imgData.type,data:imgData.data}},{type:“text”,text:`Weight: ${latestWeight}kg. Target: ${PROFILE.targetWeight}kg. Analyse this physique photo.`}];const t=await callClaude(PHYSIQUE_PROMPT,uc,500);setAnalysis(t);const entry={id:uid(),date:todayStr(),weight:latestWeight,analysis:t};const updated=[entry,…pastReads].slice(0,12);setPastReads(updated);lsSet(“physique-history”,updated);}catch(e){setPhysError(e.message||“Analysis failed”);}setPhysLoading(false);};
const tabs=[{id:“weekly”,label:“Weekly”},{id:“physique”,label:“Physique”},{id:“lifts”,label:“Lifts”},{id:“history”,label:“Days”}];
return(
<PageShell>
<BackHeader title="Weekly Summary"/>
<div style={{padding:“12px 20px 16px”}}><div style={{display:“flex”,gap:4,background:C.bg,borderRadius:12,padding:3}}>{tabs.map(t=>(<button key={t.id} onClick={()=>setSection(t.id)} style={{flex:1,padding:“7px 4px”,background:section===t.id?C.card:“transparent”,borderRadius:9,border:“none”,cursor:“pointer”,fontFamily:F.body,fontSize:12,fontWeight:section===t.id?600:400,color:section===t.id?C.text:C.textDim,transition:“all 0.15s”,boxShadow:section===t.id?C.shadow:“none”}}>{t.label}</button>))}</div></div>
{section===“weekly”&&(<div style={{padding:“0 20px”,display:“flex”,flexDirection:“column”,gap:12}}>
<Card style={{padding:20}}><div style={{fontFamily:F.body,fontSize:12,color:C.textDim,marginBottom:16}}>{recentDays.length>0?`${fmtDate(recentDays[recentDays.length-1][0])} – ${fmtDate(recentDays[0][0])}`:“No data yet”}</div><div style={{marginBottom:16}}><div style={{display:“flex”,justifyContent:“space-between”,fontFamily:F.body,fontSize:14,color:C.text,marginBottom:4}}><span>Calorie Target</span><span style={{color:C.textDim}}>{avgCalPct}%</span></div><HBar pct={avgCalPct}/></div><div style={{marginBottom:16}}><div style={{display:“flex”,justifyContent:“space-between”,fontFamily:F.body,fontSize:14,color:C.text,marginBottom:4}}><span>Protein Target</span><span style={{color:C.textDim}}>{avgProtPct}%</span></div><HBar pct={avgProtPct}/></div><div style={{background:C.bg,borderRadius:12,padding:“12px 16px”,fontFamily:F.body,fontSize:14,color:C.text}}>{calHitDays} out of {Math.min(recentDays.length,7)} days on track</div></Card>
{recentDays.length>0&&(<><Card style={{padding:20}}><div style={{display:“flex”,alignItems:“center”,gap:8,marginBottom:14}}><div style={{width:24,height:24,borderRadius:“50%”,background:C.accentSoft,display:“flex”,alignItems:“center”,justifyContent:“center”}}><Scale size={13} color={C.accent}/></div><span style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text}}>Insights</span></div>{[avgProtPct>=90?“Protein consistency strong — on target”:“Protein consistency needs improvement”,avgCalPct>=90?“Calorie surplus sustained — aligned with muscle gain”:`Average ${avgKcal} kcal/day — ${PROFILE.targets.kcal-avgKcal>0?`${PROFILE.targets.kcal-avgKcal} kcal below target`:"on target"}`].map((ins,i)=>(<div key={i} style={{display:“flex”,gap:10,padding:“8px 0”,borderBottom:i<1?`1px solid ${C.border}`:“none”}}><div style={{width:3,borderRadius:2,background:C.accent,flexShrink:0}}/><span style={{fontFamily:F.body,fontSize:14,color:C.text,lineHeight:1.4}}>{ins}</span></div>))}</Card>
<Card style={{padding:20}}><div style={{display:“flex”,alignItems:“center”,gap:8,marginBottom:14}}><div style={{width:24,height:24,borderRadius:“50%”,background:C.accentSoft,display:“flex”,alignItems:“center”,justifyContent:“center”}}><Sparkles size={13} color={C.accent}/></div><span style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text}}>Recommendations</span></div>{[avgProtPct<90&&`Increase protein by ~${Math.max(10,Math.round(PROFILE.targets.protein*(1-avgProtPct/100)))}g daily`,avgCalPct<85&&`Add ${Math.round(PROFILE.targets.kcal-avgKcal)} kcal on low days — rice, oats, peanut butter`,`Weight: ${latestWeight}kg → ${PROFILE.targetWeight}kg goal (${(PROFILE.targetWeight-latestWeight).toFixed(1)}kg remaining)`].filter(Boolean).map((rec,i)=>(<div key={i} style={{fontFamily:F.body,fontSize:14,color:C.text,padding:“8px 0”,borderBottom:i<2?`1px solid ${C.border}`:“none”,lineHeight:1.4}}>{rec}</div>))}</Card></>)}
<Card style={{padding:20}}><div style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text,marginBottom:12}}>Body Weight</div><div style={{display:“flex”,alignItems:“baseline”,gap:8,marginBottom:4}}><span style={{fontFamily:F.body,fontSize:42,fontWeight:700,color:C.text,lineHeight:1}}>{latestWeight}</span><span style={{fontFamily:F.body,fontSize:16,color:C.textDim}}>kg → {PROFILE.targetWeight}</span></div><div style={{fontFamily:F.body,fontSize:13,color:parseFloat(weightChange)>=0?C.success:C.danger,marginBottom:16}}>{parseFloat(weightChange)>=0?”+”:””}{weightChange} kg total · {(PROFILE.targetWeight-latestWeight).toFixed(1)} kg to goal</div>{weights.length>=2&&(<svg width=“100%” height=“80” viewBox=“0 0 300 80” preserveAspectRatio=“none” style={{display:“block”,marginBottom:16}}><line x1="0" y1={80-((PROFILE.targetWeight-wMin)/range)*72-4} x2="300" y2={80-((PROFILE.targetWeight-wMin)/range)*72-4} stroke={C.accentTrack} strokeWidth="1.5" strokeDasharray="3,3"/><polyline fill=“none” stroke={C.accent} strokeWidth=“2” points={weights.map((wt,i)=>`${(i/(weights.length-1))*296+2},${80-((wt.weight-wMin)/range)*72-4}`).join(” “)}/>{weights.map((wt,i)=>{const x=(i/(weights.length-1))*296+2,y=80-((wt.weight-wMin)/range)*72-4;return<circle key={i} cx={x} cy={y} r="3" fill={C.card} stroke={C.accent} strokeWidth="2"/>;})}</svg>)}<div style={{display:“flex”,gap:8}}><input type=“number” step=“0.1” inputMode=“decimal” value={wInput} onChange={e=>setWInput(e.target.value)} placeholder={`${latestWeight}`} style={{flex:1,padding:“11px 14px”,background:C.bg,border:`1px solid ${C.border}`,borderRadius:R.btn,fontFamily:F.body,fontSize:14,color:C.text,outline:“none”}} onKeyDown={e=>{if(e.key===“Enter”){addWeight(wInput);setWInput(””);}}}/><button onClick={()=>{addWeight(wInput);setWInput(””);}} disabled={!wInput} style={{padding:“11px 20px”,background:wInput?C.accent:C.bg,color:wInput?“white”:C.textDim,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:14,fontWeight:600,cursor:wInput?“pointer”:“default”}}>Save</button></div></Card>
</div>)}
{section===“physique”&&(<div style={{padding:“0 20px”,display:“flex”,flexDirection:“column”,gap:12}}>
<Card style={{padding:20}}><div style={{display:“flex”,alignItems:“center”,gap:8,marginBottom:14}}><TrendingUp size={16} color={C.accent} strokeWidth={1.5}/><span style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text}}>Physique Trend</span></div>
{!preview?(<div><div style={{background:C.bg,borderRadius:12,height:160,display:“flex”,flexDirection:“column”,alignItems:“center”,justifyContent:“center”,gap:8,cursor:“pointer”,marginBottom:16}} onClick={()=>fileRef.current?.click()}><Camera size={28} color={C.textFaint} strokeWidth={1.5}/><span style={{fontFamily:F.body,fontSize:13,color:C.textDim}}>Weekly Photo Comparison</span><span style={{fontFamily:F.body,fontSize:11,color:C.textFaint}}>Tap to upload</span></div><input ref={fileRef} type=“file” accept=“image/*” onChange={handleImg} style={{display:“none”}}/><div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:16}}><div><div style={{fontFamily:F.body,fontSize:12,color:C.textDim,marginBottom:4}}>Body Fat</div><div style={{fontFamily:F.body,fontSize:24,fontWeight:700,color:C.text}}>—</div><div style={{fontFamily:F.body,fontSize:11,color:C.textDim}}>log photo to estimate</div></div><div><div style={{fontFamily:F.body,fontSize:12,color:C.textDim,marginBottom:4}}>Muscle Trend</div><div style={{display:“inline-flex”,alignItems:“center”,gap:6,background:C.bg,borderRadius:20,padding:“6px 12px”,marginTop:2}}><TrendingUp size={14} color={C.accent}/><span style={{fontFamily:F.body,fontSize:13,fontWeight:500,color:C.text}}>Gaining</span></div></div></div></div>):(<div><div style={{position:“relative”,marginBottom:12}}><img src={preview} alt=“progress” style={{width:“100%”,borderRadius:12,maxHeight:360,objectFit:“cover”,display:“block”}}/><button onClick={()=>{setPreview(null);setImgData(null);setAnalysis(””);}} style={{position:“absolute”,top:8,right:8,background:“rgba(0,0,0,0.5)”,border:“none”,borderRadius:“50%”,width:30,height:30,display:“flex”,alignItems:“center”,justifyContent:“center”,cursor:“pointer”}}><X size={15} color="white"/></button></div>{!analysis&&!physLoading&&(<button onClick={analysePhysique} style={{width:“100%”,padding:“13px”,background:C.accent,color:“white”,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:15,fontWeight:600,cursor:“pointer”,display:“flex”,alignItems:“center”,justifyContent:“center”,gap:8}}><Sparkles size={16}/>Analyse physique</button>)}{physLoading&&<div style={{padding:“16px”,textAlign:“center”,fontFamily:F.body,fontSize:14,color:C.textDim}}>Analysing…</div>}{physError&&<div style={{padding:“12px 14px”,background:”#FDF0EE”,borderRadius:R.btn,fontFamily:F.body,fontSize:13,color:C.danger,display:“flex”,gap:8}}><AlertCircle size={14} style={{flexShrink:0,marginTop:1}}/>{physError}</div>}{analysis&&(<Card style={{padding:16,background:C.accentSoft,boxShadow:“none”,border:`1px solid ${C.accentTrack}`}}><div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.accent,textTransform:“uppercase”,letterSpacing:“0.04em”,marginBottom:8}}>Coach read</div><div style={{fontFamily:F.body,fontSize:13,color:C.text,lineHeight:1.7,whiteSpace:“pre-wrap”}}>{analysis}</div></Card>)}</div>)}
</Card>
{pastReads.length>0&&(<Card style={{padding:20}}><div style={{fontFamily:F.body,fontSize:15,fontWeight:600,color:C.text,marginBottom:12}}>Past reads</div>{pastReads.slice(0,5).map(r=>(<div key={r.id} style={{paddingBottom:12,borderBottom:`1px solid ${C.border}`,marginBottom:12}}><div style={{display:“flex”,justifyContent:“space-between”,marginBottom:4}}><span style={{fontFamily:F.body,fontSize:13,fontWeight:500,color:C.text}}>{fmtDate(r.date)}</span><span style={{fontFamily:F.body,fontSize:12,color:C.textDim}}>{r.weight}kg</span></div><div style={{fontFamily:F.body,fontSize:12,color:C.textMid,lineHeight:1.5,display:”-webkit-box”,WebkitLineClamp:3,WebkitBoxOrient:“vertical”,overflow:“hidden”}}>{r.analysis}</div></div>))}</Card>)}
</div>)}
{section===“lifts”&&(<div style={{padding:“0 20px”,display:“flex”,flexDirection:“column”,gap:12}}>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:10}}>{allLifts.map(name=>{const best=bestLift(name);return(<Card key={name} style={{padding:16,cursor:“pointer”,border:liftName===name?`1.5px solid ${C.accent}`:undefined}} onClick={()=>setLiftName(name)}><div style={{display:“flex”,justifyContent:“space-between”,alignItems:“flex-start”,marginBottom:10}}><Dumbbell size={15} color={C.accent} strokeWidth={1.5}/>{liftName===name&&<div style={{width:6,height:6,borderRadius:“50%”,background:C.accent}}/>}</div><div style={{fontFamily:F.body,fontSize:11,fontWeight:500,color:C.textDim,marginBottom:4,textTransform:“uppercase”,letterSpacing:“0.04em”}}>{name}</div>{best?(<><div style={{fontFamily:F.body,fontSize:22,fontWeight:700,color:C.text}}>{best.weight}<span style={{fontSize:13,color:C.textDim,marginLeft:3,fontWeight:400}}>×{best.reps}</span></div><div style={{fontFamily:F.body,fontSize:11,color:C.accent,marginTop:4}}>e1RM {e1rm(best.weight,best.reps)}kg</div></>):<div style={{fontFamily:F.body,fontSize:20,color:C.textFaint}}>—</div>}</Card>);})}</div>
<Card style={{padding:20}}><div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textMid,marginBottom:14,textTransform:“uppercase”,letterSpacing:“0.04em”}}>Log {liftName}</div><div style={{display:“flex”,gap:8,alignItems:“center”}}><input type=“number” inputMode=“decimal” value={liftKg} onChange={e=>setLiftKg(e.target.value)} placeholder=“kg” style={{flex:1,padding:“11px”,background:C.bg,border:`1px solid ${C.border}`,borderRadius:R.btn,fontFamily:F.body,fontSize:15,color:C.text,outline:“none”,textAlign:“center”}}/><span style={{fontFamily:F.body,fontSize:18,color:C.textDim}}>×</span><input type=“number” inputMode=“numeric” value={liftReps} onChange={e=>setLiftReps(e.target.value)} placeholder=“reps” style={{flex:1,padding:“11px”,background:C.bg,border:`1px solid ${C.border}`,borderRadius:R.btn,fontFamily:F.body,fontSize:15,color:C.text,outline:“none”,textAlign:“center”}}/><button onClick={()=>{addLift(liftName,liftKg,liftReps);setLiftKg(””);setLiftReps(””);}} disabled={!liftKg||!liftReps} style={{padding:“11px 18px”,background:(liftKg&&liftReps)?C.accent:C.bg,color:(liftKg&&liftReps)?“white”:C.textDim,border:“none”,borderRadius:R.btn,fontFamily:F.body,fontSize:14,fontWeight:600,cursor:(liftKg&&liftReps)?“pointer”:“default”,transition:“background 0.15s”}}>Log</button></div></Card>
{liftHist.length>0&&(<Card style={{padding:20}}><div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textMid,marginBottom:14,textTransform:“uppercase”,letterSpacing:“0.04em”}}>{liftName} history</div>{liftHist.map((l,i)=>(<div key={l.id||i} style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,padding:“10px 0”,borderBottom:`1px solid ${C.border}`}}><span style={{fontFamily:F.body,fontSize:13,color:C.textMid}}>{fmtDate(l.date)}</span><div style={{display:“flex”,gap:12,alignItems:“center”}}><span style={{fontFamily:F.body,fontSize:12,color:C.textFaint}}>e1RM {e1rm(l.weight,l.reps)}</span><span style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{l.weight}kg × {l.reps}</span></div></div>))}</Card>)}
</div>)}
{section===“history”&&(<div style={{padding:“0 20px”,display:“flex”,flexDirection:“column”,gap:8}}>{sortedHist.length===0?(<Card style={{padding:40,textAlign:“center”}}><div style={{fontFamily:F.body,fontSize:15,color:C.textDim}}>No history yet — start logging</div></Card>):sortedHist.slice(0,30).map(([date,day])=>{const t=day.totals||{};const pct=Math.min(100,Math.round(((t.kcal||0)/PROFILE.targets.kcal)*100));const protOk=(t.protein||0)>=PROFILE.targets.protein*0.95;const isToday=date===todayStr();return(<Card key={date} style={{padding:16}}><div style={{display:“flex”,justifyContent:“space-between”,alignItems:“baseline”,marginBottom:10}}><div style={{display:“flex”,gap:8,alignItems:“center”}}><span style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{isToday?“Today”:fmtDate(date)}</span>{isToday&&<span style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.accent,background:C.accentSoft,padding:“2px 8px”,borderRadius:20}}>Live</span>}</div><span style={{fontFamily:F.body,fontSize:16,fontWeight:700,color:C.text}}>{Math.round(t.kcal||0)}</span></div><div style={{height:6,background:C.bg,borderRadius:3,marginBottom:10,overflow:“hidden”}}><div style={{height:“100%”,width:`${pct}%`,background:pct>=95?C.success:pct>=80?C.accent:C.danger,borderRadius:3}}/></div><div style={{fontFamily:F.body,fontSize:12,color:C.textDim,display:“flex”,gap:10}}><span style={{color:protOk?C.success:C.textDim,fontWeight:protOk?600:400}}>{Math.round(t.protein||0)}g P</span><span>·</span><span>{Math.round(t.carbs||0)}g C</span><span>·</span><span>{Math.round(t.fat||0)}g F</span></div></Card>);})}</div>)}
</PageShell>
);
};

function Nav(){
const navigate=useNavigate();const location=useLocation();
return(<nav style={{position:“absolute”,bottom:0,left:0,right:0,background:“rgba(255,255,255,0.92)”,backdropFilter:“blur(20px)”,WebkitBackdropFilter:“blur(20px)”,borderTop:`1px solid ${C.border}`,paddingBottom:“env(safe-area-inset-bottom, 8px)”}}><div style={{display:“flex”,justifyContent:“space-around”,padding:“10px 0 4px”}}>{[{path:”/”,Icon:Home,label:“Home”},{path:”/log-meal”,Icon:({style})=><div style={{…style,width:26,height:26,borderRadius:“50%”,border:`1.5px solid ${location.pathname==="/log-meal"?C.text:C.textDim}`,display:“flex”,alignItems:“center”,justifyContent:“center”}}><Plus size={14} color={location.pathname===”/log-meal”?C.text:C.textDim} strokeWidth={2}/></div>,label:“Log”},{path:”/progress”,Icon:TrendingUp,label:“Progress”}].map(({path,Icon,label})=>{const active=location.pathname===path;return(<button key={path} onClick={()=>navigate(path)} style={{display:“flex”,flexDirection:“column”,alignItems:“center”,gap:4,background:“none”,border:“none”,cursor:“pointer”,padding:“4px 20px”,color:active?C.text:C.textDim}}><Icon size={24} strokeWidth={1.5} color={active?C.text:C.textDim}/><span style={{fontFamily:F.body,fontSize:11,fontWeight:active?600:400,color:active?C.text:C.textDim}}>{label}</span></button>);})}</div></nav>);
}

function AppContent({store}){
return(<div style={{height:“100%”,display:“flex”,flexDirection:“column”,position:“relative”,background:C.bg}}><div style={{flex:1,overflow:“hidden”}}><Routes><Route path=”/” element={<HomePage store={store}/>}/><Route path=”/log-meal” element={<LogPage store={store}/>}/><Route path=”/progress” element={<ProgressPage store={store}/>}/></Routes></div><Nav/></div>);
}

export default function App(){
const store=useStore();
useEffect(()=>{const l=document.createElement(“link”);l.href=“https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap”;l.rel=“stylesheet”;document.head.appendChild(l);return()=>{try{document.head.removeChild(l);}catch{}};},[]);
if(!store.loaded)return(<div style={{minHeight:“100vh”,background:C.bg,display:“flex”,alignItems:“center”,justifyContent:“center”}}><span style={{fontFamily:“system-ui”,fontSize:13,color:C.textDim}}>Loading…</span></div>);
return(<BrowserRouter><div style={{minHeight:“100vh”,background:C.bg,display:“flex”,alignItems:“center”,justifyContent:“center”,fontFamily:F.body}}><div style={{width:“100%”,maxWidth:430,height:“100vh”,maxHeight:932,background:C.bg,boxShadow:“0 0 60px rgba(0,0,0,0.12)”,overflow:“hidden”,position:“relative”}}><AppContent store={store}/></div></div></BrowserRouter>);
}
