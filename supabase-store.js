// Implements the same interface as LocalStore, backed by Supabase.
// Every method returns a Promise and the same row shapes, so app.js
// cannot tell the two apart.

const ok = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export class SupabaseStore {
  constructor(client) {
    this.sb = client;
  }

  async listPeople() {
    return ok(
      await this.sb.from("person").select("*").order("sort_order")
    );
  }

  async listTasks(personId) {
    let q = this.sb.from("task").select("*").eq("active", true);
    if (personId) q = q.eq("person_id", personId);
    return ok(await q);
  }

  async createTask(t) {
    return ok(
      await this.sb.from("task").insert(t).select().single()
    );
  }

  async updateTask(id, patch) {
    return ok(
      await this.sb.from("task").update(patch).eq("id", id).select().single()
    );
  }

  async deleteTask(id) {
    // day_plan rows cascade via the foreign key
    ok(await this.sb.from("task").delete().eq("id", id));
  }

  async listDayPlan(day, personId) {
    let q = this.sb.from("day_plan").select("*").eq("day", day);
    if (personId) q = q.eq("person_id", personId);
    return ok(await q);
  }

  async choose(day, personId, taskId) {
    // unique (day, task_id) makes this idempotent — tapping twice is harmless
    return ok(
      await this.sb
        .from("day_plan")
        .upsert(
          { day, person_id: personId, task_id: taskId },
          { onConflict: "day,task_id", ignoreDuplicates: false }
        )
        .select()
        .single()
    );
  }

  async unchoose(planId) {
    ok(await this.sb.from("day_plan").delete().eq("id", planId));
  }

  async setDone(planId, done) {
    return ok(
      await this.sb
        .from("day_plan")
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq("id", planId)
        .select()
        .single()
    );
  }

  async history(personId, fromDay, toDay) {
    return ok(
      await this.sb
        .from("day_plan")
        .select("*")
        .eq("person_id", personId)
        .gte("day", fromDay)
        .lte("day", toDay)
        .order("day")
    );
  }

  // ---- collections ----

  async listCollections(personId) {
    let q = this.sb
      .from("collection")
      .select("*, collection_task(task_id)")
      .order("sort_order");
    if (personId) q = q.eq("person_id", personId);
    const rows = ok(await q);
    return rows.map((c) => ({
      id: c.id,
      person_id: c.person_id,
      name: c.name,
      sort_order: c.sort_order,
      task_ids: (c.collection_task || []).map((x) => x.task_id),
    }));
  }

  async createCollection(personId, name) {
    const existing = ok(
      await this.sb.from("collection").select("id").eq("person_id", personId)
    );
    const row = ok(
      await this.sb
        .from("collection")
        .insert({ person_id: personId, name, sort_order: existing.length })
        .select()
        .single()
    );
    return { ...row, task_ids: [] };
  }

  async renameCollection(id, name) {
    return ok(
      await this.sb.from("collection").update({ name }).eq("id", id).select().single()
    );
  }

  async deleteCollection(id) {
    // collection_task rows cascade via the foreign key
    ok(await this.sb.from("collection").delete().eq("id", id));
  }

  async setCollectionTasks(id, taskIds) {
    ok(await this.sb.from("collection_task").delete().eq("collection_id", id));
    if (!taskIds.length) return;
    ok(
      await this.sb
        .from("collection_task")
        .insert(taskIds.map((task_id) => ({ collection_id: id, task_id })))
    );
  }

  async applyCollection(day, personId, collectionId) {
    const links = ok(
      await this.sb
        .from("collection_task")
        .select("task_id")
        .eq("collection_id", collectionId)
    );
    if (!links.length) return;
    // one round trip; unique (day, task_id) keeps it idempotent
    ok(
      await this.sb.from("day_plan").upsert(
        links.map((l) => ({ day, person_id: personId, task_id: l.task_id })),
        { onConflict: "day,task_id", ignoreDuplicates: true }
      )
    );
  }

  subscribe(cb) {
    const ch = this.sb
      .channel("board")
      .on("postgres_changes", { event: "*", schema: "public", table: "day_plan" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "task" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "collection" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "collection_task" }, cb)
      .subscribe();
    return () => this.sb.removeChannel(ch);
  }
}
