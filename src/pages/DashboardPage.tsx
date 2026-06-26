import { Link } from 'react-router-dom'

const stats = [
  {
    label: 'Estaciones registradas',
    value: '0',
    helper: 'Aún no hay estaciones creadas',
  },
  {
    label: 'Equipos principales',
    value: '0',
    helper: 'CPU y monitores registrados',
  },
  {
    label: 'Movimientos recientes',
    value: '0',
    helper: 'Sin historial disponible',
  },
  {
    label: 'Incidencias abiertas',
    value: '0',
    helper: 'Todo en orden por ahora',
  },
]

function DashboardPage() {
  return (
    <section>
      <div className="welcome-card">
        <div>
          <p className="eyebrow">Panel principal</p>
          <h2>El inventario empieza desde cero.</h2>

          <p>
            Registra las estaciones nuevas, relaciona CPU y monitor, genera
            códigos QR y conserva un historial claro de cada movimiento.
          </p>
        </div>

        <Link to="/estaciones" className="primary-button">
          Crear primera estación
        </Link>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span>{stat.helper}</span>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Primeros pasos</p>
              <h3>Orden recomendado de configuración</h3>
            </div>
          </div>

          <ol className="setup-list">
            <li>
              <span>1</span>
              Registrar laboratorios.
            </li>
            <li>
              <span>2</span>
              Crear estaciones de trabajo.
            </li>
            <li>
              <span>3</span>
              Asociar CPU, monitor y periféricos.
            </li>
            <li>
              <span>4</span>
              Generar e imprimir códigos QR.
            </li>
          </ol>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Estado del sistema</p>
              <h3>Todo listo para empezar</h3>
            </div>
          </div>

          <div className="system-status">
            <p>
              <span className="status-dot" />
              Interfaz y navegación configuradas
            </p>

            <p>
              <span className="status-dot muted-dot" />
              Base de datos pendiente de modelado
            </p>

            <p>
              <span className="status-dot muted-dot" />
              Escáner QR pendiente de integración
            </p>
          </div>
        </article>
      </div>
    </section>
  )
}

export default DashboardPage