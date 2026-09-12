import { Route, Routes } from 'react-router-dom'

import { AppHomePage } from '@/routes/app-home-page'
import { CreateHouseholdPage } from '@/routes/create-household-page'
import { JoinHouseholdPage } from '@/routes/join-household-page'
import { LandingPage } from '@/routes/landing-page'
import { LoginPage } from '@/routes/login-page'
import { PairDevicePage } from '@/routes/pair-device-page'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/foyer/creer" element={<CreateHouseholdPage />} />
      <Route path="/rejoindre/:token" element={<JoinHouseholdPage />} />
      <Route path="/appareils/associer/:token" element={<PairDevicePage />} />
      <Route path="/app" element={<AppHomePage />} />
    </Routes>
  )
}

export default App
