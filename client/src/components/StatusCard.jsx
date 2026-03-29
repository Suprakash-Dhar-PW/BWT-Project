import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Play, ShieldCheck, Trophy } from 'lucide-react'
import Card from './Card'
import { cn } from '../lib/utils'

export default function StatusCard({ settings, currentPos, memberData }) {
  const isOngoing = settings?.status === 'VOTING'
  const isRevealed = settings?.status === 'REVEALED'
  const isFinished = settings?.status === 'FINISHED'

  return (
    <Card className="p-8 border-slate-200 overflow-hidden relative shadow-2xl shadow-blue-900/5 bg-white" hover={false}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 blur-[100px] rounded-full translate-x-32 -translate-y-32" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
         <div className="space-y-6">
            <div className="flex items-center gap-3">
               <div className={cn(
                 "w-3 h-3 rounded-full ring-4 shadow-xl",
                 isOngoing ? "bg-emerald-500 ring-emerald-100 animate-pulse" : "bg-blue-500 ring-blue-100"
               )} />
               <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] leading-none">Transmission Status: {settings?.status}</p>
            </div>
            
            <div className="space-y-2">
               {isOngoing ? (
                  <h3 className="text-4xl sm:text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1 text-center sm:text-left">
                     Protocol <br/>
                     <span className="text-blue-600">Transmitting</span>
                  </h3>
               ) : (
                  <h3 className="text-4xl sm:text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1 text-center sm:text-left">
                     System <br/>
                     <span className="text-slate-400">Idle State</span>
                  </h3>
               )}
               <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-sm text-center sm:text-left">
                  {isOngoing ? `Target role identification active for ${currentPos?.name}. Ballot hub open.` : 'No active election transmissions detected. Monitoring registry for cycle initiation.'}
               </p>
            </div>
         </div>

         <div className="flex flex-col items-center md:items-end gap-5 shrink-0">
            {currentPos && (
               <div className="p-5 bg-slate-900 rounded-[2rem] text-white flex items-center gap-5 border border-slate-800 shadow-2xl w-full sm:w-auto">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-center text-blue-400 backdrop-blur-md">
                     {isOngoing ? <ShieldCheck className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                  </div>
                  <div className="pr-4">
                     <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Authenticated Target</p>
                     <h4 className="text-2xl font-black uppercase tracking-tight leading-none">{currentPos.name}</h4>
                  </div>
               </div>
            )}
            
            {memberData?.is_voter ? (
               <div className="flex items-center gap-2 px-5 p-2 bg-emerald-50 border border-emerald-100 rounded-full">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Voter Access Cleared</span>
               </div>
            ) : (
               <div className="flex items-center gap-2 px-5 p-2 bg-amber-50 border border-amber-100 rounded-full">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Entry Restricted</span>
               </div>
            )}
         </div>
      </div>
    </Card>
  )
}
