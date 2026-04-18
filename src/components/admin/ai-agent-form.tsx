"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { AiAgent, Category } from "@/models/types";
import { useLocale } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NewAgentModal } from "@/components/admin/ai-agents-manager";

interface AiAgentFormProps {
  agent: AiAgent | null;
  categories: Category[];
  initialAvatarUrl: string | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function AiAgentForm({ agent, categories, initialAvatarUrl }: AiAgentFormProps) {
  const router = useRouter();
  const { t } = useLocale();
  const isNew = !agent;

  // Form state
  const [name, setName] = useState(agent?.name ?? "");
  const [slug, setSlug] = useState(agent?.slug ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [categoryId, setCategoryId] = useState(agent?.category_id ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newAgent, setNewAgent] = useState<{
    agentName: string;
    agentId: string;
    prompt: string;
  } | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!agent);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate slug from name (only if not manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && !agent) {
      setSlug(slugify(name));
    }
  }, [name, slugManuallyEdited, agent]);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(slugify(value));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("admin.aiAgents.errorNameRequired"));
      return;
    }
    if (!slug.trim()) {
      toast.error(t("admin.aiAgents.errorSlugRequired"));
      return;
    }
    if (!categoryId) {
      toast.error(t("admin.aiAgents.errorCategoryRequired"));
      return;
    }

    setSaving(true);
    try {
      // API expects camelCase fields
      const body = isNew
        ? {
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim() || null,
            categoryId,
          }
        : {
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim() || null,
          };

      const url = isNew
        ? "/api/admin/ai-agents"
        : `/api/admin/ai-agents/${agent.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      const data = await res.json();

      if (isNew) {
        // API returns { agent: { id, name, ... }, prompt }
        setNewAgent({
          agentName: data.agent.name,
          agentId: data.agent.id,
          prompt: data.prompt,
        });
      } else {
        toast.success(t("admin.aiAgents.saved"));
        router.push("/admin/ai-agents");
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save agent",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agent) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      // API expects field name "file"
      formData.append("file", file);

      const res = await fetch(`/api/admin/ai-agents/${agent.id}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to upload avatar");
      }

      const data = await res.json();
      // API returns { version, urls } - build URL client-side using shared helper
      // We need CDN base URL and key prefix from the response URLs
      const url128 = data.urls?.[128];
      if (url128) {
        setAvatarUrl(url128);
      }
      toast.success("Avatar uploaded");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload avatar",
      );
    } finally {
      setUploadingAvatar(false);
      // Clear the input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    if (!agent) return;

    setUploadingAvatar(true);
    try {
      const res = await fetch(`/api/admin/ai-agents/${agent.id}/avatar`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete avatar");
      }

      setAvatarUrl(null);
      toast.success("Avatar removed");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete avatar",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAgentModalClose = () => {
    setNewAgent(null);
    router.push("/admin/ai-agents");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("admin.common.back")}
        </Button>
        <h1 className="text-xl font-semibold text-foreground">
          {isNew
            ? t("admin.aiAgents.createTitle")
            : t("admin.aiAgents.editTitle")}
        </h1>
      </div>

      {/* Form */}
      <div className="rounded-lg bg-secondary p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left column: Basic info */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-foreground">
                {t("admin.aiAgents.form.name")} *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("admin.aiAgents.form.namePlaceholder")}
                className="mt-1"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="text-sm font-medium text-foreground">
                {t("admin.aiAgents.form.slug")} *
              </label>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={t("admin.aiAgents.form.slugPlaceholder")}
                className="mt-1 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("admin.aiAgents.form.slugHelp")}
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium text-foreground">
                {t("admin.aiAgents.form.category")} *
              </label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1"
                disabled={!isNew}
              >
                <option value="">
                  {t("admin.aiAgents.form.selectCategory")}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {isNew
                  ? t("admin.aiAgents.form.categoryHelp")
                  : t("admin.aiAgents.form.categoryLocked")}
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-foreground">
                {t("admin.aiAgents.form.description")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("admin.aiAgents.form.descriptionPlaceholder")}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            {/* Author ID (only for edit, read-only) */}
            {!isNew && agent && (
              <div>
                <label className="text-sm font-medium text-foreground">
                  Author ID
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                  <code className="flex-1 text-xs font-mono text-foreground select-all">
                    {agent.id}
                  </code>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.aiAgents.form.authorIdHelp")}
                </p>
              </div>
            )}
          </div>

          {/* Right column: Avatar (only for edit) */}
          {!isNew && (
            <div className="space-y-4">
              <label className="text-sm font-medium text-foreground">
                {t("admin.aiAgents.form.avatar")}
              </label>
              <div className="flex items-start gap-4">
                {/* Avatar preview */}
                <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                  {avatarUrl ? (
                    <>
                      <Image
                        src={avatarUrl}
                        alt={name}
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={handleAvatarDelete}
                        disabled={uploadingAvatar}
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
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* Upload controls */}
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {avatarUrl
                      ? t("admin.aiAgents.form.changeAvatar")
                      : t("admin.aiAgents.form.uploadAvatar")}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.aiAgents.form.avatarHelp")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3 border-t border-border pt-6">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNew ? t("admin.aiAgents.form.create") : t("admin.aiAgents.form.save")}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/ai-agents")}
          >
            {t("admin.common.cancel")}
          </Button>
        </div>
      </div>

      {/* New agent modal */}
      {newAgent && (
        <NewAgentModal
          agentName={newAgent.agentName}
          agentId={newAgent.agentId}
          prompt={newAgent.prompt}
          onClose={handleAgentModalClose}
          t={t}
        />
      )}
    </div>
  );
}
