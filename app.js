import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LocalStore } from "./store.js";
import { SupabaseStore } from "./supabase-store.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const APP_VERSION = "0.2.0";

const params = new URLSearchParams(location.search);
const USE_LOCAL = params.has("local"); // ?local  -> seeded localStorage, no Supabase
const IS_WALL = params.has("wall");    // ?wall   -> tablet kiosk behaviour

const sb = USE_LOCAL
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage,
      },
    });

const store = USE_LOCAL ? new LocalStore() : new SupabaseStore(sb);
window.store = store; // dev convenience

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local
const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// On a phone, remember who you are. On the wall panel, never.
const MY_PERSON = "familyboard.me";
const myPerson = () => (IS_WALL ? null : localStorage.getItem(MY_PERSON));
const setMyPerson = (id) => { if (!IS_WALL) localStorage.setItem(MY_PERSON, id); };

// ---------- routing ----------

let unsub = null;

const VIEWS = ["homeView", "person", "manage"];
function show(view) {
  VIEWS.forEach((v) => (el(v).hidden = v !== view));
}

function route() {
  if (unsub) { unsub(); unsub = null; }

  const person = location.hash.match(/^#\/p\/([^/]+)/);
  const manage = location.hash.match(/^#\/manage\/([^/]+)/);

  if (manage) {
    renderManage(manage[1]);
    unsub = store.subscribe(() => renderManage(manage[1], { keepInput: true }));
  } else if (person) {
    setMyPerson(person[1]);
    renderPerson(person[1]);
    unsub = store.subscribe(() => renderPerson(person[1], { keepPanel: true }));
  } else {
    renderHome();
    unsub = store.subscribe(renderHome);
  }
}

window.addEventListener("hashchange", route);

// ---------- home ----------

async function renderHome() {
  show("homeView");

  const day = today();
  const people = await store.listPeople();
  const plans = await store.listDayPlan(day);

  el("home").innerHTML = people
    .map((p) => {
      const mine = plans.filter((x) => x.person_id === p.id);
      const done = mine.filter((x) => x.done_at).length;
      const total = mine.length;
      const dots = mine.map((x) => `<span class="dot ${x.done_at ? "on" : ""}"></span>`).join("");
      return `
        <button class="card" data-person="${p.id}" style="--c:${p.color}">
          <div class="name">${esc(p.name)}</div>
          <div class="count">${total ? `${done} / ${total}` : "—"}</div>
          <div class="dots">${total ? dots : `<span class="unplanned">Not planned yet</span>`}</div>
        </button>`;
    })
    .join("");
}

el("home").addEventListener("click", (e) => {
  const card = e.target.closest("[data-person]");
  if (card) location.hash = `#/p/${card.dataset.person}`;
});

// ---------- person board ----------

let planOpen = false;
let tagFilter = null;   // null = show all
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

  const [tasks, plans] = await Promise.all([
    store.listTasks(personId),
    store.listDayPlan(day, personId),
  ]);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

  // --- today's list: open first, done sunk to the bottom ---
  const rows = plans
    .map((p) => ({ plan: p, task: byId[p.task_id] }))
    .filter((r) => r.task)
    .sort((a, b) =>
      (a.plan.done_at ? 1 : 0) - (b.plan.done_at ? 1 : 0) ||
      String(a.plan.chosen_at).localeCompare(String(b.plan.chosen_at))
    );

  const openCount = rows.filter((r) => !r.plan.done_at).length;
  const doneCount = rows.length - openCount;

  el("count").textContent = rows.length ? `${doneCount} / ${rows.length}` : "";

  el("todayList").innerHTML = rows.length
    ? rows
        .map(
          (r, i) => `
      <li class="task ${r.plan.done_at ? "is-done" : ""} ${
            i === openCount && doneCount && openCount ? "first-done" : ""
          }" data-plan="${r.plan.id}">
        <button class="toggle" data-act="toggle" aria-pressed="${!!r.plan.done_at}">
          <span class="mark" aria-hidden="true"></span>
          <span class="title">${esc(r.task.title)}</span>
        </button>
        <button class="remove" data-act="remove" aria-label="Remove ${esc(
          r.task.title
        )} from today">✕</button>
      </li>`
        )
        .join("")
    : `<li class="empty">Nothing planned for today. Open <b>Plan</b> to pick what you'll do.</li>`;

  // --- plan panel ---
  const chosen = new Set(plans.map((p) => p.task_id));
  const dow = new Date().getDay();

  const eligible = tasks
    .filter((t) => !chosen.has(t.id))
    .filter((t) => t.kind === "general" || !t.weekdays?.length || t.weekdays.includes(dow));

  // tag chips come from what's actually available right now
  const allTags = [...new Set(eligible.flatMap((t) => t.tags || []))].sort();
  el("tagBar").innerHTML = allTags.length
    ? `<button class="chip ${tagFilter ? "" : "on"}" data-tag="">All</button>` +
      allTags
        .map(
          (t) =>
            `<button class="chip ${tagFilter === t ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`
        )
        .join("")
    : "";

  const q = planSearch.trim().toLowerCase();
  const available = eligible
    .filter((t) => !tagFilter || (t.tags || []).includes(tagFilter))
    .filter((t) => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));

  el("planList").innerHTML = available.length
    ? available
        .map(
          (t) => `
      <li>
        <button class="avail" data-add="${t.id}">
          <span class="body">
            <span class="title">${esc(t.title)}</span>
            ${(t.tags || []).length
              ? `<span class="tags">${(t.tags || []).map((x) => esc(x)).join(" · ")}</span>`
              : ""}
          </span>
          <span class="kind">${t.kind === "general" ? "anytime" : "daily"}</span>
          <span class="plus" aria-hidden="true">+</span>
        </button>
      </li>`
        )
        .join("")
    : `<li class="empty">${
        eligible.length
          ? "No tasks match this filter."
          : "Everything available is already on today's list."
      }</li>`;

  setPanel(planOpen);
}

function setPanel(open) {
  planOpen = open;
  el("planPanel").classList.toggle("open", open);
  el("scrim").classList.toggle("on", open);
  el("planBtn").setAttribute("aria-expanded", String(open));
}

const currentPerson = () => location.hash.match(/^#\/(?:p|manage)\/([^/]+)/)?.[1];

el("todayList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const li = btn.closest(".task");
  const planId = li.dataset.plan;

  if (btn.dataset.act === "toggle") {
    const done = btn.getAttribute("aria-pressed") === "true";
    li.classList.toggle("is-done", !done); // instant feedback
    await store.setDone(planId, !done);
  } else {
    await store.unchoose(planId);
  }
});

el("planList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  btn.classList.add("added");
  await store.choose(today(), currentPerson(), btn.dataset.add);
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

el("planBtn").addEventListener("click", () => setPanel(!planOpen));
el("scrim").addEventListener("click", () => setPanel(false));
el("back").addEventListener("click", () => { location.hash = ""; });

// ---------- manage ----------

let editingId = null;

async function renderManage(personId, { keepInput = false } = {}) {
  const people = await store.listPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) { location.hash = ""; return; }

  show("manage");
  el("manage").style.setProperty("--c", person.color);
  el("manageName").textContent = `${person.name} · tasks`;
  el("manageBack").href = `#/p/${personId}`;

  const tasks = (await store.listTasks(personId)).sort((a, b) =>
    a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title)
  );

  el("poolList").innerHTML = tasks.length
    ? tasks
        .map(
          (t) => `
      <li class="pool ${editingId === t.id ? "editing" : ""}" data-task="${t.id}">
        <button class="poolMain" data-act="edit">
          <span class="title">${esc(t.title)}</span>
          <span class="meta">
            ${t.kind === "general" ? "anytime" : weekdayLabel(t.weekdays)}
            ${(t.tags || []).length ? " · " + (t.tags || []).map(esc).join(" · ") : ""}
          </span>
        </button>
        <button class="poolDel" data-act="delete" aria-label="Delete ${esc(t.title)}">🗑</button>
      </li>`
        )
        .join("")
    : `<li class="empty">No tasks yet. Add the first one below.</li>`;

  if (!keepInput) clearForm();
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function weekdayLabel(w) {
  if (!w || !w.length) return "any day";
  if (w.length === 7) return "every day";
  return w.slice().sort().map((d) => DAYS[d]).join(" ");
}

function clearForm() {
  editingId = null;
  el("tTitle").value = "";
  el("tTags").value = "";
  el("tKind").value = "recurring";
  [...el("tDays").querySelectorAll("input")].forEach((c) => (c.checked = false));
  el("saveTask").textContent = "Add task";
  el("cancelEdit").hidden = true;
  syncKindUI();
}

function syncKindUI() {
  el("daysRow").hidden = el("tKind").value === "general";
}
el("tKind").addEventListener("change", syncKindUI);

el("poolList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const taskId = btn.closest(".pool").dataset.task;

  if (btn.dataset.act === "delete") {
    const tasks = await store.listTasks(currentPerson());
    const t = tasks.find((x) => x.id === taskId);
    if (!confirm(`Delete "${t?.title}"? Its history will be removed too.`)) return;
    if (editingId === taskId) clearForm();
    await store.deleteTask(taskId);
    return;
  }

  // edit
  const tasks = await store.listTasks(currentPerson());
  const t = tasks.find((x) => x.id === taskId);
  if (!t) return;
  editingId = t.id;
  el("tTitle").value = t.title;
  el("tTags").value = (t.tags || []).join(", ");
  el("tKind").value = t.kind;
  [...el("tDays").querySelectorAll("input")].forEach(
    (c) => (c.checked = (t.weekdays || []).includes(Number(c.value)))
  );
  el("saveTask").textContent = "Save changes";
  el("cancelEdit").hidden = false;
  syncKindUI();
  el("tTitle").focus();
});

el("cancelEdit").addEventListener("click", clearForm);

el("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const personId = currentPerson();
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
  try {
    if (editingId) await store.updateTask(editingId, patch);
    else await store.createTask({ person_id: personId, ...patch });
    clearForm();
    el("tTitle").focus();
  } catch (err) {
    console.error(err);
    el("manageError").textContent = err.message || "Could not save that task.";
  } finally {
    btn.disabled = false;
  }
});

// ---------- auth gate ----------

function showLogin(showIt) {
  el("login").hidden = !showIt;
  el("app").hidden = showIt;
}

function landing() {
  // Phones go straight to their own board; the wall panel starts at home.
  const me = myPerson();
  if (!location.hash && me) location.hash = `#/p/${me}`;
  else route();
}

async function start() {
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
    if (msg.includes("not confirmed")) {
      err.textContent =
        "This account isn't confirmed yet. Confirm it in Supabase under Authentication → Users.";
    } else if (msg.includes("invalid login")) {
      err.textContent = "That email and password don't match an account.";
    } else if (msg.includes("failed to fetch")) {
      err.textContent = "Can't reach the server. Check SUPABASE_URL in config.js.";
    } else {
      err.textContent = error.message;
    }
    return;
  }
  el("password").value = "";
  showLogin(false);
  landing();
});

start();
