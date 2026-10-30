const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Mismo cálculo que huella() en chat-widget/scripts/sync-catalogo.mjs: CRLF→LF antes del hash.
module.exports = createHash("sha256")
  .update(readFileSync(join(__dirname, "catalogo", "es.json"), "utf8").replace(/\r\n/g, "\n"))
  .digest("hex");
