"use strict";
/* =========================================================================
   POP IN OFF — JEOPARDY BOARD
   Standalone, offline-first. No scoring (Buzzonk handles buzz-in + points).
   ========================================================================= */

const DEFAULT_VALUES = [200,400,600,800,1000];

const state = {
  title: "Pop In Off — Game Night",
  categories: [],      // [{name, clues:[{value,clue,answer,used}]}]
  ddEnabled: true,
  dd: null,            // {ci, ri}
  rows: 0,             // max clues in any category
};

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const setupEl=$("setup"), gameEl=$("game"), boardEl=$("board");
const clueLayer=$("clueLayer"), clueBackdrop=$("clueBackdrop"), clueCard=$("clueCard");
const clueValueEl=$("clueValue"), clueCatEl=$("clueCat"), clueTextEl=$("clueText"), clueAnswerEl=$("clueAnswer");
const ddSplash=$("ddSplash"), ddSub=$("ddSub");
const soundBtn=$("soundBtn"), thinkBtn=$("thinkBtn"), timesUpBtn=$("timesUpBtn");

/* =========================================================================
   SOUND  (optional — files live in sounds/, see sounds/README.md)
   Missing files just no-op, so the board works with or without audio.
   ========================================================================= */
const Sound = (()=>{
  // Single source of truth for file paths. To use .wav instead of .mp3,
  // change the extensions here and nowhere else.
  const FILES = {
    select:      "sounds/select.mp3",        // soft blip when a clue opens
    dailyDouble: "sounds/daily-double.mp3",  // sting when the Daily Double appears
    reveal:      "sounds/correct.mp3",        // ding when the answer is revealed
    timesUp:     "sounds/times-up.mp3",       // buzzer when time runs out
    theme:       "sounds/think-music.mp3",    // looping "think" music
  };
  const store = (()=>{ try{ return window.localStorage; }catch(e){ return null; } })();
  let muted = store ? store.getItem("pio_muted")==="1" : false;
  const cache = {};
  function get(key){
    if(cache[key]) return cache[key];
    const a = new Audio(FILES[key]);
    a.preload = "auto";
    a.addEventListener("error", ()=>{}, {once:true}); // missing file -> silent
    cache[key] = a; return a;
  }
  function play(key){
    if(muted) return;
    try{ const a=get(key); a.loop=false; a.currentTime=0; const p=a.play(); if(p&&p.catch) p.catch(()=>{}); }catch(e){}
  }
  function theme(on){
    const a=get("theme"); a.loop=true;
    if(on && !muted){ try{ a.currentTime=0; const p=a.play(); if(p&&p.catch) p.catch(()=>{}); }catch(e){} }
    else{ try{ a.pause(); }catch(e){} }
  }
  function stopAll(){ Object.values(cache).forEach(a=>{ try{ a.pause(); a.currentTime=0; }catch(e){} }); }
  function setMuted(m){ muted=m; if(store){ try{ store.setItem("pio_muted", m?"1":"0"); }catch(e){} } if(m) stopAll(); }
  function isMuted(){ return muted; }
  return {play, theme, stopAll, setMuted, isMuted};
})();

function resetThinkBtn(){ thinkBtn.classList.remove("on"); thinkBtn.innerHTML="&#9654; Think music"; }
function updateSoundBtn(){
  soundBtn.classList.toggle("off", Sound.isMuted());
  soundBtn.innerHTML = Sound.isMuted() ? "&#128263; Muted" : "&#128266; Sound";
}

/* =========================================================================
   CSV PARSING  (RFC-4180-ish state machine: handles quotes, commas, newlines)
   ========================================================================= */
function parseCSV(text){
  const rows=[]; let row=[], field="", inQuotes=false;
  text = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQuotes){
      if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQuotes=false; }
      else field+=c;
    }else{
      if(c==='"') inQuotes=true;
      else if(c===","){ row.push(field); field=""; }
      else if(c==="\n"){ row.push(field); rows.push(row); row=[]; field=""; }
      else field+=c;
    }
  }
  row.push(field); rows.push(row);
  // drop fully-empty rows
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}

