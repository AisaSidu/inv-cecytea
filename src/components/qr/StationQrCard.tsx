import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type StationQrCardProps = {
  stationCode: string
  laboratoryName: string
  qrUrl: string
}

function StationQrCard({ stationCode, laboratoryName, qrUrl }: StationQrCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrError, setQrError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function generateQr() {
      setQrError('')

      try {
        const nextQrDataUrl = await QRCode.toDataURL(qrUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 360,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        })

        if (!isMounted) return

        setQrDataUrl(nextQrDataUrl)
      } catch {
        if (!isMounted) return

        setQrError('No fue posible generar el código QR.')
      }
    }

    void generateQr()

    return () => {
      isMounted = false
    }
  }, [qrUrl])

  function handlePrint() {
    window.print()
  }

  return (
    <article className="panel qr-card">
      <div className="panel-heading">
        <p className="eyebrow">QR</p>
        <h3>Etiqueta de estación</h3>
      </div>

      <div className="qr-print-area">
        <div className="qr-label">
          <div className="qr-label-heading">
            <strong>{stationCode}</strong>
            <span>{laboratoryName}</span>
          </div>

          <div className="qr-image-frame">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`Código QR de ${stationCode}`} />
            ) : (
              <span>{qrError || 'Generando QR...'}</span>
            )}
          </div>

          <p>{qrUrl}</p>
        </div>
      </div>

      <div className="qr-actions">
        <a
          className="secondary-button"
          href={qrDataUrl || undefined}
          download={`${stationCode}-qr.png`}
          aria-disabled={!qrDataUrl}
        >
          Descargar PNG
        </a>

        <button
          className="primary-button"
          type="button"
          onClick={handlePrint}
          disabled={!qrDataUrl}
        >
          Imprimir etiqueta
        </button>
      </div>

      {qrError && (
        <p className="form-error" role="alert">
          {qrError}
        </p>
      )}
    </article>
  )
}

export default StationQrCard
