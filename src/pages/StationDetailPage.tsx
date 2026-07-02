import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import StationQrCard from '../components/qr/StationQrCard'
import { useAuth } from '../features/auth/useAuth'
import { supabase } from '../lib/supabase'

type StationStatus = 'active' | 'inactive' | 'maintenance'
type AssetType = 'cpu' | 'monitor'
type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'damaged' | 'retired' | 'lost'
type PeripheralType = 'keyboard' | 'mouse' | 'headset' | 'speakers' | 'webcam' | 'ups' | 'other'
type PeripheralCondition = 'good' | 'damaged' | 'mixed' | 'not_applicable'

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

type Movement = {
  id: string
  movement_type: string
  reason: string | null
  notes: string | null
  created_at: string
  assets: {
    asset_code: string
    asset_type: AssetType
  } | null
}

type MovementRow = Omit<Movement, 'assets'> & {
  assets: Movement['assets'][] | Movement['assets']
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
  damaged: 'Dañado',
  retired: 'Retirado',
  lost: 'Perdido',
}

const peripheralTypeLabels: Record<PeripheralType, string> = {
  keyboard: 'Teclado',
  mouse: 'Mouse',
  headset: 'Audífonos',
  speakers: 'Bocinas',
  webcam: 'Webcam',
  ups: 'UPS',
  other: 'Otro',
}

const peripheralConditionLabels: Record<PeripheralCondition, string> = {
  good: 'Buen estado',
  damaged: 'Dañado',
  mixed: 'Mixto',
  not_applicable: 'No aplica',
}

const peripheralTypes = Object.keys(peripheralTypeLabels) as PeripheralType[]

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
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

function mapMovement(row: MovementRow): Movement {
  const asset = Array.isArray(row.assets)
    ? row.assets[0] ?? null
    : row.assets

  return {
    ...row,
    assets: asset,
  }
}

