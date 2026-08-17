import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import type { InventoryRole } from '../features/auth/AuthContext'
import { supabase } from '../lib/supabase'

type Laboratory = {
  id: string
  code: string
  name: string
  building: string | null
  is_active: boolean
}

type StationStatus = 'active' | 'inactive' | 'maintenance'

type StationRecord = {
  id: string
  code: string
  location_label: string | null
  notes: string | null
  status: StationStatus
  laboratory_id: string
}

type Station = StationRecord & {
  laboratories: Pick<Laboratory, 'id' | 'code' | 'name'> | null
}

const statusLabels: Record<StationStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  maintenance: 'Mantenimiento',
}

const roleLabels: Record<InventoryRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Consulta',
}

type SupabaseError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function getInventoryWriteErrorMessage(entityLabel: string, error: SupabaseError) {
  const message = error.message?.toLowerCase() ?? ''

  if (error.code === '23505') {
    return `El codigo de ${entityLabel} ya existe.`
  }

  if (error.code === '23514') {
    return `Revisa que el codigo y los datos obligatorios de ${entityLabel} sean validos.`
  }

  if (
    error.code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return 'Tu rol actual no permite registrar inventario. Pide que tu perfil sea Administrador u Operador.'
  }

  return `No fue posible registrar ${entityLabel}. ${getSupabaseErrorSummary(error)}`
}

function getSupabaseErrorSummary(error: SupabaseError) {
  const parts = [error.message, error.details, error.hint].filter(Boolean)

  if (parts.length === 0) {
    return 'Revisa la conexion e intenta de nuevo.'
  }

  return parts.join(' ')
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

function mapStation(
  station: StationRecord,
  laboratoriesById: Record<string, Pick<Laboratory, 'id' | 'code' | 'name'>>,
): Station {
  return {
    ...station,
    laboratories: laboratoriesById[station.laboratory_id] ?? null,
  }
}

function getLaboratoriesById(laboratories: Laboratory[]) {
  return laboratories.reduce<Record<string, Pick<Laboratory, 'id' | 'code' | 'name'>>>(
    (current, laboratory) => {
      current[laboratory.id] = {
        id: laboratory.id,
        code: laboratory.code,
        name: laboratory.name,
      }
      return current
    },
    {},
  )
}

function StationsPage() {
  const { profile, canWriteInventory } = useAuth()
  const currentRoleLabel = profile?.role ? roleLabels[profile.role] : 'Sin perfil'

  const [laboratories, setLaboratories] = useState<Laboratory[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [selectedLaboratoryId, setSelectedLaboratoryId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingLab, setIsSavingLab] = useState(false)
  const [isSavingStation, setIsSavingStation] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formMessage, setFormMessage] = useState('')

  const [labCode, setLabCode] = useState('LAB-CIBER')
  const [labName, setLabName] = useState('Laboratorio de Ciberseguridad')
  const [labBuilding, setLabBuilding] = useState('')

  const [stationCode, setStationCode] = useState('EST-001')
  const [locationLabel, setLocationLabel] = useState('')
  const [stationNotes, setStationNotes] = useState('')

  // NUEVOS ESTADOS: Pestañas y Búsqueda
  const [activeTab, setActiveTab] = useState<'directory' | 'admin'>('directory')
  const [searchQuery, setSearchQuery] = useState('')

  async function fetchInventoryBase() {
    const [laboratoriesResult, stationsResult] = await Promise.all([
      supabase
        .from('laboratories')
        .select('id, code, name, building, is_active')
        .order('code', { ascending: true }),
      supabase
        .from('stations')
        .select('id, code, location_label, notes, status, laboratory_id')
        .order('code', { ascending: true }),
    ])

    return { laboratoriesResult, stationsResult }
  }

  function applyInventoryBase(
    nextLaboratories: Laboratory[],
    nextStationRecords: StationRecord[],
    shouldKeepSelectedLaboratory: boolean,
  ) {
    const laboratoriesById = getLaboratoriesById(nextLaboratories)

    setLaboratories(nextLaboratories)
    setStations(nextStationRecords.map((station) => mapStation(station, laboratoriesById)))
    setSelectedLaboratoryId((current) =>
      shouldKeepSelectedLaboratory && current ? current : nextLaboratories[0]?.id || '',
    )
  }

  async function loadData() {
    setIsLoading(true)
    setLoadError('')

    const { laboratoriesResult, stationsResult } = await fetchInventoryBase()

    if (laboratoriesResult.error || stationsResult.error) {
      const error = laboratoriesResult.error ?? stationsResult.error
      setLoadError(
        `No fue posible cargar laboratorios y estaciones. ${
          error ? getSupabaseErrorSummary(error) : 'Intenta de nuevo.'
        }`,
      )
      setIsLoading(false)
      return
    }

    applyInventoryBase(
      (laboratoriesResult.data ?? []) as Laboratory[],
      (stationsResult.data ?? []) as StationRecord[],
      true,
    )
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const { laboratoriesResult, stationsResult } = await fetchInventoryBase()

      if (!isMounted) return

      if (laboratoriesResult.error || stationsResult.error) {
        const error = laboratoriesResult.error ?? stationsResult.error
        setLoadError(
          `No fue posible cargar laboratorios y estaciones. ${
            error ? getSupabaseErrorSummary(error) : 'Intenta de nuevo.'
          }`,
        )
        setIsLoading(false)
        return
      }

      applyInventoryBase(
        (laboratoriesResult.data ?? []) as Laboratory[],
        (stationsResult.data ?? []) as StationRecord[],
        false,
      )
      setIsLoading(false)
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  // Filtro de búsqueda dinámico
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stations
    const query = searchQuery.toLowerCase()
    return stations.filter(
      (station) =>
        station.code.toLowerCase().includes(query) ||
        station.laboratories?.name.toLowerCase().includes(query) ||
        station.location_label?.toLowerCase().includes(query)
    )
  }, [stations, searchQuery])

  async function handleCreateLaboratory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    if (!canWriteInventory) {
      setFormMessage(`Tu rol actual (${currentRoleLabel}) no permite registrar inventario.`)
      return
    }

    setIsSavingLab(true)

    const { data, error } = await supabase
      .from('laboratories')
      .insert({
        code: normalizeCode(labCode),
        name: labName.trim(),
        building: labBuilding.trim() || null,
      })
      .select('id, code, name, building, is_active')
      .single()

    if (error || !data) {
      setFormMessage(
        error
          ? getInventoryWriteErrorMessage('laboratorio', error)
          : 'No fue posible registrar el laboratorio. Intenta de nuevo.',
      )
      setIsSavingLab(false)
      return
    }

    setLaboratories((current) => [...current, data].sort((a, b) => a.code.localeCompare(b.code)))
    setSelectedLaboratoryId(data.id)
    setLabCode('')
    setLabName('')
    setLabBuilding('')
    setFormMessage('Laboratorio registrado correctamente.')
    setIsSavingLab(false)
  }

  async function handleCreateStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    if (!canWriteInventory) {
      setFormMessage(`Tu rol actual (${currentRoleLabel}) no permite registrar inventario.`)
      return
    }

    if (!selectedLaboratoryId) {
      setFormMessage('Primero registra o selecciona un laboratorio.')
      return
    }

    setIsSavingStation(true)

    const { data, error } = await supabase
      .from('stations')
      .insert({
        code: normalizeCode(stationCode),
        laboratory_id: selectedLaboratoryId,
        location_label: locationLabel.trim() || null,
        notes: stationNotes.trim() || null,
      })
      .select('id, code, location_label, notes, status, laboratory_id')
      .single()

    if (error || !data) {
      setFormMessage(
        error
          ? getInventoryWriteErrorMessage('estacion', error)
          : 'No fue posible registrar la estacion. Intenta de nuevo.',
      )
      setIsSavingStation(false)
      return
    }

    const laboratoriesById = getLaboratoriesById(laboratories)

    setStations((current) =>
      [...current, mapStation(data as StationRecord, laboratoriesById)].sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
    )
    setStationCode('')
    setLocationLabel('')
    setStationNotes('')
    setFormMessage('Estacion creada correctamente.')
    setIsSavingStation(false)
  }

  return (
    <section className="stations-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Directorio</p>
          <h2>Catálogo de Estaciones</h2>
          <p>
            Busca y consulta el estado de las estaciones de trabajo, o registra
            nuevos laboratorios si tienes permisos de administración.
          </p>
        </div>

        <button className="secondary-button" type="button" onClick={() => void loadData()}>
          Actualizar datos
        </button>
      </div>

      {loadError && (
        <div className="dashboard-error" role="alert">
          {loadError}
        </div>
      )}

      {formMessage && (
        <div className="inline-message" role="status">
          {formMessage}
        </div>
      )}

      {/* NAVEGACIÓN DE PESTAÑAS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button
          type="button"
          className={activeTab === 'directory' ? 'primary-button' : 'secondary-button'}
          onClick={() => setActiveTab('directory')}
          style={{ padding: '8px 24px' }}
        >
          Directorio
        </button>
        {canWriteInventory && (
          <button
            type="button"
            className={activeTab === 'admin' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveTab('admin')}
            style={{ padding: '8px 24px' }}
          >
            Administración
          </button>
        )}
      </div>

      {/* PESTAÑA 1: DIRECTORIO (Toda la pantalla) */}
      {activeTab === 'directory' && (
        <div className="panel" style={{ width: '100%' }}>
          <div className="panel-heading split-heading" style={{ alignItems: 'center' }}>
            <div>
              <p className="eyebrow">Listado</p>
              <h3>{isLoading ? 'Cargando...' : `${filteredStations.length} estaciones encontradas`}</h3>
            </div>
            
            {/* BUSCADOR */}
            <div style={{ minWidth: '250px' }}>
              <input
                type="search"
                placeholder="Buscar por código o laboratorio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          {stations.length === 0 && !isLoading ? (
            <div className="empty-list" style={{ padding: '40px 0' }}>
              <strong>No hay estaciones registradas</strong>
              <p>Ve a la pestaña de Administración para crear el primer laboratorio.</p>
            </div>
          ) : filteredStations.length === 0 ? (
            <div className="empty-list" style={{ padding: '40px 0' }}>
              <strong>Sin resultados</strong>
              <p>No se encontraron estaciones con la búsqueda "{searchQuery}".</p>
            </div>
          ) : (
            <div className="stations-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginTop: '16px' }}>
              {filteredStations.map((station) => (
                <article key={station.id} className="station-row" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div>
                    <div className="station-title-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{station.code}</strong>
                      <span className={`status-pill status-${station.status}`}>
                        {statusLabels[station.status]}
                      </span>
                    </div>

                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                      {station.laboratories?.name ?? 'Laboratorio sin nombre'}
                      <br />
                      {station.location_label ? `📍 ${station.location_label}` : '📍 Sin ubicación específica'}
                    </p>
                  </div>

                  <Link to={`/estaciones/${station.id}`} className="secondary-button" style={{ width: '100%', textAlign: 'center', marginTop: 'auto' }}>
                    Abrir expediente
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: ADMINISTRACIÓN (Solo si tiene permisos) */}
      {activeTab === 'admin' && canWriteInventory && (
        <div className="stations-workspace">
          <div className="stations-forms" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <div className="panel" style={{ marginBottom: '24px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                <strong>Área de configuración:</strong> Utiliza estos formularios únicamente cuando se inaugure un nuevo laboratorio físico o se instalen nuevas mesas de trabajo.
              </p>
            </div>

            <form className="data-form" onSubmit={handleCreateLaboratory} style={{ marginBottom: '32px' }}>
              <div className="form-heading">
                <p className="eyebrow">Paso 1</p>
                <h3>Registrar nuevo laboratorio</h3>
              </div>

              <div className="form-row">
                <label>
                  Código
                  <input
                    value={labCode}
                    onChange={(event) => setLabCode(event.target.value)}
                    placeholder="LAB-CIBER"
                    required
                  />
                </label>

                <label>
                  Nombre
                  <input
                    value={labName}
                    onChange={(event) => setLabName(event.target.value)}
                    placeholder="Lab. de Ciberseguridad"
                    required
                  />
                </label>
              </div>

              <label>
                Edificio o ubicación
                <input
                  value={labBuilding}
                  onChange={(event) => setLabBuilding(event.target.value)}
                  placeholder="Edificio A, aula 3"
                />
              </label>

              <button className="primary-button" type="submit" disabled={isSavingLab}>
                {isSavingLab ? 'Guardando...' : 'Guardar laboratorio'}
              </button>
            </form>

            <form className="data-form" onSubmit={handleCreateStation}>
              <div className="form-heading">
                <p className="eyebrow">Paso 2</p>
                <h3>Crear estaciones de trabajo</h3>
              </div>

              <label>
                Laboratorio destino
                <select
                  value={selectedLaboratoryId}
                  onChange={(event) => setSelectedLaboratoryId(event.target.value)}
                  required
                >
                  <option value="">Selecciona laboratorio</option>
                  {laboratories.map((laboratory) => (
                    <option key={laboratory.id} value={laboratory.id}>
                      {laboratory.code} - {laboratory.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label>
                  Código de la estación
                  <input
                    value={stationCode}
                    onChange={(event) => setStationCode(event.target.value)}
                    placeholder="EST-001"
                    required
                  />
                </label>

                <label>
                  Ubicación visible
                  <input
                    value={locationLabel}
                    onChange={(event) => setLocationLabel(event.target.value)}
                    placeholder="Fila 1, equipo 1"
                  />
                </label>
              </div>

              <label>
                Notas (Opcional)
                <textarea
                  value={stationNotes}
                  onChange={(event) => setStationNotes(event.target.value)}
                  placeholder="Observaciones de instalación, red o mobiliario"
                  rows={2}
                />
              </label>

              <button className="primary-button" type="submit" disabled={isSavingStation}>
                {isSavingStation ? 'Creando...' : 'Añadir estación al catálogo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default StationsPage