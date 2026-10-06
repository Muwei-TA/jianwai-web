import { ApiError } from "../api";
/** Each write is serialized against the last acknowledged server revision. Current input is never replaced by a response. */
export class SaveQueue<T> {
  revision: number;
  current: T;
  saved: T;
  dirty = false;
  blocked = false;
  saving = false;
  private generation = 0;
  private pending: Promise<void> | null = null;
  constructor(
    initial: T,
    revision: number,
    private persist: (
      value: T,
      revision: number,
    ) => Promise<{ revision: number }>,
    private notify: () => void = () => {},
  ) {
    this.current = structuredClone(initial);
    this.saved = structuredClone(initial);
    this.revision = revision;
  }
  update(value: T) {
    this.current = structuredClone(value);
    this.generation++;
    this.dirty = true;
    this.notify();
  }
  save(): Promise<void> {
    const run = async () => {
      if (this.blocked)
        throw new ApiError(
          409,
          "STALE_DRAFT",
          "云端有更新版本，请先导出备份，再明确重新载入。",
        );
      if (!this.dirty) return;
      const value = structuredClone(this.current),
        generation = this.generation;
      this.saving = true;
      this.notify();
      try {
        const result = await this.persist(value, this.revision);
        this.revision = result.revision;
        this.saved = value;
        if (generation === this.generation) this.dirty = false;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409)
          this.blocked = true;
        throw error;
      } finally {
        this.saving = false;
        this.notify();
      }
    };
    const operation = this.pending
      ? this.pending.catch(() => {}).then(run)
      : run();
    this.pending = operation;
    void operation
      .finally(() => {
        if (this.pending === operation) this.pending = null;
      })
      .catch(() => {});
    return operation;
  }
  async flush() {
    await this.save();
    while (this.dirty && !this.blocked) await this.save();
  }
  backup() {
    return JSON.stringify(
      { revision: this.revision, ...this.current },
      null,
      2,
    );
  }
}
