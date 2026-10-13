// Analytics events raised by widget actions while the app was not running.

export interface AdhkarSessionCompletedEvent {
  name: 'adhkar_session_completed';
  props: {category: string; duration_ms: number; dhikr_count: number};
}

export type PendingWidgetEvent = AdhkarSessionCompletedEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAdhkarSessionCompleted(
  value: unknown,
): value is AdhkarSessionCompletedEvent {
  if (!isRecord(value) || value.name !== 'adhkar_session_completed') {
    return false;
  }
  const props = value.props;
  return (
    isRecord(props) &&
    typeof props.category === 'string' &&
    typeof props.duration_ms === 'number' &&
    typeof props.dhikr_count === 'number'
  );
}

export function parsePendingWidgetEvents(
  json: string | null,
): PendingWidgetEvent[] {
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: unknown[] = parsed;
  return items.filter(isAdhkarSessionCompleted);
}
