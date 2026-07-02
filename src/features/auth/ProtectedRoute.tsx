import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

type ProtectedRouteProps = {
  children: ReactNode
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <main className="auth-loading">
        <div className="auth-loading-card">
          <span className="status-dot" />
          Verificando sesión...
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <Navigate
        to="/iniciar-sesion"
        replace
        state={{
          from: `${location.pathname}${location.search}`,
        }}
      />
    )
  }

  return <>{children}</>
}

export default ProtectedRoute
