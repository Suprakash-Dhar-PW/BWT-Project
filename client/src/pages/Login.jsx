import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Mail, ArrowRight, Loader2, Sparkles, Hash, AlertTriangle, RefreshCw } from 'lucide-react'

import Button from '../components/Button'
import Card from '../components/Card'
import { cn } from '../lib/utils'

export default function Login() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('email') // email or verify
  const [errorMsg, setErrorMsg] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const signIn = useStore(state => state.signIn)
  const verifyOtp = useStore(state => state.verifyOtp)
  const user = useStore(state => state.user)
  const memberData = useStore(state => state.memberData)
  
  const navigate = useNavigate()
  const inputRef = useRef(null)

  useEffect(() => {
    // Critical: only redirect if user AND their member registry record are confirmed
    if (user && memberData) {
       navigate('/dashboard')
    }
  }, [user, memberData, navigate])

  useEffect(() => {
    let timer
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [cooldown])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    setErrorMsg('')
    // Check if email belongs to a member first for better UX
    const { data: member } = await supabase.from('members').select('id').eq('email', email.trim().toLowerCase()).single()
    
    if (!member) {
      setLoading(false)
      return setErrorMsg("Identity not found in personnel registry.")
    }

    const { error } = await signIn(email.trim().toLowerCase())
    if (error) {
      setErrorMsg(`Authentication Fault: ${error.message}`)
    } else {
      setStep('verify')
      setCooldown(30)
    }
    setLoading(false)
  }

  const handleVerify = async (e) => {
    e?.preventDefault()
    if (token.length < 6) return
    
    setLoading(true)
    setErrorMsg('')
    const { error, memberData: verifiedData } = await verifyOtp(email.trim().toLowerCase(), token)
    if (error) {
       setErrorMsg(`Verification Failed: ${error.message}`)
       setToken('')
    } else if (verifiedData) {
       // All users land on dashboard for a unified start experience
       navigate('/dashboard')
    } else {
       setErrorMsg(`Authorization Error: Member registry check failed.`)
       setToken('')
       setStep('email')
    }
    setLoading(false)
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setLoading(true)
    setErrorMsg('')
    const { error } = await signIn(email.trim().toLowerCase())
    if (!error) {
      setCooldown(30)
      setToken('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === 'email' ? (
          <motion.div
            key="email-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <Card className="p-10 border-slate-200 shadow-2xl bg-white relative overflow-hidden" hover={false}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 blur-3xl rounded-full translate-x-16 -translate-y-16" />
               
               <div className="relative z-10">
                 <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-10 shadow-xl group">
                    <ShieldCheck className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                 </div>
                 
                 <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-4">Personnel Authentication</h2>
                 <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-8 leading-[0.9]">
                    System <br/>
                    <span className="text-blue-600 italic">Clearance</span>
                 </h1>

                 <form onSubmit={handleLogin} className="space-y-6">
                    {errorMsg && (
                       <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest rounded-xl text-center border border-red-100">
                          {errorMsg}
                       </div>
                    )}
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Identifier</label>
                       <div className="relative group">
                          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                             <Mail className="w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                          </div>
                          <input
                             required
                             type="email"
                             value={email}
                             onChange={(e) => setEmail(e.target.value)}
                             placeholder="name@domain.com"
                             className="w-full h-14 bg-slate-50 border border-slate-200 pl-12 pr-4 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                          />
                       </div>
                    </div>

                    <Button 
                      type="submit" 
                      loading={loading} 
                      icon={ArrowRight}
                      className="w-full h-14 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl"
                    >
                      Initialize Access
                    </Button>
                 </form>
               </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="verify-step"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <Card className="p-10 border-slate-200 shadow-2xl bg-white relative overflow-hidden text-center" hover={false}>
               <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-blue-100">
                  <Hash className="w-8 h-8 text-white" />
               </div>

               <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-4">Security Challenge</h2>
               <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-none text-center">
                  Passcode Required
               </h1>
               <p className="text-slate-500 text-[11px] font-medium leading-relaxed mb-10 uppercase tracking-widest max-w-[240px] mx-auto">
                 Enter the unique 6-digit sequence dispatched to your registry email.
               </p>

               <div className="space-y-8">
                  {errorMsg && (
                     <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest rounded-xl text-center border border-red-100">
                        {errorMsg}
                     </div>
                  )}
                  <div className="relative">
                     <input
                        ref={inputRef}
                        type="text"
                        maxLength={10}
                        value={token}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          setToken(val)
                          if (val.length >= 6) {
                            // Automatically attempt verification as a fallback but allow manual submit
                          }
                        }}
                        autoFocus
                        className="w-full h-20 bg-slate-50 border-2 border-slate-200 rounded-3xl text-center text-4xl font-black tracking-[0.5em] text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50 transition-all"
                        placeholder="000000"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <button 
                       onClick={() => setStep('email')} 
                       className="h-14 border border-slate-100 hover:bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                     >
                       Change Email
                     </button>
                     <Button 
                       onClick={handleVerify} 
                       loading={loading}
                       className="h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100"
                     >
                       Verify Identity
                     </Button>
                  </div>

                  <div className="pt-6 border-t border-slate-50">
                     <button
                        onClick={handleResend}
                        disabled={cooldown > 0 || loading}
                        className="flex items-center gap-2 mx-auto text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 disabled:opacity-50 transition-colors"
                     >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                        {cooldown > 0 ? `Retry in ${cooldown}s` : 'Request New Token'}
                     </button>
                  </div>
               </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
