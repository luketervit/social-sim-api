"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Persona } from "@/lib/schemas";
import type { AgentMessage } from "@/lib/simulation/types";
import type { ChatAnalysis } from "@/lib/simulation/analyze-chat";
import { MascotImage, MascotVideo } from "@/app/components/Mascot";
import AudienceTable, { buildPersonaCsv } from "./AudienceTable";
import OnboardingModal from "./OnboardingModal";
import Sidebar from "./Sidebar";
import {
  type AudienceSummary,
  type ChatState,
  type Platform,
  type RunMode,
  type VariantRun,
  type VariantStatus,
  PLATFORM_LABELS,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
  SIMULATION_ROUNDS,
  DEFAULT_PERSONA_CAP,
  avgAffinity,
  describeAffinity,
  formatHandle,
  inferPlatformFromFilename,
  makeChat,
  renderChatTitle,
  sentimentBreakdown,
  summariseArchetypes,
  variantId,
  variantScore,
} from "./types";

export type { AudienceSummary };

interface DashboardClientProps {
  email: string;
  audiences: AudienceSummary[];
  initialChats?: ChatState[];
}

const ACCEPTED_EXTENSIONS = [".csv", ".json", ".ndjson"];
const POLL_INTERVAL_MS = 2000;
const SIM_POLL_INTERVAL_MS = 1500;

