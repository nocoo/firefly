import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadSettingsImage } from "./settings-image";
import { MAX_FILE_SIZE } from "@/lib/r2";

describe("uploadSettingsImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads through the existing media API and preserves the filename", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ url: "https://example.com/uuid.png" }, { status: 201 }));
    const file = new File(["image"], "account-avatar.png", { type: "image/png" });
    expect(await uploadSettingsImage(file)).toBe("https://example.com/uuid.png");
    expect(fetch).toHaveBeenCalledWith("/api/media", expect.objectContaining({ method: "POST" }));
    const body = fetch.mock.calls[0][1]?.body as FormData;
    expect((body.get("file") as File).name).toBe("account-avatar.png");
  });

  it("rejects unsupported formats and oversized images before uploading", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(uploadSettingsImage(new File(["svg"], "qr.svg", { type: "image/svg+xml" }))).rejects.toThrow("请选择");
    await expect(uploadSettingsImage(new File([new Uint8Array(MAX_FILE_SIZE + 1)], "big.png", { type: "image/png" }))).rejects.toThrow("10 MB");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [400, { error: "Invalid image" }, "Invalid image"],
    [500, {}, "图片上传失败"],
    [201, {}, "上传未返回图片地址"],
  ])("surfaces errors from a %s response", async (status, result, message) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result, { status }));
    await expect(uploadSettingsImage(new File(["image"], "qr.png", { type: "image/png" }))).rejects.toThrow(message);
  });

  it("propagates network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network unavailable"));
    await expect(uploadSettingsImage(new File(["image"], "qr.png", { type: "image/png" }))).rejects.toThrow("Network unavailable");
  });
});
