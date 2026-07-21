import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LoginPage } from './pages/LoginPage'
import { UpdateToast } from './components/UpdateToast'
import { useAuthStore } from './store/auth-store'
import './index.css'

function Root() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrated        = useAuthStore((s) => s.hydrated)
  const hydrate         = useAuthStore((s) => s.hydrate)

  // Restore the persisted session once on startup
  useEffect(() => { hydrate() }, [hydrate])

  // Avoid flashing the login page before the session is known
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {isAuthenticated ? <App /> : <LoginPage />}
      <UpdateToast />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