/* Build the board model from a 2-D array of rows (first row = header). */
function buildBoard(rows){
  if(!rows.length) throw new Error("No data found.");
  const header = rows[0].map(h=>String(h).trim().toLowerCase());
  const find = names => header.findIndex(h => names.includes(h));
  const iCat = find(["category","cat"]);
  const iVal = find(["value","val","points"]);
  const iClue = find(["clue","prompt"]);
  const iAns = find(["answer","response","correct","question"]);
  if(iCat<0 || iClue<0 || iAns<0)
    throw new Error("Header row must include Category, Clue, and Answer (Value is optional).");

  const map=new Map(), order=[];
  for(let r=1;r<rows.length;r++){
    const row=rows[r];
    const cat=String(row[iCat]??"").trim();
    const clue=String(row[iClue]??"").trim();
    const answer=String(row[iAns]??"").trim();
    if(!cat && !clue && !answer) continue;
    if(!cat){ throw new Error(`Row ${r+1} is missing a Category.`); }
    if(!map.has(cat)){ map.set(cat,[]); order.push(cat); }
    let value=null;
    if(iVal>=0){ const v=parseInt(String(row[iVal]??"").replace(/[^0-9.\-]/g,""),10); if(!isNaN(v)) value=v; }
    map.get(cat).push({value, clue, answer, used:false});
  }

  const cats = order.map(name=>{
    const clues=map.get(name);
    clues.forEach((c,i)=>{ if(c.value==null) c.value = DEFAULT_VALUES[i] ?? (i+1)*200; });
    clues.sort((a,b)=>a.value-b.value);
    return {name, clues};
  });
  return cats;
}

/* Validate + render the setup preview, enable/disable Start. */
function loadCategories(cats){
  state.categories = cats;
  state.rows = cats.reduce((m,c)=>Math.max(m,c.clues.length),0);
  renderPreview();
}

function renderPreview(){
  const pv=$("preview"); pv.innerHTML="";
  const cats=state.categories;
  if(!cats.length){ $("startBtn").disabled=true; return; }

  const msgs=[];
  if(cats.length>6) msgs.push(["warn",`You have ${cats.length} categories. The board shows all of them, but 6 is the classic, most TV-readable layout.`]);
  if(cats.length<2) msgs.push(["warn","Only one category — that'll work, but most games use 6."]);
  const oddRows = cats.filter(c=>c.clues.length!==5);
  if(oddRows.length) msgs.push(["warn",`${oddRows.length} categor${oddRows.length>1?"ies":"y"} don't have exactly 5 clues. Missing slots show as blank tiles.`]);

  msgs.forEach(([cls,t])=>{
    const d=document.createElement("div"); d.className="pv-msg "+cls; d.textContent=t; pv.appendChild(d);
  });

  const wrap=document.createElement("div"); wrap.className="pv-cats";
  cats.forEach(c=>{
    const el=document.createElement("div"); el.className="pv-cat";
    el.innerHTML=`<b>${escapeHTML(c.name)}</b><span>${c.clues.length} clue${c.clues.length!==1?"s":""}</span>`;
    wrap.appendChild(el);
  });
  pv.appendChild(wrap);
  $("startBtn").disabled=false;
}

function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

/* =========================================================================
   FILE / PASTE / SAMPLE / TEMPLATE
   ========================================================================= */
$("csvBtn").onclick = ()=> $("fileInput").click();
$("fileInput").onchange = e=>{
  const file=e.target.files[0]; if(!file) return;
  const name=file.name.toLowerCase();
  if(name.endsWith(".xlsx")||name.endsWith(".xls")){
    if(typeof XLSX==="undefined"){ showLoadError("The .xlsx reader didn't load (likely offline). Re-save your sheet as CSV and load that — CSV always works offline."); return; }
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const arr=XLSX.utils.sheet_to_json(ws,{header:1,blankrows:false,defval:""});
        tryLoad(()=> loadCategories(buildBoard(arr)));
      }catch(err){ showLoadError(err.message||"Could not read that spreadsheet."); }
    };
    reader.readAsArrayBuffer(file);
  }else{
    const reader=new FileReader();
    reader.onload=ev=> tryLoad(()=> loadCategories(buildBoard(parseCSV(ev.target.result))));
    reader.readAsText(file);
  }
  e.target.value="";
};

