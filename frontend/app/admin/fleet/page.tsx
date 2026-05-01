"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Bike, Plus, Search, X, Check, AlertCircle, Loader2,
  ShieldCheck, MoreVertical, Trash2, MapPin,
} from "lucide-react";
import {
  ridersApi, sellersApi, fleetApi,
  type Seller, type Rider, type FleetMember, type FleetAssignment,
} from "@/lib/api";
import { relTime } from "@/lib/format";

interface SellerWithCount {
  seller: Seller;
  fleetCount: number;
}

export default function FleetManagementPage() {
  const [allRiders, setAllRiders] = useState<Rider[]>([]);
  const [sellers, setSellers] = useState<SellerWithCount[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Load all sellers and their fleet counts
  async function loadSellers() {
    try {
      const ss = await sellersApi.listAll();
      const withCounts = await Promise.all(
        ss.map(async (s) => {
          try {
            const fleet = await fleetApi.listFleet(s.id);
            const active = fleet.filter((m) => m.assignment.status === "approved");
            return { seller: s, fleetCount: active.length };
          } catch {
            return { seller: s, fleetCount: 0 };
          }
        })
      );
      setSellers(withCounts);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadRiders() {
    try {
      setAllRiders(await ridersApi.listAll());
    } catch {}
  }

  useEffect(() => {
    loadRiders();
    loadSellers();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return sellers;
    const q = search.toLowerCase();
    return sellers.filter(
      (s) =>
        s.seller.business_name.toLowerCase().includes(q) ||
        s.seller.owner_name.toLowerCase().includes(q) ||
        (s.seller.location_area || "").toLowerCase().includes(q)
    );
  }, [sellers, search]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-ink-500">
          Vetted fleet management
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-900 leading-tight">
          Boda assignments
        </h1>
        <p className="mt-1 text-sm text-ink-500 max-w-2xl">
          Tukole vets bodas and assigns them to specific businesses. Each seller has
          a dedicated fleet that knows their shop, their customers, and their
          standards.
        </p>
      </div>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Sellers list */}
        <aside className="card overflow-hidden flex flex-col h-[600px]">
          <div className="px-4 py-3 border-b border-sand-200">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-2">
              Sellers ({sellers.length})
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sellers..."
                className="input pl-9 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-sand-200">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-ink-500 text-center">
                {sellers.length === 0
                  ? "No sellers yet. Have one sign up to manage their fleet."
                  : "No sellers match your search."}
              </div>
            ) : (
              filtered.map(({ seller, fleetCount }) => {
                const active = selectedSellerId === seller.id;
                return (
                  <button
                    key={seller.id}
                    onClick={() => setSelectedSellerId(seller.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      active ? "bg-teal-50" : "hover:bg-sand-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink-900 truncate">
                          {seller.business_name}
                        </div>
                        <div className="text-xs text-ink-500 truncate">
                          {seller.owner_name} · {seller.location_area || "—"}
                        </div>
                      </div>
                      <div
                        className={`text-xs px-2 py-0.5 rounded-chip whitespace-nowrap ${
                          fleetCount > 0
                            ? "bg-teal-100 text-teal-700"
                            : "bg-coral-100 text-coral-700"
                        }`}
                      >
                        {fleetCount === 0 ? "No fleet" : `${fleetCount} riders`}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Selected seller's fleet */}
        <section className="lg:col-span-2">
          {selectedSellerId ? (
            <FleetForSeller
              sellerId={selectedSellerId}
              allRiders={allRiders}
              onChange={loadSellers}
            />
          ) : (
            <div className="card p-12 text-center">
              <Users className="w-10 h-10 mx-auto text-ink-500" />
              <div className="font-display text-xl text-ink-900 mt-3">
                Pick a seller to manage their fleet
              </div>
              <div className="text-sm text-ink-500 mt-1">
                Choose from the list to assign or remove vetted bodas.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// =============================================================================
// Fleet management for a single seller
// =============================================================================
function FleetForSeller({
  sellerId,
  allRiders,
  onChange,
}: {
  sellerId: string;
  allRiders: Rider[];
  onChange: () => void;
}) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [members, setMembers] = useState<FleetMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    try {
      const [s, m] = await Promise.all([
        sellersApi.get(sellerId),
        fleetApi.listFleet(sellerId),
      ]);
      setSeller(s);
      setMembers(m);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  async function remove(assignmentId: string) {
    if (!confirm("Remove this rider from the fleet?")) return;
    try {
      await fleetApi.removeFromFleet(sellerId, assignmentId);
      await load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const memberRiderIds = new Set(members.filter(m => m.assignment.status !== "removed").map((m) => m.rider.id));
  const availableRiders = allRiders.filter((r) => !memberRiderIds.has(r.id));
  const activeMembers = members.filter((m) => m.assignment.status === "approved");
  const removedMembers = members.filter((m) => m.assignment.status === "removed");

  if (!seller) {
    return (
      <div className="card p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-ink-500" />
      </div>
    );
  }

  return (
    <>
      <div className="card p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">
              Fleet for
            </div>
            <h2 className="font-display text-2xl text-ink-900 leading-tight">
              {seller.business_name}
            </h2>
            <div className="text-sm text-ink-500 mt-0.5">
              {seller.owner_name} · {seller.location_area || "—"} · {seller.phone}
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-coral">
            <Plus className="w-4 h-4" />
            Assign rider
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-3 bg-coral-50 border-coral-200 text-sm text-coral-700 mb-4">
          {error}
        </div>
      )}

      {activeMembers.length === 0 ? (
        <div className="card p-12 text-center">
          <Bike className="w-10 h-10 mx-auto text-ink-500" />
          <div className="font-display text-lg text-ink-900 mt-3">
            No bodas assigned yet
          </div>
          <div className="text-sm text-ink-500 mt-1 max-w-sm mx-auto">
            Without a fleet, orders fall back to any available rider. Assign vetted
            bodas to make this seller's deliveries dedicated.
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary mt-4 inline-flex"
          >
            <Plus className="w-4 h-4" />
            Assign first rider
          </button>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {activeMembers.map((member) => (
            <FleetMemberCard
              key={member.assignment.id}
              member={member}
              onRemove={() => remove(member.assignment.id)}
            />
          ))}
        </div>
      )}

      {removedMembers.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-ink-500 cursor-pointer hover:text-ink-700">
            Removed riders ({removedMembers.length})
          </summary>
          <div className="space-y-2 mt-2">
            {removedMembers.map((member) => (
              <div
                key={member.assignment.id}
                className="card p-3 opacity-60 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-sand-200 flex items-center justify-center text-xs">
                  {member.rider.full_name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 truncate">
                    {member.rider.full_name}
                  </div>
                  <div className="text-xs text-ink-500">
                    Removed {relTime(member.assignment.assigned_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <AnimatePresence>
        {showAdd && (
          <AssignRiderModal
            sellerName={seller.business_name}
            availableRiders={availableRiders}
            onClose={() => setShowAdd(false)}
            onAssign={async (data) => {
              try {
                await fleetApi.addToFleet(sellerId, data);
                await load();
                onChange();
                setShowAdd(false);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FleetMemberCard({
  member,
  onRemove,
}: {
  member: FleetMember;
  onRemove: () => void;
}) {
  const { assignment, rider } = member;
  const total = assignment.deliveries_completed + assignment.deliveries_failed;
  const successRate = total > 0
    ? Math.round((assignment.deliveries_completed / total) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-600 text-sand-50 flex items-center justify-center font-medium overflow-hidden shrink-0">
          {rider.photo_url ? (
            <img src={rider.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            rider.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink-900">{rider.full_name}</span>
            <span className="text-xs font-mono text-ink-500">{rider.plate_number}</span>
            <span className="text-[10px] uppercase tracking-wider text-teal-700 bg-teal-100 px-2 py-0.5 rounded-chip">
              <ShieldCheck className="w-2.5 h-2.5 inline mr-0.5" />
              Approved
            </span>
          </div>

          <div className="text-xs text-ink-500 mt-0.5">
            {rider.stage || "—"} · {rider.phone}
          </div>

          {assignment.coverage_areas && (
            <div className="text-xs text-ink-700 mt-1.5 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-coral-500" />
              <span>{assignment.coverage_areas}</span>
            </div>
          )}

          {assignment.seller_instructions && (
            <div className="text-xs text-ink-700 mt-1.5 p-2 rounded-card bg-sand-100 border border-sand-200">
              <span className="text-[10px] uppercase tracking-wider text-ink-500 block">
                Instructions
              </span>
              {assignment.seller_instructions}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-ink-500 mt-2">
            <span>
              {assignment.deliveries_completed} completed
            </span>
            {successRate !== null && (
              <span className="text-teal-700 font-medium">
                {successRate}% success
              </span>
            )}
            <span>Joined {relTime(assignment.assigned_at)}</span>
          </div>
        </div>

        <button
          onClick={onRemove}
          className="btn-ghost p-1.5 text-ink-500 hover:text-coral-600"
          title="Remove from fleet"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Assign rider modal
// =============================================================================
function AssignRiderModal({
  sellerName,
  availableRiders,
  onClose,
  onAssign,
}: {
  sellerName: string;
  availableRiders: Rider[];
  onClose: () => void;
  onAssign: (data: {
    rider_id: string;
    coverage_areas?: string;
    seller_instructions?: string;
    vetting_notes?: string;
  }) => Promise<void>;
}) {
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [vetting, setVetting] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return availableRiders;
    const q = search.toLowerCase();
    return availableRiders.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.plate_number || "").toLowerCase().includes(q) ||
        (r.stage || "").toLowerCase().includes(q)
    );
  }, [availableRiders, search]);

  const selectedRider = availableRiders.find((r) => r.id === selectedRiderId);

  async function submit() {
    if (!selectedRiderId) return;
    setBusy(true);
    try {
      await onAssign({
        rider_id: selectedRiderId,
        coverage_areas: coverage.trim() || undefined,
        seller_instructions: instructions.trim() || undefined,
        vetting_notes: vetting.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="card p-6 max-w-lg w-full max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">
              Assign to {sellerName}
            </div>
            <div className="font-display text-xl text-ink-900">
              {step === "pick" ? "Pick a vetted rider" : "Vetting details"}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "pick" ? (
          <>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, plate, or stage..."
                className="input pl-9 py-2 text-sm"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="text-sm text-ink-500 text-center py-8">
                  {availableRiders.length === 0
                    ? "Every active rider is already on this fleet."
                    : "No riders match."}
                </div>
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRiderId(r.id)}
                    className={`w-full text-left p-3 rounded-card border transition-colors ${
                      selectedRiderId === r.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-sand-200 hover:bg-sand-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-600 text-sand-50 flex items-center justify-center text-xs font-medium overflow-hidden shrink-0">
                        {r.photo_url ? (
                          <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          r.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink-900 truncate">
                          {r.full_name}
                        </div>
                        <div className="text-xs text-ink-500 truncate">
                          {r.plate_number || "—"} · {r.stage || "no stage"}
                        </div>
                      </div>
                      {selectedRiderId === r.id && (
                        <Check className="w-4 h-4 text-teal-600 shrink-0" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setStep("details")}
              disabled={!selectedRiderId}
              className="btn-primary justify-center mt-4"
            >
              Next: vetting details
            </button>
          </>
        ) : (
          <>
            {selectedRider && (
              <div className="card p-3 bg-teal-50 border-teal-200 mb-4 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                <div className="text-sm text-teal-700">
                  Assigning <strong>{selectedRider.full_name}</strong> to {sellerName}
                </div>
              </div>
            )}

            <div className="space-y-4 flex-1 overflow-y-auto">
              <Field
                label="Coverage areas"
                hint="Where this rider should mostly handle deliveries for this seller."
              >
                <input
                  type="text"
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                  placeholder="Bukoto, Ntinda, Kololo"
                  className="input"
                />
              </Field>

              <Field
                label="Instructions for this rider"
                hint="What should they know about how this seller works?"
              >
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Sarah ships fragile fashion items. Double-bag everything. Arrive at her shop only between 9am-2pm."
                  className="input"
                  rows={3}
                />
              </Field>

              <Field
                label="Tukole vetting notes (private)"
                hint="Why we believe this rider is right for this business."
              >
                <textarea
                  value={vetting}
                  onChange={(e) => setVetting(e.target.value)}
                  placeholder="Verified ID, 2-yr clean record, recommended by stage chairman."
                  className="input"
                  rows={2}
                />
              </Field>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setStep("pick")}
                className="btn-secondary flex-1 justify-center"
              >
                Back
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="btn-coral flex-1 justify-center"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm assignment
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="field-label">{label}</div>
      {hint && <div className="field-hint mb-2">{hint}</div>}
      <div>{children}</div>
    </label>
  );
}
