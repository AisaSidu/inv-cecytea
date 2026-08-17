import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type DashboardCounts = {
  laboratories: number
  stations: number
  assets: number
  openIncidents: number
}

type RecentMovement = {
  id: string
  movement_type: string
  reason: string | null
  created_at: string
  assets: {
    asset_code: string
  } | null
}

type ActiveIncident = {
  id: string
  description: string
  created_at: string
  stations: {
    code: string
  } | null
}

const emptyCounts: DashboardCounts = {
  laboratories: 0,
  stations: 0,
  assets: 0,
  openIncidents: 0,
}

function DashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts>(emptyCounts)
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([])
  const [activeIncidents, setActiveIncidents] = useState<ActiveIncident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      setIsLoading(true)
      setLoadError('')

      // 1. Cargamos los contadores
      const [
        laboratoriesResult,
        stationsResult,
        assetsResult,
        incidentsCountResult,
      ] = await Promise.all([
        supabase.from('laboratories').select('*', { count: 'exact', head: true }),
        supabase.from('stations').select('*', { count: 'exact', head: true }),
        supabase.from('assets').select('*', { count: 'exact', head: true }),
        supabase.from('station_incidents').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ])

      // 2. Cargamos la actividad reciente (solo los últimos 5)
      const [movementsListResult, incidentsListResult] = await Promise.all([
        supabase
          .from('asset_movements')
          .select('id, movement_type, reason, created_at, assets(asset_code)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('station_incidents')
          .select('id, description, created_at, stations(code)')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      const firstError =
        laboratoriesResult.error ??
        stationsResult.error ??
        assetsResult.error ??
        incidentsCountResult.error ??
        movementsListResult.error ??
        incidentsListResult.error

      if (!isMounted) return

      if (firstError) {
        setLoadError('No fue posible cargar los datos del inventario.')
        setIsLoading(false)
        return
      }

      setCounts({
        laboratories: laboratoriesResult.count ?? 0,
        stations: stationsResult.count ?? 0,
        assets: assetsResult.count ?? 0,
        openIncidents: incidentsCountResult.count ?? 0,
      })

      setRecentMovements((movementsListResult.data ?? []) as unknown as RecentMovement[])
      setActiveIncidents((incidentsListResult.data ?? []) as unknown as ActiveIncident[])

      setIsLoading(false)
    }

    void loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [])

  const hasData = counts.stations > 0

  const stats = [
    {
      label: 'Laboratorios',
      value: counts.laboratories,
      helper: 'Espacios registrados',
      isAlert: false,
    },
    {
      label: 'Estaciones',
      value: counts.stations,
      helper: 'Puestos de trabajo',
      isAlert: false,
    },
    {
      label: 'Equipos asignados',
      value: counts.assets,
      helper: 'CPU y monitores en uso',
      isAlert: false,
    },
    {
      label: 'Incidencias abiertas',
      value: counts.openIncidents,
      helper: 'Requieren atención',
      isAlert: counts.openIncidents > 0, // Cambia el estilo si hay problemas
    },
  ]

  return (
    <section>
      {/* TARJETA DE BIENVENIDA DINÁMICA */}
      <div className="welcome-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Panel principal</p>
          <h2>
            {hasData 
              ? 'Resumen general de inventario' 
              : 'Aún no hay estaciones registradas.'}
          </h2>
          <p>
            {hasData 
              ? 'Ten un excelente turno. Aquí tienes el estado actual de los laboratorios.'
              : 'Para empezar, registra laboratorios, crea estaciones y genera sus códigos QR.'}
          </p>
        </div>

        {hasData ? (
          <Link to="/escanear" className="primary-button" style={{ fontSize: '1.1rem', padding: '12px 24px' }}>
            <span style={{ marginRight: '8px' }}>📷</span> Escanear QR
          </Link>
        ) : (
          <Link to="/estaciones" className="primary-button">
            Crear primera estación
          </Link>
        )}
      </div>

      {loadError && (
        <div className="dashboard-error" role="alert">
          {loadError}
        </div>
      )}

      {/* MÉTRICAS */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card" style={stat.isAlert ? { borderLeft: '4px solid #ef4444', backgroundColor: '#fef2f2' } : {}}>
            <p style={stat.isAlert ? { color: '#b91c1c', fontWeight: 'bold' } : {}}>{stat.label}</p>
            <strong style={stat.isAlert ? { color: '#ef4444' } : {}}>
              {isLoading ? '...' : stat.value}
            </strong>
            <span style={stat.isAlert ? { color: '#991b1b' } : {}}>{stat.helper}</span>
          </article>
        ))}
      </div>

      {/* PANELES INFERIORES: VISTA DE CONFIGURACIÓN VS VISTA DE OPERACIÓN */}
      {!hasData && !isLoading ? (
        <div className="dashboard-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Primeros pasos</p>
                <h3>Orden recomendado de configuración</h3>
              </div>
            </div>
            <ol className="setup-list">
              <li><span>1</span> Registrar el primer laboratorio.</li>
              <li><span>2</span> Crear estaciones de trabajo.</li>
              <li><span>3</span> Asociar CPU, monitor y periféricos.</li>
              <li><span>4</span> Generar e imprimir códigos QR.</li>
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
              <p><span className="status-dot" /> Sesión protegida con Supabase Auth</p>
              <p><span className="status-dot" /> Inventario protegido con políticas RLS</p>
            </div>
          </article>
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* PANEL DE INCIDENCIAS ACTIVAS */}
          <article className="panel">
            <div className="panel-heading split-heading">
              <div>
                <p className="eyebrow">Atención requerida</p>
                <h3>Incidencias abiertas</h3>
              </div>
              {counts.openIncidents > 5 && (
                <span className="context-pill">Viendo 5 más recientes</span>
              )}
            </div>

            {activeIncidents.length === 0 ? (
              <div className="empty-list" style={{ padding: '24px 0' }}>
                <strong>Todo en orden</strong>
                <p>No hay reportes de fallas en los laboratorios.</p>
              </div>
            ) : (
              <div className="incident-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeIncidents.map((incident) => (
                  <div key={incident.id} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ color: '#ef4444' }}>{incident.stations?.code ?? 'Estación desconocida'}</strong>
                      <small style={{ color: '#64748b' }}>{new Date(incident.created_at).toLocaleDateString()}</small>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>{incident.description}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* PANEL DE HISTORIAL RECIENTE */}
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Historial general</p>
                <h3>Últimos movimientos de equipos</h3>
              </div>
            </div>

            {recentMovements.length === 0 ? (
              <div className="empty-list" style={{ padding: '24px 0' }}>
                <strong>Sin movimientos recientes</strong>
                <p>Aún no se registran traslados o asignaciones.</p>
              </div>
            ) : (
              <div className="movement-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentMovements.map((movement) => (
                  <div key={movement.id} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong>{movement.assets?.asset_code ?? 'Equipo'}</strong>
                      <small style={{ color: '#64748b' }}>{new Date(movement.created_at).toLocaleDateString()}</small>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>
                      {movement.reason ?? 'Movimiento registrado'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  )
}

export default DashboardPage