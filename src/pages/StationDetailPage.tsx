import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type StationStatus = 'active' | 'inactive' | 'maintenance'

type StationDetail = {
  id: string
  code: string
  location_label: string | null
  notes: string | null
  status: StationStatus
  laboratories: {
    code: string
    name: string
    building: string | null
  } | null
}

type StationDetailRow = Omit<StationDetail, 'laboratories'> & {
  laboratories:
    | StationDetail['laboratories'][]
    | StationDetail['laboratories']
}

const statusLabels: Record<StationStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  maintenance: 'Mantenimiento',
}

function mapStationDetail(row: StationDetailRow): StationDetail {
  const laboratory = Array.isArray(row.laboratories)
    ? row.laboratories[0] ?? null
    : row.laboratories

  return {
    ...row,
    laboratories: laboratory,
  }
}

function StationDetailPage() {
  const { stationId } = useParams()
  const [station, setStation] = useState<StationDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadStation() {
      if (!stationId) {
        setIsLoading(false)
        setLoadError('No se recibió el identificador de la estación.')
        return
      }

      const { data, error } = await supabase
        .from('stations')
        .select('id, code, location_label, notes, status, laboratories(code, name, building)')
        .eq('id', stationId)
        .single()

      if (!isMounted) return

      if (error || !data) {
        setLoadError('No fue posible cargar esta estación.')
        setIsLoading(false)
        return
      }

      setStation(mapStationDetail(data as unknown as StationDetailRow))
      setIsLoading(false)
    }

    void loadStation()

    return () => {
      isMounted = false
    }
  }, [stationId])

  const qrUrl = useMemo(() => {
    if (!station) return ''
    return `${window.location.origin}/estaciones/${station.id}`
  }, [station])

  if (isLoading) {
    return (
      <section className="placeholder-page">
        <div className="placeholder-icon">□</div>
        <p className="eyebrow">Detalle de estación</p>
        <h2>Cargando estación...</h2>
      </section>
    )
  }

  if (loadError || !station) {
    return (
      <section className="placeholder-page">
        <div className="placeholder-icon">□</div>
        <p className="eyebrow">Detalle de estación</p>
        <h2>Estación no disponible</h2>
        <p className="placeholder-description">{loadError}</p>
        <Link to="/estaciones" className="secondary-button">
          Volver a estaciones
        </Link>
      </section>
    )
  }

  return (
    <section className="station-detail-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Detalle de estación</p>
          <h2>{station.code}</h2>
          <p>
            Esta será la vista que abrirá el código QR físico pegado en la
            estación de trabajo.
          </p>
        </div>

        <Link to="/estaciones" className="secondary-button">
          Volver
        </Link>
      </div>

      <div className="detail-grid">
        <article className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Ubicación</p>
            <h3>{station.laboratories?.name ?? 'Laboratorio sin nombre'}</h3>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Código laboratorio</dt>
              <dd>{station.laboratories?.code ?? 'Sin dato'}</dd>
            </div>
            <div>
              <dt>Edificio</dt>
              <dd>{station.laboratories?.building ?? 'Sin dato'}</dd>
            </div>
            <div>
              <dt>Ubicación</dt>
              <dd>{station.location_label ?? 'Sin ubicación específica'}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <span className={`status-pill status-${station.status}`}>
                  {statusLabels[station.status]}
                </span>
              </dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <p className="eyebrow">QR</p>
            <h3>Ruta de consulta</h3>
          </div>

          <div className="qr-preview">
            <span>QR</span>
          </div>

          <p className="qr-url">{qrUrl}</p>
        </article>
      </div>

      <article className="panel pending-panel">
        <div className="panel-heading">
          <p className="eyebrow">Siguiente bloque</p>
          <h3>Equipos por estación</h3>
        </div>

        <p>
          Aquí conectaremos CPU, monitor y checklist de periféricos. La base ya
          está lista para guardar esa relación sin perder qué pertenece a cada
          puesto.
        </p>

        {station.notes && <p className="station-notes">{station.notes}</p>}
      </article>
    </section>
  )
}

export default StationDetailPage