const LOADING_REPORT_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Generating analysis…</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; background: #FAF9F7; color: #1A1A1A; height: 100vh; display: flex; align-items: center; justify-content: center; }
  .wrap { text-align: center; max-width: 360px; padding: 0 24px; }
  .pulse { width: 10px; height: 10px; border-radius: 999px; background: #7C5CFC; margin: 0 auto 18px; animation: p 1.4s ease-in-out infinite; }
  h1 { font-family: "Fraunces", Georgia, serif; font-size: 22px; margin: 0 0 10px; font-weight: 500; letter-spacing: -0.02em; }
  p { font-size: 13px; color: #6B6B6B; line-height: 1.55; margin: 0; }
  @keyframes p { 0%, 100% { opacity: 0.5; transform: scale(0.9);} 50% { opacity: 1; transform: scale(1.05);} }
</style></head>
<body><div class="wrap">
  <div class="pulse"></div>
  <h1>Building your report</h1>
  <p>Claude is reading every reply and writing a strategic analysis. Usually 8–15 seconds.</p>
</div></body></html>`;

type ConfirmModalState =
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      onConfirm: () => void;
    }
  | {
      kind: "error";
      title: string;
      message: string;
    };

interface ConvoMessage {
  id: string;
  role: "atharias" | "user" | "system";
  body?: ReactNode;
  raw?: ReactNode;
}

export default function DashboardClient({
  email,
  audiences: initialAudiences,
  initialChats,
}: DashboardClientProps) {
  const [audiences, setAudiences] = useState<AudienceSummary[]>(initialAudiences);
  const [chats, setChats] = useState<ChatState[]>(() =>
    initialChats && initialChats.length > 0 ? initialChats : [makeChat()]
  );
  const [activeChatId, setActiveChatId] = useState<string>(() => chats[0].id);
  const [view, setView] = useState<"chat" | "audience">("chat");
  const [viewedAudienceId, setViewedAudienceId] = useState<string | null>(null);
  const [viewedAudiencePersonas, setViewedAudiencePersonas] = useState<Persona[]>(
    []
  );
  const [viewedAudienceLoading, setViewedAudienceLoading] = useState(false);
  const [viewedAudienceError, setViewedAudienceError] = useState<string | null>(
    null
  );
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(
    null
  );

  const activeChat =
    chats.find((c) => c.id === activeChatId) ?? chats[0] ?? null;

  // Update the active chat with a partial patch.
  const updateActive = useCallback(
    (patch: Partial<ChatState> | ((c: ChatState) => Partial<ChatState>)) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChatId) return c;
          const p = typeof patch === "function" ? patch(c) : patch;
          return { ...c, ...p };
        })
      );
    },
    [activeChatId]
  );

  // Update a specific chat by id (used by polling for any background sims).
  const updateChatById = useCallback(
    (id: string, patch: Partial<ChatState> | ((c: ChatState) => Partial<ChatState>)) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const p = typeof patch === "function" ? patch(c) : patch;
          return { ...c, ...p };
        })
      );
    },
    []
  );

  // ---------------- Chat persistence ----------------

  // Debounce-save each chat to the DB whenever a meaningful field changes.
  // We hash the persistable shape so transient state (loading flags, errors)
  // doesn't trigger writes.
  const persistableHash = chats
    .map((c) =>
      JSON.stringify({
        id: c.id,
        title: renderChatTitle(c),
        audienceId: c.audienceId,
        audienceName: c.audienceName,
        audienceRowCount: c.audienceRowCount,
        platform: c.platform,
        post: c.post,
        personaCap: c.personaCap,
        mode: c.mode,
        variantsLen: c.variants.length,
        variantsStatus: c.variants.map((v) => v.status).join(","),
      })
    )
    .join("|");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      for (const c of chats) {
        const variantsForWire = c.variants.map((v) => ({
          id: v.id,
          label: v.label,
          hook: v.hook,
          rationale: v.rationale,
          post: v.post,
          simulationId: v.simulationId,
          status: v.status,
          // Persist the full thread so sentiment counts, replies, and the
          // analysis pdf survive reloads. Capped per-sim at 250 messages
          // (25 personas × 10 rounds) so JSONB stays comfortably sized.
          thread: v.thread,
          aggression: v.aggression,
          error: v.error,
        }));
        void fetch("/api/v1/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: c.id,
            title: renderChatTitle(c),
            audienceId: c.audienceId,
            audienceName: c.audienceName,
            audienceRowCount: c.audienceRowCount,
            platform: c.platform,
            post: c.post,
            personaCap: c.personaCap,
            mode: c.mode,
            variants: variantsForWire,
          }),
        }).catch(() => {});
      }
    }, 600);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistableHash]);

  // On hydration: any chat that has an audienceId but no personas loaded yet
  // (server didn't fetch them) needs to fetch them now.
  const audiencesById = useMemo(() => {
    const map = new Map<string, AudienceSummary>();
    for (const a of audiences) map.set(a.id, a);
    return map;
  }, [audiences]);

  useEffect(() => {
    let cancelled = false;
    for (const c of chats) {
      if (
        c.audienceId &&
        c.audiencePersonas.length === 0 &&
        !c.audienceLoading
      ) {
        const audience = audiencesById.get(c.audienceId);
        if (!audience || audience.status !== "ready") continue;
        const chatId = c.id;
        const audienceId = c.audienceId;
        void (async () => {
          try {
            const res = await fetch(`/api/v1/audiences/${audienceId}?full=1`);
            if (!res.ok) return;
            const data = await res.json();
            const personas = Array.isArray(data?.personas)
              ? (data.personas as Persona[])
              : [];
            if (cancelled) return;
            updateChatById(chatId, {
              audiencePersonas: personas,
              audienceLoading: false,
            });
          } catch {
            /* ignore */
          }
        })();
      }
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audiencesById]);

  // ---------------- Sidebar handlers ----------------

  function handleNewChat() {
    const fresh = makeChat();
    setChats((prev) => [fresh, ...prev]);
    setActiveChatId(fresh.id);
    setView("chat");
  }

  function handleSelectChat(id: string) {
    setActiveChatId(id);
    setView("chat");
  }

  function handleDeleteChat(id: string) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = makeChat();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (id === activeChatId) {
        setActiveChatId(next[0].id);
      }
      return next;
    });
    // Fire-and-forget delete in DB.
    void fetch(`/api/v1/chats/${id}`, { method: "DELETE" }).catch(() => {});
  }

  // Pick an audience for whatever chat is active. Loads personas.
  const fetchPersonasForAudience = useCallback(
    async (audience: AudienceSummary) => {
      const res = await fetch(`/api/v1/audiences/${audience.id}?full=1`);
      if (!res.ok) {
        throw new Error("Could not load audience.");
      }
      const data = await res.json();
      const personas = Array.isArray(data?.personas)
        ? (data.personas as Persona[])
        : [];
      return { personas, platform: data?.platform as string | null };
    },
    []
  );

  async function performDeleteAudience(audience: AudienceSummary) {
    try {
      const res = await fetch(`/api/v1/audiences/${audience.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not delete audience.");
      }

      setAudiences((prev) => prev.filter((a) => a.id !== audience.id));

      // If we were viewing this audience, fall back to chat view.
      if (viewedAudienceId === audience.id) {
        setView("chat");
        setViewedAudienceId(null);
        setViewedAudiencePersonas([]);
        setViewedAudienceError(null);
      }

      // Detach from any chats that had it selected.
      setChats((prev) =>
        prev.map((c) =>
          c.audienceId === audience.id
            ? {
                ...c,
                audienceId: null,
                audienceName: null,
                audienceRowCount: null,
                audiencePersonas: [],
                audienceLoading: false,
                audienceError: null,
                platform: null,
                mode: null,
                variants: [],
              }
            : c
        )
      );
    } catch (err) {
      setConfirmModal({
        kind: "error",
        title: "Couldn't delete audience",
        message:
          err instanceof Error ? err.message : "Could not delete audience.",
      });
    }
  }

  function handleDeleteAudience(audience: AudienceSummary) {
    setConfirmModal({
      kind: "confirm",
      title: "Delete audience",
      message: `Delete "${audience.name}"? Personas and history attached to it will be removed.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        setConfirmModal(null);
        void performDeleteAudience(audience);
      },
    });
  }

  async function handleViewAudience(audience: AudienceSummary) {
    if (audience.status !== "ready") return;
    setView("audience");
    setViewedAudienceId(audience.id);
    setViewedAudienceError(null);
    setViewedAudienceLoading(true);
    try {
      const { personas } = await fetchPersonasForAudience(audience);
      setViewedAudiencePersonas(personas);
    } catch (err) {
      setViewedAudienceError(
        err instanceof Error ? err.message : "Could not load audience."
      );
    } finally {
      setViewedAudienceLoading(false);
    }
  }

  async function handleUseViewedAudienceInChat() {
    if (!viewedAudienceId) return;
    const audience = audiences.find((a) => a.id === viewedAudienceId);
    if (!audience) return;
    setView("chat");
    await handlePickAudienceForActive(audience);
  }

  function handleDownloadViewedCsv() {
    if (!viewedAudienceId) return;
    const audience = audiences.find((a) => a.id === viewedAudienceId);
    if (!audience) return;
    const csv = buildPersonaCsv(audience, viewedAudiencePersonas);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${audience.name.replace(/\s+/g, "-")}-personas.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePickAudienceForActive(audience: AudienceSummary) {
    if (audience.status !== "ready") return;
    updateActive({
      audienceId: audience.id,
      audienceName: audience.name,
      audienceRowCount: audience.row_count,
      audienceLoading: true,
      audienceError: null,
    });
    try {
      const { personas, platform } = await fetchPersonasForAudience(audience);
      updateActive((c) => ({
        audiencePersonas: personas,
        audienceLoading: false,
        personaCap: Math.min(c.personaCap, Math.max(5, personas.length)),
        platform:
          c.platform ??
          (platform === "twitter" || platform === "reddit" || platform === "slack"
            ? (platform as Platform)
            : inferPlatformFromFilename(audience.name)),
      }));
    } catch (err) {
      updateActive({
        audienceLoading: false,
        audienceError:
          err instanceof Error ? err.message : "Could not load audience.",
      });
    }
  }

  function handleUnpickAudience() {
    updateActive({
      audienceId: null,
      audienceName: null,
      audienceRowCount: null,
      audiencePersonas: [],
      audienceLoading: false,
      audienceError: null,
      platform: null,
      mode: null,
      variants: [],
      runError: null,
      variationsError: null,
    });
  }

  // ---------------- Upload (into the active chat) ----------------

  const [uploading, setUploading] = useState(false);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      const lower = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        setUploadError("Needs to be a .csv, .json, or .ndjson file.");
        return;
      }
      const guess = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Audience";
      const inferredPlatform = inferPlatformFromFilename(file.name);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", guess);
      fd.append("platform", inferredPlatform);

      setUploading(true);
      setUploadingFilename(file.name);
      try {
        const res = await fetch("/api/v1/audiences", { method: "POST", body: fd });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error ?? "Upload failed.");
        }
        // Refresh audiences list.
        const listRes = await fetch("/api/v1/audiences");
        if (listRes.ok) {
          const data = (await listRes.json()) as {
            audiences?: AudienceSummary[];
          };
          if (Array.isArray(data.audiences)) setAudiences(data.audiences);
        }
        // Attach the new audience to the active chat (still processing).
        if (payload?.audience_id) {
          updateActive({
            audienceId: payload.audience_id as string,
            audienceName: guess,
            audienceRowCount: payload.row_count ?? null,
            audiencePersonas: [],
            platform: inferredPlatform,
          });
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        setUploadingFilename(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [updateActive]
  );

  // ---------------- Audience status polling ----------------

  // Poll while any audience is processing. When one flips to "ready",
  // load its personas into any chat that has it selected.
  useEffect(() => {
    const hasProcessing = audiences.some((a) => a.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/v1/audiences");
        if (!res.ok) return;
        const data = (await res.json()) as { audiences?: AudienceSummary[] };
        if (!Array.isArray(data.audiences)) return;
        setAudiences(data.audiences);
        // For each chat that has an audienceId, if that audience just became
        // ready and personas haven't been loaded, fetch them.
        const ready = data.audiences.filter((a) => a.status === "ready");
        for (const a of ready) {
          // Find chats pointing at this audience that don't have personas yet.
          // We use a snapshot; React will batch the patches.
          setChats((prev) => {
            let changed = false;
            const next = prev.map((c) => {
              if (c.audienceId === a.id && c.audiencePersonas.length === 0) {
                changed = true;
                return {
                  ...c,
                  audienceLoading: true,
                };
              }
              return c;
            });
            if (!changed) return prev;
            // Trigger fetch outside the setter.
            void (async () => {
              try {
                const { personas, platform } = await fetchPersonasForAudience(a);
                setChats((p2) =>
                  p2.map((c) =>
                    c.audienceId === a.id
                      ? {
                          ...c,
                          audiencePersonas: personas,
                          audienceLoading: false,
                          audienceRowCount: a.row_count,
                          platform:
                            c.platform ??
                            (platform === "twitter" ||
                            platform === "reddit" ||
                            platform === "slack"
                              ? (platform as Platform)
                              : inferPlatformFromFilename(a.name)),
                        }
                      : c
                  )
                );
              } catch {
                setChats((p2) =>
                  p2.map((c) =>
                    c.audienceId === a.id
                      ? {
                          ...c,
                          audienceLoading: false,
                          audienceError: "Could not load personas.",
                        }
                      : c
                  )
                );
              }
            })();
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [audiences, fetchPersonasForAudience]);

  // ---------------- Sim run handlers (operate on activeChat) ----------------

  async function startSimulationFor(
    chat: ChatState,
    variant: VariantRun
  ): Promise<VariantRun> {
    if (!chat.audienceId || !chat.platform) return variant;
    try {
      const res = await fetch("/api/v1/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId: chat.audienceId,
          platform: chat.platform,
          input: variant.post,
          personaCap: Math.min(
            chat.personaCap,
            Math.max(5, chat.audiencePersonas.length)
          ),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Could not start simulation.");
      }
      return {
        ...variant,
        simulationId: payload.simulationId as string,
        status: "queued",
      };
    } catch (err) {
      return {
        ...variant,
        status: "failed",
        error: err instanceof Error ? err.message : "Failed to start.",
      };
    }
  }

  async function handleRunSingle() {
    if (!activeChat) return;
    if (activeChat.post.trim().length === 0) {
      updateActive({ runError: "Paste a post first." });
      return;
    }
    if (!activeChat.audienceId || activeChat.audiencePersonas.length === 0) {
      updateActive({ runError: "Pick an audience first." });
      return;
    }
    if (!activeChat.platform) {
      updateActive({ runError: "Pick a platform first." });
      return;
    }

    const original: VariantRun = {
      id: variantId(),
      label: "Your draft",
      post: activeChat.post.trim(),
      simulationId: null,
      status: "idle",
      thread: [],
      aggression: null,
      error: null,
    };
    updateActive({ runError: null, mode: "single", variants: [original] });

    const updated = await startSimulationFor(
      { ...activeChat, mode: "single", variants: [original] },
      original
    );
    updateChatById(activeChat.id, { variants: [updated] });
  }

  async function handleDraftVariations() {
    if (!activeChat) return;
    if (activeChat.post.trim().length === 0) {
      updateActive({ variationsError: "Paste a post first." });
      return;
    }
    if (!activeChat.audienceId || !activeChat.platform) {
      updateActive({ variationsError: "Pick an audience and platform first." });
      return;
    }

    updateActive({
      runError: null,
      variationsError: null,
      variationsLoading: true,
      mode: "variations",
    });

    try {
      const res = await fetch("/api/v1/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId: activeChat.audienceId,
          platform: activeChat.platform,
          post: activeChat.post.trim(),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Could not draft variations.");
      }
      const ideas = (payload?.variations ?? []) as Array<{
        id?: string;
        label?: string;
        hook?: string;
        post?: string;
        rationale?: string;
      }>;

      const original: VariantRun = {
        id: variantId(),
        label: "Your draft",
        post: activeChat.post.trim(),
        simulationId: null,
        status: "idle",
        thread: [],
        aggression: null,
        error: null,
      };
      const drafted: VariantRun[] = ideas.slice(0, 3).map((idea) => ({
        id: variantId(),
        label: idea.label ?? "Variant",
        hook: idea.hook,
        rationale: idea.rationale,
        post: (idea.post ?? "").trim(),
        simulationId: null,
        status: "idle",
        thread: [],
        aggression: null,
        error: null,
      }));
      updateActive({
        variants: [original, ...drafted],
        variationsLoading: false,
      });
    } catch (err) {
      updateActive({
        variationsError:
          err instanceof Error ? err.message : "Could not draft variations.",
        variationsLoading: false,
        mode: null,
      });
    }
  }

  async function handleRunAll() {
    if (!activeChat) return;
    const chat = activeChat;
    if (chat.variants.length === 0) return;
    for (const v of chat.variants) {
      if (v.post.trim().length === 0) {
        updateActive({ runError: "One of the drafts is empty. Fill or remove it." });
        return;
      }
    }

    updateActive({ runError: null });
    // Mark all queued.
    updateActive({
      variants: chat.variants.map((v) => ({
        ...v,
        status: "queued" as VariantStatus,
        error: null,
      })),
    });
    const queuedChat = {
      ...chat,
      variants: chat.variants.map((v) => ({
        ...v,
        status: "queued" as VariantStatus,
      })),
    };
    const started = await Promise.all(
      queuedChat.variants.map((v) => startSimulationFor(queuedChat, v))
    );
    updateChatById(chat.id, { variants: started });
  }

  function handleEditVariant(id: string, nextPost: string) {
    updateActive((c) => ({
      variants: c.variants.map((v) => (v.id === id ? { ...v, post: nextPost } : v)),
    }));
  }

  function handleRemoveVariant(id: string) {
    updateActive((c) => ({
      variants: c.variants.filter((v) => v.id !== id),
    }));
  }

  function handleResetRun() {
    updateActive({
      mode: null,
      variants: [],
      runError: null,
      variationsError: null,
      variationsLoading: false,
      post: "",
    });
  }

  // ---------------- Sim status polling for active chat ----------------

  useEffect(() => {
    if (!activeChat) return;
    const inFlight = activeChat.variants.filter(
      (v) => v.simulationId && (v.status === "queued" || v.status === "running")
    );
    if (inFlight.length === 0) return;

    let cancelled = false;
    const chatId = activeChat.id;

    const interval = setInterval(async () => {
      const updates = await Promise.all(
        inFlight.map(async (v) => {
          try {
            const res = await fetch(`/api/v1/simulate/${v.simulationId}/status`);
            if (!res.ok) return null;
            const data = await res.json();
            return { id: v.id, data };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      updateChatById(chatId, (c) => ({
        variants: c.variants.map((variant) => {
          const update = updates.find((u) => u && u.id === variant.id);
          if (!update || !update.data) return variant;
          const data = update.data;
          let nextStatus = variant.status;
          if (data.status === "running") nextStatus = "running";
          else if (data.status === "completed") nextStatus = "completed";
          else if (data.status === "failed") nextStatus = "failed";
          return {
            ...variant,
            status: nextStatus,
            thread: Array.isArray(data.thread) ? data.thread : variant.thread,
            aggression:
              typeof data.aggressionScore === "string"
                ? data.aggressionScore
                : variant.aggression,
            error:
              data.status === "failed" && typeof data.errorMessage === "string"
                ? data.errorMessage
                : variant.error,
          };
        }),
      }));
    }, SIM_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeChat, updateChatById]);

  // ---------------- Download report ----------------

  const [reportLoading, setReportLoading] = useState(false);

  async function handleDownloadReport() {
    if (!activeChat) return;
    if (reportLoading) return;
    setReportLoading(true);

    // Open the window immediately with a placeholder so popup blockers
    // don't fire later (browsers block window.open after async work).
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) {
      setReportLoading(false);
      window.alert(
        "Pop-up blocked. Allow pop-ups for atharias.dev to download the report."
      );
      return;
    }
    win.document.write(LOADING_REPORT_HTML);
    win.document.close();

    try {
      const archetypes = summariseArchetypes(activeChat.audiencePersonas).slice(
        0,
        8
      );
      const audienceTone =
        activeChat.audiencePersonas.length > 0
          ? describeAffinity(avgAffinity(activeChat.audiencePersonas))
          : null;

      const analyzePayload = {
        audienceName: activeChat.audienceName,
        audienceTone,
        topArchetypes: archetypes,
        platform: activeChat.platform,
        variants: activeChat.variants
          .filter((v) => v.status === "completed")
          .map((v, idx) => {
            const variantIdx = activeChat.variants.findIndex(
              (x) => x.id === v.id
            );
            return {
              index: variantIdx >= 0 ? variantIdx : idx,
              label: v.label,
              post: v.post,
              thread: v.thread,
              aggression: v.aggression,
            };
          }),
      };

      let analysis: ChatAnalysis | null = null;
      if (analyzePayload.variants.length > 0) {
        try {
          const res = await fetch("/api/v1/chat-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(analyzePayload),
          });
          if (res.ok) {
            const data = await res.json();
            analysis = (data?.analysis as ChatAnalysis | undefined) ?? null;
          }
        } catch {
          /* fall through to local-only report */
        }
      }

      const html = buildReportHtml(activeChat, analysis);
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch {
        /* window may have been closed by user */
      }
    } finally {
      setReportLoading(false);
    }
  }

  // ---------------- Render ----------------

  return (
    <div
      style={{
        background: "var(--bg)",
        minHeight: "100vh",
        display: "flex",
      }}
    >
      <OnboardingModal />
      {confirmModal && (
        <ConfirmDialog
          state={confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}
      <Sidebar
        email={email}
        chats={chats}
        activeChatId={activeChatId}
        view={view}
        viewedAudienceId={viewedAudienceId}
        audiences={audiences}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onViewAudience={(a) => void handleViewAudience(a)}
        onDeleteAudience={(a) => void handleDeleteAudience(a)}
      />

      <main style={{ flex: 1, minWidth: 0 }}>
        <div
          className="mx-auto px-6"
          style={{
            maxWidth: 880,
            padding: "clamp(28px, 4vh, 48px) 24px clamp(72px, 10vh, 120px)",
          }}
        >
          {view === "audience" && viewedAudienceId ? (
            (() => {
              const viewed = audiences.find((a) => a.id === viewedAudienceId);
              if (!viewed) {
                return (
                  <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
                    Audience not found.
                  </p>
                );
              }
              return (
                <AudienceTable
                  audience={viewed}
                  personas={viewedAudiencePersonas}
                  loading={viewedAudienceLoading}
                  error={viewedAudienceError}
                  onUseInChat={() => void handleUseViewedAudienceInChat()}
                  onDownloadCsv={handleDownloadViewedCsv}
                  onDelete={() => void handleDeleteAudience(viewed)}
                />
              );
            })()
          ) : activeChat ? (
            <ChatConversation
              chat={activeChat}
              audiences={audiences}
              uploading={uploading}
              uploadingFilename={uploadingFilename}
              uploadError={uploadError}
              dragActive={dragActive}
              fileInputRef={fileInputRef}
              onUpload={handleUpload}
              onDragActive={setDragActive}
              onPickAudience={(a) => void handlePickAudienceForActive(a)}
              onUnpickAudience={handleUnpickAudience}
              onPickPlatform={(p) => updateActive({ platform: p })}
              onChangePlatform={() => updateActive({ platform: null })}
              onSetPost={(post) => updateActive({ post })}
              onSetPersonaCap={(personaCap) => updateActive({ personaCap })}
              onRunSingle={handleRunSingle}
              onDraftVariations={handleDraftVariations}
              onEditVariant={handleEditVariant}
              onRemoveVariant={handleRemoveVariant}
              onRunAll={handleRunAll}
              onResetRun={handleResetRun}
              onDownloadReport={handleDownloadReport}
            />
          ) : null}
        </div>
      </main>

      <style jsx global>{`
        @keyframes convo-fade-up {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-convo-bubble] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// =====================================================================
// ChatConversation — the per-chat conversation view
// =====================================================================

interface ChatConversationProps {
  chat: ChatState;
  audiences: AudienceSummary[];
  uploading: boolean;
  uploadingFilename: string | null;
  uploadError: string | null;
  dragActive: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (file: File) => void;
  onDragActive: (active: boolean) => void;
  onPickAudience: (a: AudienceSummary) => void;
  onUnpickAudience: () => void;
  onPickPlatform: (p: Platform) => void;
  onChangePlatform: () => void;
  onSetPost: (post: string) => void;
  onSetPersonaCap: (n: number) => void;
  onRunSingle: () => void;
  onDraftVariations: () => void;
  onEditVariant: (id: string, post: string) => void;
  onRemoveVariant: (id: string) => void;
  onRunAll: () => void;
  onResetRun: () => void;
  onDownloadReport: () => void;
}

function ChatConversation(props: ChatConversationProps) {
  const {
    chat,
    audiences,
    uploading,
    uploadingFilename,
    uploadError,
    dragActive,
    fileInputRef,
    onUpload,
    onDragActive,
    onPickAudience,
    onUnpickAudience,
    onPickPlatform,
    onChangePlatform,
    onSetPost,
    onSetPersonaCap,
    onRunSingle,
    onDraftVariations,
    onEditVariant,
    onRemoveVariant,
    onRunAll,
    onResetRun,
    onDownloadReport,
  } = props;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messages: ConvoMessage[] = [];

  // Linked audience (if any) — get current status from audiences list.
  const linkedAudience = chat.audienceId
    ? audiences.find((a) => a.id === chat.audienceId)
    : null;

  // Top: audience picker chip
  messages.push({
    id: "audience-picker",
    role: "system",
    raw: (
      <AudiencePicker
        chat={chat}
        audiences={audiences}
        linkedAudience={linkedAudience}
        onPickAudience={onPickAudience}
        onUnpickAudience={onUnpickAudience}
      />
    ),
  });

  // No audience yet — quiet empty state with the upload zone.
  if (!chat.audienceId) {
    if (uploading) {
      messages.push({
        id: "uploading",
        role: "system",
        raw: (
          <UploadingHint filename={uploadingFilename ?? "your file"} />
        ),
      });
    } else {
      const readyAudiences = audiences.filter((a) => a.status === "ready");
      if (readyAudiences.length > 0) {
        messages.push({
          id: "pick-existing-prompt",
          role: "atharias",
          body: (
            <>
              Pick one of your audiences to start, or upload a fresh CSV.
            </>
          ),
        });
        messages.push({
          id: "pick-existing-grid",
          role: "system",
          raw: (
            <ExistingAudiencePicker
              audiences={readyAudiences}
              onPick={onPickAudience}
            />
          ),
        });
      }

      messages.push({
        id: "drop",
        role: "system",
        raw: (
          <UploadDropzone
            dragActive={dragActive}
            onDragActive={onDragActive}
            onUpload={onUpload}
            fileInputRef={fileInputRef}
            uploading={false}
            hint={
              readyAudiences.length > 0
                ? "Or drop a fresh CSV to build a new audience."
                : null
            }
          />
        ),
      });
      if (uploadError) {
        messages.push({
          id: "upload-error",
          role: "system",
          raw: (
            <ErrorLine text={uploadError} />
          ),
        });
      }
    }
  }

  // Audience linked — figure out state
  if (chat.audienceId && linkedAudience) {
    if (linkedAudience.status === "processing") {
      messages.push({
        id: "processing-card",
        role: "system",
        raw: (
          <ProcessingCard
            name={linkedAudience.name}
            rowCount={linkedAudience.row_count}
          />
        ),
      });
    }

    if (linkedAudience.status === "failed") {
      messages.push({
        id: "failed",
        role: "atharias",
        body: (
          <span style={{ color: "var(--coral)" }}>
            Processing failed. Pick a different audience or upload a fresh CSV.
          </span>
        ),
      });
    }

    // While the audience is hydrating on a fresh page load, render an empty
    // placeholder instead of nothing — prevents the chat from snapping from
    // blank to populated mid-flow.
    if (
      linkedAudience.status === "ready" &&
      chat.audiencePersonas.length === 0
    ) {
      messages.push({
        id: "audience-warmup",
        role: "system",
        raw: (
          <span
            aria-live="polite"
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              opacity: 0.7,
            }}
          >
            Loading audience…
          </span>
        ),
      });
    }

    if (linkedAudience.status === "ready" && chat.audiencePersonas.length > 0) {
      if (!chat.platform) {
        const suggested = inferPlatformFromFilename(linkedAudience.name);
        messages.push({
          id: "ask-platform",
          role: "atharias",
          body: (
            <>
              Where do you want to test this? I picked{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {PLATFORM_LABELS[suggested]}
              </strong>{" "}
              based on the filename.
            </>
          ),
        });
        messages.push({
          id: "platform-chips",
          role: "system",
          raw: <PlatformChips suggested={suggested} onPick={onPickPlatform} />,
        });
      } else {
        messages.push({
          id: "platform-chosen",
          role: "user",
          body: <>{PLATFORM_LABELS[chat.platform]}.</>,
        });

        if (chat.mode === null) {
          messages.push({
            id: "ask-post",
            role: "atharias",
            body: (
              <>
                Paste the draft you want to test. Run it as-is, or let me draft a
                few variations to A/B test.
              </>
            ),
          });
          messages.push({
            id: "post-composer",
            role: "system",
            raw: (
              <PostComposer
                post={chat.post}
                onPostChange={onSetPost}
                personaCap={chat.personaCap}
                onPersonaCapChange={onSetPersonaCap}
                maxPersonas={Math.max(5, chat.audiencePersonas.length)}
                onRunSingle={onRunSingle}
                onDraftVariations={onDraftVariations}
                onChangePlatform={onChangePlatform}
                platformLabel={PLATFORM_LABELS[chat.platform]}
                error={chat.runError ?? chat.variationsError}
                draftingVariations={chat.variationsLoading}
              />
            ),
          });
        }

        // Drafting state — Claude is generating variants but they haven't
        // come back yet. Without this, the chat went blank between the
        // user's "Draft variations" tap and the editable cards landing.
        if (chat.mode === "variations" && chat.variants.length === 0) {
          messages.push({
            id: "user-asked-variations-loading",
            role: "user",
            body: <>Draft variations.</>,
          });
          messages.push({
            id: "drafting-variations-msg",
            role: "atharias",
            body: (
              <>
                Drafting{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  3 variations
                </strong>{" "}
                plus your original draft. This takes ~5 seconds.
              </>
            ),
          });
          messages.push({
            id: "drafting-variations-spinner",
            role: "system",
            raw: <ProcessingPulse />,
          });
        }

        if (
          chat.mode === "variations" &&
          chat.variants.length > 0 &&
          chat.variants.every((v) => v.simulationId === null && v.status === "idle")
        ) {
          messages.push({
            id: "user-asked-variations",
            role: "user",
            body: <>Draft variations.</>,
          });
          messages.push({
            id: "variations-explainer",
            role: "atharias",
            body: (
              <>
                Here are{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {chat.variants.length}
                </strong>{" "}
                drafts total: your original plus 3 variations. Edit any of them,
                drop the ones you don&apos;t want, then run all.
              </>
            ),
          });
          messages.push({
            id: "variation-cards",
            role: "system",
            raw: (
              <VariationReview
                variants={chat.variants}
                onEdit={onEditVariant}
                onRemove={onRemoveVariant}
                onRunAll={onRunAll}
                onCancel={onResetRun}
                error={chat.runError}
                personaCap={Math.min(chat.personaCap, chat.audiencePersonas.length)}
              />
            ),
          });
        }

        if (
          chat.mode !== null &&
          chat.variants.some((v) => v.status !== "idle")
        ) {
          if (chat.mode === "single" && chat.variants[0]) {
            messages.push({
              id: "user-post-single",
              role: "user",
              body: (
                <span
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 17,
                    lineHeight: 1.45,
                  }}
                >
                  {chat.variants[0].post}
                </span>
              ),
            });
          } else if (chat.mode === "variations") {
            messages.push({
              id: "running-variants-msg",
              role: "user",
              body: <>Run all {chat.variants.length}.</>,
            });
          }

          const allDone = chat.variants.every(
            (v) => v.status === "completed" || v.status === "failed"
          );
          messages.push({
            id: "running-status",
            role: "atharias",
            body: allDone
              ? chat.mode === "variations"
                ? "All done. Comparison below."
                : "Done."
              : `Streaming. ${chat.variants.reduce(
                  (acc, v) => acc + v.thread.length,
                  0
                )} replies so far.`,
          });

          if (chat.mode === "variations" && allDone) {
            messages.push({
              id: "variation-comparison",
              role: "system",
              raw: <VariationComparison variants={chat.variants} />,
            });
          }

          messages.push({
            id: "variant-streams",
            role: "system",
            raw: (
              <VariantList
                variants={chat.variants}
                platform={chat.platform}
                showLabel={chat.mode === "variations"}
              />
            ),
          });

          if (allDone) {
            messages.push({
              id: "after-run-actions",
              role: "system",
              raw: (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={onResetRun}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 999,
                      background: "var(--ink)",
                      color: "var(--butter-deep)",
                      border: "none",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Try another draft
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadReport}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 999,
                      background: "transparent",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-hover)",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Download report (.pdf) ↓
                  </button>
                </div>
              ),
            });
          }
        }
      }
    }
  }

  // Auto-scroll on new messages.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, chat.variants]);

  return (
    <div
      ref={scrollRef}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {messages.map((m, i) => (
        <ConversationItem key={m.id} message={m} delayMs={Math.min(i * 30, 240)} />
      ))}
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function ConversationItem({
  message,
  delayMs,
}: {
  message: ConvoMessage;
  delayMs: number;
}) {
  if (message.raw) {
    return (
      <div
        data-convo-bubble
        style={{
          animation: `convo-fade-up 320ms cubic-bezier(0.215, 0.61, 0.355, 1) ${delayMs}ms both`,
        }}
      >
        {message.raw}
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div
      data-convo-bubble
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-start",
        gap: 10,
        animation: `convo-fade-up 320ms cubic-bezier(0.215, 0.61, 0.355, 1) ${delayMs}ms both`,
      }}
    >
      {!isUser ? (
        <MascotImage
          size={32}
          alt=""
          style={{ flexShrink: 0, marginTop: 2 }}
        />
      ) : null}
      <div
        style={{
          maxWidth: "min(640px, 92%)",
          padding: "14px 18px",
          borderRadius: 18,
          borderTopLeftRadius: isUser ? 18 : 4,
          borderTopRightRadius: isUser ? 4 : 18,
          background: isUser ? "var(--ink)" : "var(--bg-subtle)",
          color: isUser ? "rgba(245, 244, 242, 0.95)" : "var(--text-primary)",
          border: isUser ? "none" : "1px solid var(--border)",
          fontSize: 15,
          lineHeight: 1.55,
        }}
      >
        {!isUser ? (
          <div
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              marginBottom: 6,
            }}
          >
            Atharias
          </div>
        ) : null}
        {message.body}
      </div>
    </div>
  );
}

