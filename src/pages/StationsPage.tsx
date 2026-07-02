import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Laboratory = {
  id: string
  code: string
  name: string
  building: string | null
  is_active: boolean
}

type StationStatus = 'active' | 'inactive' | 'maintenance'

type Station = {
  id: string
  code: string
  location_label: string | null
  notes: string | null
  status: StationStatus
  laboratory_id: string
  laboratories: Pick<Laboratory, 'id' | 'code' | 'name'> | null
}

type StationRow = Omit<Station, 'laboratories'> & {
  laboratories: Pick<Laboratory, 'id' | 'code' | 'name'>[] | Pick<Laboratory, 'id' | 'code' | 'name'> | null
}

const statusLabels: Record<StationStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  maintenance: 'Mantenimiento',
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

function mapStation(row: StationRow): Station {
  const laboratory = Array.isArray(row.laboratories)
    ? row.laboratories[0] ?? null
    : row.laboratories

  return {
    ...row,
    laboratories: laboratory,
  }
}

function StationsPage() {
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

  async function fetchInventoryBase() {
    const [laboratoriesResult, stationsResult] = await Promise.all([
      supabase
        .from('laboratories')
        .select('id, code, name, building, is_active')
        .order('code', { ascending: true }),
      supabase
        .from('stations')
        .select(
          'id, code, location_label, notes, status, laboratory_id, laboratories(id, code, name)',
        )
        .order('code', { ascending: true }),
    ])

    return { laboratoriesResult, stationsResult }
  }

  async function loadData() {
    setIsLoading(true)
    setLoadError('')

    const { laboratoriesResult, stationsResult } = await fetchInventoryBase()

    if (laboratoriesResult.error || stationsResult.error) {
      setLoadError('No fue posible cargar laboratorios y estaciones.')
      setIsLoading(false)
      return
    }

    const nextLaboratories = laboratoriesResult.data ?? []

    setLaboratories(nextLaboratories)
    setStations(((stationsResult.data ?? []) as unknown as StationRow[]).map(mapStation))
    setSelectedLaboratoryId((current) => current || nextLaboratories[0]?.id || '')
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const { laboratoriesResult, stationsResult } = await fetchInventoryBase()

      if (!isMounted) return

      if (laboratoriesResult.error || stationsResult.error) {
        setLoadError('No fue posible cargar laboratorios y estaciones.')
        setIsLoading(false)
        return
      }

      const nextLaboratories = laboratoriesResult.data ?? []

      setLaboratories(nextLaboratories)
      setStations(((stationsResult.data ?? []) as unknown as StationRow[]).map(mapStation))
      setSelectedLaboratoryId(nextLaboratories[0]?.id || '')
      setIsLoading(false)
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedLaboratory = useMemo(
    () => laboratories.find((laboratory) => laboratory.id === selectedLaboratoryId),
    [laboratories, selectedLaboratoryId],
  )

  async function handleCreateLaboratory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')
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
      setFormMessage('No fue posible registrar el laboratorio. Revisa tu rol o si el código ya existe.')
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
      .select(
        'id, code, location_label, notes, status, laboratory_id, laboratories(id, code, name)',
      )
      .single()

    if (error || !data) {
      setFormMessage('No fue posible crear la estación. Revisa permisos o si el código ya existe.')
      setIsSavingStation(false)
      return
    }

    setStations((current) =>
      [...current, mapStation(data as unknown as StationRow)].sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
    )
    setStationCode('')
    setLocationLabel('')
    setStationNotes('')
    setFormMessage('Estación creada correctamente.')
    setIsSavingStation(false)
  }

  return (
    <section className="stations-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Inventario base</p>
          <h2>Estaciones de trabajo</h2>
          <p>
            Registra cada puesto del laboratorio como una estación para después
            asociar CPU, monitor, periféricos y código QR.
          </p>
        </div>

        <button className="secondary-button" type="button" onClick={() => void loadData()}>
          Actualizar
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

      <div className="stations-workspace">
        <div className="stations-forms">
          <form className="data-form" onSubmit={handleCreateLaboratory}>
            <div className="form-heading">
              <p className="eyebrow">Paso 1</p>
              <h3>Registrar laboratorio</h3>
            </div>

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
                placeholder="Laboratorio de Ciberseguridad"
                required
              />
            </label>

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
              <h3>Crear estación</h3>
            </div>

            <label>
              Laboratorio
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

            <label>
              Código de estación
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

            <label>
              Notas
              <textarea
                value={stationNotes}
                onChange={(event) => setStationNotes(event.target.value)}
                placeholder="Observaciones de instalación, red o mobiliario"
                rows={3}
              />
            </label>

            <button className="primary-button" type="submit" disabled={isSavingStation}>
              {isSavingStation ? 'Creando...' : 'Crear estación'}
            </button>
          </form>
        </div>

        <div className="stations-list-panel">
          <div className="panel-heading split-heading">
            <div>
              <p className="eyebrow">Listado</p>
              <h3>{isLoading ? 'Cargando estaciones' : `${stations.length} estaciones`}</h3>
            </div>

            {selectedLaboratory && (
              <span className="context-pill">{selectedLaboratory.code}</span>
            )}
          </div>

          {stations.length === 0 && !isLoading ? (
            <div className="empty-list">
              <strong>No hay estaciones registradas</strong>
              <p>Crea la primera estación para comenzar a relacionar equipos y QR.</p>
            </div>
          ) : (
            <div className="stations-list">
              {stations.map((station) => (
                <article key={station.id} className="station-row">
                  <div>
                    <div className="station-title-row">
                      <strong>{station.code}</strong>
                      <span className={`status-pill status-${station.status}`}>
                        {statusLabels[station.status]}
                      </span>
                    </div>

                    <p>
                      {station.laboratories?.name ?? 'Laboratorio sin nombre'}
                      {station.location_label ? ` - ${station.location_label}` : ''}
                    </p>
                  </div>

                  <Link to={`/estaciones/${station.id}`} className="secondary-button">
                    Ver detalle
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default StationsPage
