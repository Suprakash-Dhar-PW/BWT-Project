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
    // Only set loading if not silent
    if (!silent) set({ loading: true })
    
    try {
      // 1. Refresh Auth Context
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      // 2. Parallel Core Persistence Taps
      const [memRes, posRes, setRes, voteRes] = await Promise.all([
        supabase.from('members').select('*').order('name'),
        supabase.from('positions').select('*').order('order'),
        supabase.from('settings').select('*').limit(1).maybeSingle(),
        supabase.from('votes').select('*')
      ])

      // 3. Registry Identity Mapping
      const currentMember = memRes.data?.find(
        (m) => m.email.toLowerCase() === currentUser?.email?.toLowerCase()
      )

      // 4. Atomic Pulse Update
      set({ 
        user: currentUser || null,
        memberData: currentMember || null,
        members: memRes.data || [],
        positions: posRes.data || [],
        settings: setRes.data || null,
        votes: voteRes.data || [],
        initialized: true
      })
      
      console.log("Transmission Synchronized.", { 
        admin: currentMember?.is_admin,
        votes: voteRes.data?.length 
      })

    } catch (e) {
      console.error("Critical Transmission Fault:", e)
      // Ensure we don't freeze the app on network errors
      set({ initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  init: async () => {
    if (get().initialized && !isInitializing) return;
    if (isInitializing) return;
    isInitializing = true;
    
    try {
      // 1. Initial State Fetch
      const { data: { user } } = await supabase.auth.getUser();
      set({ user: user || null });
      if (user) await get().fetchUserData(user.email);

      await get().syncSystem(true);

      // 2. Clear previous subscriptions if any
      supabase.removeAllChannels();

      // 3. Robust Real-time Subscription Channel
      const channel = supabase.channel('bwt_realtime_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
          console.log("Realtime: Settings Revised", payload.new);
          if (payload.new) set({ settings: payload.new });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
          console.log("Realtime: Member Update", payload.eventType);
          const { members } = get();
          
          if (payload.eventType === 'INSERT') {
            set({ members: [payload.new, ...members] });
          } else if (payload.eventType === 'UPDATE') {
            set({ members: members.map(m => m.id === payload.new.id ? payload.new : m) });
          } else if (payload.eventType === 'DELETE') {
            set({ members: members.filter(m => m.id === payload.old.id) });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, () => get().syncSystem(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, (payload) => {
           // For votes, we might still want a full sync to keep tallies accurate
           get().syncSystem(true);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_decisions' }, () => get().syncSystem(true))
        .subscribe((status) => {
          console.log("Realtime Subscription Status:", status);
        });

      // 4. Auth State Listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
           set({ user: null, memberData: null, initialized: false, members: [], positions: [], settings: null, votes: [] });
           isInitializing = false;
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
           if (session?.user) {
              set({ user: session.user });
              await get().fetchUserData(session.user.email);
              await get().syncSystem(true);
           }
        }
      });

    } catch (e) {
      console.error("Critical Vault Error:", e);
    } finally {
      isInitializing = false;
      set({ loading: false, initialized: true });
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
    try {
      const trimmedEmail = email.toLowerCase().trim()
      
      // 1. Registry Verification: Ensure the email is part of the authorized BWT pool
      const { data: member, error: checkError } = await supabase
        .from('members')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle()

      if (checkError || !member) {
        throw new Error("IDENTIFIER REJECTED: You are not registered in the BWT pool. Please contact an Administrator.")
      }

      // 2. Trigger OTP with auto-provisioning enabled
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true, // Required for the first login of an added member
          emailRedirectTo: window.location.origin
        }
      })
      if (error) throw error
      return { error: null }
    } catch (e) {
      console.error("Auth Transmission Error:", e.message)
      return { error: e }
    }
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
  },

  updateSettings: async (updates) => {
    const { settings } = get();
    if (!settings?.id) return { error: new Error("Settings not loaded") };

    // OPTIMISTIC UPDATE: Instant global sync
    const originalSettings = { ...settings };
    set({ settings: { ...settings, ...updates } });

    try {
      const { error } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', settings.id);
      
      if (error) throw error;
      
      await get().syncSystem(true);
      return { error: null };
    } catch (e) {
      // ROLLBACK on error
      set({ settings: originalSettings });
      console.error("Settings Update Fault:", e);
      return { error: e };
    }
  }
}))
