import { copyFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const source = path.join(projectRoot, "public", "icon-poketch.svg");
const active = path.join(projectRoot, "public", "icon.svg");

await copyFile(source, active);

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(projectRoot, "scripts", "generate-app-icons.mjs")], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`generate-app-icons exited with code ${code ?? "unknown"}`));
  });
  child.on("error", reject);
});

console.log(`Activated Poketch icon source: ${source} -> ${active}`);
