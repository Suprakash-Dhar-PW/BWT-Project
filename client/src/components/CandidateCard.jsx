import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import Card from './Card'
import { cn } from '../lib/utils'

const CandidateCard = forwardRef(({ name, isSelected, onClick, delay }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
    >
      <button 
        onClick={onClick}
        className="w-full text-left focus:outline-none"
      >
        <Card className={cn(
          "p-8 border-2 transition-all",
          isSelected ? "border-blue-600 ring-4 ring-blue-50 bg-blue-50/20" : "border-slate-50 group-hover:border-slate-100"
        )}>
          <div className="flex items-center justify-between gap-6">
             <div className="flex items-center gap-6">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl transition-all shadow-sm",
                  isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                )}>
                   {name.charAt(0)}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">{name}</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{isSelected ? 'Candidate Selected' : 'Nominated Member'}</p>
                </div>
             </div>
             {isSelected && (
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                   <CheckCircle2 className="w-6 h-6" />
                </div>
             )}
          </div>
        </Card>
      </button>
    </motion.div>
  )
})

CandidateCard.displayName = 'CandidateCard'

export default CandidateCard
