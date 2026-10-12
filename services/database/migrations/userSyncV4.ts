import {withRetryableQfSyncTransaction as withQfSyncTransaction} from '@/services/sync/qfSqliteRetry';
import {type QfSyncTransactionDatabase} from '@/services/sync/qfSyncTransaction';

export const USER_SYNC_V4_VERSION = 'user_sync_v4';

/**
 * Additive only: records which pulled QF bookmarks are also in a custom
 * collection, keyed by QF's composite membership id "<collectionId>-<bookmarkId>".
 */
export async function migrateUserSyncV4(
  db: QfSyncTransactionDatabase,
): Promise<void> {
  await withQfSyncTransaction(db, async txn => {
    const existing = await txn.getFirstAsync(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [USER_SYNC_V4_VERSION],
    );
    if (existing) return;
    await txn.runAsync(`CREATE TABLE qf_collection_bookmarks (
      owner_scope TEXT NOT NULL,
      membership_id TEXT NOT NULL,
      bookmark_id TEXT NOT NULL,
      server_updated_at INTEGER NOT NULL,
      PRIMARY KEY (owner_scope, membership_id)
    )`);
    await txn.runAsync(`CREATE INDEX idx_qf_collection_bookmarks_owner_bookmark
      ON qf_collection_bookmarks(owner_scope, bookmark_id)`);
    await txn.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [USER_SYNC_V4_VERSION, Date.now()],
    );
  });
}
