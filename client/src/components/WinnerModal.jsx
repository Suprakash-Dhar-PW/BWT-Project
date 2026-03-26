import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, PartyPopper, ChevronRight, BarChart } from 'lucide-react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function WinnerModal() {
  const { showWinnerModal, closeModal, settings } = useStore()
  const [winner, setWinner] = useState(null)
  const [currentPosition, setCurrentPosition] = useState(null)

  useEffect(() => {
    if (showWinnerModal && settings?.current_position_id) {
       fetchWinner()
    }
  }, [showWinnerModal, settings?.current_position_id])

  const fetchWinner = async () => {
    // 1. Fetch current position details
    const { data: pos } = await supabase
      .from('positions')
      .select('*')
      .eq('id', settings.current_position_id)
      .single()
    setCurrentPosition(pos)

    // 2. Fetch the winner member data
    if (pos?.winner_id) {
       const { data: mem } = await supabase
         .from('members')
         .select('*')
         .eq('id', pos.winner_id)
         .single()
       setWinner(mem)
    }
  }

  if (!showWinnerModal) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        {/* Backdrop Overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
        />

        {/* Modal Container */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          {/* Confetti Animation Background */}
          <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-blue-600 to-white -z-0 opacity-5" />
          
          <div className="relative p-8 sm:p-12 text-center">
            {/* Close Button */}
            <button 
              onClick={closeModal}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content Top */}
            <div className="flex justify-center mb-8">
               <motion.div 
                 initial={{ rotate: -10, scale: 0.5 }}
                 animate={{ rotate: 0, scale: 1 }}
                 transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                 className="w-24 h-24 bg-amber-100 rounded-[2rem] flex items-center justify-center text-amber-600 shadow-xl shadow-amber-200"
               >
                 <Trophy className="w-12 h-12" />
               </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-sm font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Protocol Finalized</h2>
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-8">
                Official {currentPosition?.name} Elected
              </h3>
            </motion.div>

            {/* Winner Spotlight Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="p-8 rounded-[2rem] bg-slate-900 text-white shadow-2xl shadow-blue-900/40 mb-10 relative overflow-hidden text-left"
            >
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full" />
               <div className="relative z-10 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-3xl shadow-lg border border-white/10 shrink-0">
                    {winner?.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <PartyPopper className="w-3.5 h-3.5" /> Mandate Confirmed
                    </p>
                    <p className="text-2xl font-black truncate uppercase leading-tight">{winner?.name}</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{winner?.email}</p>
                  </div>
               </div>
            </motion.div>

            {/* Call to Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
               <Link 
                 to="/results" 
                 onClick={closeModal}
                 className="flex-1 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
               >
                 <BarChart className="w-4 h-4" /> View Full Analytics
               </Link>
               <button 
                 onClick={closeModal}
                 className="px-8 h-14 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all"
               >
                 Dismiss
               </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
