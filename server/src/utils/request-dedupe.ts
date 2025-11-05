// Request deduplication to prevent duplicate bids and race conditions
const pendingRequests = new Map<string, Promise<any>>();

export function dedupeRequest<T>(
  key: string,
  handler: () => Promise<T>,
  ttl: number = 2000 // 2 second window
): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = handler().finally(() => {
    // Remove after TTL
    setTimeout(() => {
      pendingRequests.delete(key);
    }, ttl);
  });

  pendingRequests.set(key, promise);
  return promise;
}

export function clearPendingRequest(key: string) {
  pendingRequests.delete(key);
}
