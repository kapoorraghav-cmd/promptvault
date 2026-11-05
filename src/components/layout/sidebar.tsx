import {
  Archive,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  Library,
  Plus,
  ScanText,
  Settings,
  Star,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useCollections, useCreations } from '../../lib/hooks'
import { COLLECTION_COLOR_CLASSES } from '../../lib/labels'
import { getStorageInfo, type StorageInfo } from '../../lib/storage'
import { cn, formatBytes } from '../../lib/utils'
import { Logo } from '../brand/logo'
import { Kbd } from '../ui/misc'
import { CollectionDialog } from '../collections/collection-dialog'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/library?fav=1', label: 'Favourites', icon: Star },
  { to: '/collections', label: 'Collections', icon: FolderOpen },
  { to: '/extract', label: 'Extract from screenshot', icon: ScanText },
]

const secondaryItems = [
  { to: '/backup', label: 'Backup & restore', icon: Archive },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function NavRow({
  to,
  label,
  icon: Icon,
  end,
  count,
  onNavigate,
}: {
  to: string
  label: string
  icon: typeof Library
  end?: boolean
  count?: number
  onNavigate?: () => void
}) {
  const location = useLocation()
  const [path, query] = to.split('?')
  const isFavourites = query === 'fav=1'
  const onLibrary = location.pathname === '/library'
  const favActive = new URLSearchParams(location.search).get('fav') === '1'

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => {
        let active = isActive && location.pathname === path
        if (path === '/library') active = onLibrary && (isFavourites ? favActive : !favActive)
        if (path === '/collections') active = location.pathname.startsWith('/collections')
        return cn(
          'group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors',
          active ? 'bg-surface-3 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )
      }}
    >
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && <span className="text-xs text-subtle tabular-nums">{count}</span>}
    </NavLink>
  )
}

function StorageMeter() {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const creations = useCreations()
  useEffect(() => {
    getStorageInfo().then(setInfo)
  }, [creations?.length])

  return (
    <Link
      to="/settings#storage"
      className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 transition-colors hover:border-line-strong"
    >
      <HardDrive className="size-4 shrink-0 text-subtle" aria-hidden />
      <div className="min-w-0 text-xs leading-tight">
        <div className="font-medium text-fg">Stored on this device</div>
        <div className="mt-0.5 truncate text-subtle">
          {info?.supported ? `${formatBytes(info.usage)} used` : 'Private, local storage'}
        </div>
      </div>
    </Link>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const creations = useCreations()
  const collections = useCollections()
  const [creating, setCreating] = useState(false)

  const counts = useMemo(() => {
    const byCollection = new Map<string, number>()
    for (const c of creations ?? []) for (const id of c.collectionIds) byCollection.set(id, (byCollection.get(id) ?? 0) + 1)
    return {
      total: creations?.length ?? 0,
      favourites: creations?.filter((c) => c.favourite).length ?? 0,
      byCollection,
    }
  }, [creations])

  return (
    <div className="flex h-full flex-col gap-5 px-3 pt-4 pb-3">
      <Link to="/" onClick={onNavigate} className="flex h-8 items-center px-1.5" aria-label="PromptVault home">
        <Logo />
      </Link>

      <NewCreationButton onNavigate={onNavigate} />

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavRow
            key={item.to}
            {...item}
            onNavigate={onNavigate}
            count={item.label === 'Library' ? counts.total : item.label === 'Favourites' ? counts.favourites : undefined}
          />
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">Collections</span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex size-5 items-center justify-center rounded text-subtle hover:bg-surface-2 hover:text-fg"
            aria-label="New collection"
            title="New collection"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <div className="-mr-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto pr-1">
          {collections?.length === 0 && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-md px-2 py-1.5 text-left text-xs text-subtle hover:bg-surface-2 hover:text-muted"
            >
              Group related creations into collections.
            </button>
          )}
          {collections?.map((collection) => (
            <NavLink
              key={collection.id}
              to={`/collections/${collection.id}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex h-7.5 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
                  isActive ? 'bg-surface-3 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <span className={cn('size-2 shrink-0 rounded-full', COLLECTION_COLOR_CLASSES[collection.color].dot)} aria-hidden />
              <span className="flex-1 truncate">{collection.name}</span>
              <span className="text-xs text-subtle tabular-nums">{counts.byCollection.get(collection.id) ?? 0}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        {secondaryItems.map((item) => (
          <NavRow key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </div>
      <StorageMeter />

      <CollectionDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

export function NewCreationButton({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <Link
      to="/new"
      onClick={onNavigate}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-fg shadow-sm transition-colors hover:bg-primary/90',
        className,
      )}
    >
      <Plus className="size-4" aria-hidden />
      <span className="flex-1 text-left">New creation</span>
      <Kbd className="border-primary-fg/20 bg-primary-fg/10 text-primary-fg/70">N</Kbd>
    </Link>
  )
}
