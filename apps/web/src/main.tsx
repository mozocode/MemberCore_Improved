import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

try {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <StrictMode>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <App />
          </BrowserRouter>
      </StrictMode>
    </ErrorBoundary>
  )
} catch (err) {
  rootEl.innerHTML = `<div style="background:#000;color:#ef4444;padding:24px;font-family:monospace;min-height:100vh"><h1>Mount Error</h1><pre>${String(err)}</pre></div>`
}
