import { NavLink, Outlet } from 'react-router-dom'

const navigationItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Estaciones', to: '/stations' },
  { label: 'Escaner', to: '/scanner' },
  { label: 'Movimientos', to: '/movements' },
  { label: 'Reportes', to: '/reports' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">IL</span>
          <div>
            <strong>Inventario</strong>
            <span>Laboratorios</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Principal">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
