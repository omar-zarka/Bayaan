import {parsePendingWidgetEvents} from '../widgetEvents';

describe('parsePendingWidgetEvents', () => {
  it('parses completed sessions', () => {
    const json = JSON.stringify([
      {
        name: 'adhkar_session_completed',
        props: {category: 'morning-adhkar', duration_ms: 1200, dhikr_count: 24},
      },
    ]);
    expect(parsePendingWidgetEvents(json)).toEqual([
      {
        name: 'adhkar_session_completed',
        props: {category: 'morning-adhkar', duration_ms: 1200, dhikr_count: 24},
      },
    ]);
  });
  it('returns [] for junk', () => {
    expect(parsePendingWidgetEvents('nope')).toEqual([]);
    expect(parsePendingWidgetEvents(null)).toEqual([]);
    expect(parsePendingWidgetEvents('{}')).toEqual([]);
  });
  it('drops unknown names and bad props', () => {
    const json = JSON.stringify([
      {name: 'other', props: {}},
      {
        name: 'adhkar_session_completed',
        props: {category: 1, duration_ms: 1, dhikr_count: 1},
      },
    ]);
    expect(parsePendingWidgetEvents(json)).toEqual([]);
  });
});
