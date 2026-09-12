import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { HouseholdDrawer } from '@/components/household-drawer'
import { HouseholdError, fetchHousehold, type HouseholdSummary } from '@/lib/household'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; household: HouseholdSummary }
  | { status: 'error'; message: string }

export function AppHomePage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchHousehold()
      .then((household) => {
        if (!cancelled) setState({ status: 'ready', household })
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof HouseholdError ? err.message : 'Une erreur est survenue.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="font-display text-lg font-bold">
          {state.status === 'ready' ? state.household.name : 'Kitchen'}
        </h1>
        <Button variant="ghost" size="icon" aria-label="Ouvrir le menu" onClick={() => setIsDrawerOpen(true)}>
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-4">
        {state.status === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        {state.status === 'ready' && (
          <>
            <section aria-labelledby="stock-heading" className="flex flex-col gap-2">
              <h2 id="stock-heading" className="font-display text-lg font-semibold">
                Stock
              </h2>
              <p className="text-sm text-muted-foreground">À venir.</p>
            </section>
            <section aria-labelledby="cooking-modes-heading" className="flex flex-col gap-2">
              <h2 id="cooking-modes-heading" className="font-display text-lg font-semibold">
                Modes de cuisson
              </h2>
              <p className="text-sm text-muted-foreground">À venir.</p>
            </section>
          </>
        )}
      </main>

      {state.status === 'ready' && (
        <HouseholdDrawer
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          householdName={state.household.name}
        />
      )}
    </div>
  )
}
