import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createInvitation, fetchHouseholdPreferences, updateHouseholdPreferences } from '@/lib/household'
import { ThemeProvider } from '@/components/theme-provider'

import { HouseholdDrawer } from './household-drawer'

function renderDrawer(props: Parameters<typeof HouseholdDrawer>[0]) {
  return render(
    <ThemeProvider defaultTheme="light" enableSystem={false}>
      <HouseholdDrawer {...props} />
    </ThemeProvider>,
  )
}

vi.mock('@/lib/household', async () => {
  const actual = await vi.importActual<typeof import('@/lib/household')>('@/lib/household')
  return {
    ...actual,
    createInvitation: vi.fn(),
    fetchHouseholdPreferences: vi.fn(),
    updateHouseholdPreferences: vi.fn(),
  }
})

const createInvitationMock = vi.mocked(createInvitation)
const fetchHouseholdPreferencesMock = vi.mocked(fetchHouseholdPreferences)
const updateHouseholdPreferencesMock = vi.mocked(updateHouseholdPreferences)

describe('HouseholdDrawer', () => {
  beforeEach(() => {
    createInvitationMock.mockReset()
    fetchHouseholdPreferencesMock.mockReset()
    updateHouseholdPreferencesMock.mockReset()
    fetchHouseholdPreferencesMock.mockResolvedValue(null)
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('affiche le nom du foyer et le sélecteur de thème', async () => {
    renderDrawer({ open: true, onOpenChange: vi.fn(), householdName: "Foyer Dupont" })

    expect(screen.getByText('Foyer Dupont')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: /thème/i })).toBeInTheDocument()
  })

  it("génère un lien d'invitation et permet de le copier", async () => {
    createInvitationMock.mockResolvedValue('https://example.test/rejoindre/tok123')
    renderDrawer({ open: true, onOpenChange: vi.fn(), householdName: "Foyer Dupont" })

    await userEvent.click(screen.getByRole('button', { name: /générer un lien/i }))

    const linkInput = (await screen.findByLabelText(
      /^lien d'invitation$/i,
    )) as HTMLInputElement
    expect(linkInput.value).toBe('https://example.test/rejoindre/tok123')

    await userEvent.click(screen.getByRole('button', { name: /copier le lien d'invitation/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkInput.value)
  })

  it('charge puis sauvegarde les préférences du foyer à la perte de focus', async () => {
    fetchHouseholdPreferencesMock.mockResolvedValue('Sans gluten')
    updateHouseholdPreferencesMock.mockResolvedValue('Sans gluten, végétarien')
    renderDrawer({ open: true, onOpenChange: vi.fn(), householdName: "Foyer Dupont" })

    const textarea = (await screen.findByLabelText(/préférences du foyer/i)) as HTMLTextAreaElement
    expect(textarea.value).toBe('Sans gluten')

    await userEvent.type(textarea, ', végétarien')
    await userEvent.tab()

    expect(updateHouseholdPreferencesMock).toHaveBeenCalledWith('Sans gluten, végétarien')
  })

  it('affiche une erreur si la copie du lien échoue', async () => {
    createInvitationMock.mockResolvedValue('https://example.test/rejoindre/tok123')
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    renderDrawer({ open: true, onOpenChange: vi.fn(), householdName: 'Foyer Dupont' })

    await userEvent.click(screen.getByRole('button', { name: /générer un lien/i }))
    await screen.findByLabelText(/^lien d'invitation$/i)
    await userEvent.click(screen.getByRole('button', { name: /copier le lien d'invitation/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de copier le lien')
  })

  it('sauvegarde les préférences modifiées à la fermeture même sans perte de focus', async () => {
    fetchHouseholdPreferencesMock.mockResolvedValue('Sans gluten')
    updateHouseholdPreferencesMock.mockResolvedValue('Sans gluten, végétarien')
    const onOpenChange = vi.fn()
    renderDrawer({ open: true, onOpenChange, householdName: 'Foyer Dupont' })

    const textarea = (await screen.findByLabelText(/préférences du foyer/i)) as HTMLTextAreaElement
    await userEvent.type(textarea, ', végétarien')
    await userEvent.keyboard('{Escape}')

    expect(updateHouseholdPreferencesMock).toHaveBeenCalledWith('Sans gluten, végétarien')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('permet de naviguer le sélecteur de thème au clavier', async () => {
    renderDrawer({ open: true, onOpenChange: vi.fn(), householdName: "Foyer Dupont" })

    const selected = screen.getByRole('radio', { checked: true })
    await userEvent.click(selected)
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { checked: true })).not.toBe(selected)
  })
})
