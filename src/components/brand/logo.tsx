import { useId } from 'react'
import { cn } from '../../lib/utils'

export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={cn('size-7', className)}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7BE5B" />
          <stop offset="1" stopColor="#E58A1F" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${id}-bg)`} />
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="15.25" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.5" />
      <path d="M20 22.5 L30 32 L20 41.5" stroke="#1A1206" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 41.5 H45" stroke="#1A1206" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">PromptVault</span>
    </span>
  )
}
