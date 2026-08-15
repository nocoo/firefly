import { getR2PublicUrl } from "./r2-client";
import { getR2KeyPrefix } from "./r2";

export type HumanAvatarSize = 32 | 64 | 80 | 128 | 256;
export const HUMAN_AVATAR_SIZES: HumanAvatarSize[] = [32, 64, 80, 128, 256];

export function buildHumanAvatarUrl(
  cdnBaseUrl: string,
  keyPrefix: string,
  humanId: string,
  avatarVersion: string | null,
  size: HumanAvatarSize,
): string | null {
  if (!avatarVersion) return null;
  return `${cdnBaseUrl}/${keyPrefix}humans/${humanId}/${avatarVersion}/avatar-${size}.jpg`;
}

export function getHumanAvatarUrl(
  humanId: string,
  avatarVersion: string | null,
  size: HumanAvatarSize,
): string | null {
  return buildHumanAvatarUrl(
    getR2PublicUrl(),
    getR2KeyPrefix(),
    humanId,
    avatarVersion,
    size,
  );
}

export function getHumanAvatarR2Key(
  humanId: string,
  version: string,
  size: HumanAvatarSize,
): string {
  return `${getR2KeyPrefix()}humans/${humanId}/${version}/avatar-${size}.jpg`;
}

export function getAllHumanAvatarR2Keys(
  humanId: string,
  version: string,
): string[] {
  return HUMAN_AVATAR_SIZES.map((size) =>
    getHumanAvatarR2Key(humanId, version, size),
  );
}
