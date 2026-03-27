import React, { useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { Users, CheckCircle2, UserCheck, Vote, Trophy, ArrowRight, Activity, ShieldCheck, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'
import PageLoader from '../components/PageLoader'

export default function Dashboard() {
  const user = useStore(state => state.user)
  const memberData = useStore(state => state.memberData)
  const settings = useStore(state => state.settings)
  const members = useStore(state => state.members)
  const positions = useStore(state => state.positions)
  const votes = useStore(state => state.votes)
  const loading = useStore(state => state.loading)
  const syncSystem = useStore(state => state.syncSystem)
  
  const currentPos = positions.find(p => p.id === settings?.current_position_id) || positions[0]

  const stats = useMemo(() => {
    const winners = positions.map(p => p.winner_id).filter(Boolean)
    const filteredMembers = members.filter(m => m.email !== 'system-state@bwt.internal')
    const activeNominees = filteredMembers.filter(m => !m.is_admin && m.is_nominee && !winners.includes(m.id))
    const currentVotes = votes.filter(v => v.position_id === settings?.current_position_id)

    return {
      totalMembers: filteredMembers.filter(m => !m.is_admin).length,
      eligibleVoters: filteredMembers.filter(m => !m.is_admin && m.is_eligible).length,
      votesCast: currentVotes.length,
      nomineesCount: activeNominees.length
    }
  }, [members, positions, votes, settings])

  const lastResult = useMemo(() => {
    // Find the last position that has a winner
    const wonPositions = positions.filter(p => p.winner_id).sort((a, b) => b.order - a.order)
    if (wonPositions.length === 0) return null
    
    const lastPos = wonPositions[0]
    const winner = members.find(m => m.id === lastPos.winner_id)
    return {
      role: lastPos.name,
      winner: winner?.name || 'Unknown'
    }
  }, [positions, members])

  const nextRound = useMemo(() => {
    if (settings?.status === 'FINISHED') return null
    
    const currentIndex = positions.findIndex(p => p.id === settings?.current_position_id)
    if (settings?.status === 'REVEALED') {
      return positions[currentIndex + 1]?.name || null
    }
    return null
  }, [positions, settings])

  const startElection = async () => {
    if (stats.nomineesCount === 0) return
    await useStore.getState().updateSettings({ 
      status: 'VOTING', 
      current_position_id: currentPos?.id 
    })
  }

  const stopPhase = async () => {
    // For now, redirect to admin for complex tallying/stop logic
    // But provide a direct button to stop
    await useStore.getState().updateSettings({ status: 'REVEALED' })
  }

  if (loading) return <PageLoader />

  if (!memberData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 font-sans">
        <div className="max-w-md w-full border border-slate-200 p-10 bg-white rounded-2xl text-center shadow-sm">
           <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-slate-400" />
           </div>
           <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Access Denied</h2>
           <p className="text-sm text-slate-500 mb-6">Your account is not registered in the BWT mainframe.</p>
           <button 
             onClick={() => syncSystem(false)}
             className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
           >
             Refresh Identity
           </button>
        </div>
      </div>
    )
  }

  const isAdmin = memberData.is_admin

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 mt-6 font-sans antialiased text-slate-900">
      
      {/* Header Section */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Welcome, {memberData.name}</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            {isAdmin ? 'System Administrator' : 'Authorized Personnel'}
          </p>
        </div>
        {isAdmin && (
          <Link to="/admin" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2">
            Admin Hub <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Live Status Strip */}
      <div className="mb-8 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center h-10 px-4 gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", settings?.status === 'VOTING' ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {settings?.status === 'VOTING' ? '🟢 Voting Active' : 'System Standby'}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-100" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {currentPos?.name || 'No Active Round'} Round
          </span>
          <div className="h-4 w-px bg-slate-100" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             {stats.votesCast} / {stats.eligibleVoters} Votes Cast
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: Metrics & Summary */}
        <div className="space-y-6 flex flex-col">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard label="Personnel" value={stats.totalMembers} icon={Users} color="slate" />
            <MetricCard label="Voters Eligible" value={stats.eligibleVoters} icon={UserCheck} color="emerald" />
            <MetricCard label="Nominees" value={stats.nomineesCount} icon={CheckCircle2} color="indigo" />
            <MetricCard label="Votes Cast" value={stats.votesCast} icon={Vote} color="blue" />
          </div>

          {/* Quick Summary Section */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex-1">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Quick Summary</h2>
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Completed Round</p>
                  {lastResult ? (
                    <p className="text-sm font-bold text-slate-900 leading-none">
                      {lastResult.role} &rarr; Winner: <span className="text-emerald-600 uppercase">{lastResult.winner}</span> 🏆
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-slate-400 italic">No cycles completed yet</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{settings?.status === 'REVEALED' ? 'Next Phase' : 'Current Phase'}</p>
                  <p className="text-sm font-bold text-slate-900 leading-none uppercase">
                    {nextRound || (settings?.status === 'FINISHED' ? 'Election Cycle Complete' : currentPos?.name)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Election Card */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-[460px]">
          <div className="p-8 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-4 h-4 text-blue-600" />
              <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Current Round</h2>
            </div>
            
            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-3">
                  {currentPos?.name || 'Idle'}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Election Phase</p>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Status</p>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    settings?.status === 'VOTING' ? "bg-emerald-500 animate-pulse" : 
                    settings?.status === 'REVEALED' ? "bg-blue-500" : "bg-slate-200"
                  )} />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    {settings?.status === 'VOTING' ? 'Voting Open' : 
                     settings?.status === 'REVEALED' ? 'Round Closed (Revealed)' : 
                     settings?.status === 'FINISHED' ? 'Cycle Concluded' : 'Not Started'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Progress</p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-black text-slate-900 leading-none">
                    {stats.votesCast} / {stats.eligibleVoters}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-tighter">Votes Cast</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-900 transition-all duration-1000 ease-out"
                    style={{ width: `${(stats.votesCast / (stats.eligibleVoters || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-50 space-y-3">
              {isAdmin ? (
                // Admin Controls
                <div className="grid grid-cols-1 gap-3">
                  {settings?.status === 'SETUP' && (
                    <button 
                      onClick={startElection}
                      className="w-full h-14 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/10"
                    >
                      Start Voting
                    </button>
                  )}
                  {settings?.status === 'VOTING' && (
                    <Link 
                      to="/admin"
                      className="w-full h-14 border-2 border-slate-900 text-slate-900 rounded-xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center hover:bg-slate-50 transition-all"
                    >
                      Stop Voting Hub
                    </Link>
                  )}
                  {settings?.status === 'REVEALED' && (
                    <Link 
                      to="/admin"
                      className="w-full h-14 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                    >
                      Next Round Controls
                    </Link>
                  )}
                </div>
              ) : (
                // Member Actions
                settings?.status === 'VOTING' ? (
                  <Link 
                    to="/voting" 
                    className={cn(
                      "w-full h-14 flex items-center justify-center gap-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all",
                      memberData.is_eligible 
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200" 
                        : "bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed"
                    )}
                  >
                    {memberData.is_eligible ? "Enter Voting Hub" : "Unauthorized Access"}
                    {memberData.is_eligible && <ArrowRight className="w-4 h-4" />}
                  </Link>
                ) : (
                  <div className="w-full h-14 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em]">
                     Hub Restrictions Active
                  </div>
                )
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-slate-100/50 border border-slate-200/50 rounded-xl flex items-center gap-4">
         <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0" />
         <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
            Identity Protection Protocol: All ballot transmissions are hashed and anonymized prior to database commit.
         </p>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }) {
  const colors = {
    slate: "text-slate-900 bg-white",
    emerald: "text-emerald-600 bg-white",
    indigo: "text-indigo-600 bg-white",
    blue: "text-blue-600 bg-white"
  }

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 bg-slate-50")}>
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h4 className={cn("text-3xl font-black tracking-tighter leading-none", colors[color])}>{value}</h4>
      </div>
    </div>
  )
}
