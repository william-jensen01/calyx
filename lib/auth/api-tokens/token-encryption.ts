import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment or generate one
function getEncryptionKey(): Buffer {
  const keyFromEnv = process.env.TOKEN_ENCRYPTION_KEY;

  if (keyFromEnv) {
    // Convert hex string to buffer
    if (keyFromEnv.length !== 64) {
      throw new Error(
        "TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)"
      );
    }
    return Buffer.from(keyFromEnv, "hex");
  }

  // Generate a key and warn user
  const generatedKey = crypto.randomBytes(KEY_LENGTH);
  console.warn("⚠️  TOKEN_ENCRYPTION_KEY not found in environment variables!");
  console.warn(
    "⚠️  Using generated key - tokens will not be recoverable after restart!"
  );
  console.warn(
    `⚠️  Add this to your .env.local: TOKEN_ENCRYPTION_KEY=${generatedKey.toString(
      "hex"
    )}`
  );

  return generatedKey;
}

export interface EncryptedTokenData {
  encrypted: string;
  iv: string;
  tag: string;
  algorithm: string;
}

/**
 * Encrypt a token for secure storage
 */
export function encryptToken(token: string): EncryptedTokenData {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // 128-bit IV for GCM

    const cipher = crypto.createCipheriv(
      ALGORITHM,
      key,
      iv
    ) as crypto.CipherGCM;
    cipher.setAAD(Buffer.from("api-token")); // Additional authenticated data

    let encrypted = cipher.update(token, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      algorithm: ALGORITHM,
    };
  } catch (error) {
    console.error("Token encryption failed:", error);
    throw new Error("Failed to encrypt token");
  }
}

/**
 * Decrypt a token from secure storage
 */
export function decryptToken(encryptedData: EncryptedTokenData): string {
  try {
    const key = getEncryptionKey();

    // Validate the encrypted data structure
    if (!encryptedData.encrypted || !encryptedData.iv || !encryptedData.tag) {
      throw new Error("Invalid encrypted token data structure");
    }

    const iv = Buffer.from(encryptedData.iv, "hex");

    const decipher = crypto.createDecipheriv(
      encryptedData.algorithm || ALGORITHM,
      key,
      iv
    ) as crypto.DecipherGCM;
    decipher.setAAD(Buffer.from("api-token")); // Same AAD used during encryption
    decipher.setAuthTag(Buffer.from(encryptedData.tag, "hex"));

    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Token decryption failed:", error);
    throw new Error(
      "Failed to decrypt token - data may be corrupted or key changed"
    );
  }
}

/**
 * Validate encrypted token data structure
 */
export function isValidEncryptedData(
  data: Partial<EncryptedTokenData>
): data is EncryptedTokenData {
  return (
    data &&
    typeof data === "object" &&
    typeof data.encrypted === "string" &&
    typeof data.iv === "string" &&
    typeof data.tag === "string" &&
    data.encrypted.length > 0 &&
    data.iv.length === 32 && // 16 bytes = 32 hex chars
    data.tag.length === 32 // 16 bytes = 32 hex chars
  );
}

/**
 * Generate a new encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

/**
 * Test encryption/decryption with a sample token
 */
export function testEncryption(): boolean {
  try {
    const testToken = "cx_test_token_1234567890abcdef";
    const encrypted = encryptToken(testToken);
    const decrypted = decryptToken(encrypted);

    const success = decrypted === testToken;

    if (success) {
      console.log("✅ Token encryption test passed");
    } else {
      console.error(
        "❌ Token encryption test failed - decrypted token does not match"
      );
    }

    return success;
  } catch (error) {
    console.error("❌ Token encryption test failed:", error);
    return false;
  }
}

// Helper to create encryption key for first setup
if (require.main === module) {
  const command = process.argv[2];

  if (command === "generate-key") {
    const key = generateEncryptionKey();
    console.log("🔑 Generated encryption key:");
    console.log(`TOKEN_ENCRYPTION_KEY=${key}`);
    console.log("\n💡 Add this to your .env.local file");
  } else if (command === "test") {
    testEncryption();
  } else {
    console.log("Usage:");
    console.log("  generate-key  - Generate a new encryption key");
    console.log("  test         - Test encryption/decryption");
  }
}