function StationDetailPage() {
  const { stationId } = useParams()
  const { user } = useAuth()
  const [station, setStation] = useState<StationDetail | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [peripherals, setPeripherals] = useState<StationPeripheral[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingAsset, setIsSavingAsset] = useState(false)
  const [isSavingPeripheral, setIsSavingPeripheral] = useState(false)
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

  async function fetchStationBundle(nextStationId: string) {
    const [stationResult, assetsResult, peripheralsResult, movementsResult] = await Promise.all([
      supabase
        .from('stations')
        .select('id, code, location_label, notes, status, laboratories(code, name, building)')
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
        .select('id, movement_type, reason, notes, created_at, assets(asset_code, asset_type)')
        .eq('to_station_id', nextStationId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    return { stationResult, assetsResult, peripheralsResult, movementsResult }
  }

  async function loadStationBundle() {
    if (!stationId) return

    setIsLoading(true)
    setLoadError('')

    const { stationResult, assetsResult, peripheralsResult, movementsResult } =
      await fetchStationBundle(stationId)

    if (stationResult.error || !stationResult.data || assetsResult.error || peripheralsResult.error) {
      setLoadError('No fue posible cargar esta estación.')
      setIsLoading(false)
      return
    }

    setStation(mapStationDetail(stationResult.data as unknown as StationDetailRow))
    setAssets((assetsResult.data ?? []) as Asset[])
    setPeripherals((peripheralsResult.data ?? []) as StationPeripheral[])
    setMovements(((movementsResult.data ?? []) as unknown as MovementRow[]).map(mapMovement))
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      if (!stationId) {
        setLoadError('No se recibió el identificador de la estación.')
        setIsLoading(false)
        return
      }

      const { stationResult, assetsResult, peripheralsResult, movementsResult } =
        await fetchStationBundle(stationId)

      if (!isMounted) return

      if (stationResult.error || !stationResult.data || assetsResult.error || peripheralsResult.error) {
        setLoadError('No fue posible cargar esta estación.')
        setIsLoading(false)
        return
      }

      setStation(mapStationDetail(stationResult.data as unknown as StationDetailRow))
      setAssets((assetsResult.data ?? []) as Asset[])
      setPeripherals((peripheralsResult.data ?? []) as StationPeripheral[])
      setMovements(((movementsResult.data ?? []) as unknown as MovementRow[]).map(mapMovement))
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

    if (!stationId || !station) {
      setFormMessage('No hay una estación válida para asignar el equipo.')
      return
    }

    if (assignedAssetsByType[assetType]) {
      setFormMessage(`Esta estación ya tiene ${assetTypeLabels[assetType]} asignado.`)
      return
    }

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
      setFormMessage('No fue posible registrar el equipo. Revisa permisos, código o serie duplicada.')
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
        reason: 'Asignación inicial a estación',
        notes: `Asignado a ${station.code}`,
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
        ? 'Equipo registrado, pero no se pudo guardar el movimiento.'
        : 'Equipo registrado y asignado correctamente.',
    )
    setIsSavingAsset(false)

    void loadStationBundle()
  }

  async function handleSavePeripheral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage('')

    if (!stationId) {
      setFormMessage('No hay una estación válida para actualizar periféricos.')
      return
    }

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
      setFormMessage('No fue posible actualizar el checklist. Revisa permisos o cantidades.')
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
    setFormMessage('Checklist de periféricos actualizado correctamente.')
    setIsSavingPeripheral(false)
  }

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

      {formMessage && (
        <div className="inline-message" role="status">
          {formMessage}
        </div>
      )}

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
                  <div>
                    <dt>Marca</dt>
                    <dd>{asset.brand ?? 'Sin dato'}</dd>
                  </div>
                  <div>
                    <dt>Modelo</dt>
                    <dd>{asset.model ?? 'Sin dato'}</dd>
                  </div>
                  <div>
                    <dt>Serie</dt>
                    <dd>{asset.serial_number ?? 'Sin dato'}</dd>
                  </div>
                  {asset.notes && (
                    <div>
                      <dt>Notas</dt>
                      <dd>{asset.notes}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="equipment-empty">
                  Registra este equipo para completar la estación.
                </p>
              )}
            </article>
          )
        })}
      </div>

      <section className="panel peripherals-panel">
        <div className="panel-heading split-heading">
          <div>
            <p className="eyebrow">Checklist</p>
            <h3>Periféricos de la estación</h3>
          </div>
          <span className="context-pill">{peripherals.length} revisados</span>
        </div>

        <div className="peripheral-grid">
          {peripheralTypes.map((type) => {
            const peripheral = peripheralsByType[type]
            const isComplete = peripheral
              ? peripheral.present_quantity >= peripheral.expected_quantity
              : false

            return (
              <article key={type} className="peripheral-card">
                <div className="peripheral-card-header">
                  <strong>{peripheralTypeLabels[type]}</strong>
                  <span className={`status-pill ${isComplete ? 'status-active' : 'status-maintenance'}`}>
                    {peripheral ? `${peripheral.present_quantity}/${peripheral.expected_quantity}` : 'Sin revisar'}
                  </span>
                </div>

                <p>
                  {peripheral
                    ? peripheralConditionLabels[peripheral.condition]
                    : 'Pendiente de registrar'}
                </p>

                {peripheral?.notes && <small>{peripheral.notes}</small>}
              </article>
            )
          })}
        </div>
      </section>

      <div className="station-operations-grid">
        <form className="data-form" onSubmit={handleCreateAsset}>
          <div className="form-heading">
            <p className="eyebrow">Asignación</p>
            <h3>Registrar CPU o monitor</h3>
          </div>

          <label>
            Tipo de equipo
            <select
              value={assetType}
              onChange={(event) => {
                const nextType = event.target.value as AssetType
                setAssetType(nextType)
                setAssetCode(nextType === 'cpu' ? 'CPU-001' : 'MON-001')
              }}
            >
              <option value="cpu" disabled={Boolean(assignedAssetsByType.cpu)}>
                CPU
              </option>
              <option value="monitor" disabled={Boolean(assignedAssetsByType.monitor)}>
                Monitor
              </option>
            </select>
          </label>

          <label>
            Código de activo
            <input
              value={assetCode}
              onChange={(event) => setAssetCode(event.target.value)}
              placeholder={assetType === 'cpu' ? 'CPU-001' : 'MON-001'}
              required
            />
          </label>

          <div className="form-row">
            <label>
              Marca
              <input
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Dell, HP, Lenovo"
              />
            </label>

            <label>
              Modelo
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="OptiPlex, ThinkCentre"
              />
            </label>
          </div>

          <label>
            Número de serie
            <input
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="Serie del fabricante"
            />
          </label>

          <label>
            Notas
            <textarea
              value={assetNotes}
              onChange={(event) => setAssetNotes(event.target.value)}
              placeholder="Condición física, accesorios incluidos o detalles de red"
              rows={3}
            />
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={isSavingAsset || Boolean(assignedAssetsByType.cpu && assignedAssetsByType.monitor)}
          >
            {isSavingAsset ? 'Guardando...' : 'Asignar equipo'}
          </button>
        </form>

        <form className="data-form" onSubmit={handleSavePeripheral}>
          <div className="form-heading">
            <p className="eyebrow">Revisión</p>
            <h3>Actualizar periférico</h3>
          </div>

          <label>
            Periférico
            <select
              value={peripheralType}
              onChange={(event) => setPeripheralType(event.target.value as PeripheralType)}
            >
              {peripheralTypes.map((type) => (
                <option key={type} value={type}>
                  {peripheralTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label>
              Esperados
              <input
                type="number"
                min="1"
                value={expectedQuantity}
                onChange={(event) => setExpectedQuantity(Number(event.target.value))}
                required
              />
            </label>

            <label>
              Presentes
              <input
                type="number"
                min="0"
                value={presentQuantity}
                onChange={(event) => setPresentQuantity(Number(event.target.value))}
                required
              />
            </label>
          </div>

          <label>
            Condición
            <select
              value={peripheralCondition}
              onChange={(event) =>
                setPeripheralCondition(event.target.value as PeripheralCondition)
              }
            >
              {Object.entries(peripheralConditionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Notas
            <textarea
              value={peripheralNotes}
              onChange={(event) => setPeripheralNotes(event.target.value)}
              placeholder="Faltante, daño visible, cambio pendiente"
              rows={3}
            />
          </label>

          <button className="primary-button" type="submit" disabled={isSavingPeripheral}>
            {isSavingPeripheral ? 'Guardando...' : 'Guardar revisión'}
          </button>
        </form>

        <article className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Historial reciente</p>
            <h3>Movimientos de asignación</h3>
          </div>

          {movements.length === 0 ? (
            <div className="empty-list">
              <strong>Sin movimientos todavía</strong>
              <p>Al asignar CPU o monitor aparecerá el rastro inicial.</p>
            </div>
          ) : (
            <div className="movement-list">
              {movements.map((movement) => (
                <div key={movement.id} className="movement-row">
                  <strong>
                    {movement.assets?.asset_code ?? 'Activo'} ·{' '}
                    {movement.assets ? assetTypeLabels[movement.assets.asset_type] : 'Equipo'}
                  </strong>
                  <span>{new Date(movement.created_at).toLocaleString()}</span>
                  <p>{movement.reason ?? movement.notes ?? movement.movement_type}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}

export default StationDetailPage
