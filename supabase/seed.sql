-- ============================================================
-- Lumière Nails — Demo Seed Data
-- Run AFTER schema.sql to populate the database with demo data
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- BRANCHES
-- ────────────────────────────────────────────────────────────
INSERT INTO branches (id, name, address, staff_count, phone, image_url) VALUES
  ('1', 'Neili Branch',   'Neili District, Taoyuan City',              2, '03-123-4567', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop'),
  ('2', 'Zhongli Branch', 'Zhongli District, Taoyuan City',            3, '03-234-5678', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop'),
  ('3', 'CYCU Branch',    'Near Chung Yuan Christian University, Taoyuan', 2, '03-345-6789', 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&auto=format&fit=crop')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SERVICES
-- ────────────────────────────────────────────────────────────
INSERT INTO services (id, name, duration_minutes, price, description, category) VALUES
  ('1', 'Basic Manicure',   60,  600,  'Classic nail care including shaping, cuticle care, and polish application.',   'Manicure'),
  ('2', 'Gel Manicure',     120, 1200, 'Long-lasting gel polish that stays chip-free for up to 3 weeks.',              'Gel'),
  ('3', 'Gel Removal',      30,  300,  'Safe and gentle removal of existing gel polish.',                              'Removal'),
  ('4', 'Nail Art Basic',   90,  900,  'Creative nail art designs including patterns, gradients, and accents.',        'Nail Art'),
  ('5', 'Premium Nail Art', 150, 1800, 'Elaborate custom nail art with gems, 3D elements, and intricate designs.',     'Nail Art')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SAMPLE BOOKINGS (demo data so admin dashboard looks real)
-- Dates are relative — adjust these to be near your demo date
-- Using fixed dates for the demo; update as needed
-- ────────────────────────────────────────────────────────────

-- Neili Branch bookings
INSERT INTO bookings (branch_id, service_id, customer_name, line_id, phone, date, start_time, end_time, status) VALUES
  ('1', '2', 'Alice Chen',    '@alice_nails',   '0912-345-678', CURRENT_DATE + 1, '10:00', '12:00', 'confirmed'),
  ('1', '1', 'Betty Lin',     '@betty_lin',     '0923-456-789', CURRENT_DATE + 1, '10:00', '11:00', 'confirmed'),
  ('1', '4', 'Clara Wu',      '@clarawu',       NULL,           CURRENT_DATE + 1, '13:00', '14:35', 'confirmed'),
  ('1', '2', 'Diana Huang',   '@diana_h',       '0934-567-890', CURRENT_DATE + 2, '14:00', '16:00', 'confirmed'),
  ('1', '5', 'Eva Tsai',      '@eva_nails',     '0945-678-901', CURRENT_DATE + 3, '10:00', '12:35', 'confirmed'),
  ('1', '1', 'Fiona Chang',   '@fiona_c',       NULL,           CURRENT_DATE - 2, '11:00', '12:00', 'completed'),
  ('1', '3', 'Grace Liu',     '@grace_liu',     '0956-789-012', CURRENT_DATE - 1, '15:00', '15:30', 'completed'),
  ('1', '2', 'Hannah Ko',     '@hannah_k',      '0967-890-123', CURRENT_DATE - 3, '16:00', '18:00', 'cancelled');

-- Zhongli Branch bookings (3 staff — can handle more concurrent)
INSERT INTO bookings (branch_id, service_id, customer_name, line_id, phone, date, start_time, end_time, status) VALUES
  ('2', '1', 'Iris Wang',     '@iris_w',        '0978-901-234', CURRENT_DATE + 1, '10:00', '11:00', 'confirmed'),
  ('2', '2', 'Jasmine Lee',   '@jasmine_lee',   '0989-012-345', CURRENT_DATE + 1, '10:00', '12:00', 'confirmed'),
  ('2', '4', 'Karen Chen',    '@karen_nails',   NULL,           CURRENT_DATE + 1, '11:00', '12:35', 'confirmed'),
  ('2', '5', 'Lisa Hsu',      '@lisa_hsu',      '0912-111-222', CURRENT_DATE + 2, '10:00', '12:35', 'confirmed'),
  ('2', '2', 'Mia Yang',      '@mia_yang',      '0923-222-333', CURRENT_DATE + 2, '13:00', '15:00', 'confirmed'),
  ('2', '1', 'Nina Chou',     '@nina_c',        NULL,           CURRENT_DATE + 2, '14:00', '15:00', 'confirmed'),
  ('2', '3', 'Olivia Pai',    '@olivia_pai',    '0934-333-444', CURRENT_DATE + 3, '10:00', '10:30', 'confirmed'),
  ('2', '2', 'Penny Su',      '@penny_su',      '0945-444-555', CURRENT_DATE - 1, '15:00', '17:00', 'completed'),
  ('2', '1', 'Quinn Lu',      '@quinn_lu',      NULL,           CURRENT_DATE - 2, '10:00', '11:00', 'completed'),
  ('2', '4', 'Rachel Ho',     '@rachel_ho',     '0956-555-666', CURRENT_DATE - 1, '13:00', '14:35', 'cancelled');

-- CYCU Branch bookings
INSERT INTO bookings (branch_id, service_id, customer_name, line_id, phone, date, start_time, end_time, status) VALUES
  ('3', '1', 'Sarah Cheng',   '@sarah_cycu',    '0967-666-777', CURRENT_DATE + 1, '12:00', '13:00', 'confirmed'),
  ('3', '2', 'Tina Fang',     '@tina_fang',     '0978-777-888', CURRENT_DATE + 1, '12:00', '14:00', 'confirmed'),
  ('3', '4', 'Uma Kuo',       '@uma_kuo',       NULL,           CURRENT_DATE + 2, '10:00', '11:35', 'confirmed'),
  ('3', '3', 'Vera Liao',     '@vera_liao',     '0989-888-999', CURRENT_DATE + 2, '15:00', '15:30', 'confirmed'),
  ('3', '5', 'Wendy Shih',    '@wendy_s',       '0912-999-000', CURRENT_DATE + 3, '13:00', '15:35', 'confirmed'),
  ('3', '1', 'Xena Tao',      '@xena_tao',      NULL,           CURRENT_DATE - 1, '10:00', '11:00', 'completed'),
  ('3', '2', 'Yuki Weng',     '@yuki_w',        '0923-000-111', CURRENT_DATE - 2, '14:00', '16:00', 'completed'),
  ('3', '4', 'Zoe Hung',      '@zoe_hung',      '0934-111-222', CURRENT_DATE - 1, '11:00', '12:35', 'cancelled');
