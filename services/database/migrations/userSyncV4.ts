import {withRetryableQfSyncTransaction as withQfSyncTransaction} from '@/services/sync/qfSqliteRetry';
import {type QfSyncTransactionDatabase} from '@/services/sync/qfSyncTransaction';

export const USER_SYNC_V4_VERSION = 'user_sync_v4';

/** Additive: the last synced highlights document of each surah per account. */
export async function migrateUserSyncV4(
  db: QfSyncTransactionDatabase,
): Promise<void> {
  await withQfSyncTransaction(db, async txn => {
    const existing = await txn.getFirstAsync(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [USER_SYNC_V4_VERSION],
    );
    if (existing) return;
    await txn.runAsync(`CREATE TABLE qf_highlight_sync (
      owner_scope TEXT NOT NULL,
      surah_number INTEGER NOT NULL,
      etag TEXT NOT NULL,
      entries_json TEXT NOT NULL,
      PRIMARY KEY (owner_scope, surah_number)
    )`);
    await txn.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [USER_SYNC_V4_VERSION, Date.now()],
    );
  });
}
