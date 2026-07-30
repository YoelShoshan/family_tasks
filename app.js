import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LocalStore } from "./store.js";
import { SupabaseStore } from "./supabase-store.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { STRINGS, getLang, setLang, makeT } from "./i18n.js";

const APP_VERSION = "0.10.0";

const params = new URLSearchParams(location.search);
const USE_LOCAL = params.has("local"); // ?local -> seeded localStorage, no Supabase
const IS_WALL = params.has("wall");    // ?wall  -> tablet kiosk behaviour

const sb = USE_LOCAL
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
    });

const store = USE_LOCAL ? new LocalStore() : new SupabaseStore(sb);
window.store = store; // dev convenience

let lang = getLang();
let t = makeT(lang);

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local
const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// On a phone, remember who you are. On the wall panel, never.
const MY_PERSON = "familyboard.me";
const myPerson = () => (IS_WALL ? null : localStorage.getItem(MY_PERSON));
const setMyPerson = (id) => { if (!IS_WALL) localStorage.setItem(MY_PERSON, id); };

// ---------- language ----------

let editingId = null;    // task being edited in the manage form
let editingSetId = null; // set whose membership is being edited

function applyLang() {
  t = makeT(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = STRINGS[lang].dir;

  el("loginTitle").textContent = t("appTitle");
  el("loginSub").textContent = t("loginSub");
  el("email").placeholder = t("email");
  el("password").placeholder = t("password");
  el("loginBtn").textContent = t("signIn");

  el("homeEyebrow").textContent = t("todayEyebrow");

  el("back").setAttribute("aria-label", t("backToEveryone"));
  el("manageBack").setAttribute("aria-label", t("backToBoard"));
  el("manageLink").textContent = t("tasksBtn");
  el("statsLink").textContent = t("statsBtn");
  el("avgLink").textContent = t("avgBtn");
  el("planBtn").textContent = t("planBtn");

  el("planTitle").textContent = t("addToToday");
  el("planSearch").placeholder = t("searchTasks");

  el("tTitle").placeholder = t("newTask");
  el("tTags").placeholder = t("tagsPlaceholder");
  el("optRecurring").textContent = t("recurring");
  el("optGeneral").textContent = t("general");
  el("cancelEdit").textContent = t("cancel");
  el("setDoneBtn").textContent = t("doneEditing");
  el("saveTask").textContent = editingId ? t("saveChanges") : t("addTask");

  [...el("tDays").querySelectorAll("label span")].forEach((s, i) => {
    s.textContent = t("days")[i];
  });

  [...document.querySelectorAll(".langBtn")].forEach((b) => (b.textContent = t("langBtn")));
}

function toggleLang() {
  lang = lang === "he" ? "en" : "he";
  setLang(lang);
  applyLang();
  route();
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".langBtn")) toggleLang();
});

// ---------- trend chart ----------