$("pasteBtn").onclick = ()=>{ const w=$("pasteWrap"); w.style.display = w.style.display==="none"?"block":"none"; };
$("pasteLoadBtn").onclick = ()=>{
  const txt=$("pasteArea").value.trim();
  if(!txt){ showLoadError("Paste some CSV text first."); return; }
  tryLoad(()=> loadCategories(buildBoard(parseCSV(txt))));
};

function tryLoad(fn){ try{ fn(); }catch(err){ showLoadError(err.message||"Could not parse that data."); } }
function showLoadError(msg){
  const pv=$("preview");
  pv.innerHTML=`<div class="pv-msg err">${escapeHTML(msg)}</div>`;
  $("startBtn").disabled=true;
}

$("templateBtn").onclick = ()=>{
  const csv = SAMPLE_CSV;
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="jeopardy-template.csv";
  a.click();
  URL.revokeObjectURL(a.href);
};

$("sampleBtn").onclick = ()=> tryLoad(()=> loadCategories(buildBoard(parseCSV(SAMPLE_CSV))));

/* =========================================================================
   START / RENDER BOARD
   ========================================================================= */
$("startBtn").onclick = ()=>{
  state.title = $("titleInput").value.trim() || "Pop In Off";
  state.ddEnabled = $("ddToggle").checked;
  startGame();
};

function startGame(){
  $("gameTitle").textContent = state.title;
  armDailyDouble();
  renderBoard();
  setupEl.style.display="none";
  gameEl.style.display="flex";
}

function armDailyDouble(){
  state.dd=null;
  if(!state.ddEnabled) return;
  const pool=[];
  state.categories.forEach((c,ci)=> c.clues.forEach((cl,ri)=> pool.push({ci,ri})));
  if(pool.length) state.dd = pool[Math.floor(Math.random()*pool.length)];
}

function renderBoard(){
  const cats=state.categories, rows=state.rows;
  boardEl.style.gridTemplateColumns=`repeat(${cats.length},1fr)`;
  boardEl.style.gridTemplateRows=`minmax(56px,0.85fr) repeat(${rows},1fr)`;
  boardEl.innerHTML="";

  // header row
  cats.forEach(c=>{
    const h=document.createElement("div");
    h.className="cell category";
    h.textContent=c.name;
    boardEl.appendChild(h);
  });

  // value rows
  for(let ri=0; ri<rows; ri++){
    cats.forEach((c,ci)=>{
      const clue=c.clues[ri];
      const cell=document.createElement("div");
      if(!clue){ cell.className="cell tile used"; boardEl.appendChild(cell); return; }
      cell.className="cell tile" + (clue.used?" used":"");
      cell.dataset.ci=ci; cell.dataset.ri=ri;
      cell.textContent = clue.used ? "" : "$"+clue.value;
      boardEl.appendChild(cell);
    });
  }
}

boardEl.addEventListener("click", e=>{
  const cell=e.target.closest(".tile");
  if(!cell || cell.classList.contains("used")) return;
  openClue(+cell.dataset.ci, +cell.dataset.ri, cell);
});

/* =========================================================================
   CLUE ZOOM (FLIP: animate from the tapped tile's rect to fullscreen)
   ========================================================================= */
let current=null; // {ci,ri,el,clue,isDD}

function openClue(ci,ri,cell){
  const clue=state.categories[ci].clues[ri];
  const isDD = !!(state.dd && state.dd.ci===ci && state.dd.ri===ri);
  current={ci,ri,el:cell,clue,isDD};

  const value = isDD ? clue.value*2 : clue.value;
  clueValueEl.textContent="$"+value;
  clueCatEl.textContent=state.categories[ci].name;
  clueTextEl.textContent=clue.clue;
  clueAnswerEl.textContent=clue.answer;
  clueAnswerEl.style.display="none";
  $("revealBtn").textContent="Reveal answer";

  if(isDD){
    ddSub.textContent="Worth $"+value;
    ddSplash.style.display="flex";
  }else{
    ddSplash.style.display="none";
  }

  resetThinkBtn();
  Sound.play(isDD ? "dailyDouble" : "select");
  flipOpen(cell);
}

