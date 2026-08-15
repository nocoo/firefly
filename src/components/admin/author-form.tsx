"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, User, X } from "lucide-react";
import { toast } from "sonner";
import type { Human } from "@/models/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function AuthorForm({
  author,
  initialAvatarUrl,
}: {
  author: Human | null;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const isNew = !author;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(author?.name ?? "");
  const [slug, setSlug] = useState(author?.slug ?? "");
  const [description, setDescription] = useState(author?.description ?? "");
  const [email, setEmail] = useState(author?.email ?? "");
  const [profilePublic, setProfilePublic] = useState(author?.profile_public === 1);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!author);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!slugManuallyEdited && !author) {
      setSlug(slugify(name));
    }
  }, [name, slugManuallyEdited, author]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("请输入名称");
    if (!slug.trim()) return toast.error("请输入标识符");

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        email: email.trim() || null,
        profile_public: profilePublic,
      };
      const url = isNew ? "/api/admin/authors" : `/api/admin/authors/${author.id}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存失败");
      }
      toast.success(isNew ? "作者已创建" : "作者已更新");
      router.push("/admin/authors");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!author) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/authors/${author.id}/avatar`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "上传失败");
      }
      const data = await res.json();
      setAvatarUrl(data.urls?.[80] ?? data.urls?.[128] ?? null);
      toast.success("头像已更新");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!author) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/admin/authors/${author.id}/avatar`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除头像失败");
      setAvatarUrl(null);
      toast.success("头像已删除");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除头像失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {isNew ? "创建作者" : "编辑作者"}
        </h1>
      </div>

      {!isNew && (
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <User className="h-6 w-6" />
            </span>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              上传头像
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="secondary"
                disabled={uploading}
                onClick={handleRemoveAvatar}
              >
                <X className="mr-2 h-4 w-4" />
                移除
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">名称</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">标识</label>
          <Input
            value={slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">描述</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">邮箱</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profilePublic}
            onChange={(e) => setProfilePublic(e.target.checked)}
          />
          允许公开查询
        </label>
      </div>

      <div className="flex gap-3">
        <Button type="button" disabled={saving} onClick={handleSave}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isNew ? "创建" : "保存"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/admin/authors")}
        >
          取消
        </Button>
      </div>
    </div>
  );
}
