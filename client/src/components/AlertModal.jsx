import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import Button from './Button'
import Card from './Card'

export default function AlertModal({ isOpen, onClose, onConfirm, title, message, type = 'danger' }) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md"
        >
          <Card className="p-8 border-slate-100 shadow-2xl bg-white relative overflow-hidden" hover={false}>
            <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-10 border border-red-100">
               <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter text-center mb-4 leading-none">{title}</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed text-center mb-10 max-w-[280px] mx-auto uppercase tracking-widest text-[10px]">
              {message}
            </p>

            <div className="grid grid-cols-2 gap-4">
               <Button variant="secondary" onClick={onClose}>Abort</Button>
               <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Confirm</Button>
            </div>
            
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg text-slate-300 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-all"
            >
               <X className="w-4 h-4" />
            </button>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
