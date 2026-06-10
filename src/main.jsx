import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Error monitoring — only active when VITE_SENTRY_DSN is set. The dynamic
// import keeps the SDK out of the bundle entirely on builds without a DSN.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
if (SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      // Errors only — no session replay, no tracing. Keeps the free-tier
      // quota for what actually matters: unhandled exceptions.
      sampleRate: 1.0,
      tracesSampleRate: 0,
    })
  }).catch(() => {
    // Monitoring must never break the app.
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