function flipOpen(fromEl){
  const r=fromEl.getBoundingClientRect();
  const vw=window.innerWidth, vh=window.innerHeight;
  clueLayer.style.display="block";
  // start collapsed onto the tile
  clueCard.style.transition="none";
  clueCard.style.transform=`translate(${r.left}px,${r.top}px) scale(${r.width/vw},${r.height/vh})`;
  clueBackdrop.style.opacity="0";
  void clueCard.offsetWidth; // force reflow
  // animate to fullscreen
  clueCard.style.transition="transform .42s cubic-bezier(.2,.7,.2,1)";
  clueCard.style.transform="translate(0,0) scale(1,1)";
  requestAnimationFrame(()=> clueBackdrop.style.opacity="1");
}

function flipClose(){
  if(!current) return;
  Sound.theme(false); resetThinkBtn();
  const r=current.el.getBoundingClientRect();
  const vw=window.innerWidth, vh=window.innerHeight;
  clueBackdrop.style.opacity="0";
  clueCard.style.transition="transform .36s cubic-bezier(.4,0,.6,1)";
  clueCard.style.transform=`translate(${r.left}px,${r.top}px) scale(${r.width/vw},${r.height/vh})`;
  const done=()=>{
    clueCard.removeEventListener("transitionend",done);
    clueLayer.style.display="none";
    current=null;
  };
  clueCard.addEventListener("transitionend",done);
}

$("ddRevealBtn").onclick = ()=>{ ddSplash.style.display="none"; };

$("revealBtn").onclick = ()=>{
  const shown = clueAnswerEl.style.display!=="none";
  clueAnswerEl.style.display = shown ? "none":"block";
  if(!shown) Sound.play("reveal");
  $("revealBtn").textContent = shown ? "Reveal answer" : "Hide answer";
};

$("doneBtn").onclick = ()=>{
  if(!current) return;
  const {ci,ri,el}=current;
  state.categories[ci].clues[ri].used=true;
  el.classList.add("used");
  el.textContent="";
  flipClose();
};

$("clueClose").onclick = ()=> flipClose();  // close WITHOUT marking answered (misclick escape)

/* keyboard: Esc closes (no mark), Space toggles answer */
document.addEventListener("keydown", e=>{
  if(clueLayer.style.display!=="block") return;
  if(e.key==="Escape") flipClose();
  else if(e.code==="Space"){ e.preventDefault(); $("revealBtn").click(); }
  else if(e.key==="Enter"){ e.preventDefault(); $("doneBtn").click(); }
});

/* =========================================================================
   TOP BAR
   ========================================================================= */
$("resetBtn").onclick = ()=>{
  state.categories.forEach(c=> c.clues.forEach(cl=> cl.used=false));
  armDailyDouble();
  renderBoard();
};
$("backBtn").onclick = ()=>{
  gameEl.style.display="none";
  setupEl.style.display="block";
};

/* ---------- SOUND CONTROLS ---------- */
thinkBtn.onclick = ()=>{
  const on = !thinkBtn.classList.contains("on");
  thinkBtn.classList.toggle("on", on);
  thinkBtn.innerHTML = on ? "&#9209; Stop music" : "&#9654; Think music";
  Sound.theme(on);
};
timesUpBtn.onclick = ()=>{ Sound.theme(false); resetThinkBtn(); Sound.play("timesUp"); };
soundBtn.onclick = ()=>{ Sound.setMuted(!Sound.isMuted()); if(Sound.isMuted()) resetThinkBtn(); updateSoundBtn(); };
updateSoundBtn();

/* =========================================================================
   SAMPLE GAME  (also doubles as the downloadable CSV template / format example)
   ========================================================================= */
