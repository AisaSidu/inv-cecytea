import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type DashboardCounts = {
  laboratories: number
  stations: number
  assets: number
  movements: number
}

const emptyCounts: DashboardCounts = {
  laboratories: 0,
  stations: 0,
  assets: 0,
  movements: 0,
}

function DashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts>(emptyCounts)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboardCounts() {
      setIsLoading(true)
      setLoadError('')

      const [
        laboratoriesResult,
        stationsResult,
        assetsResult,
        movementsResult,
      ] = await Promise.all([
        supabase
          .from('laboratories')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('stations')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('assets')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('asset_movements')
          .select('*', { count: 'exact', head: true }),
      ])

      const firstError =
        laboratoriesResult.error ??
        stationsResult.error ??
        assetsResult.error ??
        movementsResult.error

      if (!isMounted) return

      if (firstError) {
        setLoadError(
          'No fue posible cargar los datos del inventario.'
        )
        setIsLoading(false)
        return
      }

      setCounts({
        laboratories: laboratoriesResult.count ?? 0,
        stations: stationsResult.count ?? 0,
        assets: assetsResult.count ?? 0,
        movements: movementsResult.count ?? 0,
      })

      setIsLoading(false)
    }

    void loadDashboardCounts()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = [
    {
      label: 'Laboratorios registrados',
      value: counts.laboratories,
      helper: 'Espacios registrados en el sistema',
    },
    {
      label: 'Estaciones registradas',
      value: counts.stations,
      helper: 'Puestos de trabajo configurados',
    },
    {
      label: 'Equipos principales',
      value: counts.assets,
      helper: 'CPU y monitores registrados',
    },
    {
      label: 'Movimientos registrados',
      value: counts.movements,
      helper: 'Cambios guardados en historial',
    },
  ]

  return (
    <section>
      <div className="welcome-card">
        <div>
          <p className="eyebrow">Panel principal</p>
          <h2>El inventario empieza desde cero.</h2>

          <p>
            Registra las estaciones nuevas, relaciona CPU y monitor,
            genera códigos QR y conserva un historial claro de cada
            movimiento.
          </p>
        </div>

        <Link to="/estaciones" className="primary-button">
          Crear primera estación
        </Link>
      </div>

      {loadError && (
        <div className="dashboard-error" role="alert">
          {loadError}
        </div>
      )}

      <div className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p>{stat.label}</p>

            <strong>
              {isLoading ? '...' : stat.value}
            </strong>

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
              Registrar el primer laboratorio.
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
              <h3>Base protegida y conectada</h3>
            </div>
          </div>

          <div className="system-status">
            <p>
              <span className="status-dot" />
              Sesión protegida con Supabase Auth
            </p>

            <p>
              <span className="status-dot" />
              Inventario protegido con políticas RLS
            </p>

            <p>
              <span className="status-dot muted-dot" />
              Formularios administrativos pendientes
            </p>
          </div>
        </article>
      </div>
    </section>
  )
}

export default DashboardPage