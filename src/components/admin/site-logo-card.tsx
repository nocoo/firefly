"use client";

import { useCallback, useState } from "react";

interface SiteLogoCardProps {
  initialLogoUrl: string | null;
}

export function SiteLogoCard({ initialLogoUrl }: SiteLogoCardProps) {
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoBusy = logoUploading || logoRemoving;

  const uploadLogo = useCallback(
    async (file: File) => {
      if (logoUploading || logoRemoving) return;
      setLogoUploading(true);
      setLogoError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload/logo", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "上传失败");
        }

        const data = await res.json();
        const size80 = data.sizes?.find(
          (s: { size: number; url: string }) => s.size === 80,
        );
        if (size80) {
          setCurrentLogoUrl(size80.url);
        }
      } catch (err) {
        setLogoError(err instanceof Error ? err.message : "上传失败");
      } finally {
        setLogoUploading(false);
      }
    },
    [logoUploading, logoRemoving],
  );

  const removeLogo = useCallback(async () => {
    if (logoUploading || logoRemoving) return;
    setLogoRemoving(true);
    setLogoError(null);

    try {
      const res = await fetch("/api/upload/logo", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "上传失败");
      }
      setCurrentLogoUrl(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLogoRemoving(false);
    }
  }, [logoUploading, logoRemoving]);

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
    e.target.value = "";
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(false);
    if (logoBusy) return;
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      uploadLogo(file);
    }
  };

  const handleLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(true);
  };

  const handleLogoDragLeave = () => setLogoDragOver(false);

  return (
    <div className="rounded-card bg-secondary p-5 md:p-6 space-y-4">
      <div>
        <h2 className="text-base font-medium text-foreground">站点图标</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          上传一张正方形图片，将用作站点 favicon 和登录页头像。
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* Logo preview */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {currentLogoUrl ? (
            <img
              src={currentLogoUrl}
              alt="Site logo"
              className="h-full w-full object-cover"
            />
          ) : (
            <svg
              className="h-8 w-8 text-muted-foreground/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>

        {/* Upload / remove actions */}
        <div className="flex flex-col gap-2">
          <div
            onDrop={handleLogoDrop}
            onDragOver={handleLogoDragOver}
            onDragLeave={handleLogoDragLeave}
            className={`flex items-center gap-2 rounded-widget border border-dashed px-3 py-2 text-xs transition-colors ${
              logoDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
            }`}
          >
            <label className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <span>{logoUploading ? "上传中..." : "上传图标"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                onChange={handleLogoFileSelect}
                disabled={logoBusy}
                className="sr-only"
              />
            </label>
            {!logoUploading && (
              <span className="text-muted-foreground/60">或拖拽上传</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            图片必须为正方形（宽高相等）。
          </p>

          {currentLogoUrl && (
            <button
              type="button"
              onClick={removeLogo}
              disabled={logoBusy}
              className="self-start text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              {logoRemoving ? "保存中..." : "移除"}
            </button>
          )}
        </div>
      </div>

      {logoError && <p className="text-xs text-destructive">{logoError}</p>}
    </div>
  );
}
