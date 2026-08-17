import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import StationQrCard from '../components/qr/StationQrCard'
import { useAuth } from '../features/auth/useAuth'
import type { InventoryRole } from '../features/auth/AuthContext'
import { supabase } from '../lib/supabase'

type StationStatus = 'active' | 'inactive' | 'maintenance'
type AssetType = 'cpu' | 'monitor'
type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'damaged' | 'retired' | 'lost'
type PeripheralType = 'keyboard' | 'mouse' | 'headset' | 'speakers' | 'webcam' | 'ups' | 'other'
type PeripheralCondition = 'good' | 'damaged' | 'mixed' | 'not_applicable'
type IncidentStatus = 'open' | 'resolved'

type Laboratory = {
  id: string
  code: string
  name: string
  building: string | null
}

type StationDetailRecord = {
  id: string
  code: string
  location_label: string | null
  notes: string | null
  status: StationStatus
  laboratory_id: string
}

type StationDetail = StationDetailRecord & {
  laboratories: Pick<Laboratory, 'code' | 'name' | 'building'> | null
}

type Asset = {
  id: string
  asset_code: string
  asset_type: AssetType
  brand: string | null
  model: string | null
  serial_number: string | null
  status: AssetStatus
  notes: string | null
}

type MovementRecord = {
  id: string
  asset_id: string
  movement_type: string
  reason: string | null
  notes: string | null
  created_at: string
}

type Movement = MovementRecord & {
  assets: {
    asset_code: string
    asset_type: AssetType
  } | null
}

type StationPeripheral = {
  id: string
  peripheral_type: PeripheralType
  expected_quantity: number
  present_quantity: number
  condition: PeripheralCondition
  notes: string | null
  last_checked_at: string | null
}

type StationIncident = {
  id: string
  description: string
  status: IncidentStatus
  created_at: string
  resolved_at: string | null
}

type SupabaseError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

const statusLabels: Record<StationStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  maintenance: 'Mantenimiento',
}

const assetTypeLabels: Record<AssetType, string> = {
  cpu: 'CPU',
  monitor: 'Monitor',
}

const assetStatusLabels: Record<AssetStatus, string> = {
  available: 'Disponible',
  assigned: 'Asignado',
  maintenance: 'Mantenimiento',
  damaged: 'Danado',
  retired: 'Retirado',
  lost: 'Perdido',
}

const peripheralTypeLabels: Record<PeripheralType, string> = {
  keyboard: 'Teclado',
  mouse: 'Mouse',
  headset: 'Audifonos',
  speakers: 'Bocinas',
  webcam: 'Webcam',
  ups: 'UPS',
  other: 'Otro',
}

const peripheralConditionLabels: Record<PeripheralCondition, string> = {
  good: 'Buen estado',
  damaged: 'Danado',
  mixed: 'Mixto',
  not_applicable: 'No aplica',
}

const roleLabels: Record<InventoryRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Consulta',
}

const peripheralTypes = Object.keys(peripheralTypeLabels) as PeripheralType[]

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

function getSupabaseErrorSummary(error: SupabaseError) {
  const parts = [error.message, error.details, error.hint].filter(Boolean)

  if (parts.length === 0) {
    return 'Revisa la conexion e intenta de nuevo.'
  }

  return parts.join(' ')
}

function getInventoryWriteErrorMessage(entityLabel: string, error: SupabaseError) {
  const message = error.message?.toLowerCase() ?? ''

  if (error.code === '23505') {
    return `El codigo de ${entityLabel} ya existe.`
  }

  if (error.code === '23514') {
    return `Revisa que los datos de ${entityLabel} sean validos.`
  }

  if (
    error.code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return 'Tu rol actual no permite modificar inventario. Pide que tu perfil sea Administrador u Operador.'
  }

  return `No fue posible guardar ${entityLabel}. ${getSupabaseErrorSummary(error)}`
}

function mapStationDetail(
  station: StationDetailRecord,
  laboratory: Pick<Laboratory, 'code' | 'name' | 'building'> | null,
): StationDetail {
  return {
    ...station,
    laboratories: laboratory,
  }
}

