import { motion } from 'framer-motion'
import Card from './Card'
import { cn } from '../lib/utils'

export default function StatsCard({ label, value, icon: Icon, colorClass, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay * 0.1 }}
    >
      <Card className="p-6 border-slate-100 flex flex-col gap-4 bg-white shadow-sm" hover={true}>
         <div className={cn(
           "w-10 h-10 rounded-xl flex items-center justify-center font-black transition-colors",
           colorClass || "bg-blue-50 text-blue-600 border border-blue-100"
         )}>
            <Icon className="w-5 h-5" />
         </div>
         <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none tracking-tighter">{value}</h4>
         </div>
      </Card>
    </motion.div>
  )
}
