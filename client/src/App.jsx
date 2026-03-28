import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Voting from './pages/Voting'
import Results from './pages/Results'
import Admin from './pages/Admin'

function ProtectedRoute({ children, adminOnly = false }) {
  const user = useStore(state => state.user)
  const memberData = useStore(state => state.memberData)
  const loading = useStore(state => state.loading)
  
  if (loading) return null
  if (!user) return <Navigate to="/" />
  if (adminOnly && !memberData?.is_admin) return <Navigate to="/dashboard" />
  
  return children
}

export default function App() {
  const init = useStore(state => state.init)
  const syncSystem = useStore(state => state.syncSystem)

  useEffect(() => {
    init()

    // STEP 8: Global Error Logging
    window.onerror = function (msg, url, line, col, error) {
      console.error("Global error:", msg, { url, line, col, error })
    }
    
    // 🔥 LIVE PROTOCOL: GLOBAL REAL-TIME SUBSCRIPTION
    const channel = supabase.channel('live-election')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
          console.log("[REALTIME] Settings Sync", payload.new);
          if (payload.new) useStore.setState({ settings: payload.new });
          syncSystem(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => {
          console.log("[REALTIME] Vote Detected");
          syncSystem(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
          console.log("[REALTIME] Registry Update");
          syncSystem(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [init, syncSystem])

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/voting" element={<ProtectedRoute><Voting /></ProtectedRoute>} />
            <Route path="/results" element={<ProtectedRoute><Results /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
