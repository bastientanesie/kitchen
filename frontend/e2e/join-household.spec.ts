import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { installVirtualAuthenticator } from './support/webauthn'

const fixtures = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '.fixtures.json'), 'utf-8'),
) as { invitationToken: string; deviceLinkToken: string }

test('un membre invité crée sa passkey et rejoint le foyer', async ({ page }) => {
  await installVirtualAuthenticator(page)

  await page.goto(`/rejoindre/${fixtures.invitationToken}`)

  await expect(page.getByRole('heading', { name: /Rejoindre/ })).toBeVisible()

  await page.getByLabel("Nom d'affichage").fill('Nouveau membre')
  await page.getByRole('button', { name: 'Créer ma passkey' }).click()

  await expect(page).toHaveURL('/app')
})

test('une invitation invalide affiche un message d’erreur', async ({ page }) => {
  await installVirtualAuthenticator(page)

  await page.goto('/rejoindre/token-inexistant')

  await expect(page.getByRole('alert')).toContainText(/expiré|invalide/i)
})
