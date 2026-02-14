"use client";

import { RefObject } from "react";

export type RefImage = {
  file: File;
  previewUrl: string;
};

export type Brief = {
  id: string;
  name: string;
  context: string;
};

type PromptboxProps = {
  prompt: string;
  setPrompt: (v: string) => void;
  refImages: RefImage[];
  removeRefImage: (index: number) => void;
  refInputRef: RefObject<HTMLInputElement | null>;
  handleAddFile: (files: FileList | null) => void;
  briefs: Brief[];
  contextButtonRef: RefObject<HTMLDivElement | null>;
  showContextPopup: () => void;
  hideContextPopup: () => void;
  briefParsing: boolean;
  referenceMode: "branding" | "inspiration";
  setReferenceMode: (v: "branding" | "inspiration") => void;
  canGenerate: boolean;
  handleGenerate: () => void;
  status: "idle" | "loading" | "done" | "error";
  error: string;
  viewMode?: "videos" | "images";
  setViewMode?: (v: "videos" | "images") => void;
  placeholder?: string;
  showExpandButton?: boolean;
  onExpand?: () => void;
  /** "center" fixed bottom, "bottom-right" fixed corner, "inline" in document flow */
  position?: "center" | "bottom-right" | "inline";
  /** "full" shows "Generate Free" text, "compact" shows circular arrow only */
  generateButtonVariant?: "full" | "compact";
  /** When true, shows Text to Video header, Veo 3.1 - Quality, disclaimer */
  scenebuilderStyle?: boolean;
  /** When true, uses light theme (bg-card, text-foreground) for inframe white mode */
  lightMode?: boolean;
};

