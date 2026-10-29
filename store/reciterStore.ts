import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {persistStorage} from '@/utils/storage'; // @ai
import {Reciter} from '@/data/reciterData';
import {RECITERS} from '@/data/reciterData';
import {HAFS_REWAYAT_NAME} from '@/data/rewayat';

// Helper function to get the Hafs A'n Assem rewayat from a reciter
function getHafsRewayat(reciter: Reciter) {
  return reciter.rewayat.find(r => r.name === HAFS_REWAYAT_NAME);
}

// @ai-start
/** The reciter a new install starts with. */
const BUILT_IN_DEFAULT_RECITER_NAME = 'Mishary Alafasi';

// RECITERS is empty on first launch before API data loads, so the store starts
// with this placeholder until the catalog arrives.
const EMPTY_RECITER: Reciter = {
  id: '',
  name: '',
  date: null,
  image_url: null,
  rewayat: [],
};

// Ensure the default rewayat is Hafs if available
function withHafsFirst(reciter: Reciter): Reciter {
  const hafsRewayat = getHafsRewayat(reciter);
  if (!hafsRewayat) return reciter;
  return {
    ...reciter,
    rewayat: [
      hafsRewayat,
      ...reciter.rewayat.filter(r => r.id !== hafsRewayat.id),
    ],
  };
}

/**
 * The default reciter, read from the current catalog: the saved choice when it
 * is still in the catalog, otherwise the built-in default, otherwise any Hafs
 * reciter. Reading the saved choice from the catalog keeps its audio URLs
 * current. Returns null while the catalog is empty.
 */
export function resolveDefaultReciter(savedId?: string): Reciter | null {
  if (RECITERS.length === 0) return null;
  const hasHafs = (reciter: Reciter) => Boolean(getHafsRewayat(reciter));
  const reciter =
    (savedId && RECITERS.find(r => r.id === savedId)) ||
    RECITERS.find(
      r => r.name === BUILT_IN_DEFAULT_RECITER_NAME && hasHafs(r),
    ) ||
    RECITERS.find(hasHafs) ||
    RECITERS[0];
  return withHafsFirst(reciter);
}

// Until the saved choice has been read from storage, the store only holds the
// placeholder. Resolving then would pick the built-in default and persist it
// over the saved choice, so refreshDefaultReciter waits for this.
let hydrationSettled = false;
// @ai-end

interface ReciterState {
  defaultReciter: Reciter;
  isInitialized: boolean;
  setDefaultReciter: (reciter: Reciter) => void;
  refreshDefaultReciter: () => void;
}

export const useReciterStore = create<ReciterState>()(
  persist(
    (set, get) => ({
      defaultReciter: EMPTY_RECITER,
      isInitialized: false,
      // @ai-start
      // Called once the catalog loads and again once storage is read. Keeps
      // the saved choice; only an empty or unknown id falls back.
      refreshDefaultReciter: () => {
        if (!hydrationSettled) return;
        const reciter = resolveDefaultReciter(get().defaultReciter?.id);
        if (reciter) set({defaultReciter: reciter});
      },
      // @ai-end
      setDefaultReciter: reciter => {
        // When setting a new default reciter, ensure Hafs is the first rewayat if available
        set({defaultReciter: withHafsFirst(reciter)});
      },
    }),
    {
      name: 'reciter-storage',
      partialize: state => ({defaultReciter: state.defaultReciter}),
      storage: persistStorage(), // @ai
      // @ai-start
      // Runs after hydration succeeds or fails. The outer argument is the
      // pre-hydration state, whose actions read the live state through get().
      onRehydrateStorage: initialState => () => {
        hydrationSettled = true;
        initialState.refreshDefaultReciter();
      },
      // @ai-end
    },
  ),
);
