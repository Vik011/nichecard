import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'hero'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'font-semibold rounded-lg transition-all cursor-pointer border-0'
  const variants = {
    primary: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]',
    ghost: 'bg-transparent border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600',
    hero: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_40px_rgba(99,102,241,0.35)] hover:shadow-[0_0_50px_rgba(99,102,241,0.5)]',
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
