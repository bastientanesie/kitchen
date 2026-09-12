import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { installVirtualAuthenticator } from './support/webauthn'

const fixtures = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '.fixtures.json'), 'utf-8'),
) as { invitationToken: string; deviceLinkToken: string }

test('un utilisateur existant associe un nouvel appareil via passkey', async ({ page }) => {
  await installVirtualAuthenticator(page)

  await page.goto(`/appareils/associer/${fixtures.deviceLinkToken}`)

  await expect(page.getByRole('heading', { name: 'Associer cet appareil' })).toBeVisible()

  await page.getByLabel('Nom de cet appareil').fill('iPhone de test')
  await page.getByRole('button', { name: 'Créer ma passkey' }).click()

  await expect(page).toHaveURL('/app')
})

test('un lien d’appairage invalide affiche un message d’erreur', async ({ page }) => {
  await installVirtualAuthenticator(page)

  await page.goto('/appareils/associer/token-inexistant')
  await page.getByLabel('Nom de cet appareil').fill('iPhone de test')
  await page.getByRole('button', { name: 'Créer ma passkey' }).click()

  await expect(page.getByRole('heading', { name: "Lien d'appairage invalide" })).toBeVisible()
})
