import { LayoutGrid, Vote, Shield, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import Badge from './Badge'

export default function DashboardHeader({ memberData }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4 border-b border-gray-100 pb-10">
       <div>
          <Badge variant="blue" className="mb-4" icon={Shield}>System Clearance: {memberData.is_admin ? 'Level 1 Admin' : 'Standard Member'}</Badge>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-[0.9]"
          >
             Personnel <br/>
             <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 italic">Dashboard</span>
          </motion.h1>
       </div>
       <div className="flex flex-col items-start md:items-end gap-1.5">
          <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase leading-none">Logged Identifier</p>
          <h4 className="text-lg font-black text-slate-900 leading-none tracking-tight break-words max-w-[240px]">{memberData.name}</h4>
       </div>
    </div>
  )
}
