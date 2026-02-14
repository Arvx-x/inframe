"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StudioHeader } from "@/app/components/StudioHeader";
import { AIPanel } from "@/app/components/AIPanel";
import { Button } from "@/app/components/ui/button";
import { ArrowLeft } from "lucide-react";

const STORAGE_KEY = "videogen:lastGeneratedVideo";

type Clip = {
  id: string;
  label: string;
  prompt: string;
  videoUrl: string | null;
  start: number;
  duration: number;
};

let clipCounter = 0;
const uid = () => `clip-${++clipCounter}-${Date.now()}`;

export default function ScenebuilderPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingClipIndex, setPlayingClipIndex] = useState<number | null>(null);
  const [seekToOnLoad, setSeekToOnLoad] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [lastFrameDataUrl, setLastFrameDataUrl] = useState<string | null>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const clipsRef = useRef(clips);
  const videoUrlRef = useRef(videoUrl);
  clipsRef.current = clips;
  videoUrlRef.current = videoUrl;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const extractLastFrameAsDataUrl = useCallback((videoUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        video.currentTime = Math.max(0, video.duration - 0.05);
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0);
        try {
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      video.onerror = () => resolve(null);
      video.load();
    });
  }, []);

  const handleVideoGenerated = useCallback(
    (generatedVideoUrl: string) => {
      const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
      const selectedEmptyClip = clips.find((c) => c.id === selectedClipId && !c.videoUrl);
      const label = "Generated clip";
      if (selectedEmptyClip) {
        setClips((prev) =>
          prev.map((c) =>
            c.id === selectedEmptyClip.id ? { ...c, label, prompt: label, videoUrl: generatedVideoUrl } : c
          )
        );
        setSelectedClipId(selectedEmptyClip.id);
      } else {
        const newClip: Clip = {
          id: uid(),
          label,
          prompt: label,
          videoUrl: generatedVideoUrl,
          start: totalDuration,
          duration: 8,
        };
        setClips((prev) => [...prev, newClip]);
        setSelectedClipId(newClip.id);
      }
      setVideoUrl(generatedVideoUrl);
    },
    [clips, selectedClipId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as {
        videoBase64?: string;
        mimeType?: string;
        prompt?: string;
      };
      if (!stored?.videoBase64) return;
      const mimeType = stored.mimeType ?? "video/mp4";
      (async () => {
        const blob = await (
          await fetch(`data:${mimeType};base64,${stored.videoBase64}`)
        ).blob();
        const url = URL.createObjectURL(blob);
        const promptText = stored.prompt ?? "Generated clip";
        const initialClip: Clip = {
          id: uid(),
          label: promptText.slice(0, 30) + (promptText.length > 30 ? "…" : ""),
          prompt: promptText,
          videoUrl: url,
          start: 0,
          duration: 8,
        };
        setClips([initialClip]);
        setVideoUrl(url);
        setSelectedClipId(initialClip.id);
      })();
    } catch {
      /* silent */
    }
  }, []);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => {
      const next = prev.filter((c) => c.id !== id);
      const removed = prev.find((c) => c.id === id);
      if (removed?.videoUrl) URL.revokeObjectURL(removed.videoUrl);
      return next;
    });
    if (selectedClipId === id) {
      setSelectedClipId(null);
      setVideoUrl("");
    }
  }, [selectedClipId]);

  const addClip = useCallback(() => {
    const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
    const newClip: Clip = {
      id: uid(),
      label: "New clip",
      prompt: "",
      videoUrl: null,
      start: totalDuration,
      duration: 8,
    };
    setClips((prev) => [...prev, newClip]);
    setSelectedClipId(newClip.id);
  }, [clips]);

  const getActiveVideo = useCallback(() => {
    return activeSlot === 0 ? videoARef.current : videoBRef.current;
  }, [activeSlot]);

  const getInactiveVideo = useCallback(() => {
    return activeSlot === 0 ? videoBRef.current : videoARef.current;
  }, [activeSlot]);

  useEffect(() => {
    const video = getActiveVideo();
    if (!video || playingClipIndex === null || seekToOnLoad === null) return;
    const seekAndPlay = () => {
      if (!video) return;
      video.currentTime = seekToOnLoad ?? 0;
      requestAnimationFrame(() => {
        video.play().catch(() => {
          setIsPlaying(false);
          setPlayingClipIndex(null);
        });
      });
      setSeekToOnLoad(null);
    };
    if (video.readyState >= 1) {
      seekAndPlay();
    } else {
      const onReady = () => {
        video.onloadeddata = null;
        seekAndPlay();
      };
      video.onloadeddata = onReady;
      return () => {
        video.onloadeddata = null;
      };
    }
  }, [playingClipIndex, seekToOnLoad, getActiveVideo]);


  useEffect(() => {
    return () => {
      clipsRef.current.forEach((c) => {
        if (c.videoUrl) URL.revokeObjectURL(c.videoUrl);
      });
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
  const displayDuration = Math.max(totalDuration, videoDuration || 0);
  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const playableClips = clips.filter((c) => c.videoUrl);
  const getClipAtTime = useCallback(
    (t: number): { index: number; timeInClip: number } => {
      let acc = 0;
      for (let i = 0; i < playableClips.length; i++) {
        const end = acc + playableClips[i].duration;
        if (t < end) return { index: i, timeInClip: t - acc };
        acc = end;
      }
      return { index: Math.max(0, playableClips.length - 1), timeInClip: 0 };
    },
    [playableClips]
  );

  const clientXToTime = useCallback(
    (clientX: number): number => {
      const el = timelineTrackRef.current;
      if (!el || totalDuration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const scrollWidth = el.scrollWidth || rect.width;
      const x = el.scrollLeft + (clientX - rect.left);
      const pct = Math.max(0, Math.min(1, x / scrollWidth));
      return pct * totalDuration;
    },
    [totalDuration]
  );

  const handleSeek = useCallback(
    (clientX: number) => {
      const t = clientXToTime(clientX);
      setPlayhead(t);
      if (isPlaying) {
        const { index, timeInClip } = getClipAtTime(t);
        setPlayingClipIndex(index);
        setSeekToOnLoad(timeInClip);
      }
    },
    [clientXToTime, getClipAtTime, isPlaying]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead) return;
      handleSeek(e.clientX);
    };
    const onUp = () => setIsDraggingPlayhead(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingPlayhead, handleSeek]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      getActiveVideo()?.pause();
      setIsPlaying(false);
      setPlayingClipIndex(null);
      return;
    }
    if (playableClips.length === 0) return;
    const { index, timeInClip } = getClipAtTime(playhead);
    setActiveSlot(0);
    setPlayingClipIndex(index);
    setSeekToOnLoad(timeInClip);
    setIsPlaying(true);
  }, [isPlaying, playableClips.length, playhead, getClipAtTime, getActiveVideo]);

  const handleVideoEnded = useCallback(() => {
    if (playingClipIndex === null) {
      setIsPlaying(false);
      return;
    }
    if (playingClipIndex < playableClips.length - 1) {
      const nextIndex = playingClipIndex + 1;
      const nextVideo = getInactiveVideo();
      setActiveSlot((s) => (s === 0 ? 1 : 0));
      setPlayingClipIndex(nextIndex);
      if (nextVideo) {
        nextVideo.currentTime = 0;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            nextVideo.play().catch(() => {
              setIsPlaying(false);
              setPlayingClipIndex(null);
            });
          });
        });
      } else {
        setSeekToOnLoad(0);
      }
    } else {
      setIsPlaying(false);
      setPlayingClipIndex(null);
      setPlayhead(totalDuration);
    }
  }, [playingClipIndex, playableClips.length, totalDuration, getInactiveVideo]);

  const previewClip = getClipAtTime(playhead);
  const displayVideoUrl =
    playingClipIndex !== null && playableClips[playingClipIndex]
      ? playableClips[playingClipIndex].videoUrl
      : playableClips[previewClip.index]?.videoUrl ?? selectedClip?.videoUrl ?? videoUrl;
  const displaySeekTime =
    playingClipIndex !== null ? null : playableClips[previewClip.index] ? previewClip.timeInClip : null;

  useEffect(() => {
    const video = getActiveVideo();
    if (!video || !displayVideoUrl) return;
    if (displaySeekTime !== null && !isPlaying) {
      video.currentTime = displaySeekTime;
    }
  }, [displayVideoUrl, displaySeekTime, isPlaying, getActiveVideo]);

  useEffect(() => {
    if (!displayVideoUrl) {
      setLastFrameDataUrl(null);
      return;
    }
    let cancelled = false;
    extractLastFrameAsDataUrl(displayVideoUrl).then((url) => {
      if (!cancelled) setLastFrameDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [displayVideoUrl, extractLastFrameAsDataUrl]);

  const getCanvasSnapshot = useCallback(() => lastFrameDataUrl, [lastFrameDataUrl]);
  const getSelectedImageSnapshot = useCallback(() => lastFrameDataUrl, [lastFrameDataUrl]);

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <StudioHeader
          activeMode="scenebuilder"
          leftSlot={
            <Link href="/editor">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          }
        />

        {/* Fixed layout: video (large) | timeline (compact bar) | promptbox */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[52px]">
          {/* 1. Video preview - compact with upper padding */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 px-6 pt-2 pb-1">
            {displayVideoUrl ? (
              <>
              <div className="relative flex max-h-[22vh] w-full max-w-xl items-center justify-center">
                {[
                  { ref: videoARef, slot: 0 },
                  { ref: videoBRef, slot: 1 },
                ].map(({ ref: r, slot }) => {
                  const isActive = activeSlot === slot;
                  const src =
                    slot === 0
                      ? !isPlaying
                        ? displayVideoUrl
                        : isActive
                          ? displayVideoUrl
                          : playableClips[(playingClipIndex ?? 0) + 2]?.videoUrl ?? undefined
                      : !isPlaying
                        ? undefined
                        : isActive
                          ? displayVideoUrl
                          : playableClips[(playingClipIndex ?? 0) + 1]?.videoUrl ?? undefined;
                  const show = !isPlaying ? slot === 0 : isActive;
                  return (
                    <video
                      key={slot}
                      ref={r}
                      src={src || undefined}
                      className={`max-h-full w-full max-w-xl rounded-lg object-contain transition-opacity duration-150 ${
                        show ? "relative z-10 opacity-100" : "pointer-events-none absolute inset-0 z-0 opacity-0"
                      }`}
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        if (Number.isFinite(d)) setVideoDuration(d);
                        const url = e.currentTarget.src;
                        if (!url) return;
                        setClips((prev) => {
                          const updated = prev.map((c) =>
                            c.videoUrl === url && c.duration !== d ? { ...c, duration: d } : c
                          );
                          let acc = 0;
                          return updated.map((c) => {
                            const next = { ...c, start: acc };
                            acc += c.duration;
                            return next;
                          });
                        });
                      }}
                      onLoadedData={(e) => {
                        if (displaySeekTime !== null && !isPlaying && slot === 0) {
                          e.currentTarget.currentTime = displaySeekTime;
                        }
                      }}
                      onTimeUpdate={(e) => {
                        if (!show) return;
                        const v = e.currentTarget;
                        if (playingClipIndex !== null && playableClips[playingClipIndex]) {
                          setPlayhead(playableClips[playingClipIndex].start + v.currentTime);
                        } else if (selectedClip) {
                          setPlayhead(selectedClip.start + v.currentTime);
                        } else {
                          setPlayhead(v.currentTime);
                        }
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={handleVideoEnded}
                      controls={!isPlaying}
                      preload="auto"
                      playsInline
                    />
                  );
                })}
              </div>
              {/* Veo thumbnail badge - bottom right of preview */}
              <div className="absolute bottom-3 right-6 flex flex-col items-center gap-0.5">
                <div className="h-7 w-10 overflow-hidden rounded border border-border bg-muted">
                  <video
                    src={displayVideoUrl || undefined}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    onLoadedData={(e) => {
                      e.currentTarget.currentTime = 0.5;
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">Veo</span>
              </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-muted">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted-foreground"
                  >
                    <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
                    <path d="m22 8-6 4 6 4V8Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No video generated yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    Add a clip with +, then use the prompt box below to generate video from an image
                  </p>
                </div>
              </div>
            )}
          </div>


          {/* 2. Timeline - single horizontal bar (as in image) */}
          <div className="shrink-0 px-6 pt-1 pb-2">
            <div className="flex min-h-[100px] items-center gap-0 rounded-lg border border-border bg-card shadow-sm">
              {/* Play button - left */}
              <div className="flex shrink-0 items-center justify-center p-3">
                <button
                  onClick={handlePlayPause}
                  disabled={playableClips.length === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-inner disabled:opacity-40"
                >
                  {isPlaying ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="ml-0.5"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Track area: timeline (clips + playhead) | add */}
              <div className="flex min-h-[88px] flex-1 items-center overflow-hidden">
                {/* Timeline strip - compact clip thumbnails */}
                <div className="flex min-h-0 min-w-0 flex-1 items-center">
                  {/* Clips - compact fixed width, no stretch */}
                  <div
                    ref={timelineTrackRef}
                    role="slider"
                    aria-label="Timeline"
                    aria-valuemin={0}
                    aria-valuemax={totalDuration}
                    aria-valuenow={playhead}
                    tabIndex={0}
                    className="scrollbar-hide relative flex h-full flex-none cursor-pointer items-center gap-1 overflow-x-auto overflow-y-hidden px-2 py-2"
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      handleSeek(e.clientX);
                    }}
                  >
                    {clips.map((clip) => {
                      const isSelected = clip.id === selectedClipId;
                      return (
                        <button
                          key={clip.id}
                          onClick={() => setSelectedClipId(clip.id)}
                          className={`group relative h-14 w-20 shrink-0 overflow-hidden rounded border transition ${
                            isSelected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/50"
                          }`}
                        >
                        {clip.videoUrl ? (
                          <video
                            src={clip.videoUrl}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            onLoadedData={(e) => {
                              e.currentTarget.currentTime = 0.5;
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted">
                            <span className="text-[9px] text-muted-foreground">+ prompt</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeClip(clip.id);
                          }}
                          className="absolute right-1 top-1 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                        </button>
                      );
                    })}

                    {/* Playhead - draggable, synced to playback */}
                    {totalDuration > 0 && playableClips.length > 0 && (
                      <div
                        data-playhead
                        role="slider"
                        aria-label="Playhead"
                        tabIndex={0}
                        className="absolute top-0 bottom-0 z-20 w-1 -translate-x-1/2 cursor-ew-resize"
                        style={{
                          left: `${Math.min(100, Math.max(0, (playhead / totalDuration) * 100))}%`,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingPlayhead(true);
                        }}
                      >
                        <div className="pointer-events-none mx-auto h-full w-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
                      </div>
                    )}
                  </div>

                  {/* Add button - white + in black circle */}
                  <div className="relative shrink-0">
                    <button
                      onClick={addClip}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90"
                      title="Add clip"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </button>

                  </div>
                </div>
              </div>

              {/* Time + icons - right */}
              <div className="flex shrink-0 flex-col items-end gap-1 border-l border-border px-4 py-2">
                <span className="font-mono text-sm text-foreground">
                  {formatTime(playhead)} / {formatTime(displayDuration)}
                </span>
                <div className="flex items-center gap-2">
                  <button className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                  <button className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. AIPanel - below timeline, in flow */}
          <div className="shrink-0 px-6 pb-4 pt-6 flex justify-center">
            <div className="w-full max-w-[600px]">
            <AIPanel
              videoOnly
              onVideoGenerated={handleVideoGenerated}
              getCanvasSnapshot={getCanvasSnapshot}
              getSelectedImageSnapshot={getSelectedImageSnapshot}
            />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
