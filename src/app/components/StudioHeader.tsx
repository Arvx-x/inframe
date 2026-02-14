"use client";

import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { Sparkles, Lightbulb, Film } from "lucide-react";
import { ProfileDropdown } from "@/app/components/ProfileDropdown";

export type StudioMode = "design" | "plan" | "scenebuilder";

type StudioHeaderProps = {
  activeMode: StudioMode;
  onDesignClick?: () => void;
  onPlanClick?: () => void;
  /** Left slot: e.g. Layers toggle, Back button, Format bar */
  leftSlot?: React.ReactNode;
  /** Right slot: e.g. Color selector, Export button (before ProfileDropdown) */
  rightSlot?: React.ReactNode;
};

const activeClass = "bg-[hsl(var(--sidebar-ring))] text-white";
const inactiveClass = "text-muted-foreground hover:text-foreground";

export function StudioHeader({
  activeMode,
  onDesignClick,
  onPlanClick,
  leftSlot,
  rightSlot,
}: StudioHeaderProps) {
  const isEditor = activeMode !== "scenebuilder";

  return (
    <header className="fixed top-0 left-0 right-0 h-[52px] bg-white border-b border-border z-[100] flex items-center px-4">
      {/* Left: optional slot + Studio Toggle */}
      <div className="flex-1 flex items-center gap-2">
        {leftSlot}

        {/* Studio Toggle: Design | Plan | Scenebuilding */}
        <div className="ml-2 inline-flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-border/60 bg-white p-0.5 shadow-sm">
            {isEditor ? (
              <>
                <button
                  onClick={onDesignClick}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeMode === "design" ? activeClass : inactiveClass
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Design
                </button>
                <button
                  onClick={onPlanClick}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeMode === "plan" ? activeClass : inactiveClass
                  }`}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Plan
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/editor"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${inactiveClass}`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Design
                </Link>
                <Link
                  href="/editor?studio=plan"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${inactiveClass}`}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Plan
                </Link>
              </>
            )}
          </div>
          {isEditor ? (
            <Link
              href="/scenebuilder"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border/60 bg-white shadow-sm"
            >
              <Film className="h-3.5 w-3.5" />
              Scenebuilding
            </Link>
          ) : (
            <span
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-transparent shadow-sm ${activeClass}`}
            >
              <Film className="h-3.5 w-3.5" />
              Scenebuilding
            </span>
          )}
        </div>
      </div>

      {/* Right: optional slot + Profile */}
      <div className="flex-1 flex justify-end gap-2">
        {rightSlot}
        <ProfileDropdown />
      </div>
    </header>
  );
}
