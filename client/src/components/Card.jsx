import { cn } from '../lib/utils'

export default function Card({ children, className, hover = true }) {
  return (
    <div className={cn(
      "bg-white border rounded-[2rem] transition-all duration-500",
      hover && "hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-900/5 hover:-translate-y-1",
      className
    )}>
      {children}
    </div>
  )
}
