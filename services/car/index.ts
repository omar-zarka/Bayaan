import {startCarSnapshotService} from './CarSnapshotService';
import {startCarPlaybackBridge} from './CarPlaybackBridge';

export function startCarIntegration(): () => void {
  const stopSnapshot = startCarSnapshotService();
  const stopBridge = startCarPlaybackBridge();
  return () => {
    stopBridge();
    stopSnapshot();
  };
}
