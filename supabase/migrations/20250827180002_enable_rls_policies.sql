-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;


-- Users table policies
CREATE POLICY users_select_own 
ON users FOR SELECT 
USING (id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY users_update_own 
ON users FOR UPDATE 
USING (id = current_setting('app.current_user_id', true)::uuid);

-- Allow user registration (anyone can insert during signup)
CREATE POLICY users_insert_signup 
ON users FOR INSERT 
WITH CHECK (true);


-- Sessions table policies
CREATE POLICY sessions_select_own 
ON sessions FOR SELECT 
USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY sessions_insert_own 
ON sessions FOR INSERT 
WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY sessions_delete_own 
ON sessions FOR DELETE 
USING (user_id = current_setting('app.current_user_id', true)::uuid);


-- Events table policies
CREATE POLICY events_select_own 
ON events FOR SELECT 
USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY events_insert_own 
ON events FOR INSERT 
WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY events_update_own 
ON events FOR UPDATE 
USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY events_delete_own 
ON events FOR DELETE 
USING (user_id = current_setting('app.current_user_id', true)::uuid);