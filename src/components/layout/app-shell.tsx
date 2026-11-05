import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Menu as MenuIcon, Moon, Plus, Search, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { usePreferences, resolveTheme } from '../../store/preferences'
import { isApplePlatform, isEditableTarget } from '../../lib/utils'
import { IconButton } from '../ui/button'
import { Kbd } from '../ui/misc'
import { SidebarContent } from './sidebar'
import { Onboarding } from '../onboarding/onboarding'

function GlobalSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const onLibrary = location.pathname === '/library'
  const [value, setValue] = useState(onLibrary ? (params.get('q') ?? '') : '')

  useEffect(() => {
    if (onLibrary) setValue(params.get('q') ?? '')
    else setValue('')
  }, [onLibrary, params])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isCmdK || (event.key === '/' && !isEditableTarget(event.target))) {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function update(next: string) {
    setValue(next)
    const nextParams = new URLSearchParams(onLibrary ? params : undefined)
    if (next) nextParams.set('q', next)
    else nextParams.delete('q')
    navigate({ pathname: '/library', search: nextParams.toString() ? `?${nextParams}` : '' }, { replace: onLibrary })
  }

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (value) update('')
            else inputRef.current?.blur()
          }
        }}
        placeholder="Search prompts, tags, models…"
        aria-label="Search your library"
        className="h-9 w-full rounded-lg border border-line bg-surface-2/70 pr-16 pl-9 text-sm text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus:border-accent/60 focus:bg-surface focus:ring-3 focus:ring-accent/15 focus:outline-none"
      />
      <div className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-1 sm:flex">
        {value ? null : (
          <>
            <Kbd>{isApplePlatform ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </>
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => {
            update('')
            inputRef.current?.focus()
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-subtle hover:bg-surface-3 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function ThemeToggle() {
  const theme = usePreferences((s) => s.theme)
  const setTheme = usePreferences((s) => s.setTheme)
  const resolved = resolveTheme(theme)
  return (
    <IconButton
      label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
    >
      {resolved === 'dark' ? <Sun /> : <Moon />}
    </IconButton>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return
      if (document.querySelector('[role="dialog"]')) return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        navigate('/new')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="flex h-full">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface/60 lg:block">
        <SidebarContent />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/50 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] animate-slide-in border-r border-line bg-surface shadow-pop focus:outline-none lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Main navigation menu</DialogPrimitive.Description>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md sm:gap-3 sm:px-5">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)} tooltip={false}>
            <MenuIcon />
          </IconButton>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <IconButton label="New creation" className="lg:hidden" variant="primary" onClick={() => navigate('/new')}>
              <Plus />
            </IconButton>
          </div>
        </header>
        <main id="main" ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Onboarding />
    </div>
  )
}
