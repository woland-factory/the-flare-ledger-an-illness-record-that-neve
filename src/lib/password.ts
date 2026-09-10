import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes } from "node:crypto";

// argon2id parameters follow OWASP guidance for interactive logins.
const MEMORY_KIB = 19456; // 19 MiB
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(16),
    parallelism: PARALLELISM,
    iterations: ITERATIONS,
    memorySize: MEMORY_KIB,
    hashLength: HASH_LENGTH,
    outputType: "encoded",
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}
