/**
 * Push notifications are temporarily disabled while we stabilise the
 * production build.  This stub keeps the call-sites compiling.
 */
export function usePushNotifications(
  _userId: string | undefined,
  _onNotificationTap?: (data: Record<string, string>) => void,
) {
  // no-op
}
