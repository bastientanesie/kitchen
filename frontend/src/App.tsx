import { Route, Routes } from 'react-router-dom'

import { CreateHouseholdPage } from '@/routes/create-household-page'
import { LandingPage } from '@/routes/landing-page'
import { LoginPage } from '@/routes/login-page'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/foyer/creer" element={<CreateHouseholdPage />} />
    </Routes>
  )
}

export default App