function AudiencePicker({
  chat,
  audiences,
  linkedAudience,
  onPickAudience,
  onUnpickAudience,
}: {
  chat: ChatState;
  audiences: AudienceSummary[];
  linkedAudience: AudienceSummary | null | undefined;
  onPickAudience: (a: AudienceSummary) => void;
  onUnpickAudience: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ready = audiences.filter((a) => a.status === "ready");

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        AUDIENCE
      </span>
      {linkedAudience ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px 5px 12px",
            borderRadius: 999,
            background: "var(--ink)",
            color: "rgba(245, 244, 242, 0.95)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {linkedAudience.name}
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 10,
              letterSpacing: "0.04em",
              color: "rgba(245, 244, 242, 0.5)",
            }}
          >
            ×{linkedAudience.row_count ?? chat.audiencePersonas.length}
          </span>
          <button
            type="button"
            onClick={onUnpickAudience}
            aria-label="Unselect audience"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(245, 244, 242, 0.7)",
              fontSize: 14,
              lineHeight: 1,
              padding: 2,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: "5px 12px",
            borderRadius: 999,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontSize: 13,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Pick an audience…
        </button>
      )}

      {!linkedAudience && open && ready.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 80,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 6,
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 10,
            minWidth: 240,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {ready.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onPickAudience(a);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }}
            >
              <span>{a.name}</span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-data), monospace",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                }}
              >
                {a.row_count ?? 0} personas
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {chat.audienceLoading ? (
        <span
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            color: "var(--text-tertiary)",
            letterSpacing: "0.04em",
          }}
        >
          Loading personas…
        </span>
      ) : null}
      {chat.audienceError ? (
        <span style={{ fontSize: 12, color: "var(--coral)" }}>
          {chat.audienceError}
        </span>
      ) : null}
    </div>
  );
}

function ExistingAudiencePicker({
  audiences,
  onPick,
}: {
  audiences: AudienceSummary[];
  onPick: (a: AudienceSummary) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}
    >
      {audiences.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a)}
          style={{
            textAlign: "left",
            padding: "14px 16px",
            borderRadius: 14,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            transition:
              "border-color 200ms cubic-bezier(0.215, 0.61, 0.355, 1), transform 200ms cubic-bezier(0.215, 0.61, 0.355, 1), background 200ms cubic-bezier(0.215, 0.61, 0.355, 1)",
            font: "inherit",
            color: "inherit",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--ink)";
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(-1px)";
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--bg-subtle)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--surface)";
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {a.name}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
          >
            {a.row_count ?? 0} personas · {a.platform ?? "twitter"}
          </span>
        </button>
      ))}
    </div>
  );
}

function UploadDropzone({
  dragActive,
  onDragActive,
  onUpload,
  fileInputRef,
  uploading,
  hint,
}: {
  dragActive: boolean;
  onDragActive: (active: boolean) => void;
  onUpload: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  hint?: string | null;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragActive(true);
      }}
      onDragLeave={() => onDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      aria-label="Upload a CSV file"
      style={{
        marginTop: 4,
        padding: "28px 24px 32px",
        borderRadius: 18,
        background: dragActive ? "var(--accent-subtle)" : "var(--surface)",
        border: `1.5px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
        textAlign: "center",
        cursor: uploading ? "progress" : "pointer",
        transition:
          "border-color 200ms cubic-bezier(0.215, 0.61, 0.355, 1), background 200ms cubic-bezier(0.215, 0.61, 0.355, 1), transform 200ms cubic-bezier(0.215, 0.61, 0.355, 1)",
        opacity: uploading ? 0.7 : 1,
        transform: dragActive ? "scale(1.005)" : "scale(1)",
      }}
    >
      <MascotVideo
        variant="idle"
        size={108}
        ariaLabel="Atharias mascot, waiting for your audience"
        style={{ margin: "0 auto 4px" }}
      />
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 22,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          fontStyle: dragActive ? "italic" : "normal",
          transition: "font-style 200ms ease",
        }}
      >
        {dragActive ? "Drop to upload" : "Drop a .csv and I'll bring the room"}
      </div>
      <div
        style={{
          fontFamily: "var(--font-data), monospace",
          fontSize: 11,
          color: "var(--text-tertiary)",
          marginTop: 10,
          letterSpacing: "0.04em",
        }}
      >
        Up to 10 MB · any CSV — we pick the useful columns
      </div>
      {hint ? (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          {hint}
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,.ndjson,text/csv,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
    </div>
  );
}

function UploadingHint({ filename }: { filename: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 18px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--accent)",
          animation: "pulse-soft 1.4s ease-in-out infinite",
        }}
      />
      <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
        Reading{" "}
        <strong style={{ fontWeight: 500 }}>{filename}</strong>…
      </span>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p
      role="alert"
      style={{
        fontSize: 13,
        color: "var(--coral)",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

function ProcessingCard({
  name,
  rowCount,
}: {
  name: string;
  rowCount: number | null;
}) {
  const steps = [
    {
      label: "Reading rows",
      detail: `${rowCount ?? "?"} rows`,
    },
    {
      label: "Picking useful columns",
      detail: "Claude is dropping URLs, emails, dates",
    },
    {
      label: "Classifying tone & reactivity",
      detail: "tone, voice, role signals",
    },
    {
      label: "Building personas",
      detail: "one persona per row",
    },
  ];
  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <MascotVideo
          variant="listening"
          size={64}
          ariaLabel="Atharias mascot, listening to your data"
          style={{ flexShrink: 0 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}
          >
            Listening to {name}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              fontStyle: "italic",
              fontFamily: "var(--font-display), Georgia, serif",
            }}
          >
            getting to know the room…
          </span>
        </div>
      </div>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {steps.map((s, i) => (
          <li
            key={s.label}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              fontSize: 14,
              color: "var(--text-primary)",
              animation: `fade-step 360ms cubic-bezier(0.215, 0.61, 0.355, 1) ${i * 90}ms both`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                fontFamily: "var(--font-data), monospace",
                fontSize: 11,
                color: "var(--text-tertiary)",
              }}
            >
              0{i + 1}
            </span>
            <span style={{ flex: 1 }}>{s.label}</span>
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "var(--text-tertiary)",
              }}
            >
              {s.detail}
            </span>
          </li>
        ))}
      </ol>
      <p
        style={{
          marginTop: 14,
          fontSize: 12,
          color: "var(--text-tertiary)",
          fontStyle: "italic",
        }}
      >
        Usually 30–90 seconds. You can switch chats while it runs.
      </p>
      <style jsx>{`
        @keyframes fade-step {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function ProcessingPulse() {
  return (
    <div
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: 999,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        fontFamily: "var(--font-data), monospace",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--accent)",
          animation: "pulse-soft 1.4s ease-in-out infinite",
        }}
      />
      Processing…
    </div>
  );
}

function ArchetypeChips({
  archetypes,
}: {
  archetypes: Array<{ archetype: string; count: number }>;
}) {
  if (archetypes.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {archetypes.map((a) => (
        <span
          key={a.archetype}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-primary)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {a.archetype}
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-data), monospace",
              color: "var(--text-tertiary)",
              fontSize: 11,
              letterSpacing: "0.04em",
            }}
          >
            ×{a.count}
          </span>
        </span>
      ))}
    </div>
  );
}

function PersonasGrid({ personas }: { personas: Persona[] }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter((p) => {
      if (p.archetype?.toLowerCase().includes(q)) return true;
      if (p.persona_prompt?.toLowerCase().includes(q)) return true;
      if (p.core_values?.some((v) => v.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [personas, search]);

  if (personas.length === 0) return null;

  const collapsedCount = 9;
  const visible = expanded ? filtered : filtered.slice(0, collapsedCount);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <span className="mono-label" style={{ color: "var(--text-tertiary)" }}>
          {personas.length} personas
        </span>
        {expanded ? (
          <input
            type="search"
            placeholder="Search by role, value, voice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              maxWidth: 320,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              fontSize: 13,
              color: "var(--text-primary)",
              outline: "none",
              fontFamily: "var(--font-body), system-ui, sans-serif",
            }}
            aria-label="Search personas"
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 11,
              letterSpacing: "0.04em",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
            }}
          >
            Personality preview
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {visible.map((p, i) => (
          <PersonaCard key={p.id ?? `${i}`} persona={p} delayMs={Math.min(i * 22, 220)} />
        ))}
      </div>

      {filtered.length > collapsedCount ? (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setExpanded((v) => !v);
              if (expanded) setSearch("");
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 13,
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "background 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--bg-subtle)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--border-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--border)";
            }}
          >
            {expanded
              ? "Show fewer"
              : `Show all ${filtered.length} personas →`}
          </button>
        </div>
      ) : null}

      {expanded && filtered.length === 0 ? (
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "var(--text-tertiary)",
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          No personas match &ldquo;{search}&rdquo;.
        </p>
      ) : null}

      {hiddenCount > 0 && !expanded ? null : null}
    </div>
  );
}

function PersonaCard({
  persona,
  delayMs,
}: {
  persona: Persona;
  delayMs: number;
}) {
  const reactivity = persona.reactivity_baseline;
  const sophistication = persona.sophistication;
  const affinity = persona.brand_affinity; // -1..1
  const voice = persona.persona_prompt
    ?.replace(/^You write things like:\s*/i, "")
    .replace(/^"|"$/g, "")
    .trim();

  const affinityLabel =
    affinity <= -0.4
      ? "skeptical"
      : affinity <= -0.1
        ? "cool"
        : affinity < 0.15
          ? "neutral"
          : affinity < 0.45
            ? "warm"
            : "supportive";
  const affinityColor =
    affinity <= -0.4
      ? "var(--coral)"
      : affinity <= -0.1
        ? "#C8552B"
        : affinity < 0.15
          ? "var(--text-secondary)"
          : affinity < 0.45
            ? "#1F8A55"
            : "var(--mint)";

  return (
    <div
      data-convo-bubble
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: `convo-fade-up 320ms cubic-bezier(0.215, 0.61, 0.355, 1) ${delayMs}ms both`,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {persona.archetype || "Unlabelled"}
        </div>
      </div>

      {voice ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          &ldquo;{voice}&rdquo;
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          fontFamily: "var(--font-data), monospace",
          fontSize: 10,
          letterSpacing: "0.04em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        <StatBar label="Reactivity" value={reactivity} color="var(--accent)" />
        <StatBar
          label="Sophistication"
          value={sophistication}
          color="var(--ink)"
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ minWidth: 88 }}>Affinity</span>
          <div
            style={{
              flex: 1,
              position: "relative",
              height: 4,
              borderRadius: 999,
              background: "var(--border)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -2,
                left: `${((affinity + 1) / 2) * 100}%`,
                transform: "translateX(-50%)",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: affinityColor,
                boxShadow: "0 0 0 2px var(--bg-subtle)",
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -1,
                left: "50%",
                transform: "translateX(-50%)",
                width: 1,
                height: 6,
                background: "var(--border-hover)",
              }}
            />
          </div>
          <span
            style={{
              color: affinityColor,
              minWidth: 64,
              textAlign: "right",
            }}
          >
            {affinityLabel}
          </span>
        </div>
      </div>

      {persona.core_values && persona.core_values.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            marginTop: 2,
          }}
        >
          {persona.core_values.slice(0, 4).map((value) => (
            <span
              key={value}
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: 10,
                color: "var(--text-secondary)",
                fontFamily: "var(--font-data), monospace",
                letterSpacing: "0.02em",
              }}
            >
              {value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ minWidth: 88 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 4,
          borderRadius: 999,
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width 360ms cubic-bezier(0.215, 0.61, 0.355, 1)",
          }}
        />
      </div>
      <span
        className="tabular-nums"
        style={{
          color: "var(--text-secondary)",
          minWidth: 30,
          textAlign: "right",
        }}
      >
        {Math.round(pct * 100)}
      </span>
    </div>
  );
}

function PlatformChips({
  suggested,
  onPick,
}: {
  suggested: Platform;
  onPick: (p: Platform) => void;
}) {
  const opts: Platform[] = ["twitter", "linkedin", "reddit", "slack"];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {opts.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            background: p === suggested ? "var(--ink)" : "var(--surface)",
            color: p === suggested ? "var(--butter-deep)" : "var(--text-primary)",
            border: p === suggested ? "none" : "1px solid var(--border)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 40,
          }}
        >
          {PLATFORM_LABELS[p]}
          {p === suggested ? (
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(245, 244, 242, 0.7)",
              }}
            >
              suggested
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function PostComposer({
  post,
  onPostChange,
  personaCap,
  onPersonaCapChange,
  maxPersonas,
  onRunSingle,
  onDraftVariations,
  onChangePlatform,
  platformLabel,
  error,
  draftingVariations,
}: {
  post: string;
  onPostChange: (v: string) => void;
  personaCap: number;
  onPersonaCapChange: (n: number) => void;
  maxPersonas: number;
  onRunSingle: () => void;
  onDraftVariations: () => void;
  onChangePlatform: () => void;
  platformLabel: string;
  error: string | null;
  draftingVariations: boolean;
}) {
  const cap = Math.max(5, Math.min(personaCap, maxPersonas));
  const estCredits = cap * SIMULATION_ROUNDS;
  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.03)",
      }}
    >
      <textarea
        value={post}
        onChange={(e) => onPostChange(e.target.value)}
        placeholder="Drop a draft tweet, post, or memo. Up to 2,000 characters."
        maxLength={2000}
        rows={4}
        aria-label="Post draft"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onRunSingle();
          }
        }}
        style={{
          width: "100%",
          padding: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "vertical",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 19,
          lineHeight: 1.45,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
          minHeight: 96,
        }}
      />

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-data), monospace",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {platformLabel}
        </span>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-data), monospace",
            letterSpacing: "0.04em",
          }}
        >
          PERSONAS
          <input
            type="number"
            min={5}
            max={Math.max(5, maxPersonas)}
            step={5}
            value={cap}
            onChange={(e) =>
              onPersonaCapChange(Number.parseInt(e.target.value, 10) || 5)
            }
            className="tabular-nums"
            style={{
              padding: "6px 10px",
              fontSize: 13,
              width: 76,
              minHeight: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              outline: "none",
            }}
            aria-label="Persona cap"
          />
        </label>

        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
            marginLeft: "auto",
          }}
        >
          ~{estCredits.toLocaleString()} credits
        </span>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onRunSingle}
          disabled={post.trim().length === 0 || draftingVariations}
          style={{
            background: "var(--ink)",
            color: "var(--butter-deep)",
            border: "none",
            borderRadius: 999,
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 500,
            minHeight: 40,
            cursor:
              post.trim().length === 0 || draftingVariations
                ? "not-allowed"
                : "pointer",
            opacity: post.trim().length === 0 || draftingVariations ? 0.55 : 1,
          }}
        >
          Run simulation →
        </button>
        <button
          type="button"
          onClick={onDraftVariations}
          disabled={post.trim().length === 0 || draftingVariations}
          style={{
            background: "transparent",
            color: "var(--text-primary)",
            border: "1px solid var(--border-hover)",
            borderRadius: 999,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 500,
            minHeight: 40,
            cursor:
              post.trim().length === 0 || draftingVariations
                ? "not-allowed"
                : "pointer",
            opacity: post.trim().length === 0 || draftingVariations ? 0.55 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {draftingVariations ? "Drafting…" : "Draft 3 variations →"}
          <span
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
          >
            4× credits
          </span>
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ marginTop: 10, fontSize: 13, color: "var(--coral)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function VariationReview({
  variants,
  onEdit,
  onRemove,
  onRunAll,
  onCancel,
  error,
  personaCap,
}: {
  variants: VariantRun[];
  onEdit: (id: string, post: string) => void;
  onRemove: (id: string) => void;
  onRunAll: () => void;
  onCancel: () => void;
  error: string | null;
  personaCap: number;
}) {
  const totalCredits = variants.length * personaCap * SIMULATION_ROUNDS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {variants.map((v, i) => (
        <VariationCard
          key={v.id}
          variant={v}
          index={i}
          canRemove={variants.length > 1}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={onRunAll}
          disabled={variants.length === 0}
          style={{
            background: "var(--ink)",
            color: "var(--butter-deep)",
            border: "none",
            borderRadius: 999,
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 500,
            minHeight: 40,
            cursor: variants.length === 0 ? "not-allowed" : "pointer",
            opacity: variants.length === 0 ? 0.55 : 1,
          }}
        >
          Run all {variants.length} →
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            borderRadius: 999,
            padding: "10px 18px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
            marginLeft: "auto",
          }}
        >
          ~{totalCredits.toLocaleString()} credits total
        </span>
      </div>

      {error ? (
        <p role="alert" style={{ fontSize: 13, color: "var(--coral)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Dot({ pulse }: { pulse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: "currentColor",
        animation: pulse ? "pulse-soft 1.4s ease-in-out infinite" : "none",
      }}
    />
  );
}

function VariationCard({
  variant,
  index,
  canRemove,
  onEdit,
  onRemove,
}: {
  variant: VariantRun;
  index: number;
  canRemove: boolean;
  onEdit: (id: string, post: string) => void;
  onRemove: (id: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-size the textarea so the full draft is visible without an inner
  // scroll bar — feels more like document editing than form filling.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [variant.post]);

  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        transition: "border-color 200ms cubic-bezier(0.215, 0.61, 0.355, 1)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: index === 0 ? "var(--text-secondary)" : "var(--accent)",
          }}
        >
          {index === 0 ? "Your draft" : `Variant ${index}`}
        </span>
        {index !== 0 ? (
          <strong
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 17,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
              fontWeight: 500,
            }}
          >
            {variant.label}
          </strong>
        ) : null}
        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(variant.id)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              fontSize: 11,
              fontFamily: "var(--font-data), monospace",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 6,
              transition: "color 150ms ease, background 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--coral)";
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--coral-muted)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-tertiary)";
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
            }}
            aria-label="Remove variant"
          >
            Remove
          </button>
        ) : null}
      </div>

      {variant.hook && index !== 0 ? (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 10,
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          {variant.hook}
        </p>
      ) : null}

      <textarea
        ref={textareaRef}
        value={variant.post}
        onChange={(e) => onEdit(variant.id, e.target.value)}
        maxLength={2000}
        aria-label={`Edit ${variant.label}`}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid transparent",
          background: "var(--bg-subtle)",
          fontFamily: "var(--font-body), system-ui, sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text-primary)",
          outline: "none",
          resize: "none",
          overflow: "hidden",
          minHeight: 72,
          transition:
            "border-color 200ms ease, background 200ms ease",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--border-hover)";
          e.currentTarget.style.background = "var(--surface)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.background = "var(--bg-subtle)";
        }}
      />

      {variant.rationale && index !== 0 ? (
        <p
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-tertiary)",
            lineHeight: 1.55,
          }}
        >
          {variant.rationale}
        </p>
      ) : null}
    </div>
  );
}

