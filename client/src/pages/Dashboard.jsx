import React, { useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { 
  Users, 
  CheckCircle2, 
  UserCheck, 
  Vote, 
  Trophy, 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Clock,
  LayoutDashboard,
  Target,
  FileBadge2,
  Bell,
  ChevronRight,
  TrendingUp,
  Zap
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import PageLoader from '../components/PageLoader'
import Badge from '../components/Badge'

export default function Dashboard() {
  const memberData = useStore(state => state.memberData)
  const settings = useStore(state => state.settings)
  const members = useStore(state => state.members)
  const positions = useStore(state => state.positions)
  const votes = useStore(state => state.votes)
  const loading = useStore(state => state.loading)
  const syncSystem = useStore(state => state.syncSystem)
  
  const currentPos = useMemo(() => {
    return positions.find(p => p.id === settings?.current_position_id) || positions[0]
  }, [positions, settings])

  const stats = useMemo(() => {
    const winners = positions.map(p => p.winner_id).filter(Boolean)
    const filteredMembers = members.filter(m => m.email !== 'system-state@bwt.internal')
    const activeNominees = filteredMembers.filter(m => !m.is_admin && m.is_nominee && !winners.includes(m.id))
    const currentVotes = votes.filter(v => v.position_id === settings?.current_position_id && v.round_number === (settings?.round_number || 1))

    return {
      totalMembers: filteredMembers.filter(m => !m.is_admin).length,
      eligibleVoters: filteredMembers.filter(m => !m.is_admin && m.is_eligible).length,
      votesCast: currentVotes.length,
      nomineesCount: activeNominees.length
    }
  }, [members, positions, votes, settings])

  const lastResult = useMemo(() => {
    const wonPositions = [...positions].filter(p => p.winner_id).sort((a, b) => b.order - a.order)
    if (wonPositions.length === 0) return null
    
    const lastPos = wonPositions[0]
    const winner = members.find(m => m.id === lastPos.winner_id)
    return {
      role: lastPos.name,
      winner: winner?.name || 'Unknown'
    }
  }, [positions, members])

  const nextPhase = useMemo(() => {
    if (settings?.status === 'FINISHED') return "Cycle Completed"
    if (settings?.status === 'REVEALED') {
      const idx = positions.findIndex(p => p.id === settings.current_position_id)
      return positions[idx + 1]?.name || "Finalizing Cycle"
    }
    return currentPos?.name || "Initializing..."
  }, [settings, positions, currentPos])

  if (loading) return <PageLoader />

  if (!memberData) return null

  const isAdmin = memberData.is_admin
  const isVotingActive = settings?.status === 'VOTING'

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24 mt-8 font-sans selection:bg-indigo-100 selection:text-indigo-900 antialiased">
      
      {/* 🚀 HERO SECTION */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-12 rounded-[2.5rem] overflow-hidden p-10 bg-slate-900 shadow-2xl shadow-slate-200"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-slate-900 to-slate-900" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="blue" className="bg-white/10 text-white border-white/20 font-black text-[9px] px-3 py-1 uppercase tracking-widest backdrop-blur-md">
                {isAdmin ? "Admin Panel Access" : "Voting Hub Platform"}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none mb-6">
              Welcome, <span className="text-indigo-400">{memberData.name.split(' ')[0]}</span>
            </h1>
            <div className="flex flex-col gap-1">
               <p className="text-[12px] font-black text-white/40 uppercase tracking-[0.4em] leading-none mb-1">Our Core Mission</p>
               <h2 className="text-xl md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-indigo-600 tracking-[0.1em] uppercase leading-none drop-shadow-sm">
                 "We assist, Almighty fulfills"
               </h2>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className={cn(
              "px-5 py-2.5 rounded-2xl flex items-center gap-3 border backdrop-blur-md shadow-lg",
              isVotingActive 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                : "bg-white/5 border-white/10 text-slate-400"
            )}>
              <div className={cn("w-2 h-2 rounded-full", isVotingActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                {isVotingActive ? `LIVE — ${currentPos?.name || 'Round'} Active` : "WAITING — DEPLOYMENT IDLE"}
              </span>
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2">System Response: 14ms</p>
          </div>
        </div>
        
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>

      {/* 📊 STATS SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatItem label="Total Members" value={stats.totalMembers} icon={Users} color="slate" delay={0.1} />
        <StatItem label="Voters Ready" value={stats.eligibleVoters} icon={CheckCircle2} color="emerald" delay={0.15} />
        <StatItem label="Nominees" value={stats.nomineesCount} icon={UserCheck} color="indigo" delay={0.2} />
        <StatItem label="Votes Cast" value={stats.votesCast} icon={Vote} color="blue" delay={0.25} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        
        {/* 🗳️ CURRENT ELECTION CARD */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col group"
        >
          <div className="p-10 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Current Election</h3>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  isVotingActive ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                )}>
                  {isVotingActive ? "Active Round" : "Standby Mode"}
                </div>
              </div>

              <div className="mb-10">
                <h2 className="text-6xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-3 truncate">
                  {currentPos?.name || "Initializing"}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Target className="w-3.5 h-3.5" /> Phase {positions.findIndex(p => p.id === currentPos?.id) + 1} of {positions.length}
                </p>
              </div>

              {isVotingActive && (
                <div className="space-y-4">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-4xl font-black text-slate-900 leading-none">
                       {stats.votesCast} / {stats.eligibleVoters}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Localized Ballots</span>
                  </div>
                  <div className="h-4 bg-slate-50 rounded-full overflow-hidden p-1 border border-slate-100 relative shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.votesCast / (stats.eligibleVoters || 1)) * 100}%` }}
                      className="h-full bg-slate-900 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                    />
                    {isVotingActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer pointer-events-none" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-12 flex items-center gap-4">
               {isVotingActive ? (
                 <Link 
                   to="/voting"
                   className="h-16 px-12 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 active:scale-95 group/btn"
                 >
                   Enter Voting Hub <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                 </Link>
               ) : (
                 isAdmin && (
                   <Link 
                     to="/admin"
                     className="h-16 px-12 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95"
                   >
                     Admin Panel <ChevronRight className="w-4 h-4" strokeWidth={3} />
                   </Link>
                 )
               )}
            </div>
          </div>
        </motion.div>

        {/* 💠 QUICK SUMMARY SECTION */}
        <div className="flex flex-col gap-6">
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.4 }}
             className="bg-indigo-50/30 border border-indigo-100/50 p-8 rounded-[2.5rem] flex-1 flex flex-col justify-between group overflow-hidden relative shadow-sm"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                 <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Last Completed</h3>
              {lastResult ? (
                <div>
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{lastResult.role}</p>
                   <p className="text-3xl font-black text-slate-900 tracking-tighter leading-tight uppercase">{lastResult.winner} 🏆</p>
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-300 italic uppercase">Initializing Registry...</p>
              )}
            </div>
            
            <div className="relative z-10 mt-10 p-5 bg-white border border-indigo-100 rounded-2xl">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Phase</p>
               <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wide">{nextPhase}</p>
            </div>
            
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all">
               <Zap className="w-32 h-32 text-indigo-900" strokeWidth={1} />
            </div>
          </motion.div>

        </div>

      </div>

    </div>
  )
}

function StatItem({ label, value, icon: Icon, color, delay }) {
  const colors = {
    slate: "from-slate-50 to-white text-slate-600 border-slate-50 shadow-slate-100 icon-bg-slate-100 icon-text-slate-500",
    emerald: "from-emerald-50 to-white text-emerald-600 border-emerald-50 shadow-emerald-100 icon-bg-emerald-100 icon-text-emerald-500",
    indigo: "from-indigo-50 to-white text-indigo-600 border-indigo-50 shadow-indigo-100 icon-bg-indigo-100 icon-text-indigo-500",
    blue: "from-blue-50 to-white text-blue-600 border-blue-50 shadow-blue-100 icon-bg-blue-100 icon-text-blue-500"
  }

  // Simplified class selection because Tailwind dynamic classes like `bg-${color}-100` often fail if not whitelisted
  const getIconContainerClass = (c) => {
    if (c === 'slate') return "bg-slate-50 text-slate-400";
    if (c === 'emerald') return "bg-emerald-50 text-emerald-500";
    if (c === 'indigo') return "bg-indigo-50 text-indigo-500";
    if (c === 'blue') return "bg-blue-50 text-blue-500";
    return "bg-slate-50 text-slate-400";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="relative p-8 bg-gradient-to-br from-white to-slate-50 border border-slate-100 rounded-[2.2rem] shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all group overflow-hidden"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm", getIconContainerClass(color))}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-4xl font-black text-slate-900 tracking-tighter mb-1 uppercase leading-none font-mono">{value}</p>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
      </div>
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all pointer-events-none">
         <Icon className="w-16 h-16 text-slate-900" strokeWidth={1} />
      </div>
    </motion.div>
  )
}
