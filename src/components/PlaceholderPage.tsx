type PlaceholderPageProps = {
  title: string
  description: string
  nextStep: string
}

function PlaceholderPage({
  title,
  description,
  nextStep,
}: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-icon">◌</div>

      <p className="eyebrow">Módulo en preparación</p>

      <h2>{title}</h2>

      <p className="placeholder-description">{description}</p>

      <div className="next-step-box">
        <strong>Siguiente paso</strong>
        <p>{nextStep}</p>
      </div>
    </section>
  )
}

export default PlaceholderPage