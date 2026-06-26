import { Link, useParams } from 'react-router-dom'

function StationDetailPage() {
  const { stationId } = useParams()

  return (
    <section className="placeholder-page">
      <div className="placeholder-icon">▣</div>

      <p className="eyebrow">Detalle de estación</p>

      <h2>{stationId ?? 'Estación no identificada'}</h2>

      <p className="placeholder-description">
        Esta será la pantalla que abrirá un código QR. Aquí aparecerán la CPU,
        monitor, periféricos, ubicación, estado e historial de movimientos.
      </p>

      <Link to="/estaciones" className="secondary-button">
        Volver a estaciones
      </Link>
    </section>
  )
}

export default StationDetailPage