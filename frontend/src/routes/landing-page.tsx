import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { VoiceJourneyDemo } from '@/components/voice-journey-demo'

export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-10 p-6 md:flex-row md:items-center md:gap-16 md:p-12">
      <div className="flex flex-col items-start gap-6 md:w-1/2">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Kitchen
        </h1>
        <p className="text-lg text-muted-foreground">
          Suivez en un coup d'œil ce qu'il y a dans votre frigo et vos placards, dictez les
          mises à jour les mains prises, et générez un prompt recette prêt à coller dans
          votre IA préférée.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/connexion">Se connecter</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/foyer/creer">Créer un foyer</Link>
          </Button>
        </div>
      </div>
      <div className="md:w-1/2">
        <VoiceJourneyDemo />
      </div>
    </main>
  )
}
