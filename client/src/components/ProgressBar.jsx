import { cn } from '../lib/utils'

export default function ProgressBar({ value, variant = 'blue', className }) {
  const variants = {
    blue: 'bg-blue-600 shadow-sm shadow-blue-500/20',
    yellow: 'bg-amber-400 shadow-sm shadow-amber-500/20',
    emerald: 'bg-emerald-500 shadow-sm shadow-emerald-500/20',
    indigo: 'bg-indigo-600 shadow-sm shadow-indigo-500/20'
  }

  return (
    <div className={cn("w-full bg-slate-100/50 rounded-full h-2 overflow-hidden border border-slate-50", className)}>
      <div 
        className={cn("h-full transition-all duration-1000 ease-out rounded-full", variants[variant])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
