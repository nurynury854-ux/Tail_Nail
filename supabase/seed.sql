-- ============================================================
-- 小尾巴美甲 Ttail Nail — Prompt-Aligned Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- BRANCHES
-- ────────────────────────────────────────────────────────────
INSERT INTO branches (id, name, address, staff_count, phone, image_url) VALUES
  ('1', '內壢店', '桃園市中壢區內壢地區', 2, '03-123-4567', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop'),
  ('2', '中壢店', '桃園市中壢區市中心', 2, '03-234-5678', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop'),
  ('3', '中原店', '桃園市中壢區中原大學周邊', 4, '03-345-6789', 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&auto=format&fit=crop')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  staff_count = EXCLUDED.staff_count,
  phone = EXCLUDED.phone,
  image_url = EXCLUDED.image_url;

-- ────────────────────────────────────────────────────────────
-- SERVICES (主項目 + 附加項目)
-- ────────────────────────────────────────────────────────────
INSERT INTO services (id, name, service_type, is_addon, is_active, duration_minutes, price, description) VALUES
  ('svc-main-solid', '單色', 'main', false, true, NULL, 0, '主項目：單色'),
  ('svc-main-cat-eye', '貓眼', 'main', false, true, NULL, 0, '主項目：貓眼'),
  ('svc-main-gradient', '漸層十指', 'main', false, true, NULL, 0, '主項目：漸層十指'),
  ('svc-main-french', '法式十指', 'main', false, true, NULL, 0, '主項目：法式十指'),
  ('svc-main-mirror', '鏡面十指', 'main', false, true, NULL, 0, '主項目：鏡面十指'),
  ('svc-main-store-style', '店內款式', 'main', false, true, NULL, 0, '主項目：店內款式'),
  ('svc-main-custom-style', '自帶圖款式', 'main', false, true, NULL, 0, '主項目：自帶圖款式'),
  ('svc-addon-remove', '卸甲', 'addon', true, true, NULL, 0, '附加項目：可疊加/可單選'),
  ('svc-addon-care', '保養＊', 'addon', true, true, NULL, 0, '附加項目：可疊加/可單選'),
  ('svc-addon-shape', '純修甲＊', 'addon', true, true, NULL, 0, '附加項目：可疊加/可單選'),
  ('svc-addon-thicken', '加厚', 'addon', true, true, NULL, 0, '附加項目：加算時間'),
  ('svc-addon-repair', '補甲', 'addon', true, true, 40, 0, '附加項目：可疊加/可單獨預約')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  service_type = EXCLUDED.service_type,
  is_addon = EXCLUDED.is_addon,
  is_active = EXCLUDED.is_active,
  duration_minutes = EXCLUDED.duration_minutes,
  price = EXCLUDED.price,
  description = EXCLUDED.description;

-- ────────────────────────────────────────────────────────────
-- STYLISTS
-- 內壢店：婷婷、Summer
-- 中壢店：阿妮、妞妞
-- 中原店：不點、小Q、小E、球球
-- ────────────────────────────────────────────────────────────
INSERT INTO stylists (id, branch_id, name, bio, is_active) VALUES
  ('sty-tingting', '1', '婷婷', '內壢店美甲師', true),
  ('sty-summer', '1', 'Summer', '內壢店美甲師', true),
  ('sty-ani', '2', '阿妮', '中壢店美甲師', true),
  ('sty-niuniu', '2', '妞妞', '中壢店美甲師', true),
  ('sty-budian', '3', '不點', '中原店美甲師', true),
  ('sty-xiaoq', '3', '小Q', '中原店美甲師', true),
  ('sty-xiaoe', '3', '小E', '中原店美甲師', true),
  ('sty-qiuqiu', '3', '球球', '中原店美甲師', true)
ON CONFLICT (id) DO UPDATE SET
  branch_id = EXCLUDED.branch_id,
  name = EXCLUDED.name,
  bio = EXCLUDED.bio,
  is_active = EXCLUDED.is_active;

-- ────────────────────────────────────────────────────────────
-- BRANCH WEEKLY HOURS (預設：每天 11:00-21:00，週日也營業)
-- ────────────────────────────────────────────────────────────
INSERT INTO branch_working_hours (
  branch_id,
  monday_open, monday_close,
  tuesday_open, tuesday_close,
  wednesday_open, wednesday_close,
  thursday_open, thursday_close,
  friday_open, friday_close,
  saturday_open, saturday_close,
  sunday_open, sunday_close
) VALUES
  ('1', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00'),
  ('2', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00'),
  ('3', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00', '11:00', '21:00')
ON CONFLICT (branch_id) DO UPDATE SET
  monday_open = EXCLUDED.monday_open,
  monday_close = EXCLUDED.monday_close,
  tuesday_open = EXCLUDED.tuesday_open,
  tuesday_close = EXCLUDED.tuesday_close,
  wednesday_open = EXCLUDED.wednesday_open,
  wednesday_close = EXCLUDED.wednesday_close,
  thursday_open = EXCLUDED.thursday_open,
  thursday_close = EXCLUDED.thursday_close,
  friday_open = EXCLUDED.friday_open,
  friday_close = EXCLUDED.friday_close,
  saturday_open = EXCLUDED.saturday_open,
  saturday_close = EXCLUDED.saturday_close,
  sunday_open = EXCLUDED.sunday_open,
  sunday_close = EXCLUDED.sunday_close,
  updated_at = NOW();

-- ────────────────────────────────────────────────────────────
-- STYLIST WEEKLY HOURS (預設：每天 11:00-21:00，週日也營業)
-- ────────────────────────────────────────────────────────────
INSERT INTO stylist_weekly_hours (stylist_id, day_of_week, start_time, end_time, is_working)
SELECT s.id, d.day_of_week,
  '11:00'::TIME,
  '21:00'::TIME,
  true
FROM stylists s
CROSS JOIN (
  SELECT 0 AS day_of_week UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) d
ON CONFLICT (stylist_id, day_of_week) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  is_working = EXCLUDED.is_working;

-- ────────────────────────────────────────────────────────────
-- SERVICE DURATIONS
-- 規則：
-- 1) 依 prompt 精確填入可確定數值
-- 2) 範圍值採 prompt 預設值做 duration_minutes，並保留 duration_note
-- 3) 「待定」依專案決策使用 120 分鐘，is_pending=true
-- ────────────────────────────────────────────────────────────

-- 不點
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-budian', 'svc-main-solid', 'hand', 30, NULL, false),
  ('sty-budian', 'svc-main-solid', 'foot', 20, NULL, false),
  ('sty-budian', 'svc-main-cat-eye', 'hand', 40, NULL, false),
  ('sty-budian', 'svc-main-cat-eye', 'foot', 30, NULL, false),
  ('sty-budian', 'svc-main-gradient', 'hand', 60, NULL, false),
  ('sty-budian', 'svc-main-gradient', 'foot', 40, NULL, false),
  ('sty-budian', 'svc-main-french', 'hand', 50, NULL, false),
  ('sty-budian', 'svc-main-french', 'foot', 50, NULL, false),
  ('sty-budian', 'svc-main-mirror', 'hand', 60, NULL, false),
  ('sty-budian', 'svc-main-mirror', 'foot', 50, NULL, false),
  ('sty-budian', 'svc-main-store-style', 'hand', 120, '待定，預設120分鐘', true),
  ('sty-budian', 'svc-main-store-style', 'foot', 120, '待定，預設120分鐘', true),
  ('sty-budian', 'svc-main-custom-style', 'hand', 120, '待定，預設120分鐘', true),
  ('sty-budian', 'svc-main-custom-style', 'foot', 120, '待定，預設120分鐘', true),
  ('sty-budian', 'svc-addon-remove', 'hand', 20, NULL, false),
  ('sty-budian', 'svc-addon-remove', 'foot', 10, NULL, false),
  ('sty-budian', 'svc-addon-care', 'hand', 40, NULL, false),
  ('sty-budian', 'svc-addon-care', 'foot', 30, NULL, false),
  ('sty-budian', 'svc-addon-shape', 'hand', 15, NULL, false),
  ('sty-budian', 'svc-addon-shape', 'foot', 20, NULL, false),
  ('sty-budian', 'svc-addon-thicken', 'hand', 15, '加算時間 +15', false),
  ('sty-budian', 'svc-addon-thicken', 'foot', 20, '加算時間 +20', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- 婷婷
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-tingting', 'svc-main-solid', 'hand', 30, NULL, false),
  ('sty-tingting', 'svc-main-solid', 'foot', 30, NULL, false),
  ('sty-tingting', 'svc-main-cat-eye', 'hand', 40, NULL, false),
  ('sty-tingting', 'svc-main-cat-eye', 'foot', 40, NULL, false),
  ('sty-tingting', 'svc-main-gradient', 'hand', 30, NULL, false),
  ('sty-tingting', 'svc-main-gradient', 'foot', 30, NULL, false),
  ('sty-tingting', 'svc-main-french', 'hand', 40, NULL, false),
  ('sty-tingting', 'svc-main-french', 'foot', 30, NULL, false),
  ('sty-tingting', 'svc-main-mirror', 'hand', 40, NULL, false),
  ('sty-tingting', 'svc-main-mirror', 'foot', 30, NULL, false),
  ('sty-tingting', 'svc-main-store-style', 'hand', 45, NULL, false),
  ('sty-tingting', 'svc-main-store-style', 'foot', 40, NULL, false),
  ('sty-tingting', 'svc-main-custom-style', 'hand', 60, NULL, false),
  ('sty-tingting', 'svc-main-custom-style', 'foot', 50, NULL, false),
  ('sty-tingting', 'svc-addon-remove', 'hand', 20, NULL, false),
  ('sty-tingting', 'svc-addon-remove', 'foot', 10, NULL, false),
  ('sty-tingting', 'svc-addon-care', 'hand', 20, NULL, false),
  ('sty-tingting', 'svc-addon-care', 'foot', 20, NULL, false),
  ('sty-tingting', 'svc-addon-shape', 'hand', 15, NULL, false),
  ('sty-tingting', 'svc-addon-shape', 'foot', 15, NULL, false),
  ('sty-tingting', 'svc-addon-thicken', 'hand', 20, '加算時間 +20', false),
  ('sty-tingting', 'svc-addon-thicken', 'foot', 15, '加算時間 +15', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- 妞妞
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-niuniu', 'svc-main-solid', 'hand', 45, NULL, false),
  ('sty-niuniu', 'svc-main-solid', 'foot', 30, NULL, false),
  ('sty-niuniu', 'svc-main-cat-eye', 'hand', 45, NULL, false),
  ('sty-niuniu', 'svc-main-cat-eye', 'foot', 30, NULL, false),
  ('sty-niuniu', 'svc-main-gradient', 'hand', 45, NULL, false),
  ('sty-niuniu', 'svc-main-gradient', 'foot', 30, NULL, false),
  ('sty-niuniu', 'svc-main-french', 'hand', 60, NULL, false),
  ('sty-niuniu', 'svc-main-french', 'foot', 40, NULL, false),
  ('sty-niuniu', 'svc-main-mirror', 'hand', 70, NULL, false),
  ('sty-niuniu', 'svc-main-mirror', 'foot', 40, NULL, false),
  ('sty-niuniu', 'svc-main-store-style', 'hand', 60, NULL, false),
  ('sty-niuniu', 'svc-main-store-style', 'foot', 45, NULL, false),
  ('sty-niuniu', 'svc-main-custom-style', 'hand', 120, '範圍 60-120，預設120', false),
  ('sty-niuniu', 'svc-main-custom-style', 'foot', 90, '範圍 60-90，預設90', false),
  ('sty-niuniu', 'svc-addon-remove', 'hand', 15, '難卸另加時（後台註記）', false),
  ('sty-niuniu', 'svc-addon-remove', 'foot', 15, NULL, false),
  ('sty-niuniu', 'svc-addon-care', 'hand', 30, '不好剪另加時（後台註記）', false),
  ('sty-niuniu', 'svc-addon-care', 'foot', 15, NULL, false),
  ('sty-niuniu', 'svc-addon-shape', 'hand', 15, '難修另加時（後台註記）', false),
  ('sty-niuniu', 'svc-addon-shape', 'foot', 10, NULL, false),
  ('sty-niuniu', 'svc-addon-thicken', 'hand', 20, '加算時間 +20', false),
  ('sty-niuniu', 'svc-addon-thicken', 'foot', 15, '加算時間 +15', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- 阿妮
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-ani', 'svc-main-solid', 'hand', 60, NULL, false),
  ('sty-ani', 'svc-main-solid', 'foot', 40, NULL, false),
  ('sty-ani', 'svc-main-cat-eye', 'hand', 60, NULL, false),
  ('sty-ani', 'svc-main-cat-eye', 'foot', 45, NULL, false),
  ('sty-ani', 'svc-main-gradient', 'hand', 60, NULL, false),
  ('sty-ani', 'svc-main-gradient', 'foot', 50, NULL, false),
  ('sty-ani', 'svc-main-french', 'hand', 90, NULL, false),
  ('sty-ani', 'svc-main-french', 'foot', 70, NULL, false),
  ('sty-ani', 'svc-main-mirror', 'hand', 120, NULL, false),
  ('sty-ani', 'svc-main-mirror', 'foot', 70, NULL, false),
  ('sty-ani', 'svc-main-store-style', 'hand', 90, NULL, false),
  ('sty-ani', 'svc-main-store-style', 'foot', 90, NULL, false),
  ('sty-ani', 'svc-main-custom-style', 'hand', 180, '範圍 60-180，預設180', false),
  ('sty-ani', 'svc-main-custom-style', 'foot', 120, '範圍 60-120，預設120', false),
  ('sty-ani', 'svc-addon-remove', 'hand', 30, '難卸另加時（後台註記）', false),
  ('sty-ani', 'svc-addon-remove', 'foot', 20, NULL, false),
  ('sty-ani', 'svc-addon-care', 'hand', 45, '不好剪另加時（後台註記）', false),
  ('sty-ani', 'svc-addon-care', 'foot', 30, NULL, false),
  ('sty-ani', 'svc-addon-shape', 'hand', 20, '難修另加時（後台註記）', false),
  ('sty-ani', 'svc-addon-shape', 'foot', 15, NULL, false),
  ('sty-ani', 'svc-addon-thicken', 'hand', 30, '加算時間 +30', false),
  ('sty-ani', 'svc-addon-thicken', 'foot', 20, '加算時間 +20', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- 小E
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-xiaoe', 'svc-main-solid', 'hand', 40, NULL, false),
  ('sty-xiaoe', 'svc-main-solid', 'foot', 30, NULL, false),
  ('sty-xiaoe', 'svc-main-cat-eye', 'hand', 50, NULL, false),
  ('sty-xiaoe', 'svc-main-cat-eye', 'foot', 40, NULL, false),
  ('sty-xiaoe', 'svc-main-gradient', 'hand', 50, NULL, false),
  ('sty-xiaoe', 'svc-main-gradient', 'foot', 50, NULL, false),
  ('sty-xiaoe', 'svc-main-french', 'hand', 80, '範圍 60-80，預設80', false),
  ('sty-xiaoe', 'svc-main-french', 'foot', 60, NULL, false),
  ('sty-xiaoe', 'svc-main-mirror', 'hand', 60, NULL, false),
  ('sty-xiaoe', 'svc-main-mirror', 'foot', 60, NULL, false),
  ('sty-xiaoe', 'svc-main-store-style', 'hand', 60, NULL, false),
  ('sty-xiaoe', 'svc-main-store-style', 'foot', 60, NULL, false),
  ('sty-xiaoe', 'svc-main-custom-style', 'hand', 120, '待定，預設120分鐘', true),
  ('sty-xiaoe', 'svc-main-custom-style', 'foot', 120, '待定，預設120分鐘', true),
  ('sty-xiaoe', 'svc-addon-remove', 'hand', 30, NULL, false),
  ('sty-xiaoe', 'svc-addon-remove', 'foot', 30, NULL, false),
  ('sty-xiaoe', 'svc-addon-care', 'hand', 40, NULL, false),
  ('sty-xiaoe', 'svc-addon-care', 'foot', 60, NULL, false),
  ('sty-xiaoe', 'svc-addon-shape', 'hand', 30, '短甲15；長甲20-30，預設30', false),
  ('sty-xiaoe', 'svc-addon-shape', 'foot', 30, NULL, false),
  ('sty-xiaoe', 'svc-addon-thicken', 'hand', 20, '加算時間 +20', false),
  ('sty-xiaoe', 'svc-addon-thicken', 'foot', 20, '加算時間 +20', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- 小Q
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-xiaoq', 'svc-main-solid', 'hand', 60, NULL, false),
  ('sty-xiaoq', 'svc-main-solid', 'foot', 60, NULL, false),
  ('sty-xiaoq', 'svc-main-cat-eye', 'hand', 69, '固定 69 分鐘', false),
  ('sty-xiaoq', 'svc-main-cat-eye', 'foot', 69, '固定 69 分鐘', false),
  ('sty-xiaoq', 'svc-main-gradient', 'hand', 70, NULL, false),
  ('sty-xiaoq', 'svc-main-gradient', 'foot', 60, NULL, false),
  ('sty-xiaoq', 'svc-main-french', 'hand', 80, NULL, false),
  ('sty-xiaoq', 'svc-main-french', 'foot', 60, NULL, false),
  ('sty-xiaoq', 'svc-main-mirror', 'hand', 70, NULL, false),
  ('sty-xiaoq', 'svc-main-mirror', 'foot', 70, NULL, false),
  ('sty-xiaoq', 'svc-main-store-style', 'hand', 70, NULL, false),
  ('sty-xiaoq', 'svc-main-store-style', 'foot', 70, NULL, false),
  ('sty-xiaoq', 'svc-main-custom-style', 'hand', 90, NULL, false),
  ('sty-xiaoq', 'svc-main-custom-style', 'foot', 120, NULL, false),
  ('sty-xiaoq', 'svc-addon-remove', 'hand', 30, NULL, false),
  ('sty-xiaoq', 'svc-addon-remove', 'foot', 30, NULL, false),
  ('sty-xiaoq', 'svc-addon-care', 'hand', 30, NULL, false),
  ('sty-xiaoq', 'svc-addon-care', 'foot', 30, NULL, false),
  ('sty-xiaoq', 'svc-addon-shape', 'hand', 15, NULL, false),
  ('sty-xiaoq', 'svc-addon-shape', 'foot', 20, NULL, false),
  ('sty-xiaoq', 'svc-addon-thicken', 'hand', 20, '加算時間 +20', false),
  ('sty-xiaoq', 'svc-addon-thicken', 'foot', 25, '加算時間 +25', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- Summer
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-summer', 'svc-main-solid', 'hand', 30, NULL, false),
  ('sty-summer', 'svc-main-solid', 'foot', 15, NULL, false),
  ('sty-summer', 'svc-main-cat-eye', 'hand', 45, NULL, false),
  ('sty-summer', 'svc-main-cat-eye', 'foot', 30, NULL, false),
  ('sty-summer', 'svc-main-gradient', 'hand', 60, NULL, false),
  ('sty-summer', 'svc-main-gradient', 'foot', 50, NULL, false),
  ('sty-summer', 'svc-main-french', 'hand', 90, NULL, false),
  ('sty-summer', 'svc-main-french', 'foot', 60, NULL, false),
  ('sty-summer', 'svc-main-mirror', 'hand', 60, NULL, false),
  ('sty-summer', 'svc-main-mirror', 'foot', 40, NULL, false),
  ('sty-summer', 'svc-main-store-style', 'hand', 60, NULL, false),
  ('sty-summer', 'svc-main-store-style', 'foot', 60, NULL, false),
  ('sty-summer', 'svc-main-custom-style', 'hand', 90, NULL, false),
  ('sty-summer', 'svc-main-custom-style', 'foot', 90, NULL, false),
  ('sty-summer', 'svc-addon-remove', 'hand', 25, NULL, false),
  ('sty-summer', 'svc-addon-remove', 'foot', 15, NULL, false),
  ('sty-summer', 'svc-addon-care', 'hand', 30, NULL, false),
  ('sty-summer', 'svc-addon-care', 'foot', 20, NULL, false),
  ('sty-summer', 'svc-addon-shape', 'hand', 20, NULL, false),
  ('sty-summer', 'svc-addon-shape', 'foot', 10, NULL, false),
  ('sty-summer', 'svc-addon-thicken', 'hand', 30, '加算時間 +30', false),
  ('sty-summer', 'svc-addon-thicken', 'foot', 20, '加算時間 +20', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- 球球
INSERT INTO service_durations (stylist_id, service_id, category, duration_minutes, duration_note, is_pending) VALUES
  ('sty-qiuqiu', 'svc-main-solid', 'hand', 40, NULL, false),
  ('sty-qiuqiu', 'svc-main-solid', 'foot', 30, NULL, false),
  ('sty-qiuqiu', 'svc-main-cat-eye', 'hand', 60, NULL, false),
  ('sty-qiuqiu', 'svc-main-cat-eye', 'foot', 30, NULL, false),
  ('sty-qiuqiu', 'svc-main-gradient', 'hand', 60, NULL, false),
  ('sty-qiuqiu', 'svc-main-gradient', 'foot', 60, NULL, false),
  ('sty-qiuqiu', 'svc-main-french', 'hand', 60, NULL, false),
  ('sty-qiuqiu', 'svc-main-french', 'foot', 90, NULL, false),
  ('sty-qiuqiu', 'svc-main-mirror', 'hand', 60, NULL, false),
  ('sty-qiuqiu', 'svc-main-mirror', 'foot', 60, NULL, false),
  ('sty-qiuqiu', 'svc-main-store-style', 'hand', 90, NULL, false),
  ('sty-qiuqiu', 'svc-main-store-style', 'foot', 90, NULL, false),
  ('sty-qiuqiu', 'svc-main-custom-style', 'hand', 150, '範圍 90-150，預設150', false),
  ('sty-qiuqiu', 'svc-main-custom-style', 'foot', 150, '範圍 90-150，預設150', false),
  ('sty-qiuqiu', 'svc-addon-remove', 'hand', 30, NULL, false),
  ('sty-qiuqiu', 'svc-addon-remove', 'foot', 20, NULL, false),
  ('sty-qiuqiu', 'svc-addon-care', 'hand', 50, NULL, false),
  ('sty-qiuqiu', 'svc-addon-care', 'foot', 50, NULL, false),
  ('sty-qiuqiu', 'svc-addon-shape', 'hand', 20, NULL, false),
  ('sty-qiuqiu', 'svc-addon-shape', 'foot', 20, NULL, false),
  ('sty-qiuqiu', 'svc-addon-thicken', 'hand', 30, '加算時間 +30', false),
  ('sty-qiuqiu', 'svc-addon-thicken', 'foot', 30, '加算時間 +30', false)
ON CONFLICT (stylist_id, service_id, category) DO UPDATE SET
  duration_minutes = EXCLUDED.duration_minutes,
  duration_note = EXCLUDED.duration_note,
  is_pending = EXCLUDED.is_pending;

-- ────────────────────────────────────────────────────────────
-- OPTIONAL SAMPLE BOOKINGS (for admin dashboard preview)
-- ────────────────────────────────────────────────────────────
INSERT INTO bookings (
  id, branch_id, service_id, stylist_id, customer_name, line_id, phone,
  selected_services, category, total_duration,
  date, start_time, end_time, status, note
) VALUES
  (
    uuid_generate_v4(), '1', 'svc-main-solid', 'sty-tingting', '王小美', 'U_DEMO_001', '0912345678',
    '[{"service_id":"svc-main-solid","service_name":"單色","service_type":"main","category":"hand","duration_minutes":30}]'::JSONB,
    'hand', 30,
    CURRENT_DATE + 1, '10:00', '10:30', 'confirmed', NULL
  ),
  (
    uuid_generate_v4(), '2', 'svc-main-custom-style', 'sty-ani', '林依婷', 'U_DEMO_002', '0923456789',
    '[{"service_id":"svc-main-custom-style","service_name":"自帶圖款式","service_type":"main","category":"hand","duration_minutes":180}]'::JSONB,
    'hand', 180,
    CURRENT_DATE + 2, '11:00', '14:00', 'confirmed', '需要先看圖'
  ),
  (
    uuid_generate_v4(), '3', 'svc-main-cat-eye', 'sty-xiaoq', '陳雅萱', 'U_DEMO_003', '0934567890',
    '[{"service_id":"svc-main-cat-eye","service_name":"貓眼","service_type":"main","category":"foot","duration_minutes":69},{"service_id":"svc-addon-thicken","service_name":"加厚","service_type":"addon","category":"foot","duration_minutes":25}]'::JSONB,
    'foot', 94,
    CURRENT_DATE - 1, '14:00', '15:34', 'completed', NULL
  )
ON CONFLICT DO NOTHING;
