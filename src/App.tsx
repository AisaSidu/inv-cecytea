import { Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import PlaceholderPage from './components/PlaceholderPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import StationDetailPage from './pages/StationDetailPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />

        <Route
          path="estaciones"
          element={
            <PlaceholderPage
              title="Estaciones de trabajo"
              description="Aquí se consultarán, crearán y administrarán las estaciones de cada laboratorio."
              nextStep="El siguiente paso será registrar laboratorios, estaciones, CPU y monitores."
            />
          }
        />

        <Route path="estaciones/:stationId" element={<StationDetailPage />} />

        <Route
          path="escanear"
          element={
            <PlaceholderPage
              title="Escanear código QR"
              description="Desde aquí se abrirá la cámara del dispositivo para consultar rápidamente una estación o equipo."
              nextStep="Después integraremos el lector QR y las rutas directas a cada estación."
            />
          }
        />

        <Route
          path="movimientos"
          element={
            <PlaceholderPage
              title="Movimientos"
              description="Aquí quedará el historial de cambios de ubicación, reemplazos y modificaciones de los equipos."
              nextStep="Más adelante conectaremos esta vista con la tabla de movimientos en Supabase."
            />
          }
        />

        <Route
          path="reportes"
          element={
            <PlaceholderPage
              title="Reportes"
              description="Desde este módulo se generarán inventarios y reportes descargables en PDF o Excel."
              nextStep="Los archivos se generarán al momento; no será necesario guardarlos en la base de datos."
            />
          }
        />

        <Route
          path="configuracion"
          element={
            <PlaceholderPage
              title="Configuración"
              description="Aquí vivirán los catálogos de laboratorios, usuarios, roles y opciones generales del sistema."
              nextStep="Este módulo se habilitará cuando agreguemos autenticación y permisos."
            />
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App