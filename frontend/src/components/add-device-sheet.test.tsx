import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DevicePairingError,
  createDeviceLinkToken,
  subscribeToDeviceLinkEvents,
  type DeviceLinkEvent,
} from '@/lib/device-pairing'

import { AddDeviceSheet } from './add-device-sheet'

vi.mock('@/lib/device-pairing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/device-pairing')>('@/lib/device-pairing')
  return { ...actual, createDeviceLinkToken: vi.fn(), subscribeToDeviceLinkEvents: vi.fn() }
})

const createDeviceLinkTokenMock = vi.mocked(createDeviceLinkToken)
const subscribeToDeviceLinkEventsMock = vi.mocked(subscribeToDeviceLinkEvents)

const TOKEN = {
  code: 'ABCD1234',
  link: 'https://kitchen.test/appareils/associer/ABCD1234',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
}

function captureEventHandler() {
  let handler: (event: DeviceLinkEvent) => void = () => {}
  subscribeToDeviceLinkEventsMock.mockImplementation((_code, onEvent) => {
    handler = onEvent
    return vi.fn()
  })
  return {
    emit: (event: DeviceLinkEvent) => handler(event),
  }
}

describe('AddDeviceSheet', () => {
  beforeEach(() => {
    createDeviceLinkTokenMock.mockReset()
    subscribeToDeviceLinkEventsMock.mockReset()
  })

  it("génère un code d'appairage et affiche le QR code, le code et le lien copiable", async () => {
    createDeviceLinkTokenMock.mockResolvedValue(TOKEN)
    captureEventHandler()
    render(<AddDeviceSheet />)

    expect(await screen.findByText('ABCD1234')).toBeInTheDocument()
    expect(screen.getByLabelText(/^lien d'appairage$/i)).toHaveValue(TOKEN.link)
  })

  it("affiche le succès de l'appairage lorsque l'événement 'paired' arrive", async () => {
    createDeviceLinkTokenMock.mockResolvedValue(TOKEN)
    const { emit } = captureEventHandler()
    render(<AddDeviceSheet />)

    await screen.findByText('ABCD1234')
    emit({ kind: 'paired', deviceName: 'iPhone de Sam' })

    expect(await screen.findByText(/iphone de sam.*associé avec succès/i)).toBeInTheDocument()
  })

  it("affiche un état expiré et permet de régénérer un code lorsque l'événement 'expired' arrive", async () => {
    createDeviceLinkTokenMock.mockResolvedValue(TOKEN)
    const { emit } = captureEventHandler()
    render(<AddDeviceSheet />)

    await screen.findByText('ABCD1234')
    emit({ kind: 'expired' })

    expect(await screen.findByText('Ce code a expiré.')).toBeInTheDocument()

    createDeviceLinkTokenMock.mockClear()
    createDeviceLinkTokenMock.mockResolvedValue({ ...TOKEN, code: 'WXYZ9876' })
    await userEvent.click(screen.getByRole('button', { name: /générer un nouveau code/i }))

    await waitFor(() => expect(createDeviceLinkTokenMock).toHaveBeenCalled())
    expect(await screen.findByText('WXYZ9876')).toBeInTheDocument()
  })

  it('affiche un message d\'erreur explicite si la génération du code échoue', async () => {
    createDeviceLinkTokenMock.mockRejectedValue(
      new DevicePairingError("La génération du code d'appairage a échoué. Veuillez réessayer."),
    )
    render(<AddDeviceSheet />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "La génération du code d'appairage a échoué",
    )
  })
})