// Two stacked areas over `days`: completed (solid) and the shortfall up to
// planned (faint). Values are 3-day rolling averages so a single day doesn't
// spike the line. Returns an SVG string.
function trendSvg(plans, days, { w = 300, h = 60, pad = 2, axis = false } = {}) {
  const planned = days.map(
    (d) => plans.filter((p) => p.day === d && !p.abandoned_at).length
  );
  const done = days.map(
    (d) => plans.filter((p) => p.day === d && p.done_at).length
  );

  const smooth = (arr) =>
    arr.map((_, i) => {
      const from = Math.max(0, i - 2);
      const win = arr.slice(from, i + 1);
      return win.reduce((a, b) => a + b, 0) / win.length;
    });

  const sp = smooth(planned);
  const sd = smooth(done);
  const peak = Math.max(...sp, 1);

  const x = (i) => pad + (i / Math.max(1, days.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - (v / peak) * (h - pad * 2);

  const line = (arr) => arr.map((v, i) => `${x(i)},${y(v).toFixed(1)}`).join(" ");
  const area = (arr) =>
    `${pad},${h - pad} ${line(arr)} ${w - pad},${h - pad}`;

  // shortfall band: planned on top, completed underneath, closed into a ribbon
  const band =
    line(sp) +
    " " +
    sd
      .map((v, i) => `${x(sd.length - 1 - i)},${y(sd[sd.length - 1 - i]).toFixed(1)}`)
      .join(" ");

  const todayX = x(days.length - 1).toFixed(1);

  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="trend" aria-hidden="true">
      <polygon class="tPlanned" points="${band}"/>
      <polygon class="tDone" points="${area(sd)}"/>
      <polyline class="tPlannedLine" points="${line(sp)}"/>
      <polyline class="tDoneLine" points="${line(sd)}"/>
      ${axis ? `<line class="tNow" x1="${todayX}" y1="${pad}" x2="${todayX}" y2="${h - pad}"/>` : ""}
    </svg>`;
}

// ---------- date helpers ----------

const dayStr = (d) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD, local
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00"); // noon avoids DST edge cases
  d.setDate(d.getDate() + n);
  return dayStr(d);
}
function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return addDays(dateStr, -d.getDay()); // Sunday-first
}

// ---------- routing ----------

let unsub = null;
const VIEWS = ["homeView", "person", "manage", "stats", "averages"];
const show = (view) => VIEWS.forEach((v) => (el(v).hidden = v !== view));

function route() {
  if (unsub) { unsub(); unsub = null; }

  const person = location.hash.match(/^#\/p\/([^/]+)/);
  const manage = location.hash.match(/^#\/manage\/([^/]+)/);
  const stats = location.hash.match(/^#\/stats\/([^/]+)/);
  const avg = location.hash.match(/^#\/avg\/([^/]+)/);

  if (avg) {
    renderAverages(avg[1]);
    unsub = store.subscribe(() => renderAverages(avg[1]));
  } else if (stats) {
    renderStats(stats[1]);
    unsub = store.subscribe(() => renderStats(stats[1]));
  } else if (manage) {
    renderManage(manage[1]);
    unsub = store.subscribe(() => renderManage(manage[1], { keepInput: true }));
  } else if (person) {
    editingSetId = null;
    setMyPerson(person[1]);
    renderPerson(person[1]);
    unsub = store.subscribe(() => renderPerson(person[1], { keepPanel: true }));
  } else {
    renderHome();
    unsub = store.subscribe(renderHome);
  }
}

window.addEventListener("hashchange", route);

const currentPerson = () =>
  location.hash.match(/^#\/(?:p|manage|stats|avg)\/([^/]+)/)?.[1];

// ---------- home ----------

async function renderHome() {
  show("homeView");

  const day = today();
  const from = addDays(day, -29);
  const people = await store.listPeople();
  const [plans, month] = await Promise.all([
    store.listDayPlan(day),
    store.listDayPlanRange(from, day),
  ]);

  const days30 = Array.from({ length: 30 }, (_, i) => addDays(from, i));

  el("home").innerHTML = people
    .map((p) => {
      const mine = plans.filter((x) => x.person_id === p.id);
      const active = mine.filter((x) => !x.abandoned_at); // abandoned = counted as never added
      const done = active.filter((x) => x.done_at).length;
      const total = active.length;
      const dots = active
        .map((x) => `<span class="dot ${x.done_at ? "on" : ""}"></span>`)
        .join("");

      const mineMonth = month.filter((x) => x.person_id === p.id);
      const chart = mineMonth.length
        ? trendSvg(mineMonth, days30, { w: 300, h: 46 })
        : "";

      return `
        <button class="card" data-person="${p.id}" style="--c:${p.color}">
          <div class="name" dir="auto">${esc(p.name)}</div>
          <div class="count ${total ? "" : "dim"}">${done} / ${total}</div>
          <div class="dots">${total ? dots : `<span class="unplanned">${t("notPlanned")}</span>`}</div>
          <div class="trendBox">${chart}</div>
        </button>`;
    })
    .join("");
}

el("home").addEventListener("click", (e) => {
  const card = e.target.closest("[data-person]");
  if (card) goTo(`#/p/${card.dataset.person}`);
});

// ---------- person board ----------

let planOpen = false;
let tagFilter = null;
let planSearch = "";

async function renderPerson(personId, { keepPanel = false } = {}) {
  if (!keepPanel) { planOpen = false; tagFilter = null; planSearch = ""; }

  const day = today();
  const people = await store.listPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) { location.hash = ""; return; }

  show("person");
  el("person").style.setProperty("--c", person.color);
  el("personName").textContent = person.name;
  el("manageLink").href = `#/manage/${personId}`;
  el("statsLink").href = `#/stats/${personId}`;
  el("avgLink").href = `#/avg/${personId}`;

  const [tasks, plans, collections, recent] = await Promise.all([
    store.listTasks(personId),
    store.listDayPlan(day, personId),
    store.listCollections(personId),
    store.listDayPlanRange(addDays(day, -27), day, personId),
  ]);
  const byId = Object.fromEntries(tasks.map((x) => [x.id, x]));

  // completions per task over the last 4 weeks, for rate colouring
  const rate = {};
  recent.forEach((p) => {
    if (p.done_at) rate[p.task_id] = (rate[p.task_id] || 0) + 1;
  });
  const rateMax = Math.max(...Object.values(rate), 1);
  const rateLevel = (id) => {
    const n = rate[id] || 0;
    return n === 0 ? 0 : Math.min(4, Math.ceil((n / rateMax) * 4));
  };

  const rows = plans
    .map((p) => ({ plan: p, task: byId[p.task_id] }))
    .filter((r) => r.task)
    .map((r) => ({
      ...r,
      state: r.plan.done_at ? "done" : r.plan.abandoned_at ? "gone" : "open",
    }))
    .sort((a, b) => {
      const rank = { open: 0, done: 1, gone: 2 };
      return (
        rank[a.state] - rank[b.state] ||
        String(a.plan.chosen_at).localeCompare(String(b.plan.chosen_at))
      );
    });

  const openCount = rows.filter((r) => r.state === "open").length;
  const doneCount = rows.filter((r) => r.state === "done").length;
  const goneCount = rows.filter((r) => r.state === "gone").length;
  const activeCount = rows.length - goneCount; // abandoned drops out of the total
  el("count").textContent = activeCount ? `${doneCount} / ${activeCount}` : "";

  el("todayList").innerHTML = rows.length
    ? rows
        .map(
          (r, i) => `
      <li class="task is-${r.state} ${
            i === openCount && openCount && rows.length > openCount ? "first-closed" : ""
          }" data-plan="${r.plan.id}">
        <button class="toggle" data-act="toggle" aria-pressed="${r.state === "done"}">
          <span class="mark" aria-hidden="true"></span>
          <span class="title" dir="auto">${esc(r.task.title)}</span>
          ${r.state === "gone" ? `<span class="goneTag">${t("abandoned")}</span>` : ""}
        </button>
        <button class="abandon" data-act="abandon" aria-label="${esc(
          r.state === "gone" ? t("restoreLabel", r.task.title) : t("abandonLabel", r.task.title)
        )}">${r.state === "gone" ? "↩" : "✕"}</button>
      </li>`
        )
        .join("")
    : `<li class="empty">${t("emptyToday")}</li>`;

  // --- plan panel ---
  const chosen = new Set(plans.map((p) => p.task_id));
  const dow = new Date().getDay();

  const eligible = tasks
    .filter((x) => !chosen.has(x.id))
    .filter((x) => x.kind === "general" || !x.weekdays?.length || x.weekdays.includes(dow));

  // one-tap sets: hide any whose tasks are all already on today's list
  const usableSets = collections.filter((c) =>
    c.task_ids.some((id) => !chosen.has(id) && byId[id])
  );
  el("setBar").innerHTML = usableSets.length
    ? `<div class="setLabel">${t("collections")}</div>` +
      usableSets
        .map((c) => {
          const n = c.task_ids.filter((id) => !chosen.has(id) && byId[id]).length;
          return `<button class="setChip" data-set="${c.id}" dir="auto">${esc(
            c.name
          )}<span class="n">+${n}</span></button>`;
        })
        .join("")
    : "";

  const allTags = [...new Set(eligible.flatMap((x) => x.tags || []))].sort((a, b) =>
    a.localeCompare(b, lang)
  );
  el("tagBar").innerHTML = allTags.length
    ? `<button class="chip ${tagFilter ? "" : "on"}" data-tag="">${t("allTags")}</button>` +
      allTags
        .map(
          (x) =>
            `<button class="chip ${tagFilter === x ? "on" : ""}" data-tag="${esc(x)}" dir="auto">${esc(x)}</button>`
        )
        .join("")
    : "";

  const q = planSearch.trim().toLowerCase();
  const available = eligible
    .filter((x) => !tagFilter || (x.tags || []).includes(tagFilter))
    .filter((x) => !q || x.title.toLowerCase().includes(q))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, lang));

  el("planList").innerHTML = available.length
    ? available
        .map(
          (x) => `
      <li>
        <button class="avail r${rateLevel(x.id)}" data-add="${x.id}">
          <span class="body">
            <span class="title" dir="auto">${esc(x.title)}</span>
            ${(x.tags || []).length
              ? `<span class="tags" dir="auto">${(x.tags || []).map(esc).join(" · ")}</span>`
              : ""}
          </span>
          <span class="kind">${x.kind === "general" ? t("kindAnytime") : t("kindDaily")}</span>
          <span class="plus" aria-hidden="true">+</span>
        </button>
      </li>`
        )
        .join("")
    : `<li class="empty">${eligible.length ? t("noMatch") : t("allChosen")}</li>`;

  setPanel(planOpen);
}

