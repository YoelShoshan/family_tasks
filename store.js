// ---- Storage interface ----
// Every method returns a Promise. Both backends implement this exactly.
//
//   listPeople()                       -> [ {id, name, color, sort_order} ]
//   listTasks(personId)                -> [ {id, person_id, title, kind, weekdays, tags, active} ]
//   createTask(t)                      -> task
//   updateTask(id, patch)              -> task
//   deleteTask(id)                     -> void
//   listDayPlan(day, personId?)        -> [ {id, day, person_id, task_id, chosen_at, done_at} ]
//   choose(day, personId, taskId)      -> plan row
//   unchoose(planId)                   -> void
//   setDone(planId, done)              -> plan row
//   history(personId, fromDay, toDay)  -> [ plan rows ]
//   subscribe(cb)                      -> unsubscribe fn   (cb fires on any change)

const uid = () => crypto.randomUUID();
const clone = (x) => JSON.parse(JSON.stringify(x));

const SEED = {
  person: [
    { id: uid(), name: "Yoel", color: "#2563eb", sort_order: 0 },
    { id: uid(), name: "Alex", color: "#16a34a", sort_order: 1 },
    { id: uid(), name: "Sam",  color: "#db2777", sort_order: 2 },
  ],
  task: [],
  day_plan: [],
};

// give the seed people a few tasks
(() => {
  const [a, b, c] = SEED.person;
  const mk = (p, title, kind, weekdays = null, tags = []) =>
    SEED.task.push({ id: uid(), person_id: p.id, title, kind, weekdays, tags, active: true });
  mk(a, "Swim", "recurring", [0, 2, 4], ["sport"]);
  mk(a, "Read 20 min", "recurring", null, ["quiet"]);
  mk(a, "Fix the shelf", "general", null, ["home"]);
  mk(b, "Practice guitar", "recurring", null, ["music"]);
  mk(b, "Homework", "recurring", [0, 1, 2, 3, 4], ["school"]);
  mk(b, "Clear the desk", "general", null, ["home"]);
  mk(c, "Tidy room", "recurring", null, ["home"]);
  mk(c, "Water plants", "recurring", [1, 4], ["home"]);
})();

export class LocalStore {
  constructor(key = "familyboard") {
    this.key = key;
    const raw = localStorage.getItem(key);
    this.db = raw ? JSON.parse(raw) : clone(SEED);
    this.listeners = new Set();
  }

  _save() {
    localStorage.setItem(this.key, JSON.stringify(this.db));
    this.listeners.forEach((cb) => cb());
  }

  async listPeople() {
    return clone(this.db.person).sort((x, y) => x.sort_order - y.sort_order);
  }

  async listTasks(personId) {
    return clone(this.db.task).filter(
      (t) => t.active && (!personId || t.person_id === personId)
    );
  }

  async createTask(t) {
    const row = {
      id: uid(),
      weekdays: null,
      tags: [],
      active: true,
      created_at: new Date().toISOString(),
      ...t,
    };
    this.db.task.push(row);
    this._save();
    return clone(row);
  }

  async updateTask(id, patch) {
    const row = this.db.task.find((t) => t.id === id);
    Object.assign(row, patch);
    this._save();
    return clone(row);
  }

  async deleteTask(id) {
    this.db.task = this.db.task.filter((t) => t.id !== id);
    this.db.day_plan = this.db.day_plan.filter((p) => p.task_id !== id);
    this._save();
  }

  async listDayPlan(day, personId) {
    return clone(this.db.day_plan).filter(
      (p) => p.day === day && (!personId || p.person_id === personId)
    );
  }

  async choose(day, personId, taskId) {
    const existing = this.db.day_plan.find((p) => p.day === day && p.task_id === taskId);
    if (existing) return clone(existing);
    const row = {
      id: uid(),
      day,
      person_id: personId,
      task_id: taskId,
      chosen_at: new Date().toISOString(),
      done_at: null,
    };
    this.db.day_plan.push(row);
    this._save();
    return clone(row);
  }

  async unchoose(planId) {
    this.db.day_plan = this.db.day_plan.filter((p) => p.id !== planId);
    this._save();
  }

  async setDone(planId, done) {
    const row = this.db.day_plan.find((p) => p.id === planId);
    row.done_at = done ? new Date().toISOString() : null;
    this._save();
    return clone(row);
  }

  async history(personId, fromDay, toDay) {
    return clone(this.db.day_plan).filter(
      (p) => p.person_id === personId && p.day >= fromDay && p.day <= toDay
    );
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // dev helper: store.reset() in the console
  reset() {
    this.db = clone(SEED);
    this._save();
  }
}
