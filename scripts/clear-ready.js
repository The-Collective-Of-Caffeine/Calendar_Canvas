const fs = require("node:fs");
const path = require("node:path");

const readyFile = path.join(process.cwd(), ".main-ready");

if (fs.existsSync(readyFile)) {
  fs.unlinkSync(readyFile);
}
