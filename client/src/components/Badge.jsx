import { cn } from '../lib/utils'

export default function Badge({ 
  children, 
  variant = 'blue', 
  size = 'md', 
  icon: Icon, 
  className 
}) {
  const variants = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    gray: 'bg-slate-50 text-slate-400 border-slate-100'
  }

  const sizes = {
    xs: 'h-4 px-1.5 text-[7px]',
    sm: 'h-6 px-2.5 text-[8px]',
    md: 'h-8 px-4 text-[10px]'
  }

  return (
    <div className={cn(
      "inline-flex items-center justify-center font-black uppercase tracking-[0.2em] rounded-lg border",
      variants[variant],
      sizes[size],
      className
    )}>
      {Icon && <Icon className="w-3.5 h-3.5 mr-2" />}
      {children}
    </div>
  )
}
