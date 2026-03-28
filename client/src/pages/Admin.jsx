import React, { useEffect, useState, useMemo, memo, useCallback, startTransition, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useStore } from "../store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Trash2,
  Shield,
  Play,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
   RefreshCw,
   Hash,
   CheckCircle2,
   UserPlus,
 } from "lucide-react";
 import Badge from "../components/Badge";
 import AlertModal from "../components/AlertModal";
 import Button from "../components/Button";
import { cn } from "../lib/utils";
import PageLoader from "../components/PageLoader";

export default function Admin() {
  const members = useStore((state) => state.members);
  const positions = useStore((state) => state.positions);
  const settings = useStore((state) => state.settings);
  const syncSystem = useStore((state) => state.syncSystem);
  const votes = useStore((state) => state.votes);
  const loading = useStore((state) => state.loading);
  const initialized = useStore((state) => state.initialized);

  if (loading || !initialized) return <PageLoader />;

  const [searchTerm, setSearchTerm] = useState("");
  const [showManualReview, setShowManualReview] = useState(false);
  const [modalTally, setModalTally] = useState({});
  const [manualSelection, setManualSelection] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(null);
  const [isAdding, setIsAdding] = useState(false); // Local state for add form
  const [actionLoading, setActionLoading] = useState(false); // Global panel state
  const [pendingId, setPendingId] = useState(null); // Individual button tracker
  const [errorMsg, setErrorMsg] = useState("");
  const [localLoadingMap, setLocalLoadingMap] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [prevNomineeCount, setPrevNomineeCount] = useState(0); // FIX 5: Track nomad count
  const isSubmittingRef = useRef(false);


  // 2. Data Persistence Layer
  const refetchData = useCallback(async () => {
    try {
       await syncSystem(true);
       console.log("Registry state refreshed.");
    } catch(err) {
       console.error("Transmission Error:", err);
       setErrorMsg("Network latency detected. Identity data might be stale.");
    }
  }, [syncSystem]);

  // Dynamic Derivations
  const getWinnerRole = (memberId) => {
    const pos = positions.find((p) => p.winner_id === memberId);
    return pos ? pos.name : null;
  };

  const wonIds = useMemo(() => {
    return positions.map((p) => p.winner_id).filter(Boolean);
  }, [positions]);

  const currentPos = positions.find((p) => p.id === settings?.current_position_id) || positions[0];

  const eligibleVoters = useMemo(() => {
    return members.filter(
      (m) =>
        m.is_eligible &&
        !m.is_admin &&
        m.email !== "system-state@bwt.internal",
    ).length;
  }, [members]);

  const nomineesCount = useMemo(() => {
    return members.filter(
      (m) =>
        m.is_nominee &&
        !m.is_admin &&
        !wonIds.includes(m.id) &&
        m.email !== "system-state@bwt.internal",
    ).length;
  }, [members, wonIds]);

  // Cleanup: Any members that match the corrupted pattern are filtered out of the operational view
  const validMembers = useMemo(() => {
    return members.filter(
      (m) =>
        m.email !== "system-state@bwt.internal" && 
        !m.name.startsWith("{") && // Corrupted JSON strings
        !m.name.includes('"round":') // More specific pattern match
    );
  }, [members]);

  const isVotingActive = settings?.status === "VOTING";

  // Fetch fresh votes for modal
  const fetchModalData = useCallback(async () => {
    if (!settings?.current_position_id) return;
    try {
      const { data, error } = await supabase
        .from("votes")
        .select("nominee_id")
        .eq("position_id", settings.current_position_id)
        .eq("round_number", settings.round_number);
      
      if (error) throw error;
      
      const newTally = data.reduce((acc, v) => {
        acc[v.nominee_id] = (acc[v.nominee_id] || 0) + 1;
        return acc;
      }, {});

      console.log(`[GOVERNANCE] Fetching Round ${settings.round_number} Tally (Direct DB Query)`);
      
      setModalTally(newTally);
    } catch (err) {
      console.error("Modal Data Fault:", err);
    }
  }, [settings?.current_position_id, settings?.round_number]);

  // 1. Double check session integrity on mount
  useEffect(() => {
    syncSystem(true);
    console.log("[ADMIN] Forced Protocol Sync Initiated.");
  }, [syncSystem]);

  // Effects using derivations
  useEffect(() => {
    if (showManualReview) {
      // FIX 2 & 5: Capture current count BEFORE refetching to check for invalidation
      setPrevNomineeCount(nomineesCount);
      setModalTally({});
      setManualSelection(null);
      fetchModalData();
    }
  }, [showManualReview, nomineesCount]);

  // FIX 4: Clear old tie state when nominees change
  useEffect(() => {
    if (settings?.status === "MANUAL_REVIEW") {
       setModalTally({});
       setManualSelection(null);
    }
  }, [nomineesCount, settings?.status]);


  const filteredMembers = useMemo(() => {
    return validMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [validMembers, searchTerm]);

  // Data reconciliation handled globally via App.jsx Realtime Subscriptions.
  // This avoids redundant fetch cycles during local state updates.
  useEffect(() => {
    if (!initialized) {
      syncSystem(false);
    }
  }, [initialized]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!name || !email || isAdding) return;

    // RULE: Prevent duplicate submissions (Strict Mode / Rapid Clicks)
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const trimmedEmail = email.trim().toLowerCase();
    const candidateName = name.trim();

    // 1. Initial State UI Lock
    setIsAdding(true);
    setErrorMsg("");
    console.time("PERSISTENCE_LATENCY");

    let timeoutId = null;

    try {
      // 1. Pre-fetch Integrity Filter
      const exists = members.find(m => m.email.toLowerCase() === trimmedEmail);
      if (exists) {
        throw new Error("Identity already present in central registry.");
      }

      console.log("[REGISTRY] Firing persistence trigger...");

      // 2. Direct Persistence Task (No timeout for verification)
      const { data: insertResult, error: insertError } = await supabase
        .from("members")
        .insert([
          {
            name: candidateName,
            email: trimmedEmail,
            is_admin: false,
            is_eligible: true,
            is_nominee: false,
          },
        ])
        .select()
        .single();

      // DEBUG: Log Raw Identity Sync Response
      console.log("[DEBUG] Supabase Insert Result:", insertResult);
      if (insertError) {
        console.error("[DEBUG] Supabase Insert Error:", insertError);
        throw insertError;
      }

      console.log("[REGISTRY] Identity confirmed.");

      // 4. Optimistic UI Injection (Direct Object)
      if (insertResult) {
        useStore.setState((state) => ({
          members: [...state.members, insertResult]
        }));
      }

      // 5. Form Refresh
      setName("");
      setEmail("");

    } catch (err) {
      console.error("[REGISTRY FAULT]", err);
      setErrorMsg(err.message || "Failed to finalize enrollment.");
    } finally {
      setIsAdding(false);
      isSubmittingRef.current = false;
      console.timeEnd("PERSISTENCE_LATENCY");
    }
  };

  const bulkToggle = useCallback(async (column, value) => {
    // OPTIMISTIC UPDATE
    const originalMembers = [...members];
    const newMembers = members.map(m => 
      !m.is_admin && m.email !== "system-state@bwt.internal"
        ? { ...m, [column]: value, ...(column === 'is_eligible' && value === false ? { is_nominee: false } : {}) }
        : m
    );
    
    startTransition(() => {
        useStore.setState({ members: newMembers });
    });

    setActionLoading(true);
    setErrorMsg("");
    try {
      if (settings?.status === "REVEALED" || settings?.status === "MANUAL_REVIEW") {
        await Promise.all([
            supabase.from("votes").delete().eq("position_id", settings.current_position_id),
            supabase.from("positions").update({ winner_id: null }).eq("id", settings.current_position_id),
            supabase.from("settings").update({ status: "SETUP", round_number: 1, winner_locked: false }).eq("id", settings.id)
        ]);
      }

      const updates = { [column]: value };
      if (column === "is_eligible" && value === false) {
        updates.is_nominee = false;
      }

      const { error } = await supabase
        .from("members")
        .update(updates)
        .eq("is_admin", false)
        .neq("email", "system-state@bwt.internal");
      if (error) throw error;
      
      const channel = supabase.channel('bwt_realtime_sync');
      await channel.send({
        type: 'broadcast',
        event: 'UPDATED_ELECTION',
        payload: { role: settings.current_position_id }
      });

    } catch (error) {
      startTransition(() => {
          useStore.setState({ members: originalMembers });
      });
      console.error("Bulk Protocol Failure:", error);
      setErrorMsg(`Bulk update failure: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [members, settings, refetchData]);


  const selectAllNominees = useCallback(async () => {
    // OPTIMISTIC UPDATE
    const originalMembers = [...members];
    const newMembers = members.map(m => 
      !m.is_admin ? { ...m, is_eligible: true, is_nominee: true } : m
    );
    
    startTransition(() => {
        useStore.setState({ members: newMembers });
    });

    setActionLoading(true);
    setErrorMsg("");
    try {
      if (settings?.status === "REVEALED" || settings?.status === "MANUAL_REVIEW") {
        await Promise.all([
            supabase.from("votes").delete().eq("position_id", settings.current_position_id),
            supabase.from("positions").update({ winner_id: null }).eq("id", settings.current_position_id),
            supabase.from("settings").update({ status: "SETUP", round_number: 1, winner_locked: false }).eq("id", settings.id)
        ]);
      }

      const { error } = await supabase
        .from("members")
        .update({
          is_eligible: true,
          is_nominee: true,
        })
        .eq("is_admin", false);

      if (error) throw error;

      const channel = supabase.channel('bwt_realtime_sync');
      await channel.send({
        type: 'broadcast',
        event: 'UPDATED_ELECTION',
        payload: { role: settings.current_position_id }
      });

    } catch (error) {
      startTransition(() => {
          useStore.setState({ members: originalMembers });
      });
      console.error("Nominee Promotion Error:", error);
      setErrorMsg("Nominee promotion failure.");
    } finally {
      setActionLoading(false);
    }
  }, [members, settings, refetchData]);



  const updateMember = useCallback(async (id, updates) => {
    if (localLoadingMap[id]) return;
    setLocalLoadingMap(prev => ({ ...prev, [id]: true }));

    const originalMembers = [...members];
    const newMembers = members.map(m => m.id === id ? { ...m, ...updates } : m);
    
    startTransition(() => {
        useStore.setState({ members: newMembers });
    });

    try {
      const isNomineeChange = updates.hasOwnProperty('is_nominee');
      const isVoterChange = updates.hasOwnProperty('is_eligible');

      if ((isNomineeChange || isVoterChange) && (settings?.status === "REVEALED" || settings?.status === "MANUAL_REVIEW")) {
        await Promise.all([
            supabase.from("votes").delete().eq("position_id", settings.current_position_id),
            supabase.from("settings").update({ status: "SETUP", round_number: 1, winner_locked: false }).eq("id", settings.id),
            supabase.from("positions").update({ winner_id: null }).eq("id", settings.current_position_id)
        ]);
      }

      const { error } = await supabase
        .from("members")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      if (isNomineeChange || isVoterChange) {
        const channel = supabase.channel('bwt_realtime_sync');
        await channel.send({
          type: 'broadcast',
          event: 'UPDATED_ELECTION',
          payload: { role: settings.current_position_id }
        });
      }

    } catch (e) {
      startTransition(() => {
          useStore.setState({ members: originalMembers });
      });
      console.error("Member Update Error:", e);
      setErrorMsg(`Update Failure: ${e.message}`);
    } finally {
      setLocalLoadingMap(prev => ({ ...prev, [id]: false }));
    }
  }, [members, settings, localLoadingMap]);

  const toggleEligible = useCallback(async (m) => {
    const updates = { is_eligible: !m.is_eligible };
    if (m.is_eligible) updates.is_nominee = false;
    await updateMember(m.id, updates);
  }, [updateMember]);

  const transferAdmin = useCallback(async (newAdmin) => {
    if (
      !confirm(
        `ARE YOU SURE? \n\nYou are about to transfer Admin Control to ${newAdmin.name} (${newAdmin.email}). \n\nYOU WILL LOSE ACCESS to this panel immediately.`,
      )
    )
      return;

    setActionLoading(true);
    setErrorMsg("");
    try {
      const currentAdmin = members.find((m) => m.is_admin);
      if (!currentAdmin) throw new Error("Admin session integrity fault.");

      const { error: transferErr } = await supabase.rpc("transfer_admin_role", {
        old_admin_email: currentAdmin.email,
        new_admin_email: newAdmin.email,
      });

      if (transferErr) throw transferErr;

      await syncSystem(true);
      
      console.log("Atomic Transfer Complete. New registry state:", useStore.getState().members);
      alert("Protocol Success: Admin Control Handover Completed.");
    } catch (e) {
      console.error("Transfer Halt:", e);
      setErrorMsg(`Transfer Protocol Fault: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [members, syncSystem]);

  const deleteMember = useCallback(async (id) => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
      await syncSystem(true);
    } catch (e) {
      setErrorMsg(`Deletion Critical: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [syncSystem]);

  const resetVoting = useCallback(async () => {
    if (
      !confirm(
        "Are you sure you want to perform a TOTAL SYSTEM RESET? All votes will be purged and members reset.",
      )
    )
      return;

    const originalSettings = { ...settings };
    const originalMembers = [...members];
    const originalVotes = [...votes];

    startTransition(() => {
        useStore.setState({
          settings: { ...settings, status: 'SETUP', current_position_id: positions[0]?.id, round_number: 1 },
          members: members.map(m => !m.is_admin ? { ...m, is_eligible: false, is_nominee: false, eliminated: false } : m),
          votes: []
        });
    });

    setActionLoading(true);
    setErrorMsg("");
    try {
      await Promise.all([
        supabase.from("votes").delete().not("id", "is", null),
        supabase.from("positions").update({ winner_id: null }).not("id", "is", null),
        supabase.from("members").update({ is_eligible: false, is_nominee: false, eliminated: false }).eq("is_admin", false),
        supabase.from("settings").update({ 
           status: "SETUP", 
           current_position_id: positions[0]?.id || null, 
           round_number: 1,
           winner_locked: false
        }).eq("id", settings?.id)
      ]);

      await syncSystem(false);
      alert("System Reset Complete: Registry synchronized and ballot boxes purged.");
    } catch (e) {
      startTransition(() => {
          useStore.setState({ settings: originalSettings, members: originalMembers, votes: originalVotes });
      });
      console.error("Critical System reset failure:", e);
      setErrorMsg(`Major protocol error during reset: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [settings, members, votes, positions, syncSystem]);

  const updateSettings = useCallback(async (updates) => {
    const originalSettings = { ...settings };
    
    startTransition(() => {
        useStore.setState({ settings: { ...settings, ...updates } });
    });

    setActionLoading(true);
    try {
      const { error: updateErr } = await supabase
        .from("settings")
        .update(updates)
        .eq("id", settings?.id || 1);
      
      if (updateErr) throw updateErr;

      await syncSystem(false);
    } catch (e) {
      startTransition(() => {
          useStore.setState({ settings: originalSettings });
      });
      console.error("Control Fault:", e);
      setErrorMsg(`Control Fault: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [settings, syncSystem]);

  const startElection = useCallback(async () => {
    if (nomineesCount === 0) {
      return setErrorMsg("Forbidden: You must select at least 1 nominee before starting.");
    }
    
    setActionLoading(true);
    try {
        const activePosId = settings?.current_position_id || (positions.length > 0 ? positions[0].id : null);
        if (!activePosId) throw new Error("No operational roles detected.");

        await supabase.from("votes").delete().eq("position_id", activePosId);
        
        await updateSettings({ 
            status: "VOTING", 
            current_position_id: activePosId,
            round_number: 1,
            winner_locked: false
        });
    } catch(err) {
        console.error("Start Election Fault:", err);
        setErrorMsg("Failed to initialize election protocol.");
    } finally {
        setActionLoading(false);
    }
  }, [nomineesCount, settings, positions, updateSettings]);

  const finalizeWinner = useCallback(async (winnerId, isManual = false) => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      if (!settings?.current_position_id) throw new Error("No active position");

      const winner = members.find(m => m.id === winnerId);
      if (!winner) throw new Error("Candidate identification failure");

      if (isManual) {
        await supabase.from('manual_decisions').insert({
          role: currentPos?.name,
          selected_winner_email: winner.email,
          selected_winner_name: winner.name,
          reason: "Admin Manual Override"
        });
      }

      const { error: winErr } = await supabase
        .from("positions")
        .update({ winner_id: winnerId })
        .eq("id", settings.current_position_id);
      if (winErr) throw winErr;

      await supabase
        .from("members")
        .update({ is_nominee: false, eliminated: true })
        .eq("id", winnerId);

      const { data: finalVotes } = await supabase
        .from("votes")
        .select("id")
        .eq("position_id", settings.current_position_id)
        .eq("round_number", settings.round_number);

      await supabase.from('election_results').insert({
        role: currentPos?.name,
        winner_name: winner.name,
        winner_email: winner.email,
        votes: finalVotes?.length || 0
      });

      await updateSettings({ 
        status: "REVEALED",
        winner_locked: true
      });
      
      await refetchData();
      alert(`CONFIRMED: ${winner.name} is the winner.`);
    } catch (e) {
      console.error("Finalization Fault:", e);
      setErrorMsg(`Finalization Fault: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [settings, members, currentPos, updateSettings, refetchData]);

  const stopVoting = useCallback(async () => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      if (!settings?.current_position_id)
        throw new Error("Null pointer: No active position identified.");

      const { data: voteData, error: voteErr } = await supabase
        .from("votes")
        .select("nominee_id")
        .eq("position_id", settings.current_position_id)
        .eq("round_number", settings.round_number || 1);

      if (voteErr) throw voteErr;

      const tally = voteData.reduce((acc, v) => {
        acc[v.nominee_id] = (acc[v.nominee_id] || 0) + 1;
        return acc;
      }, {});
      
      const counts = Object.values(tally);
      const maxVotes = counts.length > 0 ? Math.max(...counts) : 0;
      const winners = Object.entries(tally).filter(([id, count]) => count === maxVotes);
      
      const isTie = winners.length > 1;

      if (!isTie && winners.length === 1 && maxVotes > 0) {
          console.log("[PROTOCOL] Majority detected. Bypassing Governance Phase.");
          const winnerId = winners[0][0];
          await finalizeWinner(winnerId, false);
      } else {
          console.log("[PROTOCOL] Tie detected or no votes cast. Entering Governance Phase.");
          await updateSettings({ status: "MANUAL_REVIEW" });
          await refetchData();
      }
      
    } catch (e) {
      console.error("Transmission Halt:", e.message);
      setErrorMsg(`Workflow Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [settings, finalizeWinner, updateSettings, refetchData]);

  const nextRole = useCallback(async () => {
    setActionLoading(true);
    try {
      const nextOne = positions.find(p => !p.winner_id);
      
      if (nextOne) {
        await updateSettings({
          status: "SETUP",
          current_position_id: nextOne.id,
          round_number: 1,
          winner_locked: false
        });
        await syncSystem(false);
      } else {
        await updateSettings({ status: "FINISHED" });
      }
    } catch (e) {
      console.error("Phase Transition Fault:", e);
    } finally {
      setActionLoading(false);
    }
  }, [positions, updateSettings, syncSystem]);

  const startAnotherRound = useCallback(async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMsg("");
    try {
      const nextRound = (settings?.round_number || 1) + 1;
      
      console.log(`[PROTOCOL] Clearing position-specific votes for Round ${nextRound} reset.`);
      await supabase
        .from("votes")
        .delete()
        .eq("position_id", settings.current_position_id);

      await updateSettings({
        round_number: nextRound,
        status: "VOTING",
        winner_locked: false
      });

      const channel = supabase.channel('bwt_realtime_sync');
      await channel.send({
        type: 'broadcast',
        event: 'ROUND_INCREMENT',
        payload: { round: nextRound }
      });

      await syncSystem(false);
      
    } catch (e) {
      console.error("Round Initialization Fault:", e);
      setErrorMsg(`Round Initialization Fault: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [settings, updateSettings, syncSystem, actionLoading]);


  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 mt-8 font-sans">
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Admin Panel
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Personnel registry and workflow management.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">
              Add BWT Member
            </h2>
            <form onSubmit={handleAddMember} className="space-y-3">
              <input
                disabled={isAdding}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                required
                className="w-full h-10 bg-slate-50 border border-slate-200 px-3 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 disabled:opacity-50 transition-all"
              />
              <input
                disabled={isAdding}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                required
                className="w-full h-10 bg-slate-50 border border-slate-200 px-3 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 disabled:opacity-50 transition-all"
              />
              <Button 
                type="submit" 
                fullWidth 
                loading={isAdding}
                disabled={isAdding || !name || !email}
                icon={isAdding ? undefined : UserPlus}
                className="rounded-xl h-11 bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-200"
              >
                {isAdding ? "Adding..." : "Add BWT Member"}
              </Button>
            </form>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">
              Election Control
            </h2>

            <div className="mb-4 space-y-1">
              <div className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-500 uppercase">
                  Phase
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {currentPos?.name || "President"}
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                <span className="text-[10px] font-medium text-slate-500 uppercase">
                  Status
                </span>
                <Badge
                  variant={settings?.status === "VOTING" ? "success" : "blue"}
                  size="xs"
                  className="font-mono text-[9px] px-1.5 py-0 leading-none h-4"
                >
                  {settings?.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-3">
              {settings?.status === "SETUP" && (
                <button
                  disabled={actionLoading}
                  onClick={startElection}
                  className="w-full h-10 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                >
                  <Play className={cn("w-4 h-4", actionLoading && "animate-spin")} />
                  {actionLoading ? "Initializing..." : "Start Voting Session"}
                </button>
              )}
              {settings?.status === "VOTING" && (
                <button
                  disabled={actionLoading}
                  onClick={stopVoting}
                  className="w-full h-10 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition disabled:opacity-50 shadow-lg shadow-slate-100 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  {actionLoading ? "Processing Tally..." : "Stop Voting Session"}
                </button>
              )}
              {settings?.status === "MANUAL_REVIEW" && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Governance Phase</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mb-3 opacity-60">Round {settings.round_number} Tally Ready</p>
                    <button
                      disabled={actionLoading}
                      onClick={() => setShowManualReview(true)}
                      className="w-full h-10 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      <Hash className="w-4 h-4" /> Review Results
                    </button>
                  </div>
                  <button
                    disabled={actionLoading}
                    onClick={startAnotherRound}
                    className="w-full h-10 border-2 border-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", actionLoading && "animate-spin")} />
                    {actionLoading ? "Resetting Round..." : "Start New Round"}
                  </button>
                </div>
              )}
              {settings?.status === "REVEALED" && (
                <button
                  disabled={actionLoading}
                  onClick={nextRole}
                  className="w-full h-10 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-slate-100"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  {actionLoading ? "Switching..." : "Next Role"}
                </button>
              )}
              {settings?.status === "FINISHED" && (
                <div className="h-10 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center">
                  Cycle Completed
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              <button
                disabled={actionLoading || isVotingActive}
                onClick={() => bulkToggle("is_eligible", true)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px] font-semibold uppercase tracking-widest hover:bg-slate-100 transition disabled:opacity-30"
              >
                Enable All Voters
              </button>
              <button
                disabled={actionLoading || isVotingActive}
                onClick={selectAllNominees}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px] font-semibold uppercase tracking-widest hover:bg-slate-100 transition disabled:opacity-30"
              >
                Select All Nominees
              </button>
              <button
                disabled={actionLoading || isVotingActive}
                onClick={() => bulkToggle("is_eligible", false)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px] font-semibold uppercase tracking-widest hover:bg-slate-100 transition disabled:opacity-30"
              >
                Deselect All Voters
              </button>
              <button
                disabled={actionLoading || isVotingActive}
                onClick={() => bulkToggle("is_nominee", false)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px] font-semibold uppercase tracking-widest hover:bg-slate-100 transition disabled:opacity-30"
              >
                Deselect All Nominees
              </button>
            </div>
            <button
              disabled={actionLoading}
              onClick={resetVoting}
              className="px-2.5 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded text-[10px] font-semibold uppercase tracking-widest transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset Voting
            </button>
          </div>

          <input
            type="text"
            placeholder="Search BWT Members..."
            className="w-full h-9 bg-white border border-slate-200 px-3 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-400 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex-1 flex flex-col min-h-[500px]">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                Member Registry ({members.length})
              </span>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  <div className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">
                    {eligibleVoters} Voters
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">
                    {nomineesCount} Nominees
                  </span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[700px]">
              {filteredMembers.map((m) => (
                <MemberRow 
                  key={m.id}
                  member={m}
                  isWinner={wonIds.includes(m.id)}
                  isVotingActive={isVotingActive}
                  getWinnerRole={getWinnerRole}
                  toggleEligible={toggleEligible}
                  updateMember={updateMember}
                  localLoadingMap={localLoadingMap}
                  transferAdmin={transferAdmin}
                  setShowConfirmModal={setShowConfirmModal}
                  pendingId={pendingId}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={!!showConfirmModal}
        title="Delete User"
        message={`Remove ${showConfirmModal?.name} from BWT?`}
        onClose={() => setShowConfirmModal(null)}
        onConfirm={() => deleteMember(showConfirmModal?.id)}
      />

      {/* MANUAL REVIEW MODAL */}
      <AnimatePresence>
        {showManualReview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Election Governance</h2>
                      {settings.round_number > 1 && (
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-slate-200">
                          Follows {settings.round_number - 1} Runoffs
                        </span>
                      )}
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                      {currentPos?.name || 'Position Review'}
                    </h1>
                  </div>
                  <button onClick={() => setShowManualReview(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6 mb-10">
                  {/* FIX 5: UI SAFETY CHECK */}
                  {nomineesCount !== prevNomineeCount && prevNomineeCount > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 mb-6">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-xs font-black text-amber-800 uppercase tracking-tight">Nominees Updated</p>
                        <p className="text-[10px] text-amber-700 font-medium">Previous results invalidated. Please conduct voting again.</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-4">

                    <span>Candidates (Round {settings.round_number})</span>
                    <span>Tally Summary</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {members.filter(m => m.is_nominee && !wonIds.includes(m.id)).map(m => {
                      const vCount = modalTally[m.id] || 0;
                      const maxV = Math.max(...Object.values(modalTally), 0);
                      const topCandidates = Object.entries(modalTally).filter(([id, count]) => count === maxV);
                      const isTie = topCandidates.length > 1;
                      const isNaturalWinner = !isTie && m.id === topCandidates[0]?.[0];
                      const isSelected = manualSelection === m.id || (isNaturalWinner && !manualSelection);
                      const isTiedCandidate = isTie && vCount === maxV && maxV > 0;

                      return (
                        <button
                          key={m.id}
                          disabled={!isTie && !isNaturalWinner}
                          onClick={() => isTie && setManualSelection(m.id)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100" 
                              : "bg-slate-50 border-transparent hover:border-slate-200 text-slate-900",
                            isTiedCandidate && !isSelected && "border-amber-200 bg-amber-50/50",
                            !isTie && !isNaturalWinner && "opacity-40 grayscale-[0.5]"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black",
                              isSelected ? "bg-white/20" : "bg-white shadow-sm"
                            )}>
                              {m.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-sm">{m.name}</p>
                              {isTiedCandidate && <p className={cn("text-[8px] font-black uppercase tracking-widest mt-1", isSelected ? "text-white/70" : "text-amber-600")}>⚠️ Tie Detected</p>}
                              {isNaturalWinner && <p className={cn("text-[8px] font-black uppercase tracking-widest mt-1", isSelected ? "text-white/70" : "text-emerald-500")}>✨ Clear Winner</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn("text-xl font-black", isSelected ? "text-white" : "text-indigo-600")}>{vCount}</span>
                            <span className={cn("text-[9px] font-bold uppercase opacity-60", isSelected ? "text-white" : "text-slate-400")}>Votes</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Logic for Tie / No Tie footer */}
                  {(() => {
                    const maxV = Math.max(...Object.values(modalTally), 0);
                    const topCandidates = Object.entries(modalTally).filter(([id, count]) => count === maxV);
                    const isTie = topCandidates.length > 1;

                    if (!isTie && topCandidates.length === 1) {
                      const winId = topCandidates[0][0];
                      const winName = members.find(m => m.id === winId)?.name;
                      return (
                        <div className="flex flex-col gap-4">
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500 text-white rounded-lg"><CheckCircle2 className="w-4 h-4" /></div>
                                <div>
                                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Winner Declared Automatically</p>
                                   <p className="text-sm font-black text-slate-900">{winName} secured a majority.</p>
                                </div>
                             </div>
                             <span className="text-xs font-black text-emerald-600 bg-white px-3 py-1 rounded-full border border-emerald-100">{maxV} Votes</span>
                          </div>
                          <button
                            onClick={() => {
                                finalizeWinner(winId, false);
                                setShowManualReview(false);
                            }}
                            className="h-14 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl"
                          >
                            Finalize Election Cycle
                          </button>
                        </div>
                      );
                    }

                    if (isTie) {
                      return (
                        <div className="grid grid-cols-2 gap-4">
                           <button
                             disabled={!manualSelection || actionLoading}
                             onClick={() => {
                                const maxVotes = Math.max(...Object.values(modalTally), 0);
                                const naturalWinnerId = Object.entries(modalTally).find(([id, count]) => count === maxVotes)?.[0];
                                finalizeWinner(manualSelection, true);
                                setShowManualReview(false);
                             }}
                             className="h-14 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-xl"
                           >
                             <AlertTriangle className="w-4 h-4" /> Apply Manual Override
                           </button>
                           <button
                             onClick={async () => {
                                await startAnotherRound();
                                setShowManualReview(false);
                             }}
                             className="h-14 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                           >
                             <RefreshCw className="w-4 h-4" /> Run Runoff Round
                           </button>
                        </div>
                      );
                    }

                    return (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                         <p className="text-xs font-bold text-slate-400">No valid votes recorded for this round.</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MemberRow = memo(({ member: m, isWinner, isVotingActive, getWinnerRole, toggleEligible, updateMember, localLoadingMap, transferAdmin, setShowConfirmModal, pendingId }) => {
  const isMemberAdmin = m.is_admin;
  const isLocalLoading = localLoadingMap[m.id];

  return (
    <div
      className={cn(
        "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition border-b border-slate-50 last:border-0",
        isMemberAdmin ? "bg-slate-50/80" : "hover:bg-slate-50/50",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "w-10 h-10 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0",
            isMemberAdmin
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-500",
          )}
        >
          {m.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <p className="text-sm font-bold text-slate-900 leading-none truncate">
              {m.name}
            </p>
            <div className="flex gap-1">
              {isMemberAdmin && (
                <Badge
                  variant="blue"
                  size="xs"
                  className="text-[7px] py-0 px-1 opacity-70"
                >
                  ADMIN
                </Badge>
              )}
              {getWinnerRole(m.id) && (
                <Badge
                  variant="success"
                  size="xs"
                  className="text-[7px] py-0 px-1.5 bg-emerald-50 text-emerald-600 border-emerald-100 font-bold"
                >
                  ELECTED: {getWinnerRole(m.id)}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 truncate mt-1 sm:mt-0">
            {m.email}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 bg-slate-50/50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
        <div className="flex items-center gap-4 sm:gap-6">
          {!isMemberAdmin && (
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                Voter
              </span>
              <button
                disabled={isLocalLoading || isVotingActive}
                onClick={async () => await toggleEligible(m)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  m.is_eligible ? "bg-emerald-500" : "bg-slate-200",
                  isLocalLoading && "opacity-50 cursor-wait"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    m.is_eligible ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          )}

          {!isMemberAdmin && (
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                Nominee
              </span>
              <button
                disabled={isLocalLoading || !m.is_eligible || isWinner || isVotingActive}
                onClick={async () => await updateMember(m.id, { is_nominee: !m.is_nominee })}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  m.is_nominee ? "bg-indigo-600" : "bg-slate-200",
                  (isLocalLoading || !m.is_eligible) && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    m.is_nominee ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-1">
          {!isMemberAdmin && !isWinner && (
            <button
              disabled={isVotingActive || pendingId === m.id}
              onClick={async () => await transferAdmin(m)}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50 rounded-lg group"
              title="Transfer Admin Access"
            >
              <Shield className={cn("w-5 h-5 group-hover:fill-indigo-500", pendingId === m.id && "animate-spin")} />
            </button>
          )}

          <button
            disabled={isVotingActive || pendingId === m.id}
            onClick={() => setShowConfirmModal({ id: m.id, name: m.name })}
            className="p-2 text-slate-400 hover:text-red-500 transition-all hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
});
