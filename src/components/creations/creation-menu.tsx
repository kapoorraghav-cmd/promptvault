import {
  Copy,
  CopyPlus,
  Download,
  ExternalLink,
  FileText,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { copyPrompt } from '../../lib/clipboard'
import { downloadBackup, downloadMarkdown } from '../../lib/export-actions'
import { deleteCreations, duplicateCreation, toggleFavourite } from '../../lib/repo'
import type { Creation } from '../../lib/types'
import { IconButton } from '../ui/button'
import { ConfirmDialog } from '../ui/dialog'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, useAfterMenuClose } from '../ui/menu'
import { CollectionPickerDialog } from '../collections/collection-picker'

export function useDuplicate() {
  const navigate = useNavigate()
  return async (creation: Creation, openEditor = true) => {
    try {
      const id = await duplicateCreation(creation.id)
      toast.success('Variation created', { description: 'Edit it freely — the original stays unchanged.' })
      if (openEditor) navigate(`/c/${id}/edit`)
      return id
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t duplicate this item.')
      return null
    }
  }
}

export function CreationMenu({
  creation,
  trigger,
  onDeleted,
  align = 'end',
}: {
  creation: Creation
  trigger?: ReactNode
  onDeleted?: () => void
  align?: 'start' | 'end'
}) {
  const navigate = useNavigate()
  const duplicate = useDuplicate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [picking, setPicking] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { afterClose, onCloseAutoFocus } = useAfterMenuClose()

  return (
    <>
      <Menu modal={false}>
        <MenuTrigger asChild ref={triggerRef}>
          {trigger ?? (
            <IconButton label="More actions" size="sm" tooltip={false} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </IconButton>
          )}
        </MenuTrigger>
        <MenuContent align={align} onCloseAutoFocus={onCloseAutoFocus}>
          <MenuItem icon={<ExternalLink />} onSelect={() => navigate(`/c/${creation.id}`)}>
            Open
          </MenuItem>
          <MenuItem icon={<Pencil />} onSelect={() => navigate(`/c/${creation.id}/edit`)}>
            Edit
          </MenuItem>
          <MenuItem icon={<Copy />} onSelect={() => copyPrompt(creation)}>
            Copy prompt
          </MenuItem>
          <MenuItem
            icon={<Star />}
            onSelect={async () => {
              const fav = await toggleFavourite(creation.id)
              toast.success(fav ? 'Added to favourites' : 'Removed from favourites')
            }}
          >
            {creation.favourite ? 'Remove from favourites' : 'Add to favourites'}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<CopyPlus />} onSelect={() => duplicate(creation)}>
            Duplicate as variation
          </MenuItem>
          <MenuItem icon={<FolderPlus />} onSelect={afterClose(() => setPicking(true))}>
            Add to collection…
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<FileText />} onSelect={() => downloadMarkdown([creation], creation.title || 'Untitled', creation.title || 'prompt')}>
            Export as Markdown
          </MenuItem>
          <MenuItem
            icon={<Download />}
            onSelect={() => downloadBackup({ kind: 'items', creationIds: [creation.id] }, true, creation.title || 'item')}
          >
            Export with images (.zip)
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} destructive onSelect={afterClose(() => setConfirmDelete(true))}>
            Delete…
          </MenuItem>
        </MenuContent>
      </Menu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this item?"
        description={
          <>
            “{creation.title || 'Untitled'}” and its attached images will be permanently removed from this device. This
            can’t be undone unless you have a backup.
          </>
        }
        confirmLabel="Delete"
        destructive
        returnFocus={triggerRef}
        onConfirm={async () => {
          await deleteCreations([creation.id])
          toast.success('Item deleted')
          onDeleted?.()
        }}
      />
      <CollectionPickerDialog open={picking} onOpenChange={setPicking} creationIds={[creation.id]} returnFocus={triggerRef} />
    </>
  )
}
