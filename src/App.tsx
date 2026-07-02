import { Route, Routes } from 'react-router-dom'
import PlaceholderPage from './components/PlaceholderPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import StationDetailPage from './pages/StationDetailPage'
import StationsPage from './pages/StationsPage'

function App() {
  return (
    <Routes>
      <Route path="/iniciar-sesion" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route
          path="estaciones"
          element={<StationsPage />}
        />

        <Route
          path="estaciones/:stationId"
          element={<StationDetailPage />}
        />

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
              nextStep="Este módulo se habilitará cuando agreguemos formularios administrativos."
            />
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
