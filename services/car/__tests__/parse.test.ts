import {parseCarPlayRequest, parseCarTransport} from '../parse';

describe('parse', () => {
  it('parses a surah request', () => {
    expect(
      parseCarPlayRequest(
        '{"kind":"surah","reciterId":"r","rewayatId":"w","surahId":18}',
      ),
    ).toEqual({
      kind: 'surah',
      reciterId: 'r',
      rewayatId: 'w',
      surahId: 18,
      startAt: undefined,
    });
  });
  it('rejects malformed json and unknown kinds', () => {
    expect(parseCarPlayRequest('{')).toBeNull();
    expect(parseCarPlayRequest('{"kind":"x"}')).toBeNull();
    expect(parseCarPlayRequest('{"kind":"surah","reciterId":"r"}')).toBeNull();
  });
  it('parses transports', () => {
    expect(parseCarTransport('{"kind":"next"}')).toEqual({kind: 'next'});
    expect(parseCarTransport('{"kind":"seek","position":12}')).toEqual({
      kind: 'seek',
      position: 12,
    });
    expect(parseCarTransport('{"kind":"seek"}')).toBeNull();
  });
});
