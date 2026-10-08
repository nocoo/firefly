import { useState } from "react";
import { uploadSettingsImage } from "@/models/settings-image";

export function useSettingsImage(onChange: (url: string) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadSettingsImage(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片上传失败。");
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error };
}