export function Promptbox({
  prompt,
  setPrompt,
  refImages,
  removeRefImage,
  refInputRef,
  handleAddFile,
  briefs,
  contextButtonRef,
  showContextPopup,
  hideContextPopup,
  briefParsing,
  referenceMode,
  setReferenceMode,
  canGenerate,
  handleGenerate,
  status,
  error,
  viewMode,
  setViewMode,
  placeholder = "Generate a video with text...",
  showExpandButton = false,
  onExpand,
  position = "center",
  generateButtonVariant = "full",
  scenebuilderStyle = false,
  lightMode = false,
}: PromptboxProps) {
  const containerClass =
    position === "bottom-right"
      ? "fixed bottom-6 right-6 z-20 w-[min(420px,90vw)]"
      : position === "inline"
        ? "mx-auto w-[min(640px,90vw)]"
        : "fixed bottom-6 left-1/2 z-20 w-[min(640px,90vw)] -translate-x-1/2";

  const boxClass = lightMode
    ? "relative overflow-hidden rounded-2xl border border-border bg-card px-4 pb-3 pt-4 shadow-sm"
    : "prompt-glass relative overflow-hidden rounded-2xl border border-white/20 bg-white/[0.08] px-4 pb-3 pt-4 shadow-[0_25px_90px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-2xl";

  const textClass = lightMode ? "text-foreground" : "text-white/90";
  const mutedClass = lightMode ? "text-muted-foreground" : "text-white/40";
  const iconClass = lightMode ? "text-muted-foreground hover:text-foreground hover:bg-accent" : "text-white/50 transition hover:bg-white/10 hover:text-white";
  const borderClass = lightMode ? "border-border" : "border-white/10";
  const chipBgClass = lightMode ? "bg-muted" : "bg-white/5";
  const refModeClass = lightMode ? "bg-primary text-primary-foreground" : "bg-zinc-700 text-white";
  const refModeInactiveClass = lightMode ? "text-muted-foreground hover:text-foreground" : "text-zinc-500 hover:text-zinc-300";
  const disclaimerClass = lightMode ? "text-muted-foreground" : "text-white/40";
  const generateBtnClass = lightMode
    ? "flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    : "flex items-center gap-1.5 rounded-full bg-amber-300 px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-amber-300/50";

  return (
    <div className={containerClass}>
      <div className={boxClass}>
        {/* Text to Video header (Scenebuilder style) */}
        {(position === "bottom-right" || scenebuilderStyle) && (
          <div className="mb-3 flex items-center gap-1">
            <span className={`text-sm font-medium ${textClass}`}>Text to Video</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={mutedClass}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}

        {/* Top row: ref images */}
        {refImages.length > 0 && (
          <div className="mb-3 flex gap-2">
            {refImages.map((image, index) => (
              <div
                key={image.previewUrl}
                className={`group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border ${borderClass}`}
              >
                <img
                  src={image.previewUrl}
                  alt={`Ref ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => removeRefImage(index)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main row: icons + prompt + settings */}
        <div className="relative flex items-start gap-4">
          <div className="flex flex-col items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => refInputRef.current?.click()}
              disabled={refImages.length >= 3 || briefParsing}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${iconClass}`}
              title="Add reference images or briefs (PDF/Word)"
            >
              {briefParsing ? (
                <span className={`h-3 w-3 animate-spin rounded-full border-2 ${lightMode ? "border-muted-foreground/30 border-t-foreground" : "border-white/30 border-t-white"}`} />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              )}
            </button>
            <input
              ref={refInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={(e) => {
                handleAddFile(e.target.files);
                e.target.value = "";
              }}
            />
            <button className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${iconClass}`}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 10v3" />
                <path d="M6 6v11" />
                <path d="M10 3v18" />
                <path d="M14 8v7" />
                <path d="M18 5v13" />
                <path d="M22 10v3" />
              </svg>
            </button>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className={`flex-1 resize-none bg-transparent pt-0.5 text-[14px] leading-relaxed outline-none ${lightMode ? "text-foreground placeholder:text-muted-foreground" : "text-white placeholder:text-white/30"}`}
          />

          {briefs.length > 0 && (
            <div
              ref={contextButtonRef}
              className="relative mt-0.5 shrink-0"
              onMouseEnter={showContextPopup}
              onMouseLeave={hideContextPopup}
            >
              <span className={`inline-block cursor-help rounded-lg border px-2 py-1.5 text-[11px] transition ${lightMode ? `border-border bg-muted/50 ${refModeInactiveClass}` : `border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-300`}`}>
                context
              </span>
            </div>
          )}
        </div>

        {/* Reference mode toggle */}
        {refImages.length > 0 && (
          <div className={`mt-2 flex gap-1 rounded-lg p-0.5 ${lightMode ? "bg-muted/50" : "bg-zinc-900/50"}`}>
            <button
              type="button"
              onClick={() => setReferenceMode("branding")}
              className={`rounded-md px-2 py-1 text-[10px] transition ${
                referenceMode === "branding" ? refModeClass : refModeInactiveClass
              }`}
            >
              Branding/Ads
            </button>
            <button
              type="button"
              onClick={() => setReferenceMode("inspiration")}
              className={`rounded-md px-2 py-1 text-[10px] transition ${
                referenceMode === "inspiration" ? refModeClass : refModeInactiveClass
              }`}
            >
              Inspiration
            </button>
          </div>
        )}

        {/* Bottom row: chips + Expand + Generate */}
        <div className="mt-2 flex items-center gap-2">
          {viewMode !== undefined && setViewMode && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/60">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Veo 3.1
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                16:9
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                2K
              </span>
              {refImages.length > 0 && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {refImages.length}/3 refs
                </span>
              )}
            </div>
          )}
          {(position === "bottom-right" || scenebuilderStyle) && (
            <div className={`flex items-center gap-1.5 text-[11px] ${lightMode ? "text-muted-foreground" : "text-white/60"}`}>
              <span className={`rounded-full border px-2.5 py-1 ${lightMode ? "border-border bg-muted/50" : "border-white/10 bg-white/5"}`}>
                Veo 3.1 - Quality
              </span>
              <span className={`rounded-full border px-2.5 py-1 ${lightMode ? "border-border bg-muted/50" : "border-white/10 bg-white/5"}`}>
                x1
              </span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {showExpandButton && onExpand && (
              <button
                onClick={onExpand}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${lightMode ? "border-border bg-muted/50 text-foreground hover:bg-muted" : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
                Expand
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={
                generateButtonVariant === "compact"
                  ? lightMode
                    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-300 text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-amber-300/50"
                  : generateBtnClass
              }
            >
              {status === "loading" ? (
                generateButtonVariant === "compact" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  viewMode === "images"
                    ? "Generating images..."
                    : "Generating..."
                )
              ) : generateButtonVariant === "compact" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              ) : (
                <>
                  Generate Free
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {(position === "bottom-right" || scenebuilderStyle) && (
          <p className={`mt-2 text-[10px] ${disclaimerClass}`}>
            Flow can make mistakes, so double check it.
          </p>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400">{error} Please try again.</p>
        )}
      </div>
    </div>
  );
}
