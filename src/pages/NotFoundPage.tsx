import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="page not-found">
      <header className="page-header">
        <p>Error 404</p>
        <h1>Pagina no encontrada</h1>
      </header>

      <Link className="button-link" to="/">
        Volver al dashboard
      </Link>
    </section>
  )
}
