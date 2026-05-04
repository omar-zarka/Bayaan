import {RECITERS} from './reciterData';
import {CatalogProvider} from '@/types/CatalogProvider';

export const defaultCatalogProvider: CatalogProvider = {
  getAllReciters: () => RECITERS,
  getReciterById: id => RECITERS.find(r => r.id === id),
};
