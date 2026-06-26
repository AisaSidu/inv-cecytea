import { NavLink, Outlet } from 'react-router-dom'

const navigationItems = [
  { to: '/', label: 'Inicio', icon: '⌂', end: true },
  { to: '/estaciones', label: 'Estaciones', icon: '▣' },
  { to: '/escanear', label: 'Escanear QR', icon: '⌁' },
  { to: '/movimientos', label: 'Movimientos', icon: '↔' },
  { to: '/reportes', label: 'Reportes', icon: '▤' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙' },
]

function AppLayout() {
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

          <NavLink to="/escanear" className="scan-button">
            <span aria-hidden="true">⌁</span>
            Escanear QR
          </NavLink>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}

export default AppLayout