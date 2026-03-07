// Polyfill Web Crypto API for jose library in node test environment
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: typeof webcrypto }).crypto = webcrypto;
}

// Set required env vars before any module imports
process.env.JWT_SECRET = "test-secret-key-at-least-32-characters-long-for-hs256";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.STRIPE_SECRET_KEY = "sk_test_fakekeyfortesting";
process.env.STRIPE_MONTHLY_PRICE_ID = "price_monthly_test";
process.env.STRIPE_ANNUAL_PRICE_ID = "price_annual_test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_testsecret";
process.env.COINBASE_COMMERCE_API_KEY = "test-coinbase-api-key";
process.env.COINBASE_COMMERCE_WEBHOOK_SECRET = "test-coinbase-webhook-secret";
process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
