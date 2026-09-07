import { format, formatDistanceToNow } from 'date-fns';

export function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTimestamp(ts: number): string {
  return format(new Date(ts), 'dd MMM yyyy, HH:mm:ss');
}

export function formatRelativeTime(ts: number): string {
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatFps(fps: number): string {
  return `${fps.toFixed(0)} fps`;
}

export function truncateId(id: string, chars = 8): string {
  return id.slice(-chars).toUpperCase();
}
