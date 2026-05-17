import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'hero'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'font-semibold rounded-lg transition-all cursor-pointer border-0'
  const variants = {
    primary: 'bg-white text-surface-raised hover:bg-slate-100 shadow-[0_8px_16px_-2px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.2)]',
    ghost: 'bg-transparent border border-hairline-edge text-ink-muted hover:text-ink hover:border-hairline-edge',
    hero: 'bg-white text-surface-raised hover:bg-slate-100 shadow-[0_12px_28px_-4px_rgba(0,0,0,0.25)] hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.3)]',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3.5 text-base',
  }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}
