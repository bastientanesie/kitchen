import { ThemeToggle } from '@/components/theme-toggle'

function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-start gap-6 p-6">
      <h1 className="font-display text-2xl font-bold">Kitchen</h1>
      <ThemeToggle />
    </main>
  )
}

export default App
