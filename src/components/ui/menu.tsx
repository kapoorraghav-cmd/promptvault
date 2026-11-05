import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

/**
 * Opening a dialog straight from a menu item makes the closing menu and the
 * opening dialog compete for focus. `afterClose(fn)` queues `fn` to run once
 * the menu has fully closed; pass `onCloseAutoFocus` to the MenuContent.
 */
export function useAfterMenuClose() {
  const pending = useRef<(() => void) | null>(null)
  return {
    afterClose: (fn: () => void) => () => {
      pending.current = fn
    },
    onCloseAutoFocus: (event: Event) => {
      const fn = pending.current
      if (!fn) return
      pending.current = null
      event.preventDefault()
      fn()
    },
  }
}

export function MenuContent({
  children,
  align = 'end',
  className,
  onCloseAutoFocus,
}: {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  onCloseAutoFocus?: (event: Event) => void
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        onCloseAutoFocus={onCloseAutoFocus}
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          'z-50 min-w-48 animate-scale-in rounded-lg border border-line-strong bg-surface p-1 shadow-pop',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

const itemClass =
  'flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-[13px] text-fg outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted'

export function MenuItem({
  children,
  onSelect,
  icon,
  destructive,
  disabled,
  shortcut,
}: {
  children: ReactNode
  onSelect?: () => void
  icon?: ReactNode
  destructive?: boolean
  disabled?: boolean
  shortcut?: string
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(itemClass, destructive && 'text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger')}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-subtle">{shortcut}</span>}
    </DropdownMenu.Item>
  )
}

export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
}: {
  children: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
      className={itemClass}
    >
      <span className="flex size-4 items-center justify-center">{checked && <Check className="!text-accent" />}</span>
      <span className="flex-1 truncate">{children}</span>
    </DropdownMenu.CheckboxItem>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{children}</DropdownMenu.Label>
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-line" />
}
