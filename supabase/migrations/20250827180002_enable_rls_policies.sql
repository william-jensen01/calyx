-- Enable RLS on all tables, except sessions
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;


-- Users table policies
CREATE POLICY users_select_own 
ON users FOR SELECT 
TO authenticated
USING (id = auth.uid());

CREATE POLICY users_update_own 
ON users FOR UPDATE 
TO authenticated
USING (id = auth.uid());

-- Allow user registration (anyone can insert during signup)
CREATE POLICY users_insert_signup 
ON users FOR INSERT 
WITH CHECK (true);


-- Events table policies
CREATE POLICY events_select_own 
ON events FOR SELECT 
TO authenticated
USING (id = auth.uid());

CREATE POLICY events_insert_own 
ON events FOR INSERT 
WITH CHECK (true);

CREATE POLICY events_update_own 
ON events FOR UPDATE 
TO authenticated
USING (id = auth.uid());

CREATE POLICY events_delete_own 
ON events FOR DELETE 
TO authenticated
USING (id = auth.uid());
