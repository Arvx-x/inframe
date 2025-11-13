import { cn } from "@/app/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  animate?: "pulse" | "blink" | "none";
}

function Skeleton({ className, animate = "pulse", ...props }: SkeletonProps) {
  const animationClass =
    animate === "none" ? "" : animate === "blink" ? "animate-blink" : "animate-pulse";

  return <div className={cn("rounded-md bg-muted", animationClass, className)} {...props} />;
}

export { Skeleton };
