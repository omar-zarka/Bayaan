jest.mock(
  'expo-sqlite',
  () => require('@/test-utils/mockExpoSqlite').expoSqliteModule,
);
import {openDatabaseAsync, resetDatabases} from '@/test-utils/mockExpoSqlite';
import {adhkarDatabaseService} from '../AdhkarDatabaseService';
import type {AdhkarSeedData} from '@/types/adhkar';

function row(id: string, orderIndex: number): AdhkarSeedData['adhkar'][number] {
  return {
    id,
    category_id: '27',
    arabic: `((${id}))`,
    translation: null,
    transliteration: null,
    instruction: null,
    repeat_count: 1,
    audio_file: null,
    order_index: orderIndex,
  };
}

const seed: AdhkarSeedData = {
  categories: [
    {
      id: '27',
      title: 'Words of remembrance for morning and evening',
      broad_tags: ['daily'],
      dhikr_count: 3,
    },
  ],
  adhkar: [row('1', 0), row('2', 1), row('evening-1', 2)],
};

afterEach(async () => {
  await adhkarDatabaseService.close();
  await resetDatabases();
});

describe('super category dhikr lists', () => {
  it('stores an ordered list per super category and null elsewhere', async () => {
    await adhkarDatabaseService.initialize();
    await adhkarDatabaseService.seedDatabase(seed);
    await adhkarDatabaseService.seedSuperCategories({
      'evening-adhkar': ['evening-1', '1'],
    });
    const evening = await adhkarDatabaseService.getSuperCategory(
      'evening-adhkar',
    );
    expect(evening?.dhikrIds).toEqual(['evening-1', '1']);
    const morning = await adhkarDatabaseService.getSuperCategory(
      'morning-adhkar',
    );
    expect(morning?.dhikrIds).toBeNull();
    const all = await adhkarDatabaseService.getAllSuperCategories();
    expect(all.find(s => s.id === 'evening-adhkar')?.dhikrIds).toEqual([
      'evening-1',
      '1',
    ]);
    const main = await adhkarDatabaseService.getSuperCategoriesBySection(
      'main',
    );
    expect(main.find(s => s.id === 'salah')?.dhikrIds).toBeNull();
  });

  it('returns adhkar in the requested order and skips unknown ids', async () => {
    await adhkarDatabaseService.initialize();
    await adhkarDatabaseService.seedDatabase(seed);
    const adhkar = await adhkarDatabaseService.getAdhkarByIds([
      'evening-1',
      'missing',
      '1',
    ]);
    expect(adhkar.map(d => d.id)).toEqual(['evening-1', '1']);
    expect(await adhkarDatabaseService.getAdhkarByIds([])).toEqual([]);
  });

  it('adds dhikr_ids to a super_categories table created before version 6', async () => {
    const db = await openDatabaseAsync('adhkar.db');
    await db.execAsync(`
      CREATE TABLE super_categories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        arabic_title TEXT,
        color TEXT NOT NULL,
        height_multiplier REAL DEFAULT 1,
        column TEXT DEFAULT 'left',
        sort_order INTEGER DEFAULT 0,
        section TEXT DEFAULT 'main',
        category_ids TEXT NOT NULL
      );
      INSERT INTO super_categories (id, title, color, category_ids)
      VALUES ('morning-adhkar', 'Morning', '#F59E0B', '["27"]');
    `);
    await adhkarDatabaseService.initialize();
    const columns = await db.getAllAsync<{name: string}>(
      'PRAGMA table_info(super_categories)',
    );
    expect(columns.map(c => c.name)).toContain('dhikr_ids');
    const morning = await adhkarDatabaseService.getSuperCategory(
      'morning-adhkar',
    );
    expect(morning?.categoryIds).toEqual(['27']);
    expect(morning?.dhikrIds).toBeNull();
  });
});