const SAMPLE_CSV =
`Category,Value,Clue,Answer
TABLETOP RPGS,200,"This 20-sided die decides most actions in D&D",What is a d20?
TABLETOP RPGS,400,"The person who runs a D&D adventure, abbreviated DM",Who is the Dungeon Master?
TABLETOP RPGS,600,"In most fantasy RPGs, this ability score measures raw physical power",What is Strength?
TABLETOP RPGS,800,"""Powered by the ___"" is a popular indie RPG engine from Apocalypse World",What is the Apocalypse?
TABLETOP RPGS,1000,"Published in 1974, it's widely called the first tabletop RPG",What is Dungeons & Dragons?
BOARD GAME NIGHT,200,"Buy Boardwalk and bankrupt your friends in this classic",What is Monopoly?
BOARD GAME NIGHT,400,"Collect brick, wood, sheep, wheat & ore to settle this island",What is Catan?
BOARD GAME NIGHT,600,"This co-op game has players as specialists racing to cure global diseases",What is Pandemic?
BOARD GAME NIGHT,800,"Score points placing lettered tiles on a 15x15 grid",What is Scrabble?
BOARD GAME NIGHT,1000,"Mr. Green and Colonel Mustard are suspects in this whodunit",What is Clue?
VIDEO GAME LORE,200,"This plumber's brother is named Luigi",Who is Mario?
VIDEO GAME LORE,400,"""It's dangerous to go alone! Take this."" greets you in this Nintendo series",What is The Legend of Zelda?
VIDEO GAME LORE,600,"These green exploding mobs sneak up and hiss in Minecraft",What is a Creeper?
VIDEO GAME LORE,800,"This battle royale popularized building, emotes, and the storm",What is Fortnite?
VIDEO GAME LORE,1000,"Cloud, Aerith, and Sephiroth headline this 1997 Square RPG",What is Final Fantasy VII?
DICE & ODDS,200,"The most common total when rolling two six-sided dice",What is 7?
DICE & ODDS,400,"A standard die has this many faces",What is 6?
DICE & ODDS,600,"""Snake eyes"" means you rolled two of these",What are ones?
DICE & ODDS,800,"Your chance of rolling any specific number on a fair d6, as a fraction",What is 1/6?
DICE & ODDS,1000,"On a d20, the chance of a natural 20, as a percentage",What is 5%?
TUCSON,200,"Tucson is home to this university, the Wildcats",What is the University of Arizona?
TUCSON,400,"Tucson sits in this U.S. state",What is Arizona?
TUCSON,600,"This giant cactus of the Sonoran Desert surrounds the city",What is the saguaro?
TUCSON,800,"Tucson lays claim to inventing this deep-fried burrito",What is the chimichanga?
TUCSON,1000,"In 2015 Tucson became the first U.S. UNESCO City of this culinary honor",What is Gastronomy?
POP CULTURE,200,"This Netflix show features a shadow realm called the Upside Down",What is Stranger Things?
POP CULTURE,400,"""May the Force be with you"" is from this saga",What is Star Wars?
POP CULTURE,600,"Pikachu is the mascot of this card-game-and-anime franchise",What is Pokemon?
POP CULTURE,800,"Wakanda is the home of this Marvel hero",Who is Black Panther?
POP CULTURE,1000,"This 2023 biopic paired with ""Barbie"" to create ""Barbenheimer""",What is Oppenheimer?`;

/* Pre-load the sample so the board works the instant you open the file. */
tryLoad(()=> loadCategories(buildBoard(parseCSV(SAMPLE_CSV))));

/* =========================================================================
   GAME LIBRARY  — server-side CSV store at /jeopardy/games/
   Fetches the Caddy browse JSON listing, renders clickable items,
   and handles browser-side upload to POST /upload on the Node server.

   Falls back gracefully when not served from the VPS (local file open).
   ========================================================================= */
const LIBRARY_URL  = "/jeopardy/games/";
const UPLOAD_URL   = "/upload";

const libraryCard   = $("libraryCard");
const libraryHint   = $("libraryHint");
const libraryList   = $("libraryList");
const libUploadBtn  = $("libraryUploadBtn");
const libUploadInput= $("libraryFileInput");
const libUploadStatus = $("libraryUploadStatus");

let libraryActive = null; // currently selected filename

/* ---- fetch & render ---- */
async function fetchLibrary(){
  libraryHint.textContent = "Loading…";
  libraryList.innerHTML = "";
  try{
    const res = await fetch(LIBRARY_URL, {headers:{Accept:"application/json"}});
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    // Caddy browse JSON: { files: [{name, is_dir, size, modified}] }
    // Filter to CSV/XLSX only, exclude directories and README

    const files = (Array.isArray(data) ? data : (data.files || []))
      .filter(f => !f.is_dir && /\.(csv|xlsx|xls)$/i.test(f.name));

    if(!files.length){
      libraryHint.textContent = "No game files on server yet. Upload one below.";
      return;
    }
    libraryHint.textContent = `${files.length} game${files.length!==1?"s":""} available — click one to load it.`;
    files.forEach(f => renderLibraryItem(f.name));

  }catch(e){
    libraryHint.textContent = "Game library not available (running locally or server offline). Use the Load options below.";
    libraryCard.style.opacity = "0.6";
  }
}

function renderLibraryItem(filename){
  const displayName = filename.replace(/\.(csv|xlsx|xls)$/i,"");
  const item = document.createElement("div");
  item.className = "lib-item" + (filename===libraryActive?" active":"");
  item.dataset.filename = filename;

  const nameEl = document.createElement("span");
  nameEl.className = "lib-item-name";
  nameEl.textContent = displayName;

  const loadEl = document.createElement("button");
  loadEl.className = "lib-item-load";
  loadEl.textContent = filename===libraryActive ? "✓ Loaded" : "Load";

  const delEl = document.createElement("button");
  delEl.className = "lib-item-delete";
  delEl.title = "Remove from library";
  delEl.textContent = "✕";
  delEl.onclick = async (e) => {
    e.stopPropagation();
    if(!confirm("Remove \""+displayName+"\" from the library?")) return;
    try{
      const res  = await fetch(UPLOAD_URL+"/"+encodeURIComponent(filename), {method:"DELETE"});
      const data = await res.json();
      if(data.ok){
        item.remove();
        if(filename===libraryActive) libraryActive=null;
        const remaining = libraryList.querySelectorAll(".lib-item").length;
        if(!remaining) libraryHint.textContent = "No game files on server yet. Upload one below.";
      }else{
        alert("Delete failed: "+(data.error||"unknown"));
      }
    }catch(err){
      alert("Delete error: "+err.message);
    }
  };

  item.appendChild(nameEl);
  item.appendChild(loadEl);
  item.appendChild(delEl);
  item.onclick = () => loadLibraryFile(filename, item);
  libraryList.appendChild(item);
}

async function loadLibraryFile(filename, itemEl){
  try{
    const res = await fetch(LIBRARY_URL + encodeURIComponent(filename));
    if(!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();

    const lower = filename.toLowerCase();
    if(lower.endsWith(".xlsx") || lower.endsWith(".xls")){
      if(typeof XLSX==="undefined"){ showLoadError("The .xlsx reader didn't load (likely offline). Re-save as CSV."); return; }
      const buf = await (await fetch(LIBRARY_URL + encodeURIComponent(filename))).arrayBuffer();
      const wb  = XLSX.read(buf, {type:"array"});
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json(ws,{header:1,blankrows:false,defval:""});
      tryLoad(()=> loadCategories(buildBoard(arr)));
    }else{
      tryLoad(()=> loadCategories(buildBoard(parseCSV(text))));
    }

    // Update title from filename
    const titleGuess = filename.replace(/\.(csv|xlsx|xls)$/i,"");
    $("titleInput").value = titleGuess;

    // Mark active
    libraryActive = filename;
    document.querySelectorAll(".lib-item").forEach(el=>{
      el.classList.toggle("active", el.dataset.filename===filename);
      el.querySelector(".lib-item-load").textContent =
        el.dataset.filename===filename ? "✓ Loaded" : "Load";
    });

  }catch(e){
    showLoadError("Could not load \""+filename+"\" from server: "+e.message);
  }
}

/* ---- refresh button ---- */
$("libraryRefreshBtn").onclick = () => fetchLibrary();

/* ---- upload ---- */
libUploadBtn.onclick = () => libUploadInput.click();

libUploadInput.onchange = async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  e.target.value = "";

  showUploadStatus("Uploading "+file.name+"…", "");

  const fd = new FormData();
  fd.append("file", file);

  try{
    const res  = await fetch(UPLOAD_URL, {method:"POST", body:fd});
    const data = await res.json();
    if(data.ok){
      showUploadStatus("✓ \""+data.filename+"\" uploaded to library.", "ok");
      await fetchLibrary();            // refresh the list
    }else{
      showUploadStatus("Upload failed: "+(data.error||"unknown error"), "err");
    }
  }catch(err){
    showUploadStatus("Upload error: "+err.message, "err");
  }
};

function showUploadStatus(msg, cls){
  libUploadStatus.textContent = msg;
  libUploadStatus.className   = cls;
  libUploadStatus.style.display = "block";
  if(cls==="ok") setTimeout(()=>{ libUploadStatus.style.display="none"; }, 4000);
}

/* ---- auto-fetch on load ---- */
fetchLibrary();
