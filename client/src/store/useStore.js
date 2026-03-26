import { create } from 'zustand'
import { supabase } from '../lib/supabase'

let isInitializing = false

export const useStore = create((set, get) => ({
  user: null,
  memberData: null,
  loading: true,
  settings: null,
  positions: [],
  members: [],
  votes: [],
  initialized: false,

  // Global Sync Engine
  syncSystem: async (silent = true) => {
    if (!silent) set({ loading: true })
    try {
      const [memRes, posRes, setRes, voteRes] = await Promise.all([
        supabase.from('members').select('*').order('name'),
        supabase.from('positions').select('*').order('order'),
        supabase.from('settings').select('*').limit(1).maybeSingle(),
        supabase.from('votes').select('*')
      ])

      set({ 
        members: memRes.data || [],
        positions: posRes.data || [],
        settings: setRes.data || null,
        votes: voteRes.data || []
      })
    } catch (e) {
      console.error("System Sync Failure:", e)
    } finally {
      if (!silent) set({ loading: false })
    }
  },

  init: async () => {
    if (get().initialized) return
    if (isInitializing) return
    isInitializing = true
    
    try {
      // 1. Core Auth State Validation
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr && (authErr.message.includes('Refresh Token Not Found') || authErr.status === 401)) {
          await supabase.auth.signOut()
          set({ user: null, memberData: null })
      } else {
        set({ user: user || null })
        if (user) await get().fetchUserData(user.email)
      }

      // 2. Initial Full System Sync 
      await get().syncSystem(true)

      // 3. Real-time Subscriptions
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
           set({ user: null, memberData: null, initialized: false })
           isInitializing = false
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
           if (session?.user) {
              set({ user: session.user })
              await get().fetchUserData(session.user.email)
           }
        }
      })

      supabase.channel('global_revisions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => get().syncSystem(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, () => get().syncSystem(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => get().syncSystem(true))
        .subscribe()

    } catch (e) {
      console.error("Critical Vault Error:", e)
    } finally {
      isInitializing = false
      set({ loading: false, initialized: true })
    }
  },

  fetchUserData: async (email) => {
    if (!email) return null
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()
    
    if (data) {
        set({ memberData: data })
        return data
    }
    if (error) console.error("Identity Fault:", error.message)
    return null
  },

  refreshUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      set({ user })
      return await get().fetchUserData(user.email)
    }
    set({ user: null, memberData: null })
    return null
  },

  signIn: async (email) => {
    // Force OTP email delivery without redirect dependency
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: null // DISABLE redirect link usage, force manual token entry
      }
    })
    return { error }
  },

  verifyOtp: async (email, token) => {
    // Use manual token verification logic
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    })
    
    let fetchedMemberData = null
    if (data?.user) {
      set({ user: data.user })
      fetchedMemberData = await get().fetchUserData(data.user.email)
    }
    return { error, memberData: fetchedMemberData }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, memberData: null })
  }
}))
