import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'

type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'found'

type QrScannerProps = {
  onScan: (value: string) => void
}

function QrScanner({ onScan }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const hasScannedRef = useRef(false)

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [scannerError, setScannerError] = useState('')
  const [lastScan, setLastScan] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDevices() {
      try {
        const nextDevices = await BrowserQRCodeReader.listVideoInputDevices()

        if (!isMounted) return

        setDevices(nextDevices)
        setSelectedDeviceId(nextDevices[0]?.deviceId ?? '')
      } catch {
        if (!isMounted) return

        setScannerError('No fue posible consultar las cámaras disponibles.')
      }
    }

    void loadDevices()

    return () => {
      isMounted = false
      controlsRef.current?.stop()
      BrowserQRCodeReader.releaseAllStreams()
    }
  }, [])

  function stopScanner() {
    controlsRef.current?.stop()
    controlsRef.current = null
    BrowserQRCodeReader.releaseAllStreams()
    setStatus('idle')
  }

  async function startScanner() {
    if (!videoRef.current) return

    setScannerError('')
    setLastScan('')
    setStatus('starting')
    hasScannedRef.current = false

    try {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 220,
        delayBetweenScanSuccess: 800,
      })

      const controls = await reader.decodeFromVideoDevice(
        selectedDeviceId || undefined,
        videoRef.current,
        (result, _error, activeControls) => {
          const scannedValue = result?.getText()

          if (!scannedValue || hasScannedRef.current) return

          hasScannedRef.current = true
          setLastScan(scannedValue)
          setStatus('found')
          activeControls.stop()
          controlsRef.current = null
          onScan(scannedValue)
        },
      )

      controlsRef.current = controls
      setStatus('scanning')
    } catch {
      setStatus('idle')
      setScannerError(
        'No fue posible iniciar la cámara. Revisa permisos del navegador o usa captura manual.',
      )
    }
  }

  return (
    <section className="scanner-panel">
      <div className="scanner-video-shell">
        <video ref={videoRef} muted playsInline className="scanner-video" />

        <div className="scanner-frame" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="scanner-status">
          {status === 'idle' && 'Cámara detenida'}
          {status === 'starting' && 'Activando cámara...'}
          {status === 'scanning' && 'Buscando código QR...'}
          {status === 'found' && 'Código detectado'}
        </div>
      </div>

      <div className="scanner-controls">
        <label>
          Cámara
          <select
            value={selectedDeviceId}
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            disabled={status === 'starting' || status === 'scanning'}
          >
            {devices.length === 0 ? (
              <option value="">Cámara predeterminada</option>
            ) : (
              devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Cámara ${index + 1}`}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="scanner-buttons">
          {status === 'scanning' || status === 'starting' ? (
            <button className="secondary-button" type="button" onClick={stopScanner}>
              Detener
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={() => void startScanner()}>
              Activar cámara
            </button>
          )}
        </div>
      </div>

      {lastScan && (
        <p className="scanner-last-value">
          Última lectura: <span>{lastScan}</span>
        </p>
      )}

      {scannerError && (
        <p className="form-error" role="alert">
          {scannerError}
        </p>
      )}
    </section>
  )
}

export default QrScanner
