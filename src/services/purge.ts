import type Database from "better-sqlite3";

const ORPHAN_USER_TTL_MS = 60 * 60 * 1000;

export function purgeExpired(db: Database.Database): void {
  const nowIso = new Date().toISOString();
  const orphanCutoffIso = new Date(Date.now() - ORPHAN_USER_TTL_MS).toISOString();

  db.transaction(() => {
    db.prepare("DELETE FROM invitations WHERE expires_at < ?").run(nowIso);
    db.prepare("DELETE FROM device_link_tokens WHERE expires_at < ?").run(nowIso);
    db.prepare("DELETE FROM webauthn_challenges WHERE expires_at < ?").run(nowIso);
    db.prepare(
      `DELETE FROM invitations WHERE consumed_by_user_id IN (
        SELECT id FROM users WHERE created_at < ? AND id NOT IN (SELECT user_id FROM credentials)
      )`,
    ).run(orphanCutoffIso);
    db.prepare(
      "DELETE FROM users WHERE created_at < ? AND id NOT IN (SELECT user_id FROM credentials)",
    ).run(orphanCutoffIso);
  })();
}
