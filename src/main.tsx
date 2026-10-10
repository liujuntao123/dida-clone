import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initCapacitor } from './capacitor'
import { applyTheme, readPersistedTheme } from './lib/theme'
import './index.css'

applyTheme(readPersistedTheme())
void initCapacitor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
