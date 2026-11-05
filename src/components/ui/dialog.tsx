import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState, type ReactNode, type RefObject } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { Input } from './input'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/**
 * Dialogs opened from a dropdown menu would otherwise try to return focus to a
 * menu item that no longer exists. Passing the menu's trigger here sends focus
 * back to it instead.
 */
export type ReturnFocus = RefObject<HTMLElement | null>

export function DialogContent({
  title,
  description,
  children,
  className,
  hideClose,
  size = 'md',
  returnFocus,
}: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  hideClose?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  returnFocus?: ReturnFocus
}) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/55 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        onCloseAutoFocus={
          returnFocus
            ? (event) => {
                event.preventDefault()
                // Don't steal focus if the user has already moved on (e.g. opened another menu).
                const active = document.activeElement
                const menuOpen = Boolean(document.querySelector('[role="menu"]'))
                if (!menuOpen && (!active || active === document.body)) returnFocus.current?.focus()
              }
            : undefined
        }
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line-strong bg-surface shadow-pop focus:outline-none',
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-[15px] font-semibold tracking-tight">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm leading-relaxed text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && (
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mt-1 -mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pt-3 pb-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>{children}</div>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  requireText,
  onConfirm,
  children,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** If set, the user must type this exact text to enable the confirm button. */
  requireText?: string
  onConfirm: () => void | Promise<void>
  children?: ReactNode
  returnFocus?: ReturnFocus
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const blocked = requireText ? typed.trim() !== requireText : false

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('')
        onOpenChange(next)
      }}
    >
      <DialogContent title={title} description={description} size="sm" returnFocus={returnFocus}>
        {children}
        {requireText && (
          <div className="mt-1 flex flex-col gap-2">
            <label className="text-[13px] text-muted" htmlFor="confirm-text">
              Type <span className="font-mono font-semibold text-fg">{requireText}</span> to confirm
            </label>
            <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={blocked}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                setTyped('')
                onOpenChange(false)
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
