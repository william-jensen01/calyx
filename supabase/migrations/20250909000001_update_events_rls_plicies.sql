-- First drop the old policies
DROP POLICY IF EXISTS events_select_own ON events;
DROP POLICY IF EXISTS events_insert_own ON events;
DROP POLICY IF EXISTS events_update_own ON events;
DROP POLICY IF EXISTS events_delete_own ON events;

-- Recreate with user_id instead of id
CREATE POLICY events_select_own 
ON events FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY events_insert_own 
ON events FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY events_update_own 
ON events FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY events_delete_own 
ON events FOR DELETE 
TO authenticated
USING (user_id = auth.uid());