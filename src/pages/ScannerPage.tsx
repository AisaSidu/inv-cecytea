import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import QrScanner from '../components/qr/QrScanner'

function getStationPathFromQr(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) return null

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (uuidPattern.test(trimmedValue)) {
    return `/estaciones/${trimmedValue}`
  }

  try {
    const parsedUrl = new URL(trimmedValue, window.location.origin)

    if (parsedUrl.pathname.startsWith('/estaciones/')) {
      return `${parsedUrl.pathname}${parsedUrl.search}`
    }
  } catch {
    return null
  }

  return null
}

function ScannerPage() {
  const navigate = useNavigate()
  const [manualValue, setManualValue] = useState('')
  const [scanMessage, setScanMessage] = useState('')

  function handleScan(value: string) {
    const stationPath = getStationPathFromQr(value)

    if (!stationPath) {
      setScanMessage('El código leído no corresponde a una estación registrada.')
      return
    }

    setScanMessage('Estación detectada. Abriendo detalle...')
    navigate(stationPath)
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleScan(manualValue)
  }

  return (
    <section className="scanner-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Lectura rápida</p>
          <h2>Escanear QR</h2>
          <p>
            Activa la cámara, apunta al QR de la estación y el sistema abrirá
            automáticamente su ficha de inventario.
          </p>
        </div>
      </div>

      {scanMessage && (
        <div className="inline-message" role="status">
          {scanMessage}
        </div>
      )}

      <div className="scanner-layout">
        <QrScanner onScan={handleScan} />

        <aside className="panel scanner-help-panel">
          <div className="panel-heading">
            <p className="eyebrow">Alternativa</p>
            <h3>Captura manual</h3>
          </div>

          <p>
            Úsala para pruebas de escritorio, o cuando el navegador no tenga
            permiso de cámara.
          </p>

          <form className="manual-scan-form" onSubmit={handleManualSubmit}>
            <label>
              URL o identificador
              <input
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="https://.../estaciones/id"
                required
              />
            </label>

            <button className="primary-button" type="submit">
              Abrir estación
            </button>
          </form>
        </aside>
      </div>
    </section>
  )
}

export default ScannerPage