function setPanel(open) {
  planOpen = open;
  el("planPanel").classList.toggle("open", open);
  el("scrim").classList.toggle("on", open);
  el("planBtn").setAttribute("aria-expanded", String(open));
}

el("todayList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const li = btn.closest(".task");
  const planId = li.dataset.plan;

  if (btn.dataset.act === "toggle") {
    const wasDone = btn.getAttribute("aria-pressed") === "true";
    li.className = `task is-${wasDone ? "open" : "done"}`; // instant feedback

    if (!wasDone) {
      // was this the last open task?
      const openLeft = [...el("todayList").querySelectorAll(".task.is-open")].length;
      celebrate(li, openLeft === 0);
    }
    await store.setDone(planId, !wasDone);
  } else {
    const wasGone = li.classList.contains("is-gone");
    li.className = `task is-${wasGone ? "open" : "gone"}`;
    await store.setAbandoned(planId, !wasGone);
  }
});

// ---------- celebration ----------

// Synthesized so there's no audio file to host. Unlocked by the first tap.
let audioCtx = null;
function chime(isLast) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    // rising major arpeggio; a fuller one when the day is finished
    const notes = isLast
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5] // C5 E5 G5 C6 E6
      : [659.25, 830.61, 987.77];                // E5 G#5 B5
    const now = audioCtx.currentTime;

    notes.forEach((freq, i) => {
      const at = now + i * (isLast ? 0.1 : 0.075);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(isLast ? 0.22 : 0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + (isLast ? 0.9 : 0.6));
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(at);
      osc.stop(at + 1.1);
    });
  } catch {
    /* audio blocked or unsupported — the visual still runs */
  }
}

