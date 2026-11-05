import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { createHashRouter, RouterProvider, useRouteError } from 'react-router'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/app-shell'
import { TooltipProvider } from './components/ui/tooltip'
import { Button, ButtonLink } from './components/ui/button'
import { EmptyState } from './components/ui/misc'
import { CollectionDetailPage, CollectionsPage } from './pages/collections'
import { CreationDetailPage } from './pages/creation-detail'
import { DashboardPage } from './pages/dashboard'
import { EditCreationPage } from './pages/edit-creation'
import { LibraryPage } from './pages/library'

// Less frequently used screens are loaded on demand to keep start-up fast.
const BackupPage = lazy(() => import('./pages/backup').then((m) => ({ default: m.BackupPage })))
const ComparePage = lazy(() => import('./pages/compare').then((m) => ({ default: m.ComparePage })))
const ExtractPage = lazy(() => import('./pages/extract').then((m) => ({ default: m.ExtractPage })))
const SettingsPage = lazy(() => import('./pages/settings').then((m) => ({ default: m.SettingsPage })))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>{children}</Suspense>
}
import { applyTheme, resolveTheme, usePreferences } from './store/preferences'
import { AlertTriangle, Compass } from 'lucide-react'

function RouteError() {
  const error = useRouteError()
  console.error(error)
  return (
    <EmptyState
      icon={<AlertTriangle />}
      title="Something went wrong on this page"
      description="Your library is safe — this only affected the current screen. Try going back to the dashboard."
      action={
        <Button variant="primary" onClick={() => (window.location.hash = '#/')}>
          Back to dashboard
        </Button>
      }
    />
  )
}

function NotFound() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="This page doesn’t exist."
      action={
        <ButtonLink to="/" variant="primary">
          Go to dashboard
        </ButtonLink>
      }
    />
  )
}

// Hash-based routing keeps the app working as a static site on any host
// (including GitHub Pages) without server configuration.
const router = createHashRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'new', element: <EditCreationPage /> },
      { path: 'c/:id', element: <CreationDetailPage /> },
      { path: 'c/:id/edit', element: <EditCreationPage /> },
      { path: 'collections', element: <CollectionsPage /> },
      { path: 'collections/:id', element: <CollectionDetailPage /> },
      { path: 'compare', element: <Lazy><ComparePage /></Lazy> },
      { path: 'extract', element: <Lazy><ExtractPage /></Lazy> },
      { path: 'backup', element: <Lazy><BackupPage /></Lazy> },
      { path: 'settings', element: <Lazy><SettingsPage /></Lazy> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  const theme = usePreferences((s) => s.theme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const update = () => applyTheme('system')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])

  return (
    <TooltipProvider delayDuration={400}>
      <RouterProvider router={router} />
      <Toaster
        theme={resolveTheme(theme)}
        position="bottom-center"
        offset={{ bottom: 76 }}
        mobileOffset={{ bottom: 76 }}
        toastOptions={{
          classNames: {
            toast: '!bg-surface !border-line-strong !text-fg !shadow-pop !rounded-xl',
            description: '!text-muted',
          },
        }}
      />
    </TooltipProvider>
  )
}
