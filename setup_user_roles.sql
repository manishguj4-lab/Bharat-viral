CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;


ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access to published articles" ON articles FOR SELECT USING (status = 'published');
CREATE POLICY "Allow authenticated admins full access to articles" ON articles FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read-only access to active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Allow authenticated admins full access to categories" ON categories FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));