function spinCoin(li, isLast) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const box = li.getBoundingClientRect();
  const size = isLast ? 132 : 88;

  const coin = document.createElement("div");
  coin.className = "coin" + (isLast ? " big" : "");
  coin.style.left = `${box.left + box.width / 2}px`;
  coin.style.top = `${box.top + box.height / 2}px`;
  coin.style.setProperty("--size", `${size}px`);
  const gid = "cg" + Math.random().toString(36).slice(2, 8);
  coin.innerHTML = `
    <div class="coinInner">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="${gid}" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stop-color="#fff6cf"/>
            <stop offset="45%" stop-color="#f7d044"/>
            <stop offset="100%" stop-color="#c9930d"/>
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="47" fill="url(#${gid})" stroke="#a97a06" stroke-width="3"/>
        <circle cx="50" cy="50" r="37" fill="none" stroke="#e0ad1c" stroke-width="2.5"/>
        <path d="M50 26 l6.6 13.9 15.2 2.1 -11 10.9 2.7 15.2 -13.5-7.3 -13.5 7.3 2.7-15.2 -11-10.9 15.2-2.1z"
              fill="#fff3c4" stroke="#b8860b" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
      <span class="shine"></span>
    </div>`;

  el("confetti").appendChild(coin);
  coin.addEventListener("animationend", (e) => {
    if (e.target === coin) coin.remove();
  });
}

function celebrate(li, isLast) {
  chime(isLast);
  spinCoin(li, isLast);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const box = li.getBoundingClientRect();
  const originX = box.left + box.width / 2;
  const originY = box.top + box.height / 2;

  const colors = ["#22c55e", "#4ade80", "#86efac", "#facc15", "#fb923c", "#38bdf8", "#f472b6", "#a78bfa"];
  const count = isLast ? 220 : 90;
  const layer = el("confetti");

  for (let i = 0; i < count; i++) {
    const bit = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const power = (isLast ? 320 : 220) * (0.35 + Math.random() * 1.05);
    bit.className = "bit";
    bit.style.cssText = `
      left:${originX}px; top:${originY}px;
      background:${colors[(Math.random() * colors.length) | 0]};
      --dx:${Math.cos(angle) * power}px;
      --dy:${Math.sin(angle) * power - (isLast ? 220 : 150)}px;
      --rot:${(Math.random() * 1080 - 540) | 0}deg;
      --dur:${(isLast ? 2000 : 1600) + Math.random() * 900}ms;
      --delay:${Math.random() * (isLast ? 180 : 90)}ms;
      width:${6 + Math.random() * 7}px; height:${9 + Math.random() * 9}px;
      border-radius:${Math.random() < 0.35 ? "50%" : "2px"};
    `;
    layer.appendChild(bit);
    bit.addEventListener("animationend", () => bit.remove());
  }

  const banner = el("cheer");
  banner.textContent = isLast ? t("celebrateAll") : t("celebrate");
  banner.classList.toggle("big", isLast);
  banner.classList.remove("show");
  void banner.offsetWidth; // restart the animation
  banner.classList.add("show");
}

el("planList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  btn.classList.add("added");
  await store.choose(today(), currentPerson(), btn.dataset.add);
});

el("setBar").addEventListener("click", async (e) => {
  const chip = e.target.closest("[data-set]");
  if (!chip) return;
  chip.classList.add("added");
  await store.applyCollection(today(), currentPerson(), chip.dataset.set);
});

el("tagBar").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-tag]");
  if (!chip) return;
  tagFilter = chip.dataset.tag || null;
  renderPerson(currentPerson(), { keepPanel: true });
});

el("planSearch").addEventListener("input", (e) => {
  planSearch = e.target.value;
  renderPerson(currentPerson(), { keepPanel: true });
});

// <a href="#/..."> navigations push history natively; count them too.
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.id !== "manageBack") navDepth += 1;
});

// Android back: close the plan panel before leaving the screen.
window.addEventListener("popstate", () => {
  if (planOpen) setPanel(false);
});

el("planBtn").addEventListener("click", () => setPanel(!planOpen));
el("scrim").addEventListener("click", () => setPanel(false));
// Depth of in-app navigation, so back can unwind rather than exit.
let navDepth = 0;
window.addEventListener("popstate", () => { navDepth = Math.max(0, navDepth - 1); });

function goTo(hash) {
  navDepth += 1;
  location.hash = hash;
}

function goBack() {
  if (navDepth > 0) history.back();
  else location.hash = "";
}

el("back").addEventListener("click", goBack);

// ---------- manage ----------

function weekdayLabel(w) {
  if (!w || !w.length) return t("anyDay");
  if (w.length === 7) return t("everyDay");
  return w.slice().sort((a, b) => a - b).map((d) => t("days")[d]).join(" ");
}

async function renderManage(personId, { keepInput = false } = {}) {
  const people = await store.listPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) { location.hash = ""; return; }

  show("manage");
  el("manage").style.setProperty("--c", person.color);
  el("manageName").textContent = t("manageTitle", person.name);
  el("manageBack").href = `#/p/${personId}`;

  const [tasks, collections] = await Promise.all([
    store.listTasks(personId),
    store.listCollections(personId),
  ]);
  tasks.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, lang));

  const editingSet = collections.find((c) => c.id === editingSetId) || null;
  if (editingSetId && !editingSet) editingSetId = null;

  // --- sets section ---
  el("setsSection").innerHTML = `
    <div class="sectionHead">${t("collections")}</div>
    ${
      collections.length
        ? `<ul class="setList">${collections
            .map(
              (c) => `
        <li class="setRow ${c.id === editingSetId ? "editing" : ""}">
          <button class="setMain" data-setedit="${c.id}">
            <span class="title" dir="auto">${esc(c.name)}</span>
            <span class="meta">${t("setTasks", c.task_ids.length)}</span>
          </button>
          <button class="setRename" data-setrename="${c.id}">${t("renameSet")}</button>
          <button class="poolDel" data-setdel="${c.id}" aria-label="${esc(
                t("deleteSet")
              )}">🗑</button>
        </li>`
            )
            .join("")}</ul>`
        : `<p class="hint">${t("noSets")}</p>`
    }
    <div class="newSetRow">
      <input id="newSetName" type="text" dir="auto" autocomplete="off"
             placeholder="${esc(t("newSetName"))}">
      <button id="newSetBtn" type="button">${t("createSet")}</button>
    </div>`;

  // --- task pool: checkboxes when editing a set, normal rows otherwise ---
  el("poolHead").textContent = editingSet ? t("pickForSet") : "";
  el("poolHead").hidden = !editingSet;
  el("taskForm").hidden = !!editingSet;
  el("setDoneBar").hidden = !editingSet;
  if (editingSet) el("setDoneName").textContent = editingSet.name;

  const inSet = new Set(editingSet ? editingSet.task_ids : []);

  el("poolList").innerHTML = tasks.length
    ? tasks
        .map((x) =>
          editingSet
            ? `
      <li class="pool">
        <button class="poolMain pick ${inSet.has(x.id) ? "on" : ""}"
                data-pick="${x.id}" aria-pressed="${inSet.has(x.id)}">
          <span class="tick" aria-hidden="true"></span>
          <span class="body">
            <span class="title" dir="auto">${esc(x.title)}</span>
            <span class="meta" dir="auto">${
              x.kind === "general" ? t("kindAnytime") : weekdayLabel(x.weekdays)
            }</span>
          </span>
        </button>
      </li>`
            : `
      <li class="pool ${editingId === x.id ? "editing" : ""}" data-task="${x.id}">
        <button class="poolMain" data-act="edit">
          <span class="title" dir="auto">${esc(x.title)}</span>
          <span class="meta" dir="auto">
            ${x.kind === "general" ? t("kindAnytime") : weekdayLabel(x.weekdays)}
            ${(x.tags || []).length ? " · " + (x.tags || []).map(esc).join(" · ") : ""}
          </span>
        </button>
        <button class="poolDel" data-act="delete" aria-label="${esc(
          t("deleteLabel", x.title)
        )}">🗑</button>
      </li>`
        )
        .join("")
    : `<li class="empty">${t("emptyPool")}</li>`;

  if (!keepInput) clearForm();
}

