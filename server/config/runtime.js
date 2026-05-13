import fs from "fs";

export const isDocker = fs.existsSync("/.dockerenv");
