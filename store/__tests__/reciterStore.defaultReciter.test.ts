// @ai-generated
// The default reciter must survive a restart, and new installs start with
// Mishary Alafasi.
import type {Reciter} from '@/data/reciterData';

const mockStorage = new Map<string, string>();
let mockReadError: Error | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => {
    if (mockReadError) throw mockReadError;
    return mockStorage.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    mockStorage.delete(key);
  },
}));

function reciter(id: string, name: string, rewayahNames: string[]): Reciter {
  return {
    id,
    name,
    date: null,
    image_url: null,
    rewayat: rewayahNames.map((rewayah, i) => ({
      id: `${id}-r${i}`,
      reciter_id: id,
      name: rewayah,
      style: 'murattal',
      server: `https://example.com/${id}/${i}/`,
      surah_total: 114,
      surah_list: [1],
      source_type: 'mp3quran',
      created_at: '2026-01-01',
    })),
  };
}

const MISHARY = reciter('mishary', 'Mishary Alafasi', [
  "AlDorai A'n Al-Kisa'ai",
  "Hafs A'n Assem",
]);
const NOREEN = reciter('noreen', 'Noreen Mohammad Siddiq', [
  "Aldori A'n Abi Amr",
]);
const SUDAIS = reciter('sudais', 'Abdulrahman Alsudaes', [
  "Warsh A'n Nafi'",
  "Hafs A'n Assem",
]);
const CATALOG = [NOREEN, SUDAIS, MISHARY];

type Loaded = {
  store: typeof import('../reciterStore').useReciterStore;
  RECITERS: Reciter[];
};

/** A fresh app launch: new module instances reading the same storage. */
function launch(): Loaded {
  let loaded!: Loaded;
  jest.isolateModules(() => {
    loaded = {
      store: require('../reciterStore').useReciterStore,
      RECITERS: require('@/data/reciterData').RECITERS,
    };
  });
  return loaded;
}

/** What dataService.populateReciters does once the catalog loads. */
function loadCatalog({store, RECITERS}: Loaded, catalog = CATALOG) {
  RECITERS.splice(0, RECITERS.length, ...catalog);
  store.getState().refreshDefaultReciter();
  store.setState({isInitialized: true});
}

async function hydrated(loaded: Loaded) {
  await loaded.store.persist.rehydrate();
  return loaded;
}

function savedId(): string | undefined {
  const raw = mockStorage.get('reciter-storage');
  return raw ? JSON.parse(raw).state.defaultReciter.id : undefined;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => mockStorage.clear());

it('starts a new install with Mishary Alafasi, Hafs first', async () => {
  const app = await hydrated(launch());
  loadCatalog(app);
  const current = app.store.getState().defaultReciter;
  expect(current.id).toBe('mishary');
  expect(current.rewayat[0].name).toBe("Hafs A'n Assem");
});

it('keeps a chosen default reciter across a restart', async () => {
  const first = await hydrated(launch());
  loadCatalog(first);
  first.store.getState().setDefaultReciter(SUDAIS);
  await flush();

  const second = await hydrated(launch());
  loadCatalog(second);
  expect(second.store.getState().defaultReciter.id).toBe('sudais');
  expect(savedId()).toBe('sudais');
});

it('keeps a saved reciter that has no Hafs recitation', async () => {
  mockStorage.set(
    'reciter-storage',
    JSON.stringify({state: {defaultReciter: NOREEN}, version: 0}),
  );
  const app = await hydrated(launch());
  loadCatalog(app);
  expect(app.store.getState().defaultReciter.id).toBe('noreen');
});

it('keeps the saved choice when the catalog loads before storage is read', async () => {
  mockStorage.set(
    'reciter-storage',
    JSON.stringify({state: {defaultReciter: SUDAIS}, version: 0}),
  );
  const app = launch();
  // Hydration has started but not finished.
  expect(app.store.persist.hasHydrated()).toBe(false);
  loadCatalog(app);
  await flush();

  expect(app.store.getState().defaultReciter.id).toBe('sudais');
  expect(savedId()).toBe('sudais');
});

it('reads the saved reciter from the current catalog', async () => {
  const stale = {...SUDAIS, name: 'Old name', rewayat: SUDAIS.rewayat};
  mockStorage.set(
    'reciter-storage',
    JSON.stringify({state: {defaultReciter: stale}, version: 0}),
  );
  const app = await hydrated(launch());
  loadCatalog(app);
  const current = app.store.getState().defaultReciter;
  expect(current.name).toBe('Abdulrahman Alsudaes');
  // Hafs is moved first, as when the reciter is picked.
  expect(current.rewayat[0].name).toBe("Hafs A'n Assem");
});

it('falls back to Mishary when the saved reciter left the catalog', async () => {
  const gone = reciter('gone', 'Removed Reciter', ["Hafs A'n Assem"]);
  mockStorage.set(
    'reciter-storage',
    JSON.stringify({state: {defaultReciter: gone}, version: 0}),
  );
  const app = await hydrated(launch());
  loadCatalog(app);
  expect(app.store.getState().defaultReciter.id).toBe('mishary');
});

it('falls back to a Hafs reciter when Mishary is not in the catalog', async () => {
  const app = await hydrated(launch());
  loadCatalog(app, [NOREEN, SUDAIS]);
  expect(app.store.getState().defaultReciter.id).toBe('sudais');
});

it('still resolves a default when storage cannot be read', async () => {
  mockReadError = new Error('read failed');
  const app = launch();
  await flush();
  mockReadError = null;
  loadCatalog(app);
  expect(app.store.getState().defaultReciter.id).toBe('mishary');
});