// ---------- sets: events ----------

el("setsSection").addEventListener("click", async (e) => {
  const personId = currentPerson();

  const create = e.target.closest("#newSetBtn");
  if (create) {
    const input = el("newSetName");
    const name = input.value.trim();
    if (!name) return;
    input.value = "";
    await store.createCollection(personId, name);
    return;
  }

  const edit = e.target.closest("[data-setedit]");
  if (edit) {
    editingSetId = edit.dataset.setedit;
    renderManage(personId);
    return;
  }

  const rename = e.target.closest("[data-setrename]");
  if (rename) {
    const cols = await store.listCollections(personId);
    const c = cols.find((x) => x.id === rename.dataset.setrename);
    const name = prompt(t("renameSet"), c?.name || "");
    if (name && name.trim()) await store.renameCollection(c.id, name.trim());
    return;
  }

  const del = e.target.closest("[data-setdel]");
  if (del) {
    const cols = await store.listCollections(personId);
    const c = cols.find((x) => x.id === del.dataset.setdel);
    if (!c || !confirm(t("confirmDeleteSet", c.name))) return;
    if (editingSetId === c.id) editingSetId = null;
    await store.deleteCollection(c.id);
  }
});

el("manageBack").addEventListener("click", (e) => {
  e.preventDefault();
  goBack();
});

el("setDoneBtn").addEventListener("click", () => {
  editingSetId = null;
  renderManage(currentPerson());
});

function clearForm() {
  editingId = null;
  el("tTitle").value = "";
  el("tTags").value = "";
  el("tKind").value = "recurring";
  [...el("tDays").querySelectorAll("input")].forEach((c) => (c.checked = false));
  el("saveTask").textContent = t("addTask");
  el("cancelEdit").hidden = true;
  el("manageError").textContent = "";
  syncKindUI();
}

function syncKindUI() {
  el("daysRow").hidden = el("tKind").value === "general";
}
el("tKind").addEventListener("change", syncKindUI);

el("poolList").addEventListener("click", async (e) => {
  // set-membership mode
  const pick = e.target.closest("[data-pick]");
  if (pick) {
    const personId = currentPerson();
    const cols = await store.listCollections(personId);
    const c = cols.find((x) => x.id === editingSetId);
    if (!c) return;
    const has = c.task_ids.includes(pick.dataset.pick);
    const next = has
      ? c.task_ids.filter((id) => id !== pick.dataset.pick)
      : [...c.task_ids, pick.dataset.pick];
    pick.classList.toggle("on", !has); // instant feedback
    pick.setAttribute("aria-pressed", String(!has));
    await store.setCollectionTasks(c.id, next);
    return;
  }

  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const taskId = btn.closest(".pool").dataset.task;
  const tasks = await store.listTasks(currentPerson());
  const task = tasks.find((x) => x.id === taskId);
  if (!task) return;

  if (btn.dataset.act === "delete") {
    if (!confirm(t("confirmDelete", task.title))) return;
    if (editingId === taskId) clearForm();
    await store.deleteTask(taskId);
    return;
  }

  editingId = task.id;
  el("tTitle").value = task.title;
  el("tTags").value = (task.tags || []).join(", ");
  el("tKind").value = task.kind;
  [...el("tDays").querySelectorAll("input")].forEach(
    (c) => (c.checked = (task.weekdays || []).includes(Number(c.value)))
  );
  el("saveTask").textContent = t("saveChanges");
  el("cancelEdit").hidden = false;
  syncKindUI();
  el("tTitle").focus();
});

el("cancelEdit").addEventListener("click", clearForm);

el("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = el("tTitle").value.trim();
  if (!title) return;

  const kind = el("tKind").value;
  const days = [...el("tDays").querySelectorAll("input:checked")].map((c) => Number(c.value));
  const tags = el("tTags").value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const patch = {
    title,
    kind,
    tags,
    weekdays: kind === "general" ? null : days.length ? days : null,
  };

  const btn = el("saveTask");
  btn.disabled = true;
  el("manageError").textContent = "";
  try {
    if (editingId) await store.updateTask(editingId, patch);
    else await store.createTask({ person_id: currentPerson(), ...patch });
    clearForm();
    el("tTitle").focus();
  } catch (err) {
    console.error(err);
    el("manageError").textContent = err.message || t("saveFailed");
  } finally {
    btn.disabled = false;
  }
});

