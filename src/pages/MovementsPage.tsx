import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { supabase } from '../lib/supabase'

type AssetType = 'cpu' | 'monitor'
type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'damaged' | 'retired' | 'lost'
type MovementType = 'assignment' | 'transfer' | 'unassignment' | 'replacement' | 'maintenance' | 'status_change'
type MovementAction =
  | 'transfer'
  | 'send_maintenance'
  | 'mark_damaged'
  | 'mark_lost'
  | 'retire'
  | 'make_available'

type Station = {
  id: string
  code: string
  location_label: string | null
  laboratories: {
    code: string
    name: string
  } | null
}

type StationRow = Omit<Station, 'laboratories'> & {
  laboratories: Station['laboratories'][] | Station['laboratories']
}

type Asset = {
  id: string
  asset_code: string
  asset_type: AssetType
  brand: string | null
  model: string | null
  serial_number: string | null
  status: AssetStatus
  station_id: string | null
  stations: {
    code: string
    location_label: string | null
    laboratories: {
      code: string
      name: string
    } | null
  } | null
}

type AssetRow = Omit<Asset, 'stations'> & {
  stations: Asset['stations'][] | Asset['stations']
}

type Movement = {
  id: string
  asset_id: string
  movement_type: MovementType
  from_station_id: string | null
  to_station_id: string | null
  previous_status: AssetStatus | null
  new_status: AssetStatus | null
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

const assetTypeLabels: Record<AssetType, string> = {
  cpu: 'CPU',
  monitor: 'Monitor',
}

const statusLabels: Record<AssetStatus, string> = {
  available: 'Disponible',
  assigned: 'Asignado',
  maintenance: 'Mantenimiento',
  damaged: 'Dañado',
  retired: 'Retirado',
  lost: 'Perdido',
}

const actionLabels: Record<MovementAction, string> = {
  transfer: 'Asignar o transferir a estación',
  send_maintenance: 'Enviar a mantenimiento',
  mark_damaged: 'Marcar como dañado',
  mark_lost: 'Marcar como perdido',
  retire: 'Dar de baja',
  make_available: 'Dejar disponible en almacén',
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

function mapAsset(row: AssetRow): Asset {
  const station = Array.isArray(row.stations)
    ? row.stations[0] ?? null
    : row.stations

  return {
    ...row,
    stations: station,
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

function getNextMovementState(
  action: MovementAction,
  asset: Asset,
  targetStationId: string,
): {
  movementType: MovementType
  nextStatus: AssetStatus
  nextStationId: string | null
  toStationId: string | null
} {
  if (action === 'transfer') {
    return {
      movementType: asset.station_id ? 'transfer' : 'assignment',
      nextStatus: 'assigned',
      nextStationId: targetStationId,
      toStationId: targetStationId,
    }
  }

  if (action === 'send_maintenance') {
    return {
      movementType: 'maintenance',
      nextStatus: 'maintenance',
      nextStationId: null,
      toStationId: null,
    }
  }

  if (action === 'make_available') {
    return {
      movementType: 'unassignment',
      nextStatus: 'available',
      nextStationId: null,
      toStationId: null,
    }
  }

  const nextStatusByAction: Record<Exclude<MovementAction, 'transfer' | 'send_maintenance' | 'make_available'>, AssetStatus> = {
    mark_damaged: 'damaged',
    mark_lost: 'lost',
    retire: 'retired',
  }

  return {
    movementType: 'status_change',
    nextStatus: nextStatusByAction[action],
    nextStationId: null,
    toStationId: null,
  }
}

function MovementsPage() {
  const { user, canWriteInventory } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [selectedAction, setSelectedAction] = useState<MovementAction>('transfer')
  const [targetStationId, setTargetStationId] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pageMessage, setPageMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  // NUEVOS ESTADOS: Control de pestañas y búsqueda
  const [activeTab, setActiveTab] = useState<'directory' | 'movement'>('directory')
  const [searchQuery, setSearchQuery] = useState('')

  async function fetchMovementData() {
    const [assetsResult, stationsResult, movementsResult] = await Promise.all([
      supabase
        .from('assets')
        .select(
          'id, asset_code, asset_type, brand, model, serial_number, status, station_id, stations(code, location_label, laboratories(code, name))',
        )
        .order('asset_code', { ascending: true }),
      supabase
        .from('stations')
        .select('id, code, location_label, laboratories(code, name)')
        .order('code', { ascending: true }),
      supabase
        .from('asset_movements')
        .select(
          'id, asset_id, movement_type, from_station_id, to_station_id, previous_status, new_status, reason, notes, created_at, assets(asset_code, asset_type)',
        )
        .order('created_at', { ascending: false })
        .limit(25),
    ])

    return { assetsResult, stationsResult, movementsResult }
  }

  async function loadData() {
    setIsLoading(true)
    setLoadError('')

    const { assetsResult, stationsResult, movementsResult } = await fetchMovementData()

    if (assetsResult.error || stationsResult.error || movementsResult.error) {
      setLoadError('No fue posible cargar activos, estaciones o movimientos.')
      setIsLoading(false)
      return
    }

    const nextAssets = ((assetsResult.data ?? []) as unknown as AssetRow[]).map(mapAsset)

    setAssets(nextAssets)
    setStations(((stationsResult.data ?? []) as unknown as StationRow[]).map(mapStation))
    setMovements(((movementsResult.data ?? []) as unknown as MovementRow[]).map(mapMovement))
    setSelectedAssetId((current) => current || nextAssets[0]?.id || '')
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const { assetsResult, stationsResult, movementsResult } = await fetchMovementData()

      if (!isMounted) return

      if (assetsResult.error || stationsResult.error || movementsResult.error) {
        setLoadError('No fue posible cargar activos, estaciones o movimientos.')
        setIsLoading(false)
        return
      }

      const nextAssets = ((assetsResult.data ?? []) as unknown as AssetRow[]).map(mapAsset)

      setAssets(nextAssets)
      setStations(((stationsResult.data ?? []) as unknown as StationRow[]).map(mapStation))
      setMovements(((movementsResult.data ?? []) as unknown as MovementRow[]).map(mapMovement))
      setSelectedAssetId(nextAssets[0]?.id || '')
      setIsLoading(false)
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  )

  const stationById = useMemo(
    () =>
      stations.reduce<Record<string, Station>>((current, station) => {
        current[station.id] = station
        return current
      }, {}),
    [stations],
  )

  const targetStationHasSameAssetType = useMemo(() => {
    if (!selectedAsset || !targetStationId) return false

    return assets.some(
      (asset) =>
        asset.id !== selectedAsset.id &&
        asset.station_id === targetStationId &&
        asset.asset_type === selectedAsset.asset_type,
    )
  }, [assets, selectedAsset, targetStationId])

  // Lógica de filtrado de activos
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets
    const query = searchQuery.toLowerCase()
    return assets.filter(
      (asset) =>
        asset.asset_code.toLowerCase().includes(query) ||
        asset.brand?.toLowerCase().includes(query) ||
        asset.serial_number?.toLowerCase().includes(query) ||
        asset.stations?.code.toLowerCase().includes(query) ||
        statusLabels[asset.status].toLowerCase().includes(query)
    )
  }, [assets, searchQuery])

  async function handleCreateMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPageMessage('')

    if (!canWriteInventory) {
      setPageMessage('No tienes permisos para realizar movimientos.')
      return
    }

    if (!selectedAsset) {
      setPageMessage('Selecciona un activo para registrar el movimiento.')
      return
    }

    if (selectedAction === 'transfer' && !targetStationId) {
      setPageMessage('Selecciona la estación destino.')
      return
    }

    if (selectedAction === 'transfer' && targetStationHasSameAssetType) {
      setPageMessage('La estación destino ya tiene un equipo del mismo tipo asignado.')
      return
    }

    const nextMovementState = getNextMovementState(
      selectedAction,
      selectedAsset,
      targetStationId,
    )

    setIsSaving(true)

    const { error: updateError } = await supabase
      .from('assets')
      .update({
        station_id: nextMovementState.nextStationId,
        status: nextMovementState.nextStatus,
      })
      .eq('id', selectedAsset.id)

    if (updateError) {
      setPageMessage('No fue posible actualizar el activo. Revisa permisos o disponibilidad de la estación.')
      setIsSaving(false)
      return
    }

    const { error: movementError } = await supabase
      .from('asset_movements')
      .insert({
        asset_id: selectedAsset.id,
        movement_type: nextMovementState.movementType,
        from_station_id: selectedAsset.station_id,
        to_station_id: nextMovementState.toStationId,
        previous_status: selectedAsset.status,
        new_status: nextMovementState.nextStatus,
        reason: reason.trim() || actionLabels[selectedAction],
        notes: notes.trim() || null,
        performed_by: user?.id ?? null,
      })

    setIsSaving(false)

    if (movementError) {
      setPageMessage('El activo se actualizó, pero no fue posible guardar el movimiento.')
      void loadData()
      return
    }

    setReason('')
    setNotes('')
    setPageMessage('Movimiento registrado correctamente.')
    // Tras un movimiento exitoso, podemos devolverlo a la pestaña del directorio
    setActiveTab('directory')
    void loadData()
  }

  return (
    <section className="movements-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Gestión y Trazabilidad</p>
          <h2>Equipos y Movimientos</h2>
          <p>
            Consulta el catálogo general de equipos y gestiona sus traslados, mantenimientos o bajas de forma centralizada.
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

      {pageMessage && (
        <div className="inline-message" role="status">
          {pageMessage}
        </div>
      )}

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button
          type="button"
          className={activeTab === 'directory' ? 'primary-button' : 'secondary-button'}
          onClick={() => setActiveTab('directory')}
          style={{ padding: '8px 24px' }}
        >
          Catálogo de equipos
        </button>
        {canWriteInventory && (
          <button
            type="button"
            className={activeTab === 'movement' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveTab('movement')}
            style={{ padding: '8px 24px' }}
          >
            Mover equipo
          </button>
        )}
      </div>

      <div className="movements-workspace">
        {/* COLUMNA PRINCIPAL (Izquierda) */}
        <div className="movements-content" style={{ flex: '1 1 60%' }}>
          
          {/* VISTA 1: DIRECTORIO DE ACTIVOS */}
          {activeTab === 'directory' && (
            <div className="assets-table-panel panel">
              <div className="panel-heading split-heading" style={{ alignItems: 'center' }}>
                <div>
                  <p className="eyebrow">Activos</p>
                  <h3>{isLoading ? 'Cargando activos...' : `${filteredAssets.length} equipos`}</h3>
                </div>
                {/* BUSCADOR */}
                <div style={{ minWidth: '250px' }}>
                  <input
                    type="search"
                    placeholder="Buscar serie, código, marca o estado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div className="asset-table" style={{ marginTop: '16px' }}>
                {assets.length === 0 && !isLoading ? (
                  <div className="empty-list">
                    <strong>No hay activos registrados</strong>
                    <p>Asigna un CPU o monitor desde la ficha de una estación.</p>
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <div className="empty-list">
                    <strong>Sin resultados</strong>
                    <p>No se encontraron equipos que coincidan con tu búsqueda.</p>
                  </div>
                ) : (
                  filteredAssets.map((asset) => (
                    <article key={asset.id} className="asset-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                      <div style={{ flex: '1' }}>
                        <strong style={{ fontSize: '1.1rem' }}>{asset.asset_code}</strong>
                        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                          {assetTypeLabels[asset.asset_type]} · {asset.brand ?? 'Sin marca'} {asset.model ?? ''}
                          <br />
                          <small>Serie: {asset.serial_number ?? 'N/A'}</small>
                        </p>
                      </div>

                      <div style={{ flex: '1', textAlign: 'center' }}>
                        {asset.station_id ? (
                          <Link to={`/estaciones/${asset.station_id}`} style={{ fontWeight: '500' }}>
                            {asset.stations?.code ?? 'Estación'}
                          </Link>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>En almacén / Sin estación</span>
                        )}
                      </div>

                      <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                        <span className={`status-pill status-${asset.status}`}>
                          {statusLabels[asset.status]}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: FORMULARIO DE MOVIMIENTO */}
          {activeTab === 'movement' && canWriteInventory && (
            <form className="data-form movement-form panel" onSubmit={handleCreateMovement}>
              <div className="form-heading">
                <p className="eyebrow">Nuevo movimiento</p>
                <h3>Actualizar estado de activo</h3>
              </div>

              <label>
                Seleccionar equipo
                <select
                  value={selectedAssetId}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  required
                >
                  <option value="">Selecciona activo</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.asset_code} - {assetTypeLabels[asset.asset_type]} - {statusLabels[asset.status]}
                    </option>
                  ))}
                </select>
              </label>

              {selectedAsset && (
                <div className="selected-asset-card" style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <strong style={{ display: 'block', fontSize: '1.1rem' }}>{selectedAsset.asset_code}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{assetTypeLabels[selectedAsset.asset_type]}</span>
                  <p style={{ margin: '8px 0 0 0', fontWeight: '500' }}>
                    {selectedAsset.stations?.code ?? 'Almacén central'} · <span className={`status-pill status-${selectedAsset.status}`} style={{ display: 'inline-block', marginLeft: '8px' }}>{statusLabels[selectedAsset.status]}</span>
                  </p>
                </div>
              )}

              <label>
                Operación a realizar
                <select
                  value={selectedAction}
                  onChange={(event) => setSelectedAction(event.target.value as MovementAction)}
                >
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedAction === 'transfer' && (
                <label>
                  Estación destino
                  <select
                    value={targetStationId}
                    onChange={(event) => setTargetStationId(event.target.value)}
                    required
                  >
                    <option value="">Selecciona estación</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.code} - {station.laboratories?.name ?? 'Laboratorio sin nombre'}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {targetStationHasSameAssetType && selectedAction === 'transfer' && (
                <p className="form-error" role="alert" style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '-10px', marginBottom: '16px' }}>
                  ⚠️ La estación destino ya tiene {selectedAsset ? assetTypeLabels[selectedAsset.asset_type] : 'equipo'} asignado.
                </p>
              )}

              <label>
                Motivo del movimiento
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ej. Cambio por falla, reasignación, baja de ciclo..."
                />
              </label>

              <label>
                Notas adicionales
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Evidencia o responsable de la autorización"
                  rows={3}
                />
              </label>

              <button className="primary-button" type="submit" disabled={isSaving || isLoading}>
                {isSaving ? 'Guardando cambios...' : 'Confirmar movimiento'}
              </button>
            </form>
          )}
        </div>

        {/* COLUMNA LATERAL (Derecha) - Siempre visible */}
        <div className="movements-sidebar" style={{ flex: '1 1 35%' }}>
          <div className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Bitácora</p>
              <h3>Últimos movimientos</h3>
            </div>

            {movements.length === 0 ? (
              <div className="empty-list">
                <strong>Sin historial</strong>
                <p>El rastro de cambios de equipos aparecerá aquí.</p>
              </div>
            ) : (
              <div className="movement-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {movements.map((movement) => (
                  <div key={movement.id} className="movement-row" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ color: '#0f172a' }}>
                        {movement.assets?.asset_code ?? 'Activo'}
                      </strong>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {new Date(movement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#3b82f6', textTransform: 'uppercase' }}>
                      {movement.assets ? assetTypeLabels[movement.assets.asset_type] : 'Equipo'}
                    </span>

                    <p style={{ margin: '4px 0', fontSize: '0.95rem', color: '#334155' }}>
                      {movement.reason ?? movement.movement_type}
                    </p>
                    
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {movement.from_station_id ? stationById[movement.from_station_id]?.code ?? 'Origen' : 'Almacén'}
                      </span>
                      →
                      <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {movement.to_station_id ? stationById[movement.to_station_id]?.code ?? 'Destino' : 'Almacén'}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default MovementsPage