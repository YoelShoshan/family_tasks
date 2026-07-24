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
//
//   listCollections(personId)          -> [ {id, person_id, name, sort_order, task_ids:[]} ]
//   createCollection(personId, name)   -> collection
//   renameCollection(id, name)         -> collection
//   deleteCollection(id)               -> void
//   setCollectionTasks(id, taskIds)    -> void
//   applyCollection(day, personId, id) -> void   (adds its tasks to that day)
//
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
  collection: [],
  collection_task: [],
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
    // tables added after this device last saved
    for (const tbl of ["person", "task", "day_plan", "collection", "collection_task"]) {
      if (!Array.isArray(this.db[tbl])) this.db[tbl] = [];
    }
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

  // ---- collections ----

  async listCollections(personId) {
    const cols = this.db.collection
      .filter((c) => !personId || c.person_id === personId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    return cols.map((c) => ({
      ...clone(c),
      task_ids: this.db.collection_task
        .filter((ct) => ct.collection_id === c.id)
        .map((ct) => ct.task_id),
    }));
  }

  async createCollection(personId, name) {
    const row = {
      id: uid(),
      person_id: personId,
      name,
      sort_order: this.db.collection.filter((c) => c.person_id === personId).length,
      created_at: new Date().toISOString(),
    };
    this.db.collection.push(row);
    this._save();
    return { ...clone(row), task_ids: [] };
  }

  async renameCollection(id, name) {
    const row = this.db.collection.find((c) => c.id === id);
    row.name = name;
    this._save();
    return clone(row);
  }

  async deleteCollection(id) {
    this.db.collection = this.db.collection.filter((c) => c.id !== id);
    this.db.collection_task = this.db.collection_task.filter((ct) => ct.collection_id !== id);
    this._save();
  }

  async setCollectionTasks(id, taskIds) {
    this.db.collection_task = this.db.collection_task.filter((ct) => ct.collection_id !== id);
    taskIds.forEach((task_id) =>
      this.db.collection_task.push({ collection_id: id, task_id })
    );
    this._save();
  }

  async applyCollection(day, personId, collectionId) {
    const ids = this.db.collection_task
      .filter((ct) => ct.collection_id === collectionId)
      .map((ct) => ct.task_id);
    for (const taskId of ids) await this.choose(day, personId, taskId);
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
