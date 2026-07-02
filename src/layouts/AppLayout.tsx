import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../features/auth/useAuth'

const navigationItems = [
  { to: '/', label: 'Inicio', icon: '⌂', end: true },
  { to: '/estaciones', label: 'Estaciones', icon: '▣' },
  { to: '/escanear', label: 'Escanear QR', icon: '⌁' },
  { to: '/movimientos', label: 'Movimientos', icon: '↔' },
  { to: '/reportes', label: 'Reportes', icon: '▤' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙' },
]

function AppLayout() {
  const { user, signOut } = useAuth()

const [isSigningOut, setIsSigningOut] = useState(false)
const [signOutError, setSignOutError] = useState('')

async function handleSignOut() {
  setSignOutError('')
  setIsSigningOut(true)

  try {
    await signOut()
  } catch {
    setSignOutError('No fue posible cerrar sesión.')
  } finally {
    setIsSigningOut(false)
  }
}
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">IL</div>

          <div>
            <p className="brand-title">Inventario Lab</p>
            <p className="brand-subtitle">CECYTEA</p>
          </div>
        </div>

        <p className="sidebar-section-label">Navegación</p>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>

              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          Ambiente de desarrollo
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sistema de inventario</p>
            <h1>Laboratorios de cómputo</h1>
          </div>

          <div className="topbar-actions">
  <span className="signed-in-as">
    {user?.email}
  </span>

  <NavLink to="/escanear" className="scan-button">
    <span aria-hidden="true">⌁</span>
    Escanear QR
  </NavLink>

  <button
    type="button"
    className="logout-button"
    onClick={handleSignOut}
    disabled={isSigningOut}
  >
    {isSigningOut ? 'Saliendo...' : 'Salir'}
  </button>
</div>
        </header>

        {signOutError && (
  <p className="topbar-error" role="alert">
    {signOutError}
  </p>
)}

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}

export default AppLayout