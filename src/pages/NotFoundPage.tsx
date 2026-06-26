import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="placeholder-page">
      <div className="placeholder-icon">?</div>

      <p className="eyebrow">Error 404</p>

      <h2>Esta pantalla no existe.</h2>

      <p className="placeholder-description">
        Puede que el enlace esté mal escrito o que el código QR apunte a una
        estación que ya no existe.
      </p>

      <Link to="/" className="primary-button">
        Ir al inicio
      </Link>
    </section>
  )
}

export default NotFoundPage