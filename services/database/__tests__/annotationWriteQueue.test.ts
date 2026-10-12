// @ai-generated
// applyAnnotationChangesInOwnerScope writes all or none in one transaction. A
// write issued while that transaction is open must not run inside it: there
// it would be undone by the transaction's ROLLBACK.
jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);

type MockModule = typeof import('@/test-utils/mockExpoSqlite');
type Annotations =
  typeof import('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;

const DB_FILE = 'verse-annotations.db';

describe('annotation writes', () => {
  let mock: MockModule;
  let annotations: Annotations;

  beforeEach(async () => {
    jest.resetModules();
    mock = require('@/test-utils/mockExpoSqlite');
    annotations =
      require('../VerseAnnotationDatabaseService').verseAnnotationDatabaseService;
    await annotations.initialize();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await annotations.close();
    await mock.resetDatabases();
  });

  it('a write issued while a change is open waits for it and is kept when it rolls back', async () => {
    const db = await mock.openDatabaseAsync(DB_FILE);
    await annotations.addBookmark('1:1', 1, 1, 'hafs');
    await annotations.addBookmark('8:8', 8, 8, 'hafs');
    await annotations.upsertHighlight('7:7', 7, 7, 'blue', 'hafs');
    const edited = await annotations.addNote('6:6', 6, 6, 'before');
    const deleted = await annotations.addNote('9:9', 9, 9, 'gone');
    // The change's insert fails, so its transaction rolls back.
    await db.execAsync(`
      CREATE TRIGGER fail_insert BEFORE INSERT ON bookmarks
      WHEN new.verse_key = '2:2'
      BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END;
    `);

    // Start the change, then issue one of every other write while it runs.
    // The change is an exclusive transaction on its own connection, so these
    // writes wait for it instead of joining it.
    const change = annotations.applyAnnotationChangesInOwnerScope('guest', {
      removeBookmarks: ['1:1'],
      addBookmarks: [
        {verseKey: '2:2', surahNumber: 2, ayahNumber: 2, rewayahId: 'warsh'},
      ],
    });
    const issued: Promise<unknown>[] = [
      annotations.addNote('3:3', 3, 3, 'kept', undefined, 'warsh'),
      annotations.updateNote(edited.id, 'after'),
      annotations.addBookmark('4:4', 4, 4, 'hafs'),
      annotations.upsertHighlight('5:5', 5, 5, 'green', 'hafs'),
      annotations.removeHighlight('7:7'),
      annotations.removeBookmark('8:8'),
      annotations.deleteNoteById(deleted.id),
    ];
    await expect(change).rejects.toThrow('disk I/O error');
    await Promise.all(issued);

    // The change left nothing; every write issued during it was kept.
    const bookmarks = await annotations.getAllBookmarks();
    expect(bookmarks.map(b => b.verseKey).sort()).toEqual(['1:1', '4:4']);
    const notes = await annotations.getAllNotes();
    expect(
      notes
        .map(n => [n.verseKey, n.content, n.rewayahId ?? null])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['3:3', 'kept', 'warsh'],
      // An omitted rewayah is saved as 'hafs' (user_sync_v1 default).
      ['6:6', 'after', 'hafs'],
    ]);
    const highlights = [
      ...(await annotations.getHighlightsBySurah(5)),
      ...(await annotations.getHighlightsBySurah(7)),
    ];
    expect(highlights.map(h => [h.verseKey, h.color])).toEqual([
      ['5:5', 'green'],
    ]);
  });
});
