import type {Rewayat} from '@/data/reciterData';

// The CDN serves recitation files as `immutable` for a year, so a replaced file
// needs a new URL to get past HTTP caches. Bump a rewayat's entry whenever its
// files are replaced in place: a number versions every surah of the rewayat, a
// map versions only the surahs it lists.
const AUDIO_FILE_VERSIONS: Record<string, number | Record<number, number>> = {
  // Hasan Saleh, Hafs murattal: 20 surahs had an inverted right channel (silent
  // in mono) and were re-encoded on 2026-10-28/29.
  '65962996-0864-4ef9-9001-932fdc87c8f8': 2,
  // Hafs Al-Fatiha recordings that open without the basmala: a basmala was
  // added at the start on 2026-10-29.
  'f877d4f8-0834-4401-a169-f1435a7dff09': {1: 2}, // abdulaziz-alasiri
  '5b2ffba0-d38c-4e96-9b95-4b5edb58477a': {1: 2}, // abdullah-qarafi
  '5af3ea9b-bfb5-4018-9365-c6daf7827c65': {1: 2}, // abdulmajeed-al-arkani
  'e8c4e00b-b84b-4f1f-982f-09fc155b0d3c': {1: 2}, // abdulmohsin-al-askar
  '319a2586-d93e-4494-9f27-6b3e9f6b654b': {1: 2}, // abdulmohsin-al-obaikan
  '15424ace-0623-4ebb-b08b-ff502e974e52': {1: 2}, // abdulrahman-aljuraydhi
  '0e7944ac-de91-4bc2-a6a1-4976140e7eb7': {1: 2}, // abdulwali-al-arkani
  'bfafeb7e-1cde-491e-b816-6e530fbf34f8': {1: 2}, // ahmad-al-nufais
  '81b8f244-577d-457e-b175-2a79afc0f03b': {1: 2}, // ahmad-talib-bin-humaid
  'a762d292-6fd1-4120-a55a-4c18d289f6e4': {1: 2}, // khaled-al-qahtani
  'd7f42caf-d6ee-4f21-a7c9-4b5c25ccd34a': {1: 2}, // khalid-al-shoraimy
  'acf9420e-a268-4951-abfc-050df35e0f11': {1: 2}, // malik-ahmad
  '887424f7-9146-46db-b144-a8b40a6949cf': {1: 2, 3: 2}, // youssef-edghouch
  '697eddea-178e-4c4b-b3e9-04d381c92d59': {1: 2}, // yusuf-al-aidroos
  // Recordings trimmed of trailing noise after the last ayah, or given a basmala
  // in place of an unrecognised Al-Fatiha intro (2026-10-29).
  '8335b8d3-2589-489e-a472-67f27c7fe128': {2: 2, 5: 2, 6: 2, 9: 2}, // abdulghani-abdullah
  '5f7348eb-e244-49dd-bf76-d4c03ff9b4f4': {36: 2}, // abdullah-fahmi
  'e432c4f8-eaab-4572-8971-95e4f40b3326': {9: 2, 11: 2}, // mohammed-hafas-ali
  '367a93cd-da44-4b2d-b462-9f070c5c5402': {17: 2}, // saidin-abdulrahman
  '61e0357f-9ce6-4922-a3b2-e78c6d9b5771': {6: 2}, // fahad-al-kandari
  '5046099d-1642-4141-85ca-d96750956742': {27: 2}, // fawaz-alkabi
  'e260feb9-fe2d-46ea-99f3-8deeb87eba50': {56: 2}, // hussain-alshaik
  '824d6212-06c3-4e9f-9a74-fd977b69b3de': {1: 2}, // alwaleed-al-shamsan
  'b958d3cf-47b3-4e47-863c-87c81c355e73': {1: 2}, // hamad-al-daghriri
  '6757f5cc-4c08-4268-8906-ed89757e8247': {1: 2}, // othman-al-ansary
  '8c892091-6307-4489-828d-7f255d1d0028': {1: 2}, // umar-muhammad-al-qasim
};

/** Remote URL of one surah's audio file for a rewayat. */
export function audioFileUrl(
  rewayat: Pick<Rewayat, 'id' | 'server'>,
  surah: number | string,
): string {
  const padded = String(surah).padStart(3, '0');
  const entry = AUDIO_FILE_VERSIONS[rewayat.id];
  const version = typeof entry === 'number' ? entry : entry?.[Number(surah)];
  const url = `${rewayat.server}/${padded}.mp3`;
  return version ? `${url}?v=${version}` : url;
}
