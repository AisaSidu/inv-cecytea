export function DashboardPage() {
  return (
    <section className="page">
      <header className="page-header">
        <p>Resumen general</p>
        <h1>Dashboard</h1>
      </header>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Equipos registrados</span>
          <strong>0</strong>
        </article>
        <article className="metric-card">
          <span>Estaciones activas</span>
          <strong>0</strong>
        </article>
        <article className="metric-card">
          <span>Movimientos recientes</span>
          <strong>0</strong>
        </article>
      </div>
    </section>
  )
}