function mapMovement(
  movement: MovementRecord,
  assetsById: Record<string, Pick<Asset, 'asset_code' | 'asset_type'>>,
): Movement {
  return {
    ...movement,
    assets: assetsById[movement.asset_id] ?? null,
  }
}

function getAssetsById(assets: Pick<Asset, 'id' | 'asset_code' | 'asset_type'>[]) {
  return assets.reduce<Record<string, Pick<Asset, 'asset_code' | 'asset_type'>>>(
    (current, asset) => {
      current[asset.id] = {
        asset_code: asset.asset_code,
        asset_type: asset.asset_type,
      }
      return current
    },
    {},
  )
}

function StationDetailPage() {
  const { stationId } = useParams()
  const { user, profile, canWriteInventory } = useAuth()
  const currentRoleLabel = profile?.role ? roleLabels[profile.role] : 'Sin perfil'

  const [station, setStation] = useState<StationDetail | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [peripherals, setPeripherals] = useState<StationPeripheral[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [incidents, setIncidents] = useState<StationIncident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [isSavingAsset, setIsSavingAsset] = useState(false)
  const [isSavingPeripheral, setIsSavingPeripheral] = useState(false)
  const [isSavingIncident, setIsSavingIncident] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formMessage, setFormMessage] = useState('')

  const [assetType, setAssetType] = useState<AssetType>('cpu')
  const [assetCode, setAssetCode] = useState('CPU-001')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [assetNotes, setAssetNotes] = useState('')
  
  const [peripheralType, setPeripheralType] = useState<PeripheralType>('keyboard')
  const [expectedQuantity, setExpectedQuantity] = useState(1)
  const [presentQuantity, setPresentQuantity] = useState(1)
  const [peripheralCondition, setPeripheralCondition] = useState<PeripheralCondition>('good')
  const [peripheralNotes, setPeripheralNotes] = useState('')
  
  const [incidentDescription, setIncidentDescription] = useState('')

  // Control de pestañas globales
  const [activeTab, setActiveTab] = useState<'audit' | 'dossier'>('audit')

  async function fetchStationBundle(nextStationId: string) {
    const [stationResult, assetsResult, peripheralsResult, movementsResult, incidentsResult] = await Promise.all([
      supabase
        .from('stations')
        .select('id, code, location_label, notes, status, laboratory_id')
        .eq('id', nextStationId)
        .single(),
      supabase
        .from('assets')
        .select('id, asset_code, asset_type, brand, model, serial_number, status, notes')
        .eq('station_id', nextStationId)
        .order('asset_type', { ascending: true }),
      supabase
        .from('station_peripherals')
        .select('id, peripheral_type, expected_quantity, present_quantity, condition, notes, last_checked_at')
        .eq('station_id', nextStationId)
        .order('peripheral_type', { ascending: true }),
      supabase
        .from('asset_movements')
        .select('id, asset_id, movement_type, reason, notes, created_at')
        .eq('to_station_id', nextStationId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('station_incidents')
        .select('id, description, status, created_at, resolved_at')
        .eq('station_id', nextStationId)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
    ])

    const stationRecord = stationResult.data as StationDetailRecord | null

    const laboratoryResult = stationRecord?.laboratory_id
      ? await supabase
          .from('laboratories')
          .select('code, name, building')
          .eq('id', stationRecord.laboratory_id)
          .maybeSingle()
      : { data: null, error: null }

    const movementRows = (movementsResult.data ?? []) as MovementRecord[]
    const movementAssetIds = Array.from(new Set(movementRows.map((movement) => movement.asset_id)))

    const movementAssetsResult = movementAssetIds.length > 0
      ? await supabase
          .from('assets')
          .select('id, asset_code, asset_type')
          .in('id', movementAssetIds)
      : { data: [], error: null }

    return {
      stationResult,
      laboratoryResult,
      assetsResult,
      peripheralsResult,
      movementsResult,
      movementAssetsResult,
      incidentsResult
    }
  }

  function applyStationBundle(
    stationRecord: StationDetailRecord,
    laboratory: Pick<Laboratory, 'code' | 'name' | 'building'> | null,
    nextAssets: Asset[],
    nextPeripherals: StationPeripheral[],
    nextMovements: MovementRecord[],
    movementAssets: Pick<Asset, 'id' | 'asset_code' | 'asset_type'>[],
    nextIncidents: StationIncident[]
  ) {
    setStation(mapStationDetail(stationRecord, laboratory))
    setAssets(nextAssets)
    setPeripherals(nextPeripherals)
    setMovements(nextMovements.map((movement) => mapMovement(movement, getAssetsById(movementAssets))))
    setIncidents(nextIncidents)
  }

  async function loadStationBundle() {
    if (!stationId) return

    setIsLoading(true)
    setLoadError('')

    const {
      stationResult,
      laboratoryResult,
      assetsResult,
      peripheralsResult,
      movementsResult,
      movementAssetsResult,
      incidentsResult
    } = await fetchStationBundle(stationId)

    if (stationResult.error || !stationResult.data || assetsResult.error || peripheralsResult.error) {
      const error = stationResult.error ?? assetsResult.error ?? peripheralsResult.error
      setLoadError(
        `No fue posible cargar esta estacion. ${
          error ? getSupabaseErrorSummary(error) : 'Intenta de nuevo.'
        }`,
      )
      setIsLoading(false)
      return
    }

    applyStationBundle(
      stationResult.data as StationDetailRecord,
      laboratoryResult.data as Pick<Laboratory, 'code' | 'name' | 'building'> | null,
      (assetsResult.data ?? []) as Asset[],
      (peripheralsResult.data ?? []) as StationPeripheral[],
      movementsResult.error ? [] : ((movementsResult.data ?? []) as MovementRecord[]),
      movementAssetsResult.error
        ? []
        : ((movementAssetsResult.data ?? []) as Pick<Asset, 'id' | 'asset_code' | 'asset_type'>[]),
      incidentsResult.error ? [] : ((incidentsResult.data ?? []) as StationIncident[])
    )
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      if (!stationId) {
        setLoadError('No se recibio el identificador de la estacion.')
        setIsLoading(false)
        return
      }

      const {
        stationResult,
        laboratoryResult,
        assetsResult,
        peripheralsResult,
        movementsResult,
        movementAssetsResult,
        incidentsResult
      } = await fetchStationBundle(stationId)

      if (!isMounted) return

      if (stationResult.error || !stationResult.data || assetsResult.error || peripheralsResult.error) {
        const error = stationResult.error ?? assetsResult.error ?? peripheralsResult.error
        setLoadError(
          `No fue posible cargar esta estacion. ${
            error ? getSupabaseErrorSummary(error) : 'Intenta de nuevo.'
          }`,
        )
        setIsLoading(false)
        return
      }

      applyStationBundle(
        stationResult.data as StationDetailRecord,
        laboratoryResult.data as Pick<Laboratory, 'code' | 'name' | 'building'> | null,
        (assetsResult.data ?? []) as Asset[],
        (peripheralsResult.data ?? []) as StationPeripheral[],
        movementsResult.error ? [] : ((movementsResult.data ?? []) as MovementRecord[]),
        movementAssetsResult.error
          ? []
          : ((movementAssetsResult.data ?? []) as Pick<Asset, 'id' | 'asset_code' | 'asset_type'>[]),
        incidentsResult.error ? [] : ((incidentsResult.data ?? []) as StationIncident[])
      )
      setIsLoading(false)
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [stationId])

  const qrUrl = useMemo(() => {
    if (!station) return ''
    return `${window.location.origin}/estaciones/${station.id}`
  }, [station])

  const assignedAssetsByType = useMemo(
    () =>
      assets.reduce<Partial<Record<AssetType, Asset>>>((current, asset) => {
        current[asset.asset_type] = asset
        return current
      }, {}),
    [assets],
  )

  const peripheralsByType = useMemo(
    () =>
      peripherals.reduce<Partial<Record<PeripheralType, StationPeripheral>>>(
        (current, peripheral) => {
          current[peripheral.peripheral_type] = peripheral
          return current
        },
        {},
      ),
    [peripherals],
  )

  async function handleCreateAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    if (!canWriteInventory) return

    setIsSavingAsset(true)

    const { data: createdAsset, error: assetError } = await supabase
      .from('assets')
      .insert({
        asset_code: normalizeCode(assetCode),
        asset_type: assetType,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serial_number: serialNumber.trim() || null,
        station_id: stationId,
        status: 'assigned',
        notes: assetNotes.trim() || null,
      })
      .select('id, asset_code, asset_type, brand, model, serial_number, status, notes')
      .single()

    if (assetError || !createdAsset) {
      setFormMessage(
        assetError
          ? getInventoryWriteErrorMessage('el equipo', assetError)
          : 'No fue posible registrar el equipo. Intenta de nuevo.',
      )
      setIsSavingAsset(false)
      return
    }

    const { error: movementError } = await supabase
      .from('asset_movements')
      .insert({
        asset_id: createdAsset.id,
        movement_type: 'assignment',
        to_station_id: stationId,
        previous_status: 'available',
        new_status: 'assigned',
        reason: 'Asignacion inicial a estacion',
        notes: `Asignado a ${station?.code}`,
        performed_by: user?.id ?? null,
      })

    setAssets((current) =>
      [...current, createdAsset as Asset].sort((a, b) =>
        a.asset_type.localeCompare(b.asset_type),
      ),
    )
    setBrand('')
    setModel('')
    setSerialNumber('')
    setAssetNotes('')
    setAssetCode(assetType === 'cpu' ? 'MON-001' : 'CPU-001')
    setAssetType(assetType === 'cpu' ? 'monitor' : 'cpu')
    setFormMessage(
      movementError
        ? `Equipo registrado, pero no se pudo guardar el movimiento. ${getSupabaseErrorSummary(movementError)}`
        : 'Equipo registrado y asignado correctamente.',
    )
    setIsSavingAsset(false)
    void loadStationBundle()
  }

  async function handleSavePeripheral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    if (!canWriteInventory || !stationId) return
    if (presentQuantity > expectedQuantity) {
      setFormMessage('La cantidad presente no puede ser mayor a la cantidad esperada.')
      return
    }

    setIsSavingPeripheral(true)

    const { data, error } = await supabase
      .from('station_peripherals')
      .upsert(
        {
          station_id: stationId,
          peripheral_type: peripheralType,
          expected_quantity: expectedQuantity,
          present_quantity: presentQuantity,
          condition: peripheralCondition,
          notes: peripheralNotes.trim() || null,
          last_checked_at: new Date().toISOString(),
          last_checked_by: user?.id ?? null,
        },
        { onConflict: 'station_id,peripheral_type' },
      )
      .select('id, peripheral_type, expected_quantity, present_quantity, condition, notes, last_checked_at')
      .single()

    if (error || !data) {
      setFormMessage(
        error
          ? getInventoryWriteErrorMessage('el checklist', error)
          : 'No fue posible actualizar el checklist. Intenta de nuevo.',
      )
      setIsSavingPeripheral(false)
      return
    }

    setPeripherals((current) => {
      const next = current.filter((item) => item.peripheral_type !== data.peripheral_type)
      return [...next, data as StationPeripheral].sort((a, b) =>
        a.peripheral_type.localeCompare(b.peripheral_type),
      )
    })
    setPeripheralNotes('')
    setFormMessage('Checklist de perifericos actualizado correctamente.')
    setIsSavingPeripheral(false)
  }

  async function handleCreateIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    if (!canWriteInventory || !stationId) return

    setIsSavingIncident(true)

    const { data, error } = await supabase
      .from('station_incidents')
      .insert({
        station_id: stationId,
        description: incidentDescription.trim(),
        status: 'open',
        reported_by: user?.id ?? null,
      })
      .select('id, description, status, created_at, resolved_at')
      .single()

    if (error || !data) {
      setFormMessage('No fue posible reportar la incidencia. Intenta de nuevo.')
      setIsSavingIncident(false)
      return
    }

    setIncidents((current) => [data as StationIncident, ...current].sort((a, b) => a.status.localeCompare(b.status)))
    setIncidentDescription('')
    setFormMessage('Incidencia reportada correctamente.')
    setIsSavingIncident(false)
  }

  async function handleResolveIncident(incidentId: string) {
    if (!canWriteInventory) return

    const { data, error } = await supabase
      .from('station_incidents')
      .update({
        status: 'resolved',
        resolved_by: user?.id ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', incidentId)
      .select('id, description, status, created_at, resolved_at')
      .single()

    if (error || !data) {
      setFormMessage('No fue posible resolver la incidencia.')
      return
    }

    setIncidents((current) => {
      const next = current.map((inc) => (inc.id === incidentId ? (data as StationIncident) : inc))
      return next.sort((a, b) => a.status.localeCompare(b.status))
    })
    setFormMessage('Incidencia marcada como resuelta.')
  }

  if (isLoading) {
    return (
      <section className="placeholder-page">
        <div className="placeholder-icon">□</div>
        <p className="eyebrow">Detalle de estacion</p>
        <h2>Cargando estacion...</h2>
      </section>
    )
  }

  if (loadError || !station) {
    return (
      <section className="placeholder-page">
        <div className="placeholder-icon">□</div>
        <p className="eyebrow">Detalle de estacion</p>
        <h2>Estacion no disponible</h2>
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
          <p className="eyebrow">{station.laboratories?.name ?? 'Laboratorio'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2>{station.code}</h2>
            <span className={`status-pill status-${station.status}`}>
              {statusLabels[station.status]}
            </span>
          </div>
          <p style={{ marginTop: '4px' }}>{station.location_label ?? 'Sin ubicación específica'}</p>
        </div>

        <Link to="/estaciones" className="secondary-button">
          Volver
        </Link>
      </div>

      {formMessage && (
        <div className="inline-message" role="status">
          {formMessage}
        </div>
      )}

      {!canWriteInventory && (
        <div className="inline-message inline-message-warning" role="status">
          Tu rol actual ({currentRoleLabel}) solo permite consultar. Para modificar inventario o reportar fallas, necesitas permisos de Operador.
        </div>
      )}

      {/* NAVEGACIÓN GLOBAL DE PESTAÑAS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <button
          type="button"
          className={activeTab === 'audit' ? 'primary-button' : 'secondary-button'}
          onClick={() => setActiveTab('audit')}
          style={{ flex: 1, padding: '10px' }}
        >
          ✓ Revisión Diaria
        </button>
        <button
          type="button"
          className={activeTab === 'dossier' ? 'primary-button' : 'secondary-button'}
          onClick={() => setActiveTab('dossier')}
          style={{ flex: 1, padding: '10px' }}
        >
          ⚙️ Expediente Técnico
        </button>
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: REVISIÓN DIARIA (AUDITORÍA RÁPIDA) */}
      {/* ========================================================= */}
      {activeTab === 'audit' && (
        <div className="audit-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* ESTATUS DE PERIFÉRICOS (Solo visualización rápida) */}
          <section className="panel peripherals-panel">
            <div className="panel-heading split-heading">
              <div>
                <p className="eyebrow">Checklist</p>
                <h3>Estado actual de accesorios</h3>
              </div>
              <span className="context-pill">{peripherals.length} revisados</span>
            </div>

            <div className="peripheral-grid">
              {peripheralTypes.map((type) => {
                const peripheral = peripheralsByType[type]
                const isComplete = peripheral ? peripheral.present_quantity >= peripheral.expected_quantity : false
                
                return (
                  <article key={type} className="peripheral-card" style={{ padding: '12px' }}>
                    <div className="peripheral-card-header">
                      <strong>{peripheralTypeLabels[type]}</strong>
                      <span className={`status-pill ${isComplete ? 'status-active' : 'status-maintenance'}`}>
                        {peripheral ? `${peripheral.present_quantity}/${peripheral.expected_quantity}` : '0/0'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0', color: peripheral ? '#475569' : '#94a3b8' }}>
                      {peripheral ? peripheralConditionLabels[peripheral.condition] : 'Sin revisar'}
                    </p>
                  </article>
                )
              })}
            </div>
          </section>

          {/* FORMULARIOS DE ACCIÓN RÁPIDA */}
          <div className="station-operations-grid">
            <form className="data-form" onSubmit={handleSavePeripheral}>
              <div className="form-heading">
                <p className="eyebrow">Actualizar</p>
                <h3>Modificar cantidades</h3>
              </div>

              <label>
                Periférico a revisar
                <select
                  value={peripheralType}
                  onChange={(event) => setPeripheralType(event.target.value as PeripheralType)}
                  disabled={!canWriteInventory}
                >
                  {peripheralTypes.map((type) => (
                    <option key={type} value={type}>
                      {peripheralTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label>Esperados
                  <input type="number" min="1" value={expectedQuantity} onChange={(e) => setExpectedQuantity(Number(e.target.value))} disabled={!canWriteInventory} required />
                </label>
                <label>Presentes
                  <input type="number" min="0" value={presentQuantity} onChange={(e) => setPresentQuantity(Number(e.target.value))} disabled={!canWriteInventory} required />
                </label>
              </div>

              <label>Condición
                <select value={peripheralCondition} onChange={(e) => setPeripheralCondition(e.target.value as PeripheralCondition)} disabled={!canWriteInventory}>
                  {Object.entries(peripheralConditionLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="submit" disabled={isSavingPeripheral || !canWriteInventory}>
                {isSavingPeripheral ? 'Guardando...' : 'Guardar revisión'}
              </button>
            </form>

            <form className="data-form" onSubmit={handleCreateIncident}>
              <div className="form-heading">
                <p className="eyebrow">Mantenimiento</p>
                <h3>Reportar un problema</h3>
              </div>
              <label>
                Descripción detallada
                <textarea
                  value={incidentDescription}
                  onChange={(event) => setIncidentDescription(event.target.value)}
                  placeholder="Ej. El cable de red está trozado, el monitor parpadea..."
                  disabled={!canWriteInventory || isSavingIncident}
                  rows={4}
                  required
                />
              </label>
              <button className="secondary-button" type="submit" disabled={isSavingIncident || !canWriteInventory || !incidentDescription.trim()} style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444' }}>
                {isSavingIncident ? 'Enviando...' : 'Generar reporte de falla'}
              </button>
            </form>
          </div>

          {/* LISTA DE INCIDENCIAS ACTIVAS */}
          <section className="panel incidents-panel">
            <div className="panel-heading split-heading">
              <div>
                <p className="eyebrow">Seguimiento</p>
                <h3>Fallas en esta estación</h3>
              </div>
              <span className={`status-pill ${incidents.filter(i => i.status === 'open').length > 0 ? 'status-maintenance' : 'status-active'}`}>
                {incidents.filter(i => i.status === 'open').length} abiertas
              </span>
            </div>

            {incidents.length === 0 ? (
              <div className="empty-list">
                <strong>Mesa en perfectas condiciones</strong>
                <p>No hay reportes activos ni histórico de fallas.</p>
              </div>
            ) : (
              <div className="incident-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {incidents.map((incident) => (
                  <article key={incident.id} className="incident-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: incident.status === 'resolved' ? '#f8fafc' : '#fff' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <span className={`status-pill ${incident.status === 'open' ? 'status-maintenance' : 'status-active'}`}>
                          {incident.status === 'open' ? 'Abierta' : 'Resuelta'}
                        </span>
                        <small style={{ color: '#64748b' }}>
                          {new Date(incident.created_at).toLocaleDateString()}
                        </small>
                      </div>
                      <p style={{ margin: 0, color: incident.status === 'resolved' ? '#94a3b8' : '#0f172a', textDecoration: incident.status === 'resolved' ? 'line-through' : 'none' }}>
                        {incident.description}
                      </p>
                    </div>
                    {incident.status === 'open' && canWriteInventory && (
                      <button
                        className="secondary-button"
                        onClick={() => void handleResolveIncident(incident.id)}
                        style={{ fontSize: '0.85rem', padding: '8px 16px', whiteSpace: 'nowrap', marginLeft: '16px' }}
                      >
                        Marcar resuelta
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: EXPEDIENTE TÉCNICO (CONFIGURACIÓN) */}
      {/* ========================================================= */}
      {activeTab === 'dossier' && (
        <div className="dossier-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="detail-grid">
            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Ubicacion física</p>
                <h3>Datos generales</h3>
              </div>
              <dl className="detail-list">
                <div><dt>Código de laboratorio</dt><dd>{station.laboratories?.code ?? 'Sin dato'}</dd></div>
                <div><dt>Edificio</dt><dd>{station.laboratories?.building ?? 'Sin dato'}</dd></div>
                {station.notes && (<div><dt>Notas de instalación</dt><dd>{station.notes}</dd></div>)}
              </dl>
            </article>

            {/* AQUÍ VA EL QR, LEJOS DE LA VISTA PRINCIPAL */}
            <StationQrCard
              stationCode={station.code}
              laboratoryName={station.laboratories?.name ?? 'Laboratorio sin nombre'}
              qrUrl={qrUrl}
            />
          </div>

          <div className="equipment-grid">
            {(['cpu', 'monitor'] as AssetType[]).map((type) => {
              const asset = assignedAssetsByType[type]
              return (
                <article key={type} className="equipment-card">
                  <div className="equipment-card-header">
                    <div>
                      <p className="eyebrow">{assetTypeLabels[type]}</p>
                      <h3>{asset?.asset_code ?? 'Sin asignar'}</h3>
                    </div>
                    <span className={`status-pill ${asset ? 'status-active' : 'status-inactive'}`}>
                      {asset ? assetStatusLabels[asset.status] : 'Pendiente'}
                    </span>
                  </div>
                  {asset ? (
                    <dl className="asset-list">
                      <div><dt>Marca</dt><dd>{asset.brand ?? 'Sin dato'}</dd></div>
                      <div><dt>Modelo</dt><dd>{asset.model ?? 'Sin dato'}</dd></div>
                      <div><dt>Serie</dt><dd>{asset.serial_number ?? 'Sin dato'}</dd></div>
                    </dl>
                  ) : (
                    <p className="equipment-empty">Equipo no asignado en sistema.</p>
                  )}
                </article>
              )
            })}
          </div>

          <div className="station-operations-grid">
            {canWriteInventory && (
              <form className="data-form" onSubmit={handleCreateAsset}>
                <div className="form-heading">
                  <p className="eyebrow">Alta de activos</p>
                  <h3>Vincular CPU o monitor</h3>
                </div>
                <label>Tipo de equipo
                  <select value={assetType} onChange={(e) => {
                    const nextType = e.target.value as AssetType
                    setAssetType(nextType)
                    setAssetCode(nextType === 'cpu' ? 'CPU-001' : 'MON-001')
                  }}>
                    <option value="cpu" disabled={Boolean(assignedAssetsByType.cpu)}>CPU</option>
                    <option value="monitor" disabled={Boolean(assignedAssetsByType.monitor)}>Monitor</option>
                  </select>
                </label>
                <label>Código interno
                  <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} required />
                </label>
                <div className="form-row">
                  <label>Marca <input value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
                  <label>Modelo <input value={model} onChange={(e) => setModel(e.target.value)} /></label>
                </div>
                <label>Número de serie <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} /></label>
                <button className="primary-button" type="submit" disabled={isSavingAsset || Boolean(assignedAssetsByType.cpu && assignedAssetsByType.monitor)}>
                  {isSavingAsset ? 'Guardando...' : 'Asignar equipo a la mesa'}
                </button>
              </form>
            )}

            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Trazabilidad</p>
                <h3>Últimos movimientos</h3>
              </div>
              {movements.length === 0 ? (
                <div className="empty-list">
                  <strong>Historial en blanco</strong>
                  <p>Al asignar o retirar equipos de esta mesa, aparecerá aquí.</p>
                </div>
              ) : (
                <div className="movement-list">
                  {movements.map((movement) => (
                    <div key={movement.id} className="movement-row">
                      <strong>{movement.assets?.asset_code ?? 'Activo'} · {movement.assets ? assetTypeLabels[movement.assets.asset_type] : 'Equipo'}</strong>
                      <span>{new Date(movement.created_at).toLocaleDateString()}</span>
                      <p>{movement.reason ?? movement.movement_type}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </div>
      )}
    </section>
  )
}

export default StationDetailPage