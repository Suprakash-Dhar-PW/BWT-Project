import { cn } from '../lib/utils'
import { Loader2 } from 'lucide-react'

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon, 
  loading = false, 
  disabled = false, 
  className, 
  ...props 
}) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-100',
    secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-100',
    ghost: 'bg-transparent text-slate-400 hover:text-slate-900 hover:bg-slate-50'
  }

  const sizes = {
    sm: 'h-9 px-4 text-[10px]',
    md: 'h-11 px-6 text-xs',
    lg: 'h-14 px-8 text-sm'
  }

  return (
    <button
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center justify-center font-black uppercase tracking-widest transition-all rounded-xl disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : Icon && (
        <Icon className={cn("w-4 h-4", children ? "mr-2" : "m-0")} />
      )}
      {children}
    </button>
  )
}
