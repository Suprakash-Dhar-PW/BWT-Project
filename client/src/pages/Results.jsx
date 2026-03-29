import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart3, Trophy, Users, Hash, Award, RefreshCw, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'
import Badge from '../components/Badge'
import Button from '../components/Button'
import { cn } from '../lib/utils'

import { useStore } from '../store/useStore'
import { Link } from 'react-router-dom'
import PageLoader from '../components/PageLoader'

export default function Results() {
  const memberData = useStore(state => state.memberData)
  const settings = useStore(state => state.settings)
  const members = useStore(state => state.members)
  const positions = useStore(state => state.positions)
  const votes = useStore(state => state.votes)
  const syncSystem = useStore(state => state.syncSystem)
  const loading = useStore(state => state.loading)
  
  useEffect(() => {
    syncSystem(true)
  }, [syncSystem])

  const [errorMsg, setErrorMsg] = useState("")

  const [electionSnapshots, setElectionSnapshots] = useState([])
  const [loadingResults, setLoadingResults] = useState(true)

  const fetchResultsData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('election_results')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setElectionSnapshots(data || []);
    } catch (e) {
      console.error("Result Snapshot Fault:", e);
      setErrorMsg("Failed to synchronize with result server.");
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    fetchResultsData();
    // Re-fetch when settings change (round ends)
    const sub = supabase.channel('standings_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'election_results' }, () => {
        fetchResultsData();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(sub) };
  }, [fetchResultsData, settings?.status]);

  const results = useMemo(() => {
    if (!positions || !settings) return []

    return positions.map((p) => {
      // 1. Identify all Snapshot Data for this Role
      const roleRecords = electionSnapshots.filter(r => r.role === p.name);
      const finalWinner = roleRecords.find(r => r.is_final_winner);
      
      // 2. Identify the Latest Round with actual nominee tallies
      const competitiveRounds = roleRecords.filter(r => !r.is_final_winner && r.round_number);
      const latestRound = competitiveRounds.length > 0 
        ? Math.max(...competitiveRounds.map(r => r.round_number)) 
        : 0;

      // 3. Fallback: If no round snapshots exist (legacy), but a winner exists
      // We synthesize a candidate list from the winner record
      let candidates = [];
      if (latestRound > 0) {
        candidates = roleRecords
          .filter(r => r.round_number === latestRound && !r.is_final_winner)
          .map(r => ({
            id: r.nominee_id,
            name: r.winner_name,
            votes: r.votes
          }))
          .sort((a,b) => b.votes - a.votes);
      } else if (finalWinner) {
        candidates = [{
          id: p.winner_id,
          name: finalWinner.winner_name,
          votes: finalWinner.votes
        }];
      }

      const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

      const currentPosOrder = positions.find(pos => pos.id === settings.current_position_id)?.order || 0
      const isRevealed = p.winner_id !== null || (settings.status === 'FINISHED') || (p.order < currentPosOrder)
      const status = isRevealed ? 'COMPLETED' : (settings.current_position_id === p.id ? settings.status : 'PENDING')

      return {
        ...p,
        candidates,
        totalVotes,
        status,
        decided_by_admin: finalWinner?.winner_name && !p.winner_id ? true : false,
        winner_id: p.winner_id,
        final_winner_name: finalWinner?.winner_name
      }
    })
  }, [positions, electionSnapshots, settings])

  if (loading || loadingResults) return <PageLoader />

  const isLocked = settings?.status === 'VOTING'

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6"
        >
           <Hash className="w-6 h-6 text-slate-400" />
        </motion.div>
        <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Live Transmission Restricted</h2>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-6 max-w-sm leading-tight">
          Results Decrypted <br/>Post-Voting.
        </h1>
        <Link to="/dashboard">
          <Button variant="secondary" size="sm" icon={Clock}>Return to Dashboard</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Minimal Header */}
      <div className="flex items-center justify-between pt-6 pb-4 border-b border-gray-100">
         <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
               <BarChart3 className="w-5 h-5 text-blue-600" /> Standings
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated Outcome Matrix</p>
         </div>
         <Button variant="secondary" onClick={() => syncSystem(false)} icon={RefreshCw} className="h-10 text-[10px] px-4 font-black uppercase tracking-widest">
           Refresh
         </Button>
      </div>

      {/* Compact Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {results.map((pos, idx) => {
            const isRevealed = pos.winner_id !== null || (settings?.status === 'REVEALED' && pos.id === settings?.current_position_id)
            
            return (
              <motion.div
                key={pos.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="p-5 border-slate-200/60 shadow-sm" hover={false}>
                  <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3">
                       <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{pos.name}</h2>
                       {pos.status === 'COMPLETED' || isRevealed ? (
                          <Badge variant="success" size="sm" className="bg-emerald-50 text-emerald-600 border-emerald-100 py-0 text-[8px]">Closed</Badge>
                       ) : pos.status === 'VOTING' ? (
                          <Badge variant="blue" className="animate-pulse py-0 text-[8px]">Active</Badge>
                       ) : (
                          <Badge variant="gray" className="py-0 text-[8px]">Pending</Badge>
                       )}
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{pos.totalVotes} Votes</p>
                  </div>

                  <div className="space-y-2">
                    {pos.candidates.length > 0 ? pos.candidates.map((c, i) => {
                      const percentage = pos.totalVotes > 0 ? (c.votes / pos.totalVotes) * 100 : 0
                      const isWinner = pos.winner_id === c.id;

                      return (
                        <div key={c.id} className={cn(
                          "relative p-3 rounded-xl transition-all duration-300 border",
                          isWinner 
                            ? "bg-amber-50/40 border-amber-200/50" 
                            : "bg-white border-slate-50"
                        )}>
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2 flex-wrap">
                                 <span className={cn(
                                   "text-[10px] font-black uppercase tracking-tight break-words",
                                   isWinner ? "text-amber-800" : "text-slate-700"
                                 )}>
                                   {c.name}
                                 </span>
                                 {isWinner && (
                                   <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-amber-200 flex items-center gap-1">
                                     <Trophy className="w-2.5 h-2.5" /> Winner
                                   </span>
                                  )}
                                  {isWinner && pos.decided_by_admin && (
                                     <Badge variant="blue" size="xs" className="text-[7px] py-0 px-1 border-blue-200 bg-blue-50 text-blue-600 font-black">
                                       Decided by Admin
                                     </Badge>
                                  )}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                               <p className="text-[10px] font-black text-slate-900">{c.votes} <span className="text-slate-400 text-[8px] tracking-widest">{c.votes === 1 ? 'VOTE' : 'VOTES'}</span></p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                               <ProgressBar value={percentage} variant={isWinner ? 'yellow' : 'blue'} className="h-1.5 rounded-full" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 min-w-[30px] text-right">{Math.round(percentage)}%</span>
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="py-10 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Awaiting Transmission...</p>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
