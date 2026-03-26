import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, AlertTriangle, ShieldCheck, UserCheck, X } from 'lucide-react';
import { cn } from '../lib/utils';
import Card from './Card';
import Badge from './Badge';
import Button from './Button';

export default function TieBreakModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  candidates, 
  roleName,
  isProcessing 
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl"
        >
          <Card className="p-0 border-slate-200 shadow-2xl overflow-hidden bg-white" hover={false}>
            {/* Header */}
            <div className="bg-slate-900 p-8 text-center relative">
               <div className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer" onClick={onClose}>
                  <X className="w-5 h-5" />
               </div>
               
               <div className="mx-auto w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-amber-900/20">
                  <AlertTriangle className="w-8 h-8 text-white" />
               </div>
               
               <h2 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">Protocol Conflict Detected</h2>
               <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
                  Tie-Break Required
               </h1>
               <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
                  Active Ballot Cycle: <span className="text-white">{roleName}</span>
               </p>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                 <p className="text-slate-500 text-xs font-medium leading-relaxed max-w-sm mx-auto uppercase tracking-wide">
                    The election has resulted in a stalemate. Multiple candidates share the highest vote count. Administrator intervention is mandatory to finalize the outcome.
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {candidates.map((c) => (
                    <Card 
                      key={c.id} 
                      className="p-4 border-slate-100 bg-white group hover:border-blue-200 transition-all cursor-default"
                      hover={false}
                    >
                       <div className="flex items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center font-black text-sm uppercase">
                                {c.name.charAt(0)}
                             </div>
                             <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{c.name}</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                   <Badge variant="blue" className="py-0 px-1 text-[8px]">{c.votes} VOTES</Badge>
                                </div>
                             </div>
                          </div>
                       </div>
                       
                       <Button 
                         disabled={isProcessing}
                         onClick={() => onSelect(c.id, c.name)}
                         className="w-full h-10 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                       >
                          <UserCheck className="w-3.5 h-3.5" /> Approve Selection
                       </Button>
                    </Card>
                 ))}
              </div>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-center gap-2 text-slate-400">
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Admin Override Mode Enabled</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
