export interface OfflineConfig {
  persistenceEnabled: boolean
  cacheSizeBytes?: number
}

export const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  persistenceEnabled: true,
  cacheSizeBytes: 40 * 1024 * 1024,
}