// ---------- stats ----------

async function renderStats(personId) {
  const people = await store.listPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) { location.hash = ""; return; }

  show("stats");
  el("stats").style.setProperty("--c", person.color);
  el("statsName").textContent = t("statsTitle", person.name);
  el("statsBack").href = `#/p/${personId}`;

  const end = today();
  const heatStart = addDays(startOfWeek(end), -7 * 7); // 8 weeks incl. this one
  const [tasks, plans] = await Promise.all([
    store.listTasks(personId),
    store.listDayPlanRange(heatStart, end, personId),
  ]);

  const doneOnly = plans.filter((p) => p.done_at);

  if (!doneOnly.length) {
    el("statsBody").innerHTML = `<p class="hint">${t("noHistory")}</p>`;
    return;
  }

  // --- this week ---
  const weekStart = startOfWeek(end);
  const thisWeek = doneOnly.filter((p) => p.day >= weekStart);
  const weekDays = new Set(thisWeek.map((p) => p.day)).size;

  // --- last 4 weeks ---
  const fourStart = addDays(weekStart, -21);
  const last4 = doneOnly.filter((p) => p.day >= fourStart);

  // best week in the visible window (a gentler stand-in for streaks)
  const byWeek = {};
  doneOnly.forEach((p) => {
    const w = startOfWeek(p.day);
    byWeek[w] = (byWeek[w] || 0) + 1;
  });
  const bestWeek = Math.max(...Object.values(byWeek));

  // --- heatmap: 8 columns of 7 days ---
  const perDay = {};
  doneOnly.forEach((p) => { perDay[p.day] = (perDay[p.day] || 0) + 1; });
  const peak = Math.max(...Object.values(perDay), 1);

  let cells = "";
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 8; col++) {
      const d = addDays(heatStart, col * 7 + row);
      if (d > end) { cells += `<span class="cell blank"></span>`; continue; }
      const n = perDay[d] || 0;
      const lvl = n === 0 ? 0 : Math.min(4, Math.ceil((n / peak) * 4));
      cells += `<span class="cell l${lvl}" title="${d}: ${n}"></span>`;
    }
  }

  // --- per task, last 4 weeks ---
  const byTask = {};
  last4.forEach((p) => {
    byTask[p.task_id] = byTask[p.task_id] || { n: 0, last: "" };
    byTask[p.task_id].n += 1;
    if (p.day > byTask[p.task_id].last) byTask[p.task_id].last = p.day;
  });

  const taskRows = tasks
    .map((x) => ({ task: x, ...(byTask[x.id] || { n: 0, last: "" }) }))
    .sort((a, b) => b.n - a.n || a.task.title.localeCompare(b.task.title, lang));

  const maxN = Math.max(...taskRows.map((r) => r.n), 1);

  el("statsBody").innerHTML = `
    <div class="statGrid">
      <div class="stat">
        <div class="statNum">${thisWeek.length}</div>
        <div class="statLbl">${t("completedCount")} · ${t("thisWeek")}</div>
      </div>
      <div class="stat">
        <div class="statNum">${weekDays}</div>
        <div class="statLbl">${t("activeDays")}</div>
      </div>
      <div class="stat">
        <div class="statNum">${bestWeek}</div>
        <div class="statLbl">${t("bestStreakless")}</div>
      </div>
    </div>

    <div class="sectionHead">${t("trendTitle")}</div>
    <div class="trendBig">${trendSvg(
      plans.filter((p) => p.day >= addDays(end, -29)),
      Array.from({ length: 30 }, (_, i) => addDays(addDays(end, -29), i)),
      { w: 340, h: 130, pad: 4 }
    )}</div>
    <div class="legend">
      <span><i class="sw done"></i>${t("legendDone")}</span>
      <span><i class="sw planned"></i>${t("legendPlanned")}</span>
    </div>

    <div class="sectionHead">${t("heatmapTitle")}</div>
    <div class="heatWrap">
      <div class="heatDays">${t("daysShort")
        .map((d) => `<span>${d}</span>`)
        .join("")}</div>
      <div class="heat">${cells}</div>
    </div>

    <div class="sectionHead">${t("perTask")} · ${t("last4Weeks")}</div>
    <ul class="taskStats">
      ${taskRows
        .map(
          (r) => `
        <li>
          <div class="tsTop">
            <span class="tsTitle" dir="auto">${esc(r.task.title)}</span>
            <span class="tsN">${r.n ? t("timesDone", r.n) : t("neverDone")}</span>
          </div>
          <div class="tsBar"><span style="width:${(r.n / maxN) * 100}%"></span></div>
        </li>`
        )
        .join("")}
    </ul>`;
}

