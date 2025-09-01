-- Add new columns to sessions table
ALTER TABLE sessions 
ADD COLUMN ip_address INET,
ADD COLUMN device_info JSONB,
ADD COLUMN last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create index for last_activity (useful for cleanup and session management)
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);

-- Create index for ip_address (useful for security monitoring)
CREATE INDEX idx_sessions_ip_address ON sessions(ip_address);

-- Update existing sessions to have current timestamp for last_activity
UPDATE sessions SET last_activity = created_at WHERE last_activity IS NULL;

-- Add a comment explaining the device_info structure
COMMENT ON COLUMN sessions.device_info IS 'JSON object containing device information: {"userAgent": "...", "browser": "...", "os": "...", "device": "..."}';


-- Add function to update last_activity column to have current timestamp
CREATE OR REPLACE FUNCTION update_session_last_activity_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating last_activity column
CREATE TRIGGER update_sessions_last_activity
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_session_last_activity_column();
