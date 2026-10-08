ALTER TABLE site_settings ADD COLUMN wechat_name TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN wechat_qr_image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN wechat_avatar_url TEXT NOT NULL DEFAULT '';

UPDATE site_settings
SET wechat_name = '不如喝杯咖啡',
    wechat_qr_image_url = '/journal-wechat-qr.svg',
    wechat_avatar_url = '/journal-wechat-cat.png',
    updated_at = unixepoch()
WHERE id = 1;
