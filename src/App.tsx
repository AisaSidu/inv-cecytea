import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
//import PlaceholderPage from './components/PlaceholderPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import MovementsPage from './pages/MovementsPage'
import NotFoundPage from './pages/NotFoundPage'
import StationDetailPage from './pages/StationDetailPage'
import StationsPage from './pages/StationsPage'
import ReportesPage from './pages/ReportesPage'
import ConfiguracionPage from './pages/ConfigPage'

const ScannerPage = lazy(() => import('./pages/ScannerPage'))

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
            <Suspense
              fallback={
                <main className="auth-loading">
                  <div className="auth-loading-card">
                    <span className="status-dot" />
                    Cargando escáner...
                  </div>
                </main>
              }
            >
              <ScannerPage />
            </Suspense>
          }
        />

        <Route
          path="movimientos"
          element={<MovementsPage />}
        />

        <Route
          path="reportes"
          element={<ReportesPage />}
        />

        <Route
          path="configuracion"
          element={<ConfiguracionPage />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
