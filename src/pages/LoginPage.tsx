import { useState, type FormEvent } from 'react'
import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'

type NavigationState = {
  from?: string
}

function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from =
    (location.state as NavigationState | null)?.from ?? '/'

  if (session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setErrorMessage(
          'No fue posible iniciar sesión. Revisa tu correo y contraseña.'
        )
        return
      }

      navigate(from, { replace: true })
    } catch {
      setErrorMessage(
        'Ocurrió un error inesperado al intentar iniciar sesión.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">IL</div>

          <div>
            <p className="brand-title">Inventario Lab</p>
            <p className="brand-subtitle">CECYTEA</p>
          </div>
        </div>

        <div className="login-heading">
          <p className="eyebrow">Acceso institucional</p>
          <h1>Inicia sesión</h1>
          <p>
            Consulta y administra el inventario de los laboratorios
            de cómputo.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Correo electrónico

            <input
              type="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Contraseña

            <input
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="primary-button login-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="login-help">
          Las cuentas son creadas por la administración del sistema.
        </p>
      </section>
    </main>
  )
}

export default LoginPage