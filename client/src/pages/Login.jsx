import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, 
  Mail, 
  ArrowRight, 
  Loader2, 
  Hash, 
  AlertTriangle, 
  RefreshCw,
  Lock,
  ChevronLeft
} from 'lucide-react'

import { cn } from '../lib/utils'

export default function Login() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(['', '', '', '', '', '', '', '']) // 8 digits
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('email') // email or verify
  const [errorMsg, setErrorMsg] = useState('')
  const [cooldown, setCooldown] = useState(0)
  
  const signIn = useStore(state => state.signIn)
  const verifyOtp = useStore(state => state.verifyOtp)
  const user = useStore(state => state.user)
  const memberData = useStore(state => state.memberData)
  
  const navigate = useNavigate()
  const otpInputs = useRef([])

  useEffect(() => {
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
    if (!email) return

    setLoading(true)
    setErrorMsg('')
    
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
      setCooldown(60)
    }
    setLoading(false)
  }

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return
    
    const newToken = [...token]
    newToken[index] = value.slice(-1)
    setToken(newToken)

    if (value && index < 7) {
      otpInputs.current[index + 1].focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !token[index] && index > 0) {
      otpInputs.current[index - 1].focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasteData = e.clipboardData.getData('text').slice(0, 8).split('')
    if (pasteData.every(char => !isNaN(char))) {
      const newToken = [...token]
      pasteData.forEach((char, i) => {
        if (i < 8) newToken[i] = char
      })
      setToken(newToken)
      if (pasteData.length === 8) {
        otpInputs.current[7].focus()
      }
    }
  }

  const handleVerify = async (e) => {
    e?.preventDefault()
    const finalToken = token.join('')
    if (finalToken.length < 8) return
    
    setLoading(true)
    setErrorMsg('')
    const { error, memberData: verifiedData } = await verifyOtp(email.trim().toLowerCase(), finalToken)
    if (error) {
       setErrorMsg(`Verification Failed: ${error.message}`)
       setToken(['', '', '', '', '', '', '', ''])
       otpInputs.current[0].focus()
    } else if (verifiedData) {
       navigate('/dashboard')
    } else {
       setErrorMsg(`Authorization Error: Member registry check failed.`)
       setToken(['', '', '', '', '', '', '', ''])
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
      setCooldown(60)
      setToken(['', '', '', '', '', '', '', ''])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (token.join('').length === 8 && step === 'verify' && !loading) {
      handleVerify()
    }
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-6 selection:bg-indigo-100 selection:text-indigo-900 antialiased font-sans">
      <AnimatePresence mode="wait">
        {step === 'email' ? (
          <motion.div
            key="email-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-[400px]"
          >
            <div className="bg-white rounded-[2rem] shadow-[0_12px_48px_-8px_rgba(0,0,0,0.06)] border border-slate-100 p-10 md:p-12 text-center">
              
              {/* BRANDING */}
              <div className="mb-10">
                <img 
                  src={`${import.meta.env.BASE_URL}bwt.png`}
                  alt="BWT LOGO" 
                  className="w-16 h-16 mx-auto mb-6 object-contain filter drop-shadow-sm" 
                />
                <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none mb-1 text-center">
                  BWT PROTOCOL
                </h1>
                <p className="text-xs font-medium text-slate-400">Secure Voting Access</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                {errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 text-left"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </motion.div>
                )}

                <div className="text-left space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Registry Identifier</label>
                  <div className="relative group">
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="identity@bwt.local"
                      className="w-full h-14 bg-slate-50 border border-slate-50 focus:bg-white focus:border-slate-200 px-6 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none transition-all group-hover:border-slate-200"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300">
                      <Mail className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading || !email}
                  className="w-full h-14 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-100 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Access System"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <div className="flex items-center justify-center gap-2 pt-6 border-t border-slate-50 opacity-40">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Authorized Personnel Only</span>
                </div>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="verify-step"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="w-full max-w-[480px]"
          >
            <div className="bg-white rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(15,23,42,0.1)] border border-slate-100 p-8 md:p-12 relative overflow-hidden text-center">
              
              <button 
                onClick={() => setStep('email')}
                className="mb-8 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2 transition-all mx-auto opacity-70 hover:opacity-100"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Step Back
              </button>

              <div className="mb-10">
                <div className="w-20 h-20 bg-indigo-50/50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-indigo-100/50">
                  <Hash className="w-8 h-8 text-indigo-500" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 uppercase leading-none mb-3 tracking-tight">
                  Identity Verification
                </h1>
                <p className="text-sm font-medium text-slate-400 px-4">Passcode en-route to <br/><span className="text-slate-900 font-bold decoration-indigo-200 underline underline-offset-4">{email}</span></p>
              </div>

              <div className="space-y-12">
                {errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </motion.div>
                )}

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 md:gap-3 w-full" onPaste={handlePaste}>
                  {token.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => otpInputs.current[idx] = el}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className={cn(
                        "w-full h-14 md:h-16 text-center text-xl font-black rounded-2xl border-2 transition-all outline-none",
                        digit 
                          ? "bg-white border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-100" 
                          : "bg-slate-50 border-transparent focus:border-indigo-200 focus:bg-white text-slate-900"
                      )}
                    />
                  ))}
                </div>

                <div className="space-y-6">
                  <button 
                    onClick={handleVerify} 
                    disabled={loading || token.join('').length < 8}
                    className="w-full h-16 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 overflow-hidden relative group"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {loading ? "Decrypting Access..." : "Verify Identity"}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                  </button>

                  <button
                    onClick={handleResend}
                    disabled={cooldown > 0 || loading}
                    className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 hover:text-indigo-600 disabled:opacity-40 transition-all flex items-center justify-center gap-2 mx-auto py-2"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                    {cooldown > 0 ? `Retry in ${cooldown}s` : "Resend Security Token"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