function VariantList({
  variants,
  platform,
  showLabel,
}: {
  variants: VariantRun[];
  platform: Platform;
  showLabel: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {variants.map((v, i) => (
        <VariantCard
          key={v.id}
          variant={v}
          index={i}
          platform={platform}
          showLabel={showLabel}
        />
      ))}
    </div>
  );
}

function VariantCard({
  variant,
  index,
  platform,
  showLabel,
}: {
  variant: VariantRun;
  index: number;
  platform: Platform;
  showLabel: boolean;
}) {
  const breakdown = sentimentBreakdown(variant.thread);
  const isComplete = variant.status === "completed";
  const isFailed = variant.status === "failed";
  const wouldRatio =
    isComplete && breakdown.hostile + breakdown.negative > breakdown.positive;

  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {showLabel ? (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-data), monospace",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: index === 0 ? "var(--text-secondary)" : "var(--accent)",
              }}
            >
              {index === 0 ? "Your draft" : `Variant ${index}`}
            </span>
            {index !== 0 ? (
              <strong
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 17,
                  letterSpacing: "-0.01em",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {variant.label}
              </strong>
            ) : null}
          </div>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-data), monospace",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
          >
            Live thread
          </span>
        )}

        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-data), monospace",
            fontSize: 10,
            letterSpacing: "0.06em",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            color:
              variant.status === "completed"
                ? "var(--mint)"
                : variant.status === "failed"
                  ? "var(--coral)"
                  : "var(--accent)",
            background:
              variant.status === "completed"
                ? "var(--mint-muted)"
                : variant.status === "failed"
                  ? "var(--coral-muted)"
                  : "var(--accent-muted)",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {variant.status === "queued" ? (
            <>
              <Dot />
              queued
            </>
          ) : variant.status === "running" ? (
            <>
              <Dot pulse />
              running · {variant.thread.length}
            </>
          ) : variant.status === "completed" ? (
            <>done · {variant.thread.length} replies</>
          ) : variant.status === "failed" ? (
            "failed"
          ) : (
            "idle"
          )}
        </span>
      </div>

      {showLabel ? (
        <p
          style={{
            marginTop: 14,
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 17,
            lineHeight: 1.5,
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
            letterSpacing: "-0.005em",
          }}
        >
          {variant.post}
        </p>
      ) : null}

      <div
        className="tabular-nums"
        style={{
          marginTop: 12,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          fontFamily: "var(--font-data), monospace",
          fontSize: 12,
          color: "var(--text-tertiary)",
        }}
      >
        <Stat count={breakdown.positive} label="positive" color={SENTIMENT_COLORS.positive} />
        <Stat count={breakdown.neutral} label="neutral" color={SENTIMENT_COLORS.neutral} />
        <Stat count={breakdown.negative} label="negative" color={SENTIMENT_COLORS.negative} />
        <Stat count={breakdown.hostile} label="hostile" color={SENTIMENT_COLORS.hostile} />
        {variant.aggression ? (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--bg-subtle)",
              color: "var(--text-secondary)",
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {variant.aggression}
          </span>
        ) : null}
      </div>

      {variant.thread.length > 0 ? (
        <details style={{ marginTop: 12 }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-data), monospace",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            View thread ({variant.thread.length})
          </summary>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 360,
              overflowY: "auto",
              paddingRight: 6,
            }}
          >
            {variant.thread.map((msg, i) => (
              <div
                key={msg.id ?? `${msg.agent_id}-${msg.round}-${i}`}
                style={{
                  padding: "8px 10px",
                  background: "var(--bg-subtle)",
                  borderRadius: 10,
                  borderLeft: `3px solid ${SENTIMENT_COLORS[msg.sentiment]}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    fontFamily: "var(--font-data), monospace",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {formatHandle(platform, msg.archetype)}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                    R{msg.round}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      color: SENTIMENT_COLORS[msg.sentiment],
                      textTransform: "uppercase",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {SENTIMENT_LABELS[msg.sentiment]}
                  </span>
                </div>
                <p
                  style={{
                    marginTop: 5,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--text-primary)",
                  }}
                >
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {isFailed && variant.error ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--coral)" }}>
          {variant.error}
        </p>
      ) : null}

      {isComplete && showLabel ? (
        <div style={{ marginTop: 12 }}>
          <span
            style={{
              fontSize: 12,
              color: wouldRatio ? "var(--coral)" : "var(--mint)",
              fontFamily: "var(--font-data), monospace",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {wouldRatio ? "Would ratio" : "Ships clean"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function VariationComparison({ variants }: { variants: VariantRun[] }) {
  const completed = variants.filter((v) => v.status === "completed");
  if (completed.length === 0) return null;

  const ranked = [...completed].sort(
    (a, b) => variantScore(a) - variantScore(b)
  );
  const winner = ranked[0];
  const winnerIndex = variants.findIndex((v) => v.id === winner.id);

  return (
    <div
      style={{
        padding: "22px 24px",
        background: "var(--ink)",
        color: "rgba(245, 244, 242, 0.95)",
        borderRadius: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span className="mono-label" style={{ color: "var(--butter-deep)" }}>
          RECOMMENDATION
        </span>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-data), monospace",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(245, 244, 242, 0.55)",
          }}
        >
          {completed.length} variants compared
        </span>
      </div>
      <p
        style={{
          marginTop: 12,
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          fontSize: "clamp(18px, 2.2vw, 22px)",
          lineHeight: 1.35,
          color: "rgba(245, 244, 242, 0.92)",
        }}
      >
        Ship{" "}
        <strong style={{ color: "var(--butter-deep)" }}>
          {winnerIndex === 0 ? "the original" : `Variant ${winnerIndex}`}
          {winner.label && winnerIndex !== 0 ? ` — ${winner.label}` : ""}
        </strong>
        . It draws the cleanest reaction from this audience.
      </p>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {ranked.map((v) => {
          const idx = variants.findIndex((x) => x.id === v.id);
          const b = sentimentBreakdown(v.thread);
          const total = v.thread.length || 1;
          const bad = ((b.hostile + b.negative) / total) * 100;
          return (
            <div
              key={v.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 10,
                background:
                  v.id === winner.id
                    ? "rgba(245, 230, 184, 0.12)"
                    : "rgba(245, 244, 242, 0.04)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data), monospace",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color:
                    v.id === winner.id
                      ? "var(--butter-deep)"
                      : "rgba(245, 244, 242, 0.55)",
                  minWidth: 80,
                }}
              >
                {idx === 0 ? "Original" : `Variant ${idx}`}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "rgba(245, 244, 242, 0.85)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={v.label}
              >
                {v.label}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-data), monospace",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: "rgba(245, 244, 242, 0.65)",
                }}
              >
                {bad.toFixed(0)}% negative
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-data), monospace",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: "rgba(245, 244, 242, 0.65)",
                }}
              >
                {v.aggression ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ color, fontWeight: 600 }}>{count}</span>
      <span>{label}</span>
    </span>
  );
}

// =====================================================================
// Markdown report
// =====================================================================

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function affinityWord(affinity: number): string {
  if (affinity <= -0.4) return "skeptical";
  if (affinity <= -0.1) return "cool";
  if (affinity < 0.15) return "neutral";
  if (affinity < 0.45) return "warm";
  return "supportive";
}

function buildReportHtml(
  chat: ChatState,
  analysis: ChatAnalysis | null
): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const audienceName = chat.audienceName ?? "—";
  const platformLabel = chat.platform ? PLATFORM_LABELS[chat.platform] : "—";
  const personaCount = Math.min(
    chat.personaCap,
    chat.audienceRowCount ?? chat.personaCap
  );

  const archetypes = summariseArchetypes(chat.audiencePersonas).slice(0, 6);
  const audienceTone =
    chat.audiencePersonas.length > 0
      ? affinityWord(avgAffinity(chat.audiencePersonas))
      : null;

  const completed = chat.variants.filter((v) => v.status === "completed");

  // Pick which variant to feature. If Claude returned an analysis, use its
  // recommendedIndex. Otherwise fall back to lowest-score completed variant.
  let recommendedIdx = 0;
  if (analysis && analysis.recommendedIndex >= 0) {
    recommendedIdx = analysis.recommendedIndex;
  } else if (completed.length > 0) {
    const ranked = [...completed].sort(
      (a, b) => variantScore(a) - variantScore(b)
    );
    recommendedIdx = chat.variants.findIndex((v) => v.id === ranked[0].id);
  }
  const recommended =
    chat.variants[recommendedIdx] ?? chat.variants[0] ?? null;

  const recommendedHeadline =
    analysis?.recommendedHeadline ??
    (recommendedIdx === 0
      ? "Ship the original"
      : `Ship Variant ${recommendedIdx}${
          recommended?.label && recommendedIdx !== 0
            ? ` — ${recommended.label}`
            : ""
        }`);

  const sectionRecommendation =
    recommended && recommended.status === "completed"
      ? buildRecommendationSection({
          recommended,
          recommendedIdx,
          recommendedHeadline,
          analysis,
        })
      : "";

  const sectionAlternates =
    completed.length > 1
      ? buildAlternatesSection({
          chat,
          completed,
          recommendedId: recommended?.id ?? null,
          analysis,
        })
      : "";

  const sectionEvidence = buildEvidenceSection({
    chat,
    completed,
    recommendedId: recommended?.id ?? null,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Atharias simulation analysis — ${escapeHtml(audienceName)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  :root {
    --ink: #141413;
    --butter: #E8D27A;
    --bg: #FAF9F7;
    --surface: #FFFFFF;
    --border: #E5E2DC;
    --text: #1A1A1A;
    --muted: #6B6B6B;
    --tertiary: #9E9E9E;
    --mint: #34D399;
    --coral: #C8552B;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
  body { font-family: -apple-system, "PP Neue Montreal", BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; font-size: 13px; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 720px; margin: 0 auto; padding: 32px 0 48px; }
  header.brand { display: flex; align-items: center; gap: 16px; padding-bottom: 22px; border-bottom: 1px solid var(--border); }
  header.brand img { width: 56px; height: 56px; object-fit: contain; }
  header.brand .word { font-family: "Fraunces", Georgia, serif; font-size: 30px; letter-spacing: -0.02em; color: var(--text); margin: 0; font-weight: 500; }
  header.brand .tag { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--tertiary); }
  .meta-line { margin-top: 12px; font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tertiary); }
  .meta-line strong { color: var(--text); font-weight: 500; }

  /* Recommendation hero */
  .hero { margin-top: 28px; padding: 32px 32px 30px; background: var(--ink); color: rgba(245, 244, 242, 0.95); border-radius: 18px; page-break-inside: avoid; }
  .hero .eyebrow { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--butter); }
  .hero h1 { font-family: "Fraunces", Georgia, serif; font-size: 30px; letter-spacing: -0.02em; line-height: 1.15; margin: 12px 0 18px; font-weight: 500; }
  .hero h1 em { color: var(--butter); font-style: italic; font-weight: 400; }
  .hero .post-card { background: rgba(245, 244, 242, 0.07); border: 1px solid rgba(245, 244, 242, 0.14); border-radius: 12px; padding: 18px 20px; font-family: "Fraunces", Georgia, serif; font-size: 16px; line-height: 1.55; color: rgba(245, 244, 242, 0.95); white-space: pre-wrap; }
  .hero .why-block { margin-top: 22px; }
  .hero .why-label { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(245, 244, 242, 0.5); margin-bottom: 6px; }
  .hero .why-text { font-size: 14px; line-height: 1.6; color: rgba(245, 244, 242, 0.9); margin: 0; }
  .hero .breakdown { margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(245, 244, 242, 0.12); display: flex; flex-wrap: wrap; gap: 22px; font-family: "SF Mono", Menlo, monospace; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(245, 244, 242, 0.55); }
  .hero .breakdown strong { color: rgba(245, 244, 242, 0.95); font-weight: 600; }

  /* Standard sections */
  .section { margin-top: 32px; padding: 24px 26px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; page-break-inside: avoid; }
  .section .eyebrow { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tertiary); }
  .section h2 { font-family: "Fraunces", Georgia, serif; font-size: 21px; letter-spacing: -0.02em; line-height: 1.2; margin: 8px 0 14px; font-weight: 500; }
  .section p { margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: var(--text); }
  .section p:last-child { margin-bottom: 0; }

  /* Risk list */
  ul.risks { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  ul.risks li { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; background: var(--bg); border-radius: 10px; font-size: 13px; line-height: 1.55; color: var(--text); }
  ul.risks li::before { content: "▲"; color: var(--coral); font-size: 9px; line-height: 22px; flex-shrink: 0; }

  /* Alternates */
  .alternates { margin-top: 32px; }
  .alternates h2 { font-family: "Fraunces", Georgia, serif; font-size: 19px; letter-spacing: -0.02em; margin: 0 0 16px; font-weight: 500; color: var(--text); }
  .alt-card { padding: 18px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; page-break-inside: avoid; }
  .alt-card .alt-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
  .alt-card .alt-eyebrow { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tertiary); }
  .alt-card .alt-label { font-family: "Fraunces", Georgia, serif; font-size: 16px; font-weight: 500; color: var(--text); }
  .alt-card .alt-stat { margin-left: auto; font-family: "SF Mono", Menlo, monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--coral); text-transform: uppercase; }
  .alt-card .alt-post { font-family: "Fraunces", Georgia, serif; font-size: 14px; line-height: 1.5; color: var(--muted); padding: 10px 12px; background: var(--bg); border-radius: 8px; margin: 0 0 10px; white-space: pre-wrap; }
  .alt-card .alt-summary { font-size: 13px; line-height: 1.55; color: var(--text); margin: 0; }

  /* Evidence appendix */
  .evidence { margin-top: 36px; padding-top: 22px; border-top: 1px solid var(--border); }
  .evidence .eyebrow { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tertiary); margin-bottom: 12px; display: block; }
  .ev-row { padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .ev-row .ev-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .ev-row .ev-eyebrow { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tertiary); }
  .ev-row .ev-label { font-size: 13px; font-weight: 500; color: var(--text); }
  .ev-row.is-winner { background: rgba(232, 210, 122, 0.12); border-color: rgba(232, 210, 122, 0.4); }
  .ev-row.is-winner .ev-eyebrow { color: var(--ink); }
  .bars { display: flex; flex-direction: column; gap: 6px; }
  .bar { display: grid; grid-template-columns: 80px 1fr 32px; align-items: center; gap: 10px; font-size: 11px; color: var(--muted); font-family: "SF Mono", Menlo, monospace; letter-spacing: 0.04em; text-transform: uppercase; }
  .bar-track { height: 5px; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 999px; }
  .bar-count { text-align: right; color: var(--text); font-weight: 600; }

  /* Audience strip */
  .audience-strip { margin-top: 22px; padding: 16px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
  .audience-strip .eyebrow { font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tertiary); }
  .audience-strip .name { font-family: "Fraunces", Georgia, serif; font-size: 17px; font-weight: 500; margin-top: 6px; color: var(--text); }
  .audience-strip .meta { margin-top: 8px; font-size: 12px; color: var(--muted); display: flex; gap: 14px; flex-wrap: wrap; font-family: "SF Mono", Menlo, monospace; letter-spacing: 0.04em; text-transform: uppercase; }
  .audience-strip .chips { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
  .audience-strip .chips li { padding: 3px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; font-size: 11px; color: var(--text); list-style: none; }
  .audience-strip .chips li .count { color: var(--tertiary); margin-left: 6px; font-family: "SF Mono", Menlo, monospace; font-size: 10px; }

  footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-family: "SF Mono", Menlo, monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tertiary); }
  .actions { display: flex; gap: 8px; margin-top: 22px; }
  .actions button { padding: 8px 16px; border-radius: 999px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
  .actions .save { background: var(--ink); color: var(--butter); }
  .actions .close { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  @media print {
    .actions { display: none; }
    .page { padding: 0; }
    body { background: white; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="brand">
    <img src="${typeof window !== "undefined" ? window.location.origin : ""}/mascot/lion.png" alt="Atharias mascot" />
    <div>
      <h1 class="word">Atharias</h1>
      <span class="tag">Simulation Analysis · ${escapeHtml(date)}</span>
    </div>
  </header>

  <p class="meta-line">For <strong>${escapeHtml(audienceName)}</strong> on <strong>${escapeHtml(platformLabel)}</strong> · ${personaCount}${chat.audienceRowCount ? `/${chat.audienceRowCount}` : ""} personas tested${chat.variants.length > 1 ? ` · ${chat.variants.length} drafts compared` : ""}</p>

  ${sectionRecommendation}

  <div class="audience-strip">
    <span class="eyebrow">Audience</span>
    <div class="name">${escapeHtml(audienceName)}</div>
    <div class="meta">
      <span>${chat.audienceRowCount ?? chat.audiencePersonas.length} personas</span>
      ${audienceTone ? `<span>Skews ${escapeHtml(audienceTone)}</span>` : ""}
      <span>${escapeHtml(platformLabel)}</span>
    </div>
    ${
      archetypes.length > 0
        ? `<ul class="chips">${archetypes
            .map(
              (a) =>
                `<li>${escapeHtml(a.archetype)}<span class="count">×${a.count}</span></li>`
            )
            .join("")}</ul>`
        : ""
    }
  </div>

  ${sectionAlternates}

  ${sectionEvidence}

  <footer>
    <span>Atharias · Social Simulation Engine</span>
    <span>${escapeHtml(date)}</span>
  </footer>

  <div class="actions">
    <button class="save" onclick="window.print()">Save as PDF</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
</div>
<script>
  window.addEventListener("load", function () {
    setTimeout(function () { window.print(); }, 350);
  });
</script>
</body>
</html>`;
}

function buildRecommendationSection({
  recommended,
  recommendedIdx,
  recommendedHeadline,
  analysis,
}: {
  recommended: VariantRun;
  recommendedIdx: number;
  recommendedHeadline: string;
  analysis: ChatAnalysis | null;
}): string {
  const breakdown = sentimentBreakdown(recommended.thread);
  const total = recommended.thread.length || 1;
  const positivePct = ((breakdown.positive / total) * 100).toFixed(0);
  const negativePct = ((breakdown.negative / total) * 100).toFixed(0);
  const hostilePct = ((breakdown.hostile / total) * 100).toFixed(0);

  const headline = analysis?.recommendedHeadline ?? recommendedHeadline;
  const headlineHtml = (() => {
    // Highlight everything after "Ship " in butter italic.
    const match = headline.match(/^(Ship\s+)(.+)$/i);
    if (match) {
      return `${escapeHtml(match[1])}<em>${escapeHtml(match[2])}</em>`;
    }
    return `<em>${escapeHtml(headline)}</em>`;
  })();

  const whyHtml = analysis?.whyThisWins
    ? `<div class="why-block">
        <div class="why-label">Why this draft wins</div>
        <p class="why-text">${escapeHtml(analysis.whyThisWins)}</p>
      </div>`
    : "";

  const expectationHtml = analysis?.expectedReaction
    ? `<div class="why-block">
        <div class="why-label">What to expect when you ship it</div>
        <p class="why-text">${escapeHtml(analysis.expectedReaction)}</p>
      </div>`
    : "";

  const risksHtml =
    analysis?.risksToWatch && analysis.risksToWatch.length > 0
      ? `<section class="section">
          <span class="eyebrow">Risks to watch</span>
          <h2>Where the pushback comes from</h2>
          <ul class="risks">
            ${analysis.risksToWatch
              .map((r) => `<li>${escapeHtml(r)}</li>`)
              .join("")}
          </ul>
        </section>`
      : "";

  return `
    <section class="hero">
      <span class="eyebrow">Recommendation${recommendedIdx === 0 ? "" : ` · Variant ${recommendedIdx}`}</span>
      <h1>${headlineHtml}</h1>
      <div class="post-card">${escapeHtml(recommended.post)}</div>
      ${whyHtml}
      ${expectationHtml}
      <div class="breakdown">
        <span><strong>${recommended.thread.length}</strong> total replies</span>
        <span><strong>${positivePct}%</strong> positive</span>
        <span><strong>${negativePct}%</strong> negative</span>
        <span><strong>${hostilePct}%</strong> hostile</span>
        ${recommended.aggression ? `<span><strong>${escapeHtml(recommended.aggression)}</strong> aggression</span>` : ""}
      </div>
    </section>
    ${risksHtml}
  `;
}

function buildAlternatesSection({
  chat,
  completed,
  recommendedId,
  analysis,
}: {
  chat: ChatState;
  completed: VariantRun[];
  recommendedId: string | null;
  analysis: ChatAnalysis | null;
}): string {
  const others = completed.filter((v) => v.id !== recommendedId);
  if (others.length === 0) return "";

  const altNoteByIndex = new Map<number, string>();
  if (analysis) {
    for (const note of analysis.alternateNotes) {
      altNoteByIndex.set(note.index, note.summary);
    }
  }

  const cards = others
    .map((v) => {
      const idx = chat.variants.findIndex((x) => x.id === v.id);
      const b = sentimentBreakdown(v.thread);
      const total = v.thread.length || 1;
      const bad = (((b.hostile + b.negative) / total) * 100).toFixed(0);
      const summary = altNoteByIndex.get(idx);
      return `
        <div class="alt-card">
          <div class="alt-head">
            <span class="alt-eyebrow">${idx === 0 ? "Original" : `Variant ${idx}`}</span>
            <span class="alt-label">${escapeHtml(v.label)}</span>
            <span class="alt-stat">${bad}% negative + hostile</span>
          </div>
          <p class="alt-post">${escapeHtml(v.post)}</p>
          ${summary ? `<p class="alt-summary">${escapeHtml(summary)}</p>` : ""}
        </div>`;
    })
    .join("");

  return `
    <div class="alternates">
      <h2>Why not the others</h2>
      ${cards}
    </div>`;
}

function buildEvidenceSection({
  chat,
  completed,
  recommendedId,
}: {
  chat: ChatState;
  completed: VariantRun[];
  recommendedId: string | null;
}): string {
  if (completed.length === 0) return "";

  const rows = completed
    .map((v) => {
      const idx = chat.variants.findIndex((x) => x.id === v.id);
      const b = sentimentBreakdown(v.thread);
      const total = v.thread.length || 1;
      const isWinner = v.id === recommendedId;
      const bars = `
        <div class="bars">
          <div class="bar"><span class="bar-label">Positive</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(b.positive / total) * 100}%; background:#1F8A55"></span></span>
            <span class="bar-count">${b.positive}</span>
          </div>
          <div class="bar"><span class="bar-label">Neutral</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(b.neutral / total) * 100}%; background:#9E9E9E"></span></span>
            <span class="bar-count">${b.neutral}</span>
          </div>
          <div class="bar"><span class="bar-label">Negative</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(b.negative / total) * 100}%; background:#C8552B"></span></span>
            <span class="bar-count">${b.negative}</span>
          </div>
          <div class="bar"><span class="bar-label">Hostile</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(b.hostile / total) * 100}%; background:#B23226"></span></span>
            <span class="bar-count">${b.hostile}</span>
          </div>
        </div>`;
      return `
        <div class="ev-row${isWinner ? " is-winner" : ""}">
          <div class="ev-head">
            <span class="ev-eyebrow">${idx === 0 ? "Original" : `Variant ${idx}`}${isWinner ? " · Recommended" : ""}</span>
            <span class="ev-label">${escapeHtml(v.label)}</span>
          </div>
          ${bars}
        </div>`;
    })
    .join("");

  return `
    <section class="evidence">
      <span class="eyebrow">Sentiment breakdown · per draft</span>
      ${rows}
    </section>`;
}

function buildReportMarkdown(chat: ChatState): string {
  const lines: string[] = [];
  const date = new Date().toISOString().slice(0, 10);
  lines.push(`# Atharias simulation report`);
  lines.push("");
  lines.push(`**Audience:** ${chat.audienceName ?? "—"}`);
  lines.push(`**Platform:** ${chat.platform ? PLATFORM_LABELS[chat.platform] : "—"}`);
  lines.push(`**Personas tested:** ${Math.min(chat.personaCap, chat.audiencePersonas.length)} of ${chat.audiencePersonas.length}`);
  lines.push(`**Generated:** ${date}`);
  lines.push("");

  if (chat.audiencePersonas.length > 0) {
    const archetypes = summariseArchetypes(chat.audiencePersonas).slice(0, 8);
    lines.push("## Audience composition");
    lines.push("");
    for (const a of archetypes) {
      lines.push(`- **${a.archetype}** — ${a.count}`);
    }
    lines.push("");
  }

  if (chat.variants.length === 0) {
    lines.push("No simulations were run in this chat.");
    return lines.join("\n");
  }

  if (chat.mode === "variations" && chat.variants.length > 1) {
    const completed = chat.variants.filter((v) => v.status === "completed");
    if (completed.length > 0) {
      const ranked = [...completed].sort(
        (a, b) => variantScore(a) - variantScore(b)
      );
      const winner = ranked[0];
      const winnerIdx = chat.variants.findIndex((v) => v.id === winner.id);
      lines.push("## Recommendation");
      lines.push("");
      lines.push(
        `Ship **${winnerIdx === 0 ? "the original" : `Variant ${winnerIdx}`}${winner.label && winnerIdx !== 0 ? ` — ${winner.label}` : ""}**. It draws the cleanest reaction from this audience.`
      );
      lines.push("");
      lines.push("| Variant | Negative share | Aggression | Replies |");
      lines.push("| --- | ---: | --- | ---: |");
      for (const v of ranked) {
        const idx = chat.variants.findIndex((x) => x.id === v.id);
        const b = sentimentBreakdown(v.thread);
        const total = v.thread.length || 1;
        const bad = (((b.hostile + b.negative) / total) * 100).toFixed(0);
        lines.push(
          `| ${idx === 0 ? "Original" : `Variant ${idx}`} (${v.label}) | ${bad}% | ${v.aggression ?? "—"} | ${v.thread.length} |`
        );
      }
      lines.push("");
    }
  }

  for (let i = 0; i < chat.variants.length; i++) {
    const v = chat.variants[i];
    const heading =
      chat.mode === "variations"
        ? `${i === 0 ? "Original" : `Variant ${i}`} — ${v.label}`
        : "Simulation";
    lines.push(`## ${heading}`);
    lines.push("");
    if (v.hook) {
      lines.push(`> ${v.hook}`);
      lines.push("");
    }
    lines.push("**Post:**");
    lines.push("");
    lines.push("```");
    lines.push(v.post);
    lines.push("```");
    lines.push("");

    if (v.status !== "completed") {
      lines.push(`*Status: ${v.status}${v.error ? ` — ${v.error}` : ""}*`);
      lines.push("");
      continue;
    }

    const b = sentimentBreakdown(v.thread);
    lines.push(
      `**Sentiment:** ${b.positive} positive · ${b.neutral} neutral · ${b.negative} negative · ${b.hostile} hostile`
    );
    lines.push(
      `**Replies:** ${v.thread.length}${v.aggression ? ` · **Aggression:** ${v.aggression}` : ""}`
    );
    lines.push("");

    if (v.simulationId) {
      lines.push(`Shareable view: \`/sim/${v.simulationId}\``);
      lines.push("");
    }

    lines.push("### Thread");
    lines.push("");
    for (const msg of v.thread) {
      const handle = formatHandle(chat.platform ?? "twitter", msg.archetype);
      lines.push(`- \`${handle}\` *(R${msg.round}, ${msg.sentiment})*: ${msg.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmModalState;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && state.kind === "confirm") state.onConfirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 4vw, 48px)",
      }}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(20, 20, 19, 0.42)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          background: "var(--surface)",
          borderRadius: 20,
          padding: "28px 28px 24px",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.04), 0 12px 36px rgba(20,20,19,0.18), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "var(--text-primary)",
          }}
        >
          {state.title}
        </h2>
        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
          }}
        >
          {state.message}
        </p>
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          {state.kind === "confirm" && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "9px 18px",
                fontSize: 14,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => {
              if (state.kind === "confirm") state.onConfirm();
              else onClose();
            }}
            style={{
              background:
                state.kind === "confirm" ? "#B3261E" : "var(--ink)",
              color: state.kind === "confirm" ? "#FFF" : "var(--butter-deep)",
              border: "none",
              borderRadius: 999,
              padding: "9px 20px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {state.kind === "confirm" ? state.confirmLabel : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
