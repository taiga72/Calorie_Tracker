import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ProfileProvider } from './context/ProfileContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProfileProvider>
      <App />
    </ProfileProvider>
  </StrictMode>,
)
