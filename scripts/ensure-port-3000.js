/**
 * Kills any process on port 3000 and removes Next.js dev lock so the dev server can start on localhost:3000.
 * Run as predev (before `next dev`).
 */
const killPort = require("kill-port");
const fs = require("fs");
const path = ".next/dev/lock";

killPort(3000)
  .catch(() => {})
  .then(() => {
    try {
      fs.unlinkSync(path);
    } catch (_) {
      // ignore if lock doesn't exist
    }
  })
  .then(() => process.exit(0));
