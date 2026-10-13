jest.mock('@/services/database/AdhkarDatabaseService', () => ({
  adhkarDatabaseService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    needsReseed: jest.fn().mockResolvedValue(false),
    isDatabaseSeeded: jest.fn().mockResolvedValue(true),
    areSuperCategoriesSeeded: jest.fn().mockResolvedValue(true),
    seedDatabase: jest.fn().mockResolvedValue(undefined),
    seedSuperCategories: jest.fn().mockResolvedValue(undefined),
    updateDataVersion: jest.fn().mockResolvedValue(undefined),
    getSuperCategory: jest.fn(),
    getAllCategories: jest.fn(),
    getAdhkarByIds: jest.fn(),
    getAdhkarByCategoryIds: jest.fn(),
  },
}));
import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import {adhkarService} from '../AdhkarService';
import type {AdhkarCategory, Dhikr, SuperCategory} from '@/types/adhkar';

function dhikr(id: string, categoryId: string): Dhikr {
  return {
    id,
    categoryId,
    arabic: id,
    translation: null,
    transliteration: null,
    instruction: null,
    repeatCount: 1,
    audioFile: null,
    sortOrder: 0,
  };
}

function superCategory(dhikrIds: string[] | null): SuperCategory {
  return {
    id: 'evening-adhkar',
    title: 'Evening',
    arabicTitle: null,
    color: '#4F46E5',
    heightMultiplier: 1,
    column: 'right',
    sortOrder: 1,
    section: 'main',
    categoryIds: ['27'],
    dhikrIds,
  };
}

const categories: AdhkarCategory[] = [
  {id: '27', title: 'Morning and evening', dhikrCount: 3, broadTags: []},
  {id: '28', title: 'Before sleeping', dhikrCount: 1, broadTags: []},
];

describe('getAdhkarForSuperCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(adhkarDatabaseService.getAllCategories)
      .mockResolvedValue(categories);
  });

  it('follows the explicit list order and groups consecutive categories', async () => {
    jest
      .mocked(adhkarDatabaseService.getSuperCategory)
      .mockResolvedValue(superCategory(['75', 'evening-77', '106', '97']));
    jest
      .mocked(adhkarDatabaseService.getAdhkarByIds)
      .mockResolvedValue([
        dhikr('75', '27'),
        dhikr('evening-77', '27'),
        dhikr('106', '28'),
        dhikr('97', '27'),
      ]);
    const result = await adhkarService.getAdhkarForSuperCategory(
      'evening-adhkar',
    );
    expect(adhkarDatabaseService.getAdhkarByIds).toHaveBeenCalledWith([
      '75',
      'evening-77',
      '106',
      '97',
    ]);
    expect(
      result?.categoryGroups.map(g => [g.categoryId, g.adhkar.map(d => d.id)]),
    ).toEqual([
      ['27', ['75', 'evening-77']],
      ['28', ['106']],
      ['27', ['97']],
    ]);
    expect(adhkarDatabaseService.getAdhkarByCategoryIds).not.toHaveBeenCalled();
  });

  it('falls back to category membership when there is no list', async () => {
    jest
      .mocked(adhkarDatabaseService.getSuperCategory)
      .mockResolvedValue(superCategory(null));
    jest
      .mocked(adhkarDatabaseService.getAdhkarByCategoryIds)
      .mockResolvedValue([dhikr('75', '27'), dhikr('76', '27')]);
    const result = await adhkarService.getAdhkarForSuperCategory(
      'evening-adhkar',
    );
    expect(result?.categoryGroups).toEqual([
      {
        categoryId: '27',
        categoryTitle: 'Morning and evening',
        adhkar: [dhikr('75', '27'), dhikr('76', '27')],
      },
    ]);
  });
});
