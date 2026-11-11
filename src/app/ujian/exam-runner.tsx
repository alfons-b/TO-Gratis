"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TriangleAlert,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Eraser,
  Grid3x3,
  LoaderCircle,
  Send,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getDeviceId } from "@/lib/device";
import { errorMessage } from "@/lib/errors";
import { clearSession, getPending, putPending, removeIfUnchanged } from "@/lib/offline-queue";
import { createClient } from "@/lib/supabase/client";
import { OPTION_KEYS, type ExamQuestion, type OptionKey } from "@/lib/types";
import { cn, formatCountdown, SUBTEST_RANGES } from "@/lib/utils";

type Phase = "loading" | "active" | "locked" | "finishing" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

interface SessionState {
  state: "none" | "finished" | "locked" | "inactive" | "active" | "unauthenticated";
  session_id?: string;
  deadline_at?: string;
  server_now?: string;
  exam_title?: string;
  answers?: Record<string, OptionKey>;
}

const HEARTBEAT_MS = 30_000;
const RETRY_MS = 5_000;

export function ExamRunner({ participantName }: { participantName: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<Phase>("loading");
  const [fatal, setFatal] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, OptionKey | null>>({});
  const [index, setIndex] = useState(0);
  const [save, setSave] = useState<SaveStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const deviceRef = useRef<string>("");
  const sessionRef = useRef<string | null>(null);
  const deadlineRef = useRef<number>(0);
  const offsetRef = useRef<number>(0); // serverTime - clientTime
  const flushingRef = useRef(false);
  const flushAgainRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);
  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;

  const serverNow = () => Date.now() + offsetRef.current;

  const syncClock = (serverIso: string | undefined, t0: number, t1: number) => {
    if (!serverIso) return;
    offsetRef.current = new Date(serverIso).getTime() - (t0 + t1) / 2;
  };

  const goResult = useCallback(async () => {
    if (sessionRef.current) await clearSession(sessionRef.current);
    router.replace("/peserta/hasil");
    router.refresh();
  }, [router]);

  const refreshPendingCount = useCallback(async () => {
    if (!sessionRef.current) return 0;
    const p = await getPending(sessionRef.current);
    setPendingCount(p.length);
    return p.length;
  }, []);

  // ---------- Sinkronisasi jawaban ----------
  const flush = useCallback(async (): Promise<boolean> => {
    const sid = sessionRef.current;
    if (!sid) return false;
    if (flushingRef.current) {
      flushAgainRef.current = true;
      return false;
    }
    flushingRef.current = true;
    let success = true;
    try {
      for (let i = 0; i < 5; i++) {
        flushAgainRef.current = false;
        const pending = await getPending(sid);
        if (pending.length === 0) {
          setSave((s) => (s === "idle" ? "idle" : "saved"));
          break;
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setSave("offline");
          success = false;
          break;
        }
        setSave("saving");
        const t0 = Date.now();
        const { data, error } = await supabase.rpc("save_answers", {
          p_session_id: sid,
          p_device_id: deviceRef.current,
          p_items: pending.map((p) => ({
            question_id: p.questionId,
            option: p.option,
            client_ts: p.clientTs,
          })),
        });
        const t1 = Date.now();
        const res = data as { ok: boolean; error?: string; server_now?: string } | null;
        if (error || !res) {
          setSave(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
          success = false;
          break;
        }
        if (!res.ok) {
          success = false;
          if (res.error === "SESSION_CLOSED" || res.error === "NOT_FOUND") {
            void goResult();
          } else if (res.error === "DEVICE_MISMATCH") {
            setPhase("locked");
          } else {
            setSave("error");
          }
          break;
        }
        syncClock(res.server_now, t0, t1);
        await removeIfUnchanged(pending);
        if (!flushAgainRef.current) {
          const left = await getPending(sid);
          if (left.length === 0) {
            setSave("saved");
            break;
          }
        }
      }
    } finally {
      flushingRef.current = false;
      await refreshPendingCount();
    }
    if (!success && phaseRef.current === "active" && !retryTimerRef.current) {
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void flush();
      }, RETRY_MS);
    }
    return success;
  }, [supabase, goResult, refreshPendingCount]);

  const scheduleFlush = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void flush(), 250);
  }, [flush]);

  // ---------- Inisialisasi ----------
  const init = useCallback(async () => {
    setPhase("loading");
    setFatal(null);
    deviceRef.current = getDeviceId();
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("get_session_state", { p_device_id: deviceRef.current });
    const t1 = Date.now();
    if (error) {
      setFatal("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
      setPhase("error");
      return;
    }
    const st = data as SessionState;
    if (st.state === "none") return router.replace("/peserta");
    if (st.state === "finished") return router.replace("/peserta/hasil");
    if (st.state === "inactive" || st.state === "unauthenticated") return router.replace("/");
    if (st.state === "locked") {
      setPhase("locked");
      return;
    }

    sessionRef.current = st.session_id!;
    deadlineRef.current = new Date(st.deadline_at!).getTime();
    syncClock(st.server_now, t0, t1);
    setTitle(st.exam_title ?? "");

    const { data: qData, error: qErr } = await supabase.rpc("get_exam_questions", {
      p_session_id: st.session_id,
    });
    if (qErr) {
      setFatal("Gagal memuat soal. Coba muat ulang halaman.");
      setPhase("error");
      return;
    }
    const qs = (qData as ExamQuestion[]) ?? [];
    setQuestions(qs);

    const merged: Record<string, OptionKey | null> = { ...(st.answers ?? {}) };
    const pending = await getPending(st.session_id!);
    for (const p of pending) merged[p.questionId] = p.option;
    setAnswers(merged);
    setPendingCount(pending.length);

    // Lanjutkan dari soal pertama yang belum dijawab
    const firstEmpty = qs.findIndex((q) => !merged[q.id]);
    setIndex(firstEmpty >= 0 ? firstEmpty : 0);
    setRemaining(deadlineRef.current - (Date.now() + offsetRef.current));
    setPhase("active");
    if (pending.length) void flush();
  }, [supabase, router, flush]);

  useEffect(() => {
    void init();
  }, [init]);

  // ---------- Finalisasi ----------
  const finish = useCallback(
    async (manual: boolean) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setPhase("finishing");
      setSubmitError(null);
      const sid = sessionRef.current;
      if (!sid) return;

      await flush();
      const { data, error } = await supabase.rpc("submit_exam", {
        p_session_id: sid,
        p_device_id: deviceRef.current,
      });
      const res = data as { ok: boolean; error?: string } | null;
      if (!error && res?.ok) {
        await goResult();
        return;
      }
      finishingRef.current = false;
      if (res?.error === "DEVICE_MISMATCH") {
        setPhase("locked");
        return;
      }
      if (manual) {
        setPhase("active");
        setSubmitError(error ? "Gagal terhubung. Periksa koneksi lalu coba lagi." : errorMessage(res?.error));
      } else {
        // Waktu habis tetapi offline: server tetap akan menutup sesi pada deadline. Coba lagi.
        setTimeout(() => void finish(false), RETRY_MS);
      }
    },
    [flush, supabase, goResult],
  );

  // ---------- Timer (berbasis waktu server) ----------
  useEffect(() => {
    if (phase !== "active") return;
    const tick = () => {
      const left = deadlineRef.current - serverNow();
      setRemaining(left);
      if (left <= 0) void finish(false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finish]);

  // ---------- Heartbeat ----------
  const heartbeat = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid || phaseRef.current !== "active") return;
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("heartbeat", {
      p_session_id: sid,
      p_device_id: deviceRef.current,
    });
    const t1 = Date.now();
    if (error || !data) return;
    const hb = data as { status: string; device_ok?: boolean; deadline_at?: string; server_now?: string };
    syncClock(hb.server_now, t0, t1);
    if (hb.status === "finished" || hb.status === "not_found") {
      void goResult();
      return;
    }
    if (hb.device_ok === false) {
      setPhase("locked");
      return;
    }
    if (hb.deadline_at) deadlineRef.current = new Date(hb.deadline_at).getTime();
  }, [supabase, goResult]);

  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => {
      void heartbeat();
      void flush();
    }, HEARTBEAT_MS);
    const onOnline = () => void flush();
    const onOffline = () => setSave("offline");
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
        void flush();
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, heartbeat, flush]);

  // Peringatan saat menutup halaman dengan jawaban belum terkirim
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCount]);

  // ---------- Aksi menjawab ----------
  const choose = useCallback(
    async (questionId: string, option: OptionKey | null) => {
      const sid = sessionRef.current;
      if (!sid || phaseRef.current !== "active") return;
      setAnswers((a) => ({ ...a, [questionId]: option }));
      setSave("saving");
      await putPending({
        sessionId: sid,
        questionId,
        option,
        clientTs: new Date(serverNow()).toISOString(),
      });
      await refreshPendingCount();
      scheduleFlush();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleFlush, refreshPendingCount],
  );

  const answeredCount = useMemo(
    () => questions.reduce((n, q) => (answers[q.id] ? n + 1 : n), 0),
    [questions, answers],
  );

  // ---------- Tampilan status ----------
  if (phase === "loading") {
    return (
      <CenterMessage>
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <p>Memuat ujian…</p>
      </CenterMessage>
    );
  }
  if (phase === "error") {
    return (
      <CenterMessage>
        <TriangleAlert className="size-6 text-destructive" />
        <p>{fatal}</p>
        <Button onClick={() => void init()}>Coba lagi</Button>
      </CenterMessage>
    );
  }
  if (phase === "locked") {
    return (
      <CenterMessage>
        <TriangleAlert className="size-6 text-warning" />
        <p className="max-w-sm">
          Ujian Anda sedang aktif di perangkat atau browser lain. Lanjutkan di perangkat tersebut. Jika perangkat
          itu bermasalah, tutup ujian di sana, tunggu sekitar 2 menit, lalu tekan tombol di bawah.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => void init()}>Coba lagi</Button>
          <Button variant="outline" onClick={() => router.replace("/peserta")}>
            Kembali
          </Button>
        </div>
      </CenterMessage>
    );
  }

  const q = questions[index];
  if (!q) {
    return (
      <CenterMessage>
        <p>Soal tidak tersedia.</p>
      </CenterMessage>
    );
  }
  const selected = answers[q.id] ?? null;
  const lowTime = remaining !== null && remaining < 5 * 60_000;
  const unanswered = questions.filter((x) => !answers[x.id]).map((x) => x.number);

  const panel = (
    <NumberPanel
      questions={questions}
      answers={answers}
      currentIndex={index}
      onPick={(i) => {
        setIndex(i);
        setPanelOpen(false);
        window.scrollTo({ top: 0 });
      }}
    />
  );

  return (
    <div className="min-h-dvh pb-24 lg:pb-8">
      {/* Header tetap */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{participantName}</p>
          </div>
          <SaveIndicator status={save} pending={pendingCount} />
          <div
            className={cn(
              "rounded-md px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
              lowTime ? "bg-destructive text-white" : "bg-muted",
            )}
            aria-live="polite"
            title="Sisa waktu (waktu server)"
          >
            {remaining === null ? "--:--" : formatCountdown(remaining)}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[1fr_320px]">
        {/* Area soal */}
        <main className="min-w-0 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {q.subtest}
                </span>
                <span className="text-sm font-medium">
                  Soal {q.number} <span className="text-muted-foreground">/ 110</span>
                </span>
              </div>
              {selected ? (
                <button
                  type="button"
                  onClick={() => void choose(q.id, null)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Eraser className="size-3.5" /> Hapus jawaban
                </button>
              ) : null}
            </div>

            <div className="question-text text-base">{q.text}</div>

            {q.image_url ? (
              <div className="mt-4">
                {imgError[q.id] ? (
                  <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                    Gambar soal gagal dimuat. Periksa koneksi lalu{" "}
                    <button
                      type="button"
                      className="font-medium underline"
                      onClick={() => setImgError((m) => ({ ...m, [q.id]: false }))}
                    >
                      muat ulang gambar
                    </button>
                    .
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setZoom(q.image_url)}
                    className="group relative block w-full overflow-hidden rounded-md border border-border"
                    aria-label="Perbesar gambar"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={q.id + String(imgError[q.id])}
                      src={q.image_url}
                      alt={`Gambar soal nomor ${q.number}`}
                      loading="eager"
                      className="mx-auto max-h-[60vh] w-auto max-w-full"
                      onError={() => setImgError((m) => ({ ...m, [q.id]: true }))}
                    />
                    <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs text-white">
                      <ZoomIn className="size-3.5" /> Perbesar
                    </span>
                  </button>
                )}
              </div>
            ) : null}

            <div className="mt-6 space-y-2.5" role="radiogroup" aria-label={`Pilihan jawaban soal ${q.number}`}>
              {OPTION_KEYS.map((k) => {
                const active = selected === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void choose(q.id, k)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors sm:p-3.5",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                        active ? "border-primary bg-primary text-white" : "border-border",
                      )}
                    >
                      {k}
                    </span>
                    <span className="question-text pt-1 text-[15px]">{q.options[k]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          {/* Navigasi (desktop) */}
          <div className="hidden items-center justify-between gap-2 lg:flex">
            <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              <ChevronLeft /> Sebelumnya
            </Button>
            <Button variant="outline" disabled={index === questions.length - 1} onClick={() => setIndex((i) => i + 1)}>
              Berikutnya <ChevronRight />
            </Button>
          </div>
        </main>

        {/* Panel nomor (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span>
                Terjawab <b>{answeredCount}</b>
              </span>
              <span>
                Belum <b>{questions.length - answeredCount}</b>
              </span>
            </div>
            {panel}
            <Button className="w-full" onClick={() => setSubmitOpen(true)} disabled={phase === "finishing"}>
              <Send /> Kumpulkan ujian
            </Button>
          </div>
        </aside>
      </div>

      {/* Navigasi bawah (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-2 lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
          <Button variant="outline" size="lg" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} aria-label="Sebelumnya">
            <ChevronLeft />
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setPanelOpen(true)} aria-label="Daftar nomor soal">
            <Grid3x3 /> <span className="text-xs">{answeredCount}/110</span>
          </Button>
          <Button size="lg" onClick={() => setSubmitOpen(true)} disabled={phase === "finishing"} aria-label="Kumpulkan">
            <Send />
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={index === questions.length - 1}
            onClick={() => setIndex((i) => i + 1)}
            aria-label="Berikutnya"
          >
            <ChevronRight />
          </Button>
        </div>
      </nav>

      <Modal open={panelOpen} onClose={() => setPanelOpen(false)} title="Nomor soal">
        <div className="mb-3 flex justify-between text-sm">
          <span>
            Terjawab <b>{answeredCount}</b>
          </span>
          <span>
            Belum <b>{questions.length - answeredCount}</b>
          </span>
        </div>
        {panel}
      </Modal>

      <Modal open={submitOpen} onClose={() => phase !== "finishing" && setSubmitOpen(false)} title="Kumpulkan ujian?">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-semibold">{answeredCount}</p>
              <p className="text-xs text-muted-foreground">Terjawab</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-semibold">{questions.length - answeredCount}</p>
              <p className="text-xs text-muted-foreground">Belum dijawab</p>
            </div>
          </div>
          {unanswered.length ? (
            <p className="text-muted-foreground">
              Nomor belum dijawab: {unanswered.slice(0, 30).join(", ")}
              {unanswered.length > 30 ? `, dan ${unanswered.length - 30} lainnya` : ""}
            </p>
          ) : null}
          {pendingCount > 0 ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-2">
              {pendingCount} jawaban belum terkirim ke server. Sistem akan mencoba mengirimnya terlebih dahulu.
            </p>
          ) : null}
          <p className="font-medium text-destructive">
            Setelah dikumpulkan, jawaban tidak dapat diubah lagi.
          </p>
          {submitError ? <p className="text-destructive">{submitError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={phase === "finishing"}>
              Kembali
            </Button>
            <Button onClick={() => void finish(true)} disabled={phase === "finishing"}>
              {phase === "finishing" ? "Mengumpulkan…" : "Ya, kumpulkan"}
            </Button>
          </div>
        </div>
      </Modal>

      {zoom ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" onClick={() => setZoom(null)}>
          <div className="flex justify-end p-3">
            <Button variant="secondary" size="sm" onClick={() => setZoom(null)}>
              Tutup
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="Gambar soal diperbesar" className="mx-auto h-auto w-full max-w-none bg-white sm:w-auto sm:max-w-full" />
          </div>
        </div>
      ) : null}

      {phase === "finishing" && !submitOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-3 rounded-lg bg-card p-5 text-sm shadow-lg">
            <LoaderCircle className="size-5 animate-spin text-primary" />
            Waktu habis. Mengumpulkan jawaban…
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumberPanel({
  questions,
  answers,
  currentIndex,
  onPick,
}: {
  questions: ExamQuestion[];
  answers: Record<string, OptionKey | null>;
  currentIndex: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      {SUBTEST_RANGES.map((g) => (
        <div key={g.subtest}>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
            {g.subtest} {g.from}–{g.to}
          </p>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
            {questions.map((q, i) =>
              q.number >= g.from && q.number <= g.to ? (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onPick(i)}
                  aria-label={`Soal ${q.number}${answers[q.id] ? ", sudah dijawab" : ", belum dijawab"}`}
                  aria-current={i === currentIndex ? "true" : undefined}
                  className={cn(
                    "h-9 rounded-md border text-sm font-medium tabular-nums",
                    answers[q.id] ? "border-primary bg-primary text-white" : "border-border bg-background",
                    i === currentIndex && "ring-2 ring-warning ring-offset-1",
                  )}
                >
                  {q.number}
                </button>
              ) : null,
            )}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Legend className="border-primary bg-primary" label="Sudah dijawab" />
        <Legend className="border-border bg-background" label="Belum dijawab" />
        <Legend className="border-border bg-background ring-2 ring-warning" label="Soal aktif" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-3.5 rounded border", className)} /> {label}
    </span>
  );
}

function SaveIndicator({ status, pending }: { status: SaveStatus; pending: number }) {
  const map: Record<SaveStatus, { icon: React.ReactNode; text: string; cls: string }> = {
    idle: { icon: <CircleCheck className="size-4" />, text: "Siap", cls: "text-muted-foreground" },
    saving: { icon: <LoaderCircle className="size-4 animate-spin" />, text: "Menyimpan…", cls: "text-muted-foreground" },
    saved: { icon: <CircleCheck className="size-4" />, text: "Tersimpan", cls: "text-success" },
    error: { icon: <TriangleAlert className="size-4" />, text: "Gagal menyimpan", cls: "text-destructive" },
    offline: { icon: <CloudOff className="size-4" />, text: "Menunggu koneksi", cls: "text-warning" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", s.cls)} aria-live="polite" title={s.text}>
      {s.icon}
      <span className="hidden sm:inline">{s.text}</span>
      {pending > 0 && status !== "saving" ? <span>({pending})</span> : null}
    </span>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center text-sm">
      {children}
    </div>
  );
}
