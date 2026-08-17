import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Diccionarios de traducción para que el Excel sea legible
const assetTypeLabels: Record<string, string> = { cpu: 'CPU', monitor: 'Monitor' }
const assetStatusLabels: Record<string, string> = { available: 'Disponible', assigned: 'Asignado', maintenance: 'Mantenimiento', damaged: 'Dañado', retired: 'Retirado', lost: 'Perdido' }
const peripheralTypeLabels: Record<string, string> = { keyboard: 'Teclado', mouse: 'Mouse', headset: 'Audífonos', speakers: 'Bocinas', webcam: 'Webcam', ups: 'UPS', other: 'Otro' }
const peripheralConditionLabels: Record<string, string> = { good: 'Buen estado', damaged: 'Dañado', mixed: 'Mixto', not_applicable: 'No aplica' }

// Función nativa para crear y descargar el CSV compatible con Excel
function downloadCSV(filename: string, data: Record<string, any>[], columns: { key: string; header: string }[]) {
  if (!data || data.length === 0) {
    alert('No hay datos suficientes para generar este reporte.')
    return
  }

  const csvRows = []
  
  // 1. Crear la fila de cabeceras
  csvRows.push(columns.map(col => `"${col.header}"`).join(','))

  // 2. Llenar las filas de datos
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key] ?? ''
      // Escapar comillas dobles para evitar que Excel rompa las columnas
      const stringValue = String(value).replace(/"/g, '""')
      return `"${stringValue}"`
    })
    csvRows.push(values.join(','))
  }

  const csvString = csvRows.join('\n')
  
  // 3. Crear el archivo. El '\uFEFF' es vital para que Excel respete los acentos (UTF-8 BOM)
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  // 4. Forzar la descarga en el navegador
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function ReportesPage() {
  const [isGeneratingInventory, setIsGeneratingInventory] = useState(false)
  const [isGeneratingPeripherals, setIsGeneratingPeripherals] = useState(false)
  const [isGeneratingIncidents, setIsGeneratingIncidents] = useState(false)

  // --------------------------------------------------------------------------
  // REPORTE 1: INVENTARIO GENERAL DE EQUIPOS
  // --------------------------------------------------------------------------
  async function generateInventoryReport() {
    setIsGeneratingInventory(true)
    const { data, error } = await supabase
      .from('assets')
      .select('asset_code, asset_type, brand, model, serial_number, status, stations(code, laboratories(name))')
      .order('asset_code', { ascending: true })

    setIsGeneratingInventory(false)

    if (error || !data) {
      alert('Error al obtener datos del inventario.')
      return
    }

    // Aplanar los datos relacionales para el Excel
    const formattedData = data.map((item: any) => ({
      codigo: item.asset_code,
      tipo: assetTypeLabels[item.asset_type] ?? item.asset_type,
      marca: item.brand ?? 'N/A',
      modelo: item.model ?? 'N/A',
      serie: item.serial_number ?? 'N/A',
      estado: assetStatusLabels[item.status] ?? item.status,
      estacion: item.stations?.code ?? 'En almacén',
      laboratorio: item.stations?.laboratories?.name ?? 'N/A'
    }))

    const columns = [
      { key: 'codigo', header: 'Código Interno' },
      { key: 'tipo', header: 'Tipo de Equipo' },
      { key: 'marca', header: 'Marca' },
      { key: 'modelo', header: 'Modelo' },
      { key: 'serie', header: 'Número de Serie' },
      { key: 'estado', header: 'Estado' },
      { key: 'estacion', header: 'Estación Asignada' },
      { key: 'laboratorio', header: 'Laboratorio' },
    ]

    downloadCSV(`Inventario_Equipos_${new Date().toISOString().split('T')[0]}.csv`, formattedData, columns)
  }

  // --------------------------------------------------------------------------
  // REPORTE 2: AUDITORÍA DE PERIFÉRICOS (FALTANTES Y DAÑOS)
  // --------------------------------------------------------------------------
  async function generatePeripheralsReport() {
    setIsGeneratingPeripherals(true)
    const { data, error } = await supabase
      .from('station_peripherals')
      .select('peripheral_type, expected_quantity, present_quantity, condition, notes, last_checked_at, stations(code, laboratories(name))')

    setIsGeneratingPeripherals(false)

    if (error || !data) {
      alert('Error al obtener datos de periféricos.')
      return
    }

    // Filtramos usando JavaScript: Solo los que están dañados, perdidos, o donde hay menos de los esperados
    const anomalies = data.filter((item: any) => 
      item.condition !== 'good' || item.present_quantity < item.expected_quantity
    )

    const formattedData = anomalies.map((item: any) => ({
      laboratorio: item.stations?.laboratories?.name ?? 'N/A',
      estacion: item.stations?.code ?? 'Desconocida',
      periferico: peripheralTypeLabels[item.peripheral_type] ?? item.peripheral_type,
      esperados: item.expected_quantity,
      presentes: item.present_quantity,
      faltantes: item.expected_quantity - item.present_quantity > 0 ? item.expected_quantity - item.present_quantity : 0,
      condicion: peripheralConditionLabels[item.condition] ?? item.condition,
      notas: item.notes ?? '',
      ultima_revision: item.last_checked_at ? new Date(item.last_checked_at).toLocaleDateString() : 'N/A'
    }))

    const columns = [
      { key: 'laboratorio', header: 'Laboratorio' },
      { key: 'estacion', header: 'Estación' },
      { key: 'periferico', header: 'Accesorio' },
      { key: 'esperados', header: 'Cant. Esperada' },
      { key: 'presentes', header: 'Cant. Presente' },
      { key: 'faltantes', header: 'Faltantes' },
      { key: 'condicion', header: 'Condición Física' },
      { key: 'notas', header: 'Notas / Detalles' },
      { key: 'ultima_revision', header: 'Última Revisión' },
    ]

    downloadCSV(`Reporte_Anomalias_Accesorios_${new Date().toISOString().split('T')[0]}.csv`, formattedData, columns)
  }

  // --------------------------------------------------------------------------
  // REPORTE 3: BITÁCORA DE INCIDENCIAS
  // --------------------------------------------------------------------------
  async function generateIncidentsReport() {
    setIsGeneratingIncidents(true)
    const { data, error } = await supabase
      .from('station_incidents')
      .select('description, status, created_at, resolved_at, stations(code, laboratories(name))')
      .order('created_at', { ascending: false })

    setIsGeneratingIncidents(false)

    if (error || !data) {
      alert('Error al obtener datos de incidencias.')
      return
    }

    const formattedData = data.map((item: any) => ({
      laboratorio: item.stations?.laboratories?.name ?? 'N/A',
      estacion: item.stations?.code ?? 'N/A',
      estado: item.status === 'open' ? 'ABIERTA (Pendiente)' : 'RESUELTA',
      descripcion: item.description,
      fecha_reporte: new Date(item.created_at).toLocaleString(),
      fecha_resolucion: item.resolved_at ? new Date(item.resolved_at).toLocaleString() : 'N/A',
      dias_abierta: item.resolved_at 
        ? Math.floor((new Date(item.resolved_at).getTime() - new Date(item.created_at).getTime()) / (1000 * 3600 * 24))
        : Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 3600 * 24))
    }))

    const columns = [
      { key: 'laboratorio', header: 'Laboratorio' },
      { key: 'estacion', header: 'Estación Afectada' },
      { key: 'estado', header: 'Estado' },
      { key: 'descripcion', header: 'Descripción del Problema' },
      { key: 'fecha_reporte', header: 'Fecha de Reporte' },
      { key: 'fecha_resolucion', header: 'Fecha de Resolución' },
      { key: 'dias_abierta', header: 'Días Abierta (Aprox)' },
    ]

    downloadCSV(`Bitacora_Mantenimiento_${new Date().toISOString().split('T')[0]}.csv`, formattedData, columns)
  }

  return (
    <section className="reports-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Exportación de datos</p>
          <h2>Reportes de Sistema</h2>
          <p>
            Genera documentos Excel compatibles (CSV) con la información más actualizada
            de la base de datos para auditorías o justificación de presupuesto.
          </p>
        </div>
      </div>

      <div className="reports-grid" style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        
        {/* TARJETA 1 */}
        <article className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-heading">
            <p className="eyebrow">Auditoría Semestral</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Inventario General</h3>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px', flex: 1 }}>
            Descarga la lista completa de CPUs y monitores, incluyendo números de serie, marcas y la mesa exacta donde están asignados actualmente.
          </p>
          <button 
            className="primary-button" 
            onClick={() => void generateInventoryReport()} 
            disabled={isGeneratingInventory}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isGeneratingInventory ? 'Procesando datos...' : '📥 Descargar Excel (CSV)'}
          </button>
        </article>

        {/* TARJETA 2 */}
        <article className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-heading">
            <p className="eyebrow">Compras y Reposición</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Faltantes y Daños</h3>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px', flex: 1 }}>
            Filtra automáticamente la base de datos para mostrar <strong style={{color: '#ef4444'}}>únicamente</strong> las estaciones donde faltan teclados o mouses, o donde reportaste periféricos dañados.
          </p>
          <button 
            className="primary-button" 
            onClick={() => void generatePeripheralsReport()} 
            disabled={isGeneratingPeripherals}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isGeneratingPeripherals ? 'Procesando datos...' : '📥 Descargar Excel (CSV)'}
          </button>
        </article>

        {/* TARJETA 3 */}
        <article className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-heading">
            <p className="eyebrow">Soporte Técnico</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Bitácora de Mantenimiento</h3>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px', flex: 1 }}>
            Obtén un historial de todas las fallas reportadas, indicando claramente si ya fueron resueltas o cuántos días llevan pendientes de atención.
          </p>
          <button 
            className="primary-button" 
            onClick={() => void generateIncidentsReport()} 
            disabled={isGeneratingIncidents}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isGeneratingIncidents ? 'Procesando datos...' : '📥 Descargar Excel (CSV)'}
          </button>
        </article>

      </div>
    </section>
  )
}

export default ReportesPage