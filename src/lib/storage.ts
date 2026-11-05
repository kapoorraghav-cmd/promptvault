export interface StorageInfo {
  supported: boolean
  usage: number
  quota: number
  persisted: boolean | null
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!storage?.estimate) return { supported: false, usage: 0, quota: 0, persisted: null }
  try {
    const [estimate, persisted] = await Promise.all([
      storage.estimate(),
      storage.persisted ? storage.persisted() : Promise.resolve(null),
    ])
    return { supported: true, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted }
  } catch {
    return { supported: false, usage: 0, quota: 0, persisted: null }
  }
}

/**
 * Asks the browser not to clear PromptVault's data automatically when the
 * device is low on space. Browsers may decline; data is still saved either way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Returns a warning if saving `incomingBytes` would come close to the browser's limit. */
export async function checkSpaceFor(incomingBytes: number): Promise<string | null> {
  const info = await getStorageInfo()
  if (!info.supported || !info.quota) return null
  const remaining = info.quota - info.usage
  if (incomingBytes > remaining) {
    return 'There isn’t enough browser storage left for these files. Remove some items or images, or export a backup and clear old items.'
  }
  return null
}
