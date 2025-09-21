-- Create api_tokens table
CREATE TABLE api_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash        VARCHAR(255) NOT NULL UNIQUE,
  token_encrypted   JSONB,
  prefix            VARCHAR(50) NOT NULL,
  name              VARCHAR(100) NOT NULL,
  scopes            JSONB NOT NULL DEFAULT '[]'::jsonb,
  allow_viewing     BOOLEAN DEFAULT true,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at        TIMESTAMPTZ,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ,
  
  -- Ensure token is not both expired and revoked (for data consistency)
  CONSTRAINT valid_token_state CHECK (
    (expires_at IS NULL OR expires_at > created_at) AND
    (revoked_at IS NULL OR revoked_at >= created_at)
  )
);

-- Create indexes for performance
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_prefix ON api_tokens(prefix);
CREATE INDEX idx_api_tokens_expires_at ON api_tokens(expires_at);
CREATE INDEX idx_api_tokens_scopes ON api_tokens USING GIN(scopes);
CREATE INDEX idx_api_tokens_allow_viewing ON api_tokens(allow_viewing) WHERE allow_viewing = true;

-- Enable RLS
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own tokens
CREATE POLICY api_tokens_select_own 
ON api_tokens FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Users can create tokens for themselves (user_id can be null for system tokens)
CREATE POLICY api_tokens_insert_own 
ON api_tokens FOR INSERT 
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Users can update their own tokens
CREATE POLICY api_tokens_update_own 
ON api_tokens FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own tokens
CREATE POLICY api_tokens_delete_own 
ON api_tokens FOR DELETE 
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage all tokens (for cleanup, admin operations)
CREATE POLICY api_tokens_service_all 
ON api_tokens FOR ALL 
TO service_role
USING (true);

-- Add comment explaining the table structure
COMMENT ON TABLE api_tokens IS 'API tokens for programmatic access to the application';
COMMENT ON COLUMN api_tokens.token_hash IS 'Hashed version of the actual token (never store plaintext)';
COMMENT ON COLUMN api_tokens.token_encrypted IS 'Encrypted token data (IV, tag, encrypted content) for viewable tokens';
COMMENT ON COLUMN api_tokens.prefix IS 'Visible prefix of the token (e.g., "cx_01h8...")';
COMMENT ON COLUMN api_tokens.name IS 'User-friendly name for the token (e.g., "Chrome Extension")';
COMMENT ON COLUMN api_tokens.scopes IS 'JSON array of scopes/permissions for this token';
COMMENT ON COLUMN api_tokens.allow_viewing IS 'Whether this token can be decrypted and viewed';
COMMENT ON COLUMN api_tokens.user_id IS 'Optional: User who owns this token (null for system tokens)';
COMMENT ON COLUMN api_tokens.expires_at IS 'Optional: When this token expires (null = never expires)';
COMMENT ON COLUMN api_tokens.last_used_at IS 'When this token was last used for API access';
COMMENT ON COLUMN api_tokens.revoked_at IS 'When this token was revoked (null = still active)';