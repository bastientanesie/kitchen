import type { Page } from '@playwright/test'

export async function installVirtualAuthenticator(page: Page): Promise<string> {
  const client = await page.context().newCDPSession(page)

  await client.send('WebAuthn.enable')
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })

  return authenticatorId
}
