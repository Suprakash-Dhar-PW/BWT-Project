import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { Users, CheckCircle2, ShieldAlert, BarChart3, Clock, ChevronRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import { cn } from '../lib/utils'
import PageLoader from '../components/PageLoader'
import Button from '../components/Button' // Assuming Button component is located here

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
    const activePool = members.filter(m => !m.is_admin && m.is_nominee && !winners.includes(m.id))
    const currentVotes = votes.filter(v => v.position_id === settings?.current_position_id)

    return {
      totalMembers: members.filter(m => !m.is_admin).length,
      eligibleVoters: members.filter(m => !m.is_admin && m.is_eligible).length,
      votesCast: currentVotes.length,
      nomineesCount: activePool.length
    }
  }, [members, positions, votes, settings])

  if (loading) return <PageLoader />

  if (!memberData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full border border-red-100 p-10 bg-white rounded-2xl text-center shadow-sm">
           <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <ShieldAlert className="w-6 h-6 text-red-500" />
           </div>
           <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
           <p className="text-sm text-slate-500 mb-6 font-medium">Your account is not registered in the BWT mainframe.</p>
           <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {user?.email}
           </div>
           <Button variant="secondary" onClick={() => syncSystem(false)} icon={RefreshCw} className="h-10 text-[10px] px-4 font-black uppercase tracking-widest mt-6">
             Refresh
           </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 mt-8 font-sans">
      <div className="mb-8 p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold uppercase">{memberData.name.charAt(0)}</div>
            <div>
               <h1 className="text-xl font-bold text-slate-900 leading-tight">Welcome, {memberData.name}</h1>
               <p className="text-xs text-slate-500 mt-0.5 font-medium">{memberData.is_admin ? 'System Administrator' : 'Member Registry'}</p>
            </div>
         </div>
         <div className="flex gap-2">
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</span>
               <span className="text-[11px] font-bold text-slate-700 uppercase">{memberData.is_eligible ? 'Eligible' : 'Ineligible'}</span>
            </div>
            {memberData.is_nominee && (
              <Badge variant="blue" className="px-3 py-1.5 h-auto flex flex-col items-start border-indigo-100 bg-indigo-50 text-indigo-700">
                 <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Nomination</span>
                 <span className="text-[11px] font-bold uppercase">Active Candidate</span>
              </Badge>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[240px]">
           <div>
              <div className="flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-slate-400" /><h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Election Cycle</h2></div>
              <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{currentPos?.name || 'Transmission Idle'}</h3>
              <div className="flex items-center gap-2 mt-3">
                 <div className={cn("w-2 h-2 rounded-full", settings?.status === 'VOTING' ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{settings?.status || 'STANDBY'}</span>
              </div>
           </div>
           <div className="mt-8">
              {settings?.status === 'VOTING' ? (
                <Link to="/voting" className={cn("w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all", memberData.is_eligible ? "bg-slate-900 text-white hover:bg-slate-800 shadow-lg" : "bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed")}>
                   {memberData.is_eligible ? "Join Voting Hub" : "Hub Restrictions Active"}
                   {memberData.is_eligible && <ChevronRight className="w-4 h-4" />}
                </Link>
              ) : (
                <div className="w-full h-12 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase tracking-widest">Protocol Stalled</div>
              )}
           </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white grid grid-cols-2 gap-y-8 gap-x-6">
           <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Personnel</p><h4 className="text-3xl font-bold">{stats.totalMembers}</h4></div>
           <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Eligible</p><h4 className="text-3xl font-bold text-emerald-400">{stats.eligibleVoters}</h4></div>
           <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Pool</p><h4 className="text-3xl font-bold text-indigo-400">{stats.nomineesCount}</h4></div>
           <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Casts</p><h4 className="text-3xl font-bold text-blue-400">{stats.votesCast}</h4></div>
           <div className="col-span-2 pt-6 border-t border-white/5 flex items-center justify-between group cursor-pointer">
              <Link to="/results" className="flex items-center justify-between w-full">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">Live Transmission Standings</span>
                 <BarChart3 className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-all" />
              </Link>
           </div>
        </div>
      </div>
      <div className="mt-8 p-4 bg-blue-50/30 border border-blue-100/50 rounded-xl flex items-center gap-4">
         <ShieldAlert className="w-5 h-5 text-blue-500 shrink-0" />
         <p className="text-[10px] font-medium text-blue-700/80 uppercase tracking-widest leading-relaxed">Identity Protection: All ballot transmissions are hashed and anonymized prior to database committing.</p>
      </div>
    </div>
  )
}
