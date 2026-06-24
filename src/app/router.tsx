import { createBrowserRouter } from 'react-router-dom'

import { AppLayout } from '../layouts/AppLayout'
import { DashboardPage } from '../pages/DashboardPage'
import { MovementsPage } from '../pages/MovementsPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ReportsPage } from '../pages/ReportsPage'
import { ScannerPage } from '../pages/ScannerPage'
import { StationsPage } from '../pages/StationsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'stations',
        element: <StationsPage />,
      },
      {
        path: 'scanner',
        element: <ScannerPage />,
      },
      {
        path: 'movements',
        element: <MovementsPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
