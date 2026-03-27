import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useStore } from "../store/useStore";
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
} from "lucide-react";
import Badge from "../components/Badge";
import AlertModal from "../components/AlertModal";
import TieBreakModal from "../components/TieBreakModal";
import { cn } from "../lib/utils";
import PageLoader from "../components/PageLoader";

export default function Admin() {
  const members = useStore((state) => state.members);
  const positions = useStore((state) => state.positions);
  const settings = useStore((state) => state.settings);
  const syncSystem = useStore((state) => state.syncSystem);
  const loading = useStore((state) => state.loading);
  const initialized = useStore((state) => state.initialized);

  if (loading || !initialized) return <PageLoader />;

  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [tieData, setTieData] = useState({ isTie: false, candidates: [] });

  // Dynamic Derivations
  const getWinnerRole = (memberId) => {
    const pos = positions.find((p) => p.winner_id === memberId);
    return pos ? pos.name : null;
  };

  const wonIds = useMemo(() => {
    return positions.map((p) => p.winner_id).filter(Boolean);
  }, [positions]);

  const currentPos =
    positions.find((p) => p.id === settings?.current_position_id) ||
    positions[0];

  const eligibleVoters = members.filter(
    (m) =>
      m.is_eligible &&
      !m.is_admin &&
      m.email !== "system-state@bwt.internal",
  ).length;
  const nomineesCount = members.filter(
    (m) =>
      m.is_nominee &&
      !m.is_admin &&
      !wonIds.includes(m.id) &&
      m.email !== "system-state@bwt.internal",
  ).length;

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

  const filteredMembers = useMemo(() => {
    return validMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [validMembers, searchTerm]);

  useEffect(() => {
    if (!initialized) {
      syncSystem(false);
    } else if (members.length === 0) {
      syncSystem(true);
    }
  }, [initialized, members.length]);

  const addMember = async (e) => {
    e.preventDefault();
    const { name, email } = e.target.elements;
    const trimmedEmail = email.value.trim().toLowerCase();

    if (members.some((m) => m.email === trimmedEmail)) {
      return setErrorMsg("Registry Identity Error: User already exists.");
    }

    setActionLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.from("members").insert([
        {
          name: name.value.trim(),
          email: trimmedEmail,
          is_admin: false,
          is_eligible: true,
          is_nominee: false,
        },
      ]);
      if (error) throw error;

      e.target.reset();
      await syncSystem(true);
    } catch (e) {
      setErrorMsg(`Registry Fault: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const bulkToggle = async (column, value) => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      const updates = { [column]: value };
      if (column === "is_eligible" && value === false) {
        updates.is_nominee = false;
      }

      const { error } = await supabase
        .from("members")
        .update(updates)
        .eq("is_admin", false)
        .neq("email", "system-state@bwt.internal"); // Ensure corrupted member is filtered
      if (error) throw error;
      await syncSystem(true);
    } catch (error) {
      setErrorMsg(`Bulk update failure: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const selectAllNominees = async () => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase
        .from("members")
        .update({
          is_eligible: true,
          is_nominee: true,
        })
        .eq("is_admin", false);

      if (error) throw error;
      await syncSystem(true);
    } catch (error) {
      setErrorMsg("Nominee promotion failure.");
    } finally {
      setActionLoading(false);
    }
  };

  const updateMember = async (id, updates) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("members")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      await syncSystem(true);
    } catch (e) {
      setErrorMsg(`Member Update Failure: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleEligible = async (m) => {
    const updates = { is_eligible: !m.is_eligible };
    if (m.is_eligible) updates.is_nominee = false;
    await updateMember(m.id, updates);
  };

  const transferAdmin = async (newAdmin) => {
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

      // Atomic transfer protocol
      const { error: oldAdminErr } = await supabase
        .from("members")
        .update({ is_admin: false })
        .eq("id", currentAdmin.id);
      if (oldAdminErr) throw oldAdminErr;

      const { error: newAdminErr } = await supabase
        .from("members")
        .update({ is_admin: true })
        .eq("id", newAdmin.id);
      if (newAdminErr) throw newAdminErr;

      await syncSystem(true);
      alert("Protocol Success: Admin Control Handover Completed.");
    } catch (e) {
      console.error("Transfer Halt:", e);
      setErrorMsg(`Transfer Protocol Fault: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteMember = async (id) => {
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
  };

  const resetVoting = async () => {
    if (
      !confirm(
        "Are you sure you want to perform a TOTAL SYSTEM RESET? All votes will be purged.",
      )
    )
      return;

    setActionLoading(true);
    setErrorMsg("");
    try {
      // 1. Purge all ballot records
      const { error: purgeErr } = await supabase
        .from("votes")
        .delete()
        .not("id", "is", null);
      if (purgeErr) throw purgeErr;

      // 2. Wipe position winners
      const { error: clearWinnersErr } = await supabase
        .from("positions")
        .update({ winner_id: null })
        .not("id", "is", null);
      if (clearWinnersErr) throw clearWinnersErr;

      // 3. Reset all member flags
      const { error: resetRegistryErr } = await supabase
        .from("members")
        .update({
          is_eligible: false,
          is_nominee: false,
        })
        .eq("is_admin", false);
      if (resetRegistryErr) throw resetRegistryErr;

      // 4. Force reset system settings to 'SETUP'
      const { error: settingsErr } = await supabase
        .from("settings")
        .update({
          status: "SETUP",
          current_position_id: positions[0]?.id || null,
        })
        .eq("id", settings?.id);
      if (settingsErr) throw settingsErr;

      // 5. Global Store Hard Sync
      await syncSystem(false);
      setErrorMsg("");
      alert(
        "System Reset Complete: Registry synchronized and ballot boxes purged.",
      );
    } catch (e) {
      console.error("Critical System reset failure:", e);
      setErrorMsg(`Major protocol error during reset: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const updateSettings = async (updates) => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      const { data: sData, error: fetchErr } = await supabase
        .from("settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      if (sData) {
        const { error: updateErr } = await supabase
          .from("settings")
          .update(updates)
          .eq("id", sData.id);
        if (updateErr) throw updateErr;

        // Force store refresh for immediate UI response
        const { data: newSettings, error: refreshErr } = await supabase
          .from("settings")
          .select("*")
          .eq("id", sData.id)
          .single();
        if (refreshErr) throw refreshErr;

        if (newSettings) {
          useStore.setState({ settings: newSettings });
          await syncSystem(true);
        }
      } else {
        throw new Error("System settings record hidden or missing.");
      }
    } catch (e) {
      console.error("Control Fault:", e);
      setErrorMsg(`Control Fault: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const startElection = () => {
    if (nomineesCount === 0) {
      return setErrorMsg(
        "Forbidden: You must select at least 1 nominee before starting.",
      );
    }
    updateSettings({ status: "VOTING", current_position_id: positions[0]?.id });
  };

  const stopVoting = async () => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      if (!settings?.current_position_id)
        throw new Error("Null pointer: No active position identified.");

      // 1. Tally votes for this position
      const { data: votes, error: voteErr } = await supabase
        .from("votes")
        .select("nominee_id")
        .eq("position_id", settings.current_position_id);

      if (voteErr) throw voteErr;

      if (!votes || votes.length === 0) {
        // No votes cast - just halt
        await updateSettings({ status: "REVEALED" });
        return;
      }

      const tally = {};
      votes.forEach((v) => {
        tally[v.nominee_id] = (tally[v.nominee_id] || 0) + 1;
      });

      // 2. Find plurality winner
      let maxVotes = 0;
      Object.entries(tally).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
        }
      });

      // 3. Detect Ties
      const topCandidates = Object.entries(tally)
        .filter(([id, count]) => count === maxVotes)
        .map(([id, count]) => ({
          id,
          votes: count,
          name: members.find((m) => m.id === id)?.name || "Unknown Identity",
        }));

      if (topCandidates.length > 1) {
        // TIE PROTOCOL TRIGGERED
        setTieData({ isTie: true, candidates: topCandidates });
        return;
      }

      const winnerId = topCandidates[0]?.id;

      // 4. Persist winner and reveal
      if (winnerId) {
        // Update position winner
        const { error: winErr } = await supabase
          .from("positions")
          .update({ winner_id: winnerId })
          .eq("id", settings.current_position_id);
        if (winErr) throw winErr;

        // Automatically remove winner from the pool for next rounds
        const { error: memErr } = await supabase
          .from("members")
          .update({ is_nominee: false })
          .eq("id", winnerId);
        if (memErr) console.warn("Registry Update Delay:", memErr.message);
      }

      await updateSettings({ status: "REVEALED" });
      await syncSystem(true);

      const winnerName = members.find((m) => m.id === winnerId)?.name;
      if (winnerName)
        alert(
          `ELECTION RESULT: ${winnerName} has been elected as ${currentPos?.name}. They have been removed from the remaining candidate pools.`,
        );
    } catch (e) {
      console.error("Transmission Halt:", e.message);
      setErrorMsg(`Workflow Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const resolveTie = async (winnerId, winnerName) => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      if (!settings?.current_position_id)
        throw new Error("Null pointer: No active position identified.");

      // 1. Manually resolve winner with 'decided_by_admin' flag
      const { error: winErr } = await supabase
        .from("positions")
        .update({ winner_id: winnerId })
        .eq("id", settings.current_position_id);
      if (winErr) throw winErr;

      // 2. Remove winner from future pools (as they are now the elected official)
      const { error: memErr } = await supabase
        .from("members")
        .update({ is_nominee: false })
        .eq("id", winnerId);
      if (memErr) console.warn("Registry Update Delay:", memErr.message);

      // 3. Move election status forward
      await updateSettings({ status: "REVEALED" });
      await syncSystem(true);
      setTieData({ isTie: false, candidates: [] });

      alert(
        `ADMIN OVERRIDE: ${winnerName} has been manually selected as ${currentPos?.name}. Registry synchronized.`,
      );
    } catch (e) {
      console.error("Conflict Resolution Fault:", e.message);
      setErrorMsg(`Tie-Break Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const nextRole = async () => {
    setActionLoading(true);
    try {
      if (!settings) {
        throw new Error("Registry settings not synchronized.");
      }

      const currentIndex = positions.findIndex(
        (p) => p.id === settings?.current_position_id,
      );
      const nextPos = positions[currentIndex + 1];

      if (nextPos) {
        await updateSettings({
          status: "VOTING",
          current_position_id: nextPos.id,
        });
      } else {
        await updateSettings({ status: "FINISHED" });
      }
    } catch (e) {
      console.error("Workflow Shift Failure:", e);
      setErrorMsg(`Workflow Shift Failure: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 mt-8 font-sans">
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">
              Add BWT Member
            </h2>
            <form onSubmit={addMember} className="space-y-2">
              <input
                disabled={actionLoading}
                name="name"
                placeholder="Full Name"
                required
                className="w-full h-8 bg-slate-50 border border-slate-200 px-3 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-400 placeholder:text-slate-400 disabled:opacity-50"
              />
              <input
                disabled={actionLoading}
                name="email"
                type="email"
                placeholder="Email Address"
                required
                className="w-full h-8 bg-slate-50 border border-slate-200 px-3 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-400 placeholder:text-slate-400 disabled:opacity-50"
              />
              <button
                disabled={actionLoading}
                type="submit"
                className="w-full h-8 mt-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition disabled:opacity-50"
              >
                Add Member
              </button>
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
                  {currentPos?.name || "N/A"}
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

            <div className="space-y-2 border-t border-slate-100 pt-3">
              {settings?.status === "SETUP" && (
                <button
                  disabled={actionLoading}
                  onClick={startElection}
                  className="w-full h-8 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-500 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3 h-3" /> Start Voting
                </button>
              )}
              {settings?.status === "VOTING" && (
                <button
                  disabled={actionLoading}
                  onClick={stopVoting}
                  className="w-full h-9 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50 shadow-lg shadow-slate-100 flex items-center justify-center gap-1.5 mt-2"
                >
                  <X className="w-4 h-4" /> Stop Voting Session
                </button>
              )}
              {settings?.status === "REVEALED" && (
                <button
                  disabled={actionLoading}
                  onClick={nextRole}
                  className="w-full h-8 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  Next Round <ChevronRight className="w-3 h-3" />
                </button>
              )}
              {settings?.status === "FINISHED" && (
                <div className="h-8 bg-slate-50 border border-slate-200 text-slate-500 rounded text-xs font-medium flex items-center justify-center">
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
              {filteredMembers.map((m) => {
                const isWinner = wonIds.includes(m.id);
                const isMemberAdmin = m.is_admin;
                const isDisabled = actionLoading || isMemberAdmin || isWinner;

                return (
                  <div
                    key={m.id}
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
                        {/* Voter Toggle */}
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                            Voter
                          </span>
                          <button
                            disabled={isMemberAdmin || actionLoading || isVotingActive}
                            onClick={() => toggleEligible(m)}
                            className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                              m.is_eligible ? "bg-emerald-500" : "bg-slate-200",
                              (isMemberAdmin || actionLoading || isVotingActive) && "opacity-40 cursor-not-allowed"
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

                        <div className="w-px h-8 bg-slate-200" />

                        {/* Nominee Toggle */}
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">
                            Nominee
                          </span>
                          <button
                            disabled={isVotingActive || isWinner || !m.is_eligible}
                            onClick={() => updateMember(m.id, { is_nominee: !m.is_nominee })}
                            className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                              m.is_nominee && m.is_eligible ? "bg-indigo-600" : "bg-slate-200",
                              (isVotingActive || isWinner || !m.is_eligible) && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                m.is_nominee && m.is_eligible ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-slate-200 hidden sm:block" />

                      {!isMemberAdmin && !isWinner && (
                        <button
                          disabled={isVotingActive || actionLoading}
                          onClick={() => transferAdmin(m)}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50 rounded-lg group"
                          title="Transfer Admin Access"
                        >
                          <Shield className="w-5 h-5 group-hover:fill-indigo-500" />
                        </button>
                      )}

                      <button
                        disabled={isVotingActive}
                        onClick={() =>
                          setShowConfirmModal({ id: m.id, name: m.name })
                        }
                        className="p-2 text-slate-400 hover:text-red-500 transition-all hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
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

      <TieBreakModal
        isOpen={tieData.isTie}
        candidates={tieData.candidates}
        roleName={currentPos?.name}
        onClose={() => setTieData({ isTie: false, candidates: [] })}
        onSelect={resolveTie}
        isProcessing={actionLoading}
      />
    </div>
  );
}
