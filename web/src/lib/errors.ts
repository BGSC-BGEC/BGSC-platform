/**
 * True for errors meaning "the resource/route doesn't exist": the gateway's `{ error: 'not_found' }`,
 * service messages like "Event not found", and apiClient's fallback "HTTP Error 404: ...".
 */
export function isNotFoundError(message: string | null | undefined): boolean {
  if (!message) return false
  return /not[\s_-]?found|\b404\b/i.test(message)
}
