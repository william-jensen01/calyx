-- Add unique column for storing user calendar tokens
ALTER TABLE users
ADD COLUMN url_token VARCHAR(32);

-- Create trigger functions to auto-generate URL tokens
CREATE OR REPLACE FUNCTION generate_url_token()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if url_token is NULL or empty
    IF NEW.url_token IS NULL OR NEW.url_token = '' THEN
        NEW.url_token := encode(gen_random_bytes(16), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on users table for automatic token generation
CREATE TRIGGER generate_user_url_token
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION generate_url_token();

-- Generate unique tokens for existing users
UPDATE users SET url_token = encode(gen_random_bytes(16), 'hex') WHERE url_token IS NULL;

-- Make the column NOT NULL and UNIQUE after populating existing records
ALTER TABLE users
ALTER COLUMN url_token SET NOT NULL;
ALTER TABLE users
ADD CONSTRAINT users_url_token_unique UNIQUE (url_token);

-- Add index for performance
CREATE INDEX idx_users_url_token ON users(url_token);

-- Add comment explaining the purpose
COMMENT ON COLUMN users.url_token IS 'Unique URL-safe token used for routing instead of exposing user IDs';
COMMENT ON FUNCTION generate_url_token() IS 'Trigger function that automatically generates URL tokens for new users';

