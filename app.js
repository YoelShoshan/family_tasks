import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LocalStore } from "./store.js";
import { SupabaseStore } from "./supabase-store.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// Add ?local to the URL to run against localStorage with seed data.
const USE_LOCAL = new URLSearchParams(location.search).has("local");

const sb = USE_LOCAL
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,      // session survives reboots — tablet stays signed in
        autoRefreshToken: true,    // refreshes before expiry, indefinitely
        storage: window.localStorage,
      },
    });

const store = USE_LOCAL ? new LocalStore() : new SupabaseStore(sb);
window.store = store; // dev convenience

const APP_VERSION = "0.1.1";

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local
const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- routing ----------

let unsub = null;

function route() {
  const m = location.hash.match(/^#\/p\/([^/]+)/);
  if (unsub) { unsub(); unsub = null; }
  if (m) {
    renderPerson(m[1]);
    unsub = store.subscribe(() => renderPerson(m[1], { keepPanel: true }));
  } else {
    renderHome();
    unsub = store.subscribe(renderHome);
  }
}

window.addEventListener("hashchange", route);

// ---------- home ----------

async function renderHome() {
  el("person").hidden = true;
  el("homeView").hidden = false;

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

// ---------- person ----------

let planOpen = false;

async function renderPerson(personId, { keepPanel = false } = {}) {
  if (!keepPanel) planOpen = false;

  const day = today();
  const people = await store.listPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) { location.hash = ""; return; }

  el("homeView").hidden = true;
  el("person").hidden = false;
  el("person").style.setProperty("--c", person.color);
  el("personName").textContent = person.name;

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
      a.plan.chosen_at.localeCompare(b.plan.chosen_at)
    );

  const open = rows.filter((r) => !r.plan.done_at);
  const doneRows = rows.filter((r) => r.plan.done_at);

  el("count").textContent = rows.length ? `${doneRows.length} / ${rows.length}` : "";

  el("todayList").innerHTML = rows.length
    ? rows
        .map(
          (r, i) => `
      <li class="task ${r.plan.done_at ? "is-done" : ""} ${
            i === open.length && doneRows.length && open.length ? "first-done" : ""
          }" data-plan="${r.plan.id}">
        <button class="toggle" data-act="toggle" aria-pressed="${!!r.plan.done_at}">
          <span class="mark" aria-hidden="true"></span>
          <span class="title">${esc(r.task.title)}</span>
        </button>
        <button class="remove" data-act="remove" title="Remove from today" aria-label="Remove ${esc(
          r.task.title
        )} from today">✕</button>
      </li>`
        )
        .join("")
    : `<li class="empty">Nothing planned for today. Open <b>Plan</b> to pick what you'll do.</li>`;

  // --- plan panel: everything not already chosen today ---
  const chosen = new Set(plans.map((p) => p.task_id));
  const dow = new Date().getDay();
  const available = tasks
    .filter((t) => !chosen.has(t.id))
    .filter((t) => t.kind === "general" || !t.weekdays || t.weekdays.includes(dow))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));

  el("planList").innerHTML = available.length
    ? available
        .map(
          (t) => `
      <li>
        <button class="avail" data-add="${t.id}">
          <span class="title">${esc(t.title)}</span>
          <span class="kind">${t.kind === "general" ? "anytime" : "daily"}</span>
          <span class="plus" aria-hidden="true">+</span>
        </button>
      </li>`
        )
        .join("")
    : `<li class="empty">Everything available is already on today's list.</li>`;

  setPanel(planOpen);
}

function setPanel(open) {
  planOpen = open;
  el("planPanel").classList.toggle("open", open);
  el("scrim").classList.toggle("on", open);
  el("planBtn").setAttribute("aria-expanded", String(open));
}

// today's list: toggle done / remove from today
el("todayList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const li = btn.closest(".task");
  const planId = li.dataset.plan;

  if (btn.dataset.act === "toggle") {
    const done = btn.getAttribute("aria-pressed") === "true";
    li.classList.toggle("is-done", !done); // instant feedback, store confirms
    await store.setDone(planId, !done);
  } else {
    await store.unchoose(planId);
  }
});

// plan panel: add to today
el("planList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  const personId = location.hash.match(/^#\/p\/([^/]+)/)[1];
  btn.classList.add("added");
  await store.choose(today(), personId, btn.dataset.add);
});

el("planBtn").addEventListener("click", () => setPanel(!planOpen));
el("scrim").addEventListener("click", () => setPanel(false));

el("back").addEventListener("click", () => { location.hash = ""; });

// ---------- auth gate ----------

function showLogin(show) {
  el("login").hidden = !show;
  el("app").hidden = show;
}

async function start() {
  el("version").textContent = `v${APP_VERSION}${USE_LOCAL ? " · local" : ""}`;

  if (USE_LOCAL) {
    showLogin(false);
    route();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showLogin(false);
    route();
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
  route();
});

start();
