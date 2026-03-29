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
  syncPromise: null, // Track active sync to prevent concurrency issues
  syncPaused: false, // Flag to temporarily disable background sync during atomic resets

  // Global Sync Engine
  syncSystem: async (silent = true, force = false) => {
    // Prevent concurrent syncs unless forced
    if (!force && (get().syncPaused || get().syncPromise)) return get().syncPromise;

    const syncWork = (async () => {
      if (!silent) set({ loading: true });
      
      try {
        console.log("[SYNC] Starting protocol synchronization...");
        
        // 1. Parallel Core Persistence Taps
        const [memRes, posRes, setRes, voteRes] = await Promise.all([
          supabase.from('members').select('*').order('name'),
          supabase.from('positions').select('*').order('order'),
          supabase.from('settings').select('*').order('id', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('votes').select('*')
        ]);

        // Check for fetch errors
        if (memRes.error || posRes.error || setRes.error || voteRes.error) {
          console.warn("[SYNC] Data retrieval partially failed:", {
            mem: memRes.error?.message,
            pos: posRes.error?.message,
            settings: setRes.error?.message,
            votes: voteRes.error?.message
          });
        }

        // 2. Refresh Auth Context (Non-blocking if possible)
        const { data: { user: currentUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: get().user } }));

        // 3. Registry Identity Mapping
        const currentMember = memRes.data?.find(
          (m) => m.email.toLowerCase() === currentUser?.email?.toLowerCase()
        );

        // 4. Atomic Pulse Update
        set({ 
          user: currentUser || get().user,
          memberData: currentMember || get().memberData,
          members: memRes.data || get().members,
          positions: posRes.data || get().positions,
          settings: setRes.data || get().settings,
          votes: voteRes.data || get().votes,
          initialized: true
        });

        // RECOVERY LOGIC: Check for missing critical ID and heal if possible
        if (setRes.data && !setRes.data.current_position_id && posRes.data?.length > 0) {
           console.warn("[SYNC] settings.current_position_id missing. Healing from first position...");
           // We don't update DB here to prevent loops, but keep store valid
           set({ settings: { ...setRes.data, current_position_id: posRes.data[0].id } });
        }
        
        console.log("[SYNC] Transmission Synchronized.");
      } catch (e) {
        console.error("[SYNC] Critical Transmission Fault:", e);
        set({ initialized: true });
      } finally {
        set({ loading: false, syncPromise: null });
      }
    })();

    set({ syncPromise: syncWork });
    return syncWork;
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
