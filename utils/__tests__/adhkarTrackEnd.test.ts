import {isTrackFinished, minimumPlayTimeMs} from '../adhkarTrackEnd';

describe('minimumPlayTimeMs', () => {
  it('waits 2 s for long or unknown tracks and half the length of short ones', () => {
    expect(minimumPlayTimeMs(30)).toBe(2000);
    expect(minimumPlayTimeMs(0)).toBe(2000);
    expect(minimumPlayTimeMs(1.05)).toBe(525);
    expect(minimumPlayTimeMs(1.93)).toBe(965);
  });
});

describe('isTrackFinished', () => {
  const ended = {
    currentTime: 1.05,
    duration: 1.05,
    playing: false,
    didJustFinish: false,
  };

  it('finishes a 1.05 s clip whose final status arrives at 1.1 s', () => {
    expect(isTrackFinished(ended, 1100)).toBe(true);
  });

  it('ignores a stale ended status right after the track changes', () => {
    expect(isTrackFinished(ended, 100)).toBe(false);
    expect(
      isTrackFinished(
        {currentTime: 30, duration: 30, playing: false, didJustFinish: false},
        1500,
      ),
    ).toBe(false);
  });

  it('accepts didJustFinish even when currentTime lags behind', () => {
    expect(
      isTrackFinished(
        {currentTime: 0.9, duration: 1.05, playing: false, didJustFinish: true},
        1100,
      ),
    ).toBe(true);
  });

  it('does not finish a track that is still playing or paused midway', () => {
    expect(
      isTrackFinished(
        {
          currentTime: 1.05,
          duration: 1.05,
          playing: true,
          didJustFinish: false,
        },
        3000,
      ),
    ).toBe(false);
    expect(
      isTrackFinished(
        {currentTime: 10, duration: 30, playing: false, didJustFinish: false},
        12000,
      ),
    ).toBe(false);
  });
});
