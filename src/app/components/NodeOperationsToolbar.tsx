'use client';

import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import {
  Type,
  Image as ImageIcon,
  ImagePlus,
  Video,
  Wand2,
  Scissors,
  Pencil,
  Megaphone,
  Link2,
  Play,
} from "lucide-react";

export type NodeOperationKind =
  | 'input'
  | 'image-input'
  | 'text-image-input'
  | 'op-video-gen'
  | 'op-asset-gen'
  | 'op-ad-stitch'
  | 'op-bg-removal'
  | 'op-smart-edit'
  | 'tool-brand-tagline'
  | 'tool-ad-headline'
  | 'tool-cta-generator'
  | 'tool-social-caption';

export interface NodeOperationsToolbarApi {
  addInputNode: () => void;
  addImageInputNode?: () => void;
  addTextImageInputNode?: () => void;
  addToolNode: (kind: string) => void;
  connectSelectedNodes: () => void;
  runSelectedTools: () => void;
}

interface NodeOperationsToolbarProps {
  nodesApi: NodeOperationsToolbarApi | null;
  leftOffset?: number;
}

const nodeCategories = [
  {
    title: "Inputs",
    items: [
      { kind: 'input' as const, label: "Text Input", description: "Paste text for copy or prompts", icon: Type },
      { kind: 'image-input' as const, label: "Image Input", description: "Upload an image", icon: ImageIcon },
      { kind: 'text-image-input' as const, label: "Text + Image", description: "Text and image together", icon: ImagePlus },
    ],
  },
  {
    title: "Generation",
    items: [
      { kind: 'op-video-gen' as const, label: "Video Generation", description: "Generate video from image + prompt", icon: Video },
      { kind: 'op-asset-gen' as const, label: "Asset Generation", description: "Generate images from text/image", icon: Wand2 },
    ],
  },
  {
    title: "Video",
    items: [
      { kind: 'op-ad-stitch' as const, label: "Ad Stitcher", description: "Compose video ad from clips/images", icon: Video },
    ],
  },
  {
    title: "Processing",
    items: [
      { kind: 'op-bg-removal' as const, label: "Background Removal", description: "Remove image background", icon: Scissors },
      { kind: 'op-smart-edit' as const, label: "Smart Edit", description: "Edit image with text instructions", icon: Pencil },
    ],
  },
  {
    title: "Copy",
    items: [
      { kind: 'tool-brand-tagline' as const, label: "Brand Tagline", description: "Turn copy into brand tagline", icon: Megaphone },
      { kind: 'tool-ad-headline' as const, label: "Ad Headline", description: "Generate ad headlines", icon: Megaphone },
      { kind: 'tool-cta-generator' as const, label: "CTA Generator", description: "Create calls-to-action", icon: Megaphone },
      { kind: 'tool-social-caption' as const, label: "Social Caption", description: "Write social captions", icon: Megaphone },
    ],
  },
];

export function NodeOperationsToolbar({ nodesApi, leftOffset = 8 }: NodeOperationsToolbarProps) {
  const handleAddNode = (kind: NodeOperationKind) => {
    if (!nodesApi) return;

    if (kind === 'input') {
      nodesApi.addInputNode();
    } else if (kind === 'image-input' && nodesApi.addImageInputNode) {
      nodesApi.addImageInputNode();
    } else if (kind === 'text-image-input' && nodesApi.addTextImageInputNode) {
      nodesApi.addTextImageInputNode();
    } else {
      nodesApi.addToolNode(kind);
    }
  };

  return (
    <TooltipProvider>
      <div
        className="absolute flex flex-col bg-white w-[240px] rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-border/60 ring-1 ring-black/5 z-50 transition-all duration-200 ease-out overflow-hidden"
        style={{
          left: `${leftOffset}px`,
          top: 'calc((100vh - 76px) / 2 - 20px)',
          transform: 'translateY(-50%)',
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        <div className="px-3 py-3 border-b border-border/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Node Operations</h3>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {nodeCategories.map((cat) => (
            <div key={cat.title}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
                {cat.title}
              </p>
              <div className="space-y-1">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Tooltip key={item.kind}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleAddNode(item.kind)}
                          disabled={!nodesApi}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12} className="z-[60] max-w-[200px]">
                        Add {item.label} node to canvas
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-2 border-t border-border/60 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 rounded-lg h-8 text-xs"
            onClick={() => nodesApi?.connectSelectedNodes()}
            disabled={!nodesApi}
          >
            <Link2 className="h-3.5 w-3.5" />
            Connect selected nodes
          </Button>
          <Button
            size="sm"
            className="w-full justify-start gap-2 rounded-lg h-8 text-xs bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90"
            onClick={() => nodesApi?.runSelectedTools()}
            disabled={!nodesApi}
          >
            <Play className="h-3.5 w-3.5" />
            Run pipeline
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
