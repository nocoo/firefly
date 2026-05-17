"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface AvatarUploaderProps {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
}

export function AgentAvatarUploader({
  agentId,
  agentName,
  avatarUrl,
  onAvatarChange,
}: AvatarUploaderProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/admin/ai-agents/${agentId}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to upload avatar");
      }

      const data = await res.json();
      const url128 = data.urls?.[128];
      if (url128) onAvatarChange(url128);
      toast.success("Avatar uploaded");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload avatar",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    setUploading(true);
    try {
      const res = await fetch(`/api/admin/ai-agents/${agentId}/avatar`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete avatar");
      onAvatarChange(null);
      toast.success("Avatar removed");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete avatar",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-foreground">头像</label>
      <div className="flex items-start gap-4">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
          {avatarUrl ? (
            <>
              <Image
                src={avatarUrl}
                alt={agentName}
                fill
                className="object-cover"
              />
              <button
                onClick={handleDelete}
                disabled={uploading}
                className="absolute right-1 top-1 rounded-full bg-zinc-950/50 p-1 text-white hover:bg-zinc-950/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Upload className="h-8 w-8" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {avatarUrl ? "更换头像" : "上传头像"}
          </Button>
          <p className="text-xs text-muted-foreground">
            正方形图片，至少 256×256 像素
          </p>
        </div>
      </div>
    </div>
  );
}