el("statsBack").addEventListener("click", (e) => {
  e.preventDefault();
  goBack();
});

// ---------- averages ----------

let avgSortDesc = true;

async function renderAverages(personId) {
  const people = await store.listPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) { location.hash = ""; return; }

  show("averages");
  el("averages").style.setProperty("--c", person.color);
  el("avgName").textContent = t("avgTitle", person.name);
  el("avgBack").href = `#/p/${personId}`;
  el("avgSortBtn").textContent = avgSortDesc ? t("sortDesc") : t("sortAsc");

  const end = today();
  const weekFrom = addDays(end, -6);   // 7 days inclusive
  const monthFrom = addDays(end, -29); // 30 days inclusive

  const [tasks, month] = await Promise.all([
    store.listTasks(personId),
    store.listDayPlanRange(monthFrom, end, personId),
  ]);

  const doneMonth = month.filter((p) => p.done_at);

  if (!doneMonth.length) {
    el("avgBody").innerHTML = `<p class="hint">${t("noAvgData")}</p>`;
    el("avgSortBtn").hidden = true;
    return;
  }
  el("avgSortBtn").hidden = false;

  const fmt = (n) => {
    const r = Math.round(n * 100) / 100;
    if (Number.isInteger(r)) return String(r);
    return r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  };

  const rows = tasks
    .map((tk) => {
      const wk =
        doneMonth.filter((p) => p.task_id === tk.id && p.day >= weekFrom).length / 7;
      const mo = doneMonth.filter((p) => p.task_id === tk.id).length / 30;
      return { title: tk.title, week: wk, month: mo };
    })
    .filter((r) => r.week > 0 || r.month > 0);

  rows.sort((a, b) => {
    const d = b.month - a.month || b.week - a.week;
    return avgSortDesc ? d : -d;
  });

  const barMax = Math.max(...rows.map((r) => r.month), 0.01);

  el("avgBody").innerHTML = `
    <div class="avgHead">
      <span class="avgColTask">${t("colTask")}</span>
      <span class="avgColNum">${t("colWeek")}</span>
      <span class="avgColNum">${t("colMonth")}</span>
    </div>
    <ul class="avgList">
      ${rows
        .map(
          (r) => `
        <li class="avgRow">
          <span class="avgTask" dir="auto">${esc(r.title)}
            <span class="avgTrack"><span style="width:${(r.month / barMax) * 100}%"></span></span>
          </span>
          <span class="avgNum">${fmt(r.week)}</span>
          <span class="avgNum strong">${fmt(r.month)}</span>
        </li>`
        )
        .join("")}
    </ul>
    <p class="avgFoot">${t("perDay")}</p>`;
}

el("avgSortBtn").addEventListener("click", () => {
  avgSortDesc = !avgSortDesc;
  renderAverages(currentPerson());
});

el("avgBack").addEventListener("click", (e) => {
  e.preventDefault();
  goBack();
});

function showLogin(showIt) {
  el("login").hidden = !showIt;
  el("app").hidden = showIt;
}

function landing() {
  const me = myPerson();
  if (!location.hash && me) {
    // replace, not push — otherwise Android back lands on an empty hash
    history.replaceState(null, "", `#/p/${me}`);
    route();
  } else {
    route();
  }
}

async function start() {
  applyLang();
  el("version").textContent =
    `v${APP_VERSION}${USE_LOCAL ? " · local" : ""}${IS_WALL ? " · wall" : ""}`;

  if (USE_LOCAL) {
    showLogin(false);
    landing();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showLogin(false);
    landing();
  } else {
    showLogin(true);
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      showLogin(true);
      if (unsub) { unsub(); unsub = null; }
    }
  });
}

el("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = el("loginBtn");
  const err = el("loginError");
  btn.disabled = true;
  err.textContent = "";

  const { error } = await sb.auth.signInWithPassword({
    email: el("email").value.trim(),
    password: el("password").value,
  });

  btn.disabled = false;
  if (error) {
    console.error("Sign-in failed:", error);
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("not confirmed")) err.textContent = t("errNotConfirmed");
    else if (msg.includes("invalid login")) err.textContent = t("errBadLogin");
    else if (msg.includes("failed to fetch")) err.textContent = t("errNoServer");
    else err.textContent = error.message;
    return;
  }
  el("password").value = "";
  showLogin(false);
  landing();
});

start();
