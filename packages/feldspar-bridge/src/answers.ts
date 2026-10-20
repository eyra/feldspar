// The host's answers to a donation. Next sends one of these back over the MessageChannel
// for every CommandSystemDonate, matched by key.
export interface DonateSuccess {
  readonly __type__: 'DonateSuccess'
  readonly key: string
  readonly status: number
}

export interface DonateError {
  readonly __type__: 'DonateError'
  readonly key: string
  // 0 for a network error.
  readonly status: number
  readonly error: string
}

// What HostBridge.send resolves with for a donation.
export interface ResponseSystemDonate {
  readonly success: boolean
  readonly key: string
  readonly status: number
  readonly error?: string
}

// DonateSuccess has a key and a status, DonateError also an error text. Anything else
// (missing or mistyped fields) is not an answer.
export function isDonateAnswer (data: unknown): data is DonateSuccess | DonateError {
  if (typeof data !== 'object' || data === null) return false
  const { __type__, key, status, error } = data as Record<string, unknown>
  if (typeof key !== 'string' || typeof status !== 'number') return false
  return __type__ === 'DonateSuccess' || (__type__ === 'DonateError' && typeof error === 'string')
}
