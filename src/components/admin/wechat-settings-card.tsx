"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { Button } from "@nocoo/basalt/components/button";
import { Input } from "@nocoo/basalt/components/input";
import { LayerCard } from "@nocoo/basalt/components/layer-card";
import { useSettingsImage } from "@/hooks/use-settings-image";
import { isImageUrl, type WechatSettings } from "@/models/wechat";

function ImageField({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useSettingsImage(onChange);

  return (
    <div className="space-y-2" onPaste={(event) => {
      const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
      if (!file || uploading) return;
      event.preventDefault();
      void upload(file);
    }}>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex items-start gap-3">
        {value && isImageUrl(value) && (
          <img src={value} alt={`${label}预览`} width={80} height={80} className="h-20 w-20 shrink-0 rounded-widget object-contain bg-basalt-bright" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <Input id={id} value={value} disabled={uploading} maxLength={2048} onChange={(event) => onChange(event.target.value)} placeholder="https://example.com/image.png 或 /image.png" />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => picker.current?.click()}>
              {uploading ? "上传中..." : `上传${label}`}
            </Button>
            {value && <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange("")}>清除{label}</Button>}
            <span className="text-xs text-muted-foreground">支持粘贴图片，上传后需保存设置</span>
          </div>
          <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" aria-label={`选择${label}文件`} className="sr-only" disabled={uploading} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }} />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function WechatSettingsCard({ value, onChange }: {
  value: WechatSettings;
  onChange: Dispatch<SetStateAction<WechatSettings>>;
}) {
  return (
    <LayerCard padding="lg">
      <LayerCard.Header>
        <h2 className="text-base font-medium">微信公众号</h2>
        <p className="text-xs text-muted-foreground">显示在博客侧边栏。填写现成二维码图片，头像单独显示在二维码中央；清空名称或二维码可隐藏卡片。</p>
      </LayerCard.Header>
      <LayerCard.Body className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="wechat-name" className="text-sm font-medium">公众号名称</label>
          <Input id="wechat-name" maxLength={255} value={value.wechatName} onChange={(event) => {
            const wechatName = event.target.value;
            onChange((previous) => ({ ...previous, wechatName }));
          }} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ImageField id="wechat-qr-image" label="二维码图片" value={value.wechatQrImageUrl} onChange={(wechatQrImageUrl) => onChange((previous) => ({ ...previous, wechatQrImageUrl }))} />
          <ImageField id="wechat-avatar" label="公众号头像" value={value.wechatAvatarUrl} onChange={(wechatAvatarUrl) => onChange((previous) => ({ ...previous, wechatAvatarUrl }))} />
        </div>
      </LayerCard.Body>
    </LayerCard>
  );
}
