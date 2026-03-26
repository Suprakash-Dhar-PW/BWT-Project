import { Vote, BarChart3, Shield, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from './Card'
import Button from './Button'

export default function ActionPanel({ memberData, settings }) {
  const isVoter = memberData?.is_eligible
  const isAdmin = memberData?.is_admin
  const isVoting = settings?.status === 'VOTING'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
      
      {/* Target Module 1 */}
      <Card className="p-8 border-slate-200 overflow-hidden relative shadow-lg shadow-blue-900/5 bg-white group" hover={true}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 blur-3xl rounded-full translate-x-16 -translate-y-16" />
         <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-10 transition-transform group-hover:scale-110">
            <Vote className="w-8 h-8" />
         </div>
         <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-none">Voting <br/> <span className="text-blue-600">Hub</span></h3>
         <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-relaxed mb-10 max-w-[200px]"> Cast your encrypted ballot for the current target role. Access requires personnel clearance. </p>
         <Link to="/voting" className="block">
            <Button variant={isVoting ? 'primary' : 'secondary'} className="w-full text-[10px] h-11" icon={ArrowRight}> {isVoting ? 'Enter Vault' : 'Hub Offline'} </Button>
         </Link>
      </Card>

      {/* Target Module 2 */}
      <Card className="p-8 border-slate-200 overflow-hidden relative shadow-lg shadow-indigo-900/5 bg-white group" hover={true}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 blur-3xl rounded-full translate-x-16 -translate-y-16" />
         <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-10 transition-transform group-hover:scale-110">
            <BarChart3 className="w-8 h-8" />
         </div>
         <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-none">Outcome <br/> <span className="text-indigo-600">Standings</span></h3>
         <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-relaxed mb-10 max-w-[200px]"> Real-time telemetry and finalized results from previous and current election phases. </p>
         <Link to="/results" className="block">
            <Button variant="secondary" className="w-full text-[10px] h-11" icon={ArrowRight}>View Telemetry</Button>
         </Link>
      </Card>

      {/* Target Module 3 (Admin Only) */}
      {isAdmin && (
         <Card className="p-8 border-slate-200 overflow-hidden relative shadow-lg shadow-emerald-900/5 bg-white group" hover={true}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 blur-3xl rounded-full translate-x-16 -translate-y-16" />
            <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-white mb-10 transition-transform group-hover:scale-110">
               <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-none">Protocol <br/> <span className="text-emerald-600">Admin</span></h3>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-relaxed mb-10 max-w-[200px]"> High-level control unit for registry management, role nomination, and transmission start. </p>
            <Link to="/admin" className="block">
               <Button variant="secondary" className="w-full text-[10px] h-11" icon={ArrowRight}>Enter Command</Button>
            </Link>
         </Card>
      )}
    </div>
  )
}
