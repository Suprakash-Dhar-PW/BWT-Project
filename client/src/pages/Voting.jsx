import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { Vote, ShieldCheck, AlertCircle, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Card from '../components/Card'
import CandidateCard from '../components/CandidateCard'
import Button from '../components/Button'
import Badge from '../components/Badge'
import PageLoader from '../components/PageLoader'

export default function Voting() {
  const user = useStore(state => state.user)
  const memberData = useStore(state => state.memberData)
  const settings = useStore(state => state.settings)
  const positions = useStore(state => state.positions)
  const members = useStore(state => state.members)
  const votes = useStore(state => state.votes)
  const loading = useStore(state => state.loading)
  const syncSystem = useStore(state => state.syncSystem)

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [voterHash, setVoterHash] = useState(null)

  // 1. Identify current active position context
  const currentPos = useMemo(() => {
    if (!settings || !positions) return null
    return positions.find(p => p.id === settings.current_position_id)
  }, [settings, positions])

  // 2. Identify candidates (excluding winners of previous positions)
  const candidates = useMemo(() => {
    if (!currentPos || !members || !positions) return []
    
    const currentIndex = positions.findIndex(p => p.id === currentPos.id)
    const previousWinners = positions.slice(0, currentIndex).map(p => p.winner_id).filter(Boolean)
    
    return members.filter(m => 
      !m.is_admin && 
      m.is_nominee && 
      !previousWinners.includes(m.id)
    )
  }, [currentPos, members, positions])

  // 3. Cryptographically derive voter hash and check for existing ballot
  const hasVoted = useMemo(() => {
    if (!voterHash || !votes || !settings) return false
    return votes.some(v => v.voter_hash === voterHash && v.position_id === settings.current_position_id)
  }, [voterHash, votes, settings])

  useEffect(() => {
    if (user && settings?.current_position_id) {
       hashVoter(user.id, settings.current_position_id).then(setVoterHash)
    }
  }, [user, settings])

  const hashVoter = async (userId, posId) => {
    const msg = `${userId}-${posId}`
    
    // Check for cryptographic digest support (available in secure contexts only)
    if (globalThis.crypto?.subtle?.digest) {
      try {
        const encoder = new TextEncoder()
        const data = encoder.encode(msg)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        return Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
      } catch (e) {
        console.warn("Crypto digest failed, falling back:", e)
      }
    }
    
    // Fallback: Non-cryptographic but unique-enough hash for identification in dev/non-secure environments
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < msg.length; i++) {
        ch = msg.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  const submitVote = async () => {
    if (!selectedCandidate || !currentPos || !voterHash) return
    
    setSubmitting(true)
    try {
      // 1. Transactional check for session validity
      const { data: latestSettings } = await supabase.from('settings').select('status, current_position_id').single()
      if (latestSettings?.status !== 'VOTING' || latestSettings?.current_position_id !== settings.current_position_id) {
         throw new Error("Election session migration detected. Transmission aborted.")
      }

      // 2. Insert hashed ballot
      const { error } = await supabase.from('votes').insert([{
        position_id: settings.current_position_id,
        nominee_id: selectedCandidate,
        voter_hash: voterHash,
        round_number: settings.round_number || 1
      }])

      if (error) {
        if (error.message.includes('unique')) {
           // Treated as duplicate recovery
           await syncSystem(true)
        } else {
           throw error
        }
      } else {
        // success!
        setSelectedCandidate(null)
        await syncSystem(true) 
      }
    } catch (e) {
      console.error("Ballot Transmission Critical Fault:", e.message)
      alert(`Submission Error: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoader />

  if (!memberData?.is_eligible) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Card className="max-w-md text-center p-12 border-amber-100" hover={false}>
         <div className="mx-auto w-20 h-20 bg-amber-50 rounded-3xl border border-amber-100 flex items-center justify-center mb-8">
            <AlertCircle className="w-10 h-10 text-amber-500" />
         </div>
         <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-4 leading-none">Voter Restricted</h2>
         <p className="text-slate-500 font-medium leading-relaxed">
           Your identifier has not been cleared for this election cycle. Protocols are restricted to verified personnel only.
         </p>
      </Card>
    </div>
  )

  if (settings?.status !== 'VOTING') return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Card className="max-w-md text-center p-12" hover={false}>
         <div className="mx-auto w-20 h-20 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center mb-8">
            <Calendar className="w-10 h-10 text-slate-400" />
         </div>
         <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-4 leading-none">Stand By</h2>
         <p className="text-slate-500 font-medium leading-relaxed">
           The voting transmission hub is currently offline. Administrator intervention is required to initiate the next phase.
         </p>
      </Card>
    </div>
  )

  if (hasVoted) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Card className="max-w-xl text-center p-16 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-white" hover={false}>
           <div className="mx-auto w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mb-10 shadow-xl shadow-blue-100 transition-transform hover:scale-110">
              <ShieldCheck className="w-12 h-12" />
           </div>
           <Badge variant="blue" className="mb-6">Ballot Synchronized</Badge>
           <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-6">Vote Recorded</h2>
           <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-sm mx-auto">
             Your secure encrypted transmisson for <span className="text-blue-600 font-bold">{currentPos?.name}</span> has been finalized.
           </p>
        </Card>
      </motion.div>
    </div>
  )

  return (
    <div className="space-y-12 pb-20">
      <div className="text-center max-w-3xl mx-auto">
        <Badge variant="blue" className="mb-6" icon={Vote}>Active Ballot Cycle: {currentPos?.name}</Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase mb-6 leading-[0.9]">
          Cast Your <br/>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Decision</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {candidates.map((c, i) => (
            <CandidateCard
              key={c.id}
              name={c.name}
              isSelected={selectedCandidate === c.id}
              onClick={() => setSelectedCandidate(c.id)}
              delay={i}
            />
          ))}
        </AnimatePresence>
      </div>

      <motion.div 
        layout
        className="fixed bottom-12 left-0 right-0 p-4 z-50 pointer-events-none flex justify-center"
      >
        <AnimatePresence>
          {selectedCandidate && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="pointer-events-auto w-full max-w-md"
            >
              <Card className="bg-slate-900 border border-slate-800 p-6 flex items-center justify-between gap-6 shadow-2xl" hover={false}>
                <div className="flex-1">
                   <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Target Persona</p>
                   <h4 className="text-white font-black uppercase text-xl truncate">{candidates.find(c => c.id === selectedCandidate)?.name}</h4>
                </div>
                <Button 
                  onClick={submitVote} 
                  loading={submitting} 
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px]"
                >
                  Vote
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
