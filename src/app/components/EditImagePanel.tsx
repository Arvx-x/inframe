'use client';

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { X, Loader2, Wand2, Sparkles } from "lucide-react";
// Use local API route for image editing
import { toast } from "sonner";
import { Skeleton } from "@/app/components/ui/skeleton";

interface EditImagePanelProps {
  position: { x: number; y: number };
  imageElement: HTMLImageElement | null;
  onEditComplete: (newImageUrl: string) => void;
  onClose: () => void;
}

const quickActions = [
  "Boost contrast",
  "Remove background",
  "Make subject pop",
  "Make warmer",
  "Sharpen details",
  "Add dramatic lighting"
];

export default function EditImagePanel({ position, imageElement, onEditComplete, onClose }: EditImagePanelProps) {
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = async (prompt?: string) => {
    const finalPrompt = prompt || editPrompt;
    
    if (!finalPrompt.trim()) {
      toast.error("Please enter an edit command");
      return;
    }

    if (!imageElement) {
      toast.error("No image selected");
      return;
    }

    setIsEditing(true);

    try {
      // Convert image element to data URL
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(imageElement, 0, 0);
      const currentImageUrl = canvas.toDataURL('image/png');

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, currentImageUrl, isEdit: true })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data?.imageUrl) {
        onEditComplete(data.imageUrl);
        setEditPrompt("");
        toast.success("Image edited successfully!");
      } else {
        throw new Error("No image URL returned");
      }
    } catch (error) {
      console.error('Edit error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to edit image");
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    }
  };

  return (
    <div
      className="fixed z-50 bg-background border border-border rounded-2xl shadow-xl w-80 overflow-hidden"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Edit Image</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Image Preview */}
        {imageElement && (
          <div className="relative rounded-lg border border-border overflow-hidden bg-muted/20">
            <img
              src={imageElement.src}
              alt="Selected image"
              className={`w-full h-40 object-contain transition-opacity duration-200 ${isEditing ? 'opacity-0' : 'opacity-100'}`}
            />
            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Skeleton animate="blink" className="h-full w-full bg-muted/50" />
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Quick actions</p>
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => handleEdit(action)}
                disabled={isEditing}
                className="text-xs px-2.5 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Or describe your edit</p>
          <Textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Make the background warmer and increase contrast..."
            className="min-h-[80px] resize-none text-sm"
            disabled={isEditing}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleEdit()}
            disabled={isEditing || !editPrompt.trim()}
            className="flex-1 rounded-xl gap-2"
            size="sm"
          >
            {isEditing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Apply Edit
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          This will replace the selected image with the edited version
        </p>
      </div>
    </div>
  );
}
