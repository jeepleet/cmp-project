import { createPasswordHash } from "./auth.js";

const password = process.env.CMP_ADMIN_PASSWORD_TO_HASH || process.argv[2] || "";

if (!password) {
  console.error("Provide a password with CMP_ADMIN_PASSWORD_TO_HASH or as the first argument.");
  process.exit(1);
}

console.log(createPasswordHash(password));
