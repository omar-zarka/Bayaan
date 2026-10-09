import {quranLinkParams} from '../quranLink';

describe('quranLinkParams', () => {
  const pageFor = (key: string): number | undefined =>
    key === '18:10' ? 294 : undefined;

  it('opens the page that holds the ayah', () => {
    expect(quranLinkParams('18', '10', pageFor)).toEqual({
      surah: '18',
      ayah: '10',
      page: '294',
    });
  });

  it('falls back to the surah when the ayah has no known page', () => {
    expect(quranLinkParams('18', '999', pageFor)).toEqual({
      surah: '18',
      ayah: '999',
    });
  });

  it('passes only the surah when no ayah is given', () => {
    expect(quranLinkParams('18', undefined, pageFor)).toEqual({surah: '18'});
  });
});
