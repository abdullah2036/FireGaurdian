// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppProvider } from './lib/store'
import { I18nProvider } from './lib/i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </I18nProvider>
  </StrictMode>,
)

// Fade out the branded splash from index.html once the app has painted (shown at least ~0.5 s
// so it does not flash on fast loads).
const splash = document.getElementById('splash')
if (splash) {
  const hide = () => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 400) }
  setTimeout(hide, Math.max(120, 500 - performance.now()))
}
