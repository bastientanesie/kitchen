import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'
import { ThemeProvider } from './components/theme-provider'

describe('App', () => {
  it('affiche le titre Kitchen', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Kitchen' })).toBeInTheDocument()
  })
})
