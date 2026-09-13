export function invitationUrl(token: string): string {
  return `${window.location.origin}/rejoindre/${token}`
}
