import * as Dialog from '@radix-ui/react-dialog'
import { Mic, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { VoiceDictationSheet } from '@/components/voice-dictation-sheet'

export function VoiceDictationButton({ onIngredientsAdded }: { onIngredientsAdded: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          size="lg"
          aria-label="Dicter"
          className="fixed right-4 bottom-4 z-10 rounded-full shadow-lg"
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
          Dicter
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-xl bg-background p-6 shadow-lg"
          aria-label="Dicter des ingrédients"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-bold">Dicter des ingrédients</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fermer">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <VoiceDictationSheet
            onIngredientsAdded={() => {
              onIngredientsAdded()
              setOpen(false)
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
