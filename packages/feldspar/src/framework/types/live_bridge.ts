export interface LiveInit {
  action: 'live-init'
  locale: string
  liveness?: unknown
}
export function isLiveInit (value: unknown): value is LiveInit {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const init = value as Partial<LiveInit>
  return init.action === 'live-init' &&
    typeof init.locale === 'string' && init.locale.trim().length > 0
}

export interface LivenessOptions {
  attempt_id: string
}
export function isLivenessOptions (value: unknown): value is LivenessOptions {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const options = value as Partial<LivenessOptions>
  return typeof options.attempt_id === 'string' &&
    options.attempt_id.trim().length > 0
}

export interface LivenessPing extends LivenessOptions {
  __type__: 'LivenessPing'
  sequence: number
}
export function isLivenessPing (value: unknown): value is LivenessPing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const ping = value as Partial<LivenessPing>
  return ping.__type__ === 'LivenessPing' &&
    typeof ping.attempt_id === 'string' &&
    typeof ping.sequence === 'number' && Number.isInteger(ping.sequence) &&
    ping.sequence >= 1 && ping.sequence <= 2147483647
}
