import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App'
import { applyTheme, usePreferences } from './store/preferences'

applyTheme(usePreferences.getState().theme)

function showStartupError(message: string) {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = ''
  const box = document.createElement('div')
  box.style.cssText = 'max-width:32rem;margin:15vh auto;padding:0 1.5rem;font-family:system-ui,sans-serif;line-height:1.5'
  const title = document.createElement('h1')
  title.textContent = 'PromptVault can’t start'
  title.style.fontSize = '1.125rem'
  const body = document.createElement('p')
  body.textContent = message
  body.style.opacity = '0.75'
  box.append(title, body)
  root.append(box)
}

if (typeof indexedDB === 'undefined') {
  showStartupError(
    'This browser doesn’t allow local storage (IndexedDB), which PromptVault needs to save your library. If you’re in a private window, open a normal window instead.',
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
