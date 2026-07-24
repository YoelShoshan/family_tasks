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

  subscribe(cb) {
    const ch = this.sb
      .channel("board")
      .on("postgres_changes", { event: "*", schema: "public", table: "day_plan" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "task" }, cb)
      .subscribe();
    return () => this.sb.removeChannel(ch);
  }
}
