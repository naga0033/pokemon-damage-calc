import { copyFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

const copies = [
  {
    from: path.join(projectRoot, "public", "icon-legacy-trophy.svg"),
    to: path.join(projectRoot, "public", "icon.svg"),
  },
  {
    from: path.join(projectRoot, "public", "icon-192-legacy-trophy.png"),
    to: path.join(projectRoot, "public", "icon-192.png"),
  },
  {
    from: path.join(projectRoot, "public", "icon-512-legacy-trophy.png"),
    to: path.join(projectRoot, "public", "icon-512.png"),
  },
  {
    from: path.join(
      projectRoot,
      "ios",
      "PokeDamageCalc",
      "PokeDamageCalc",
      "AppIcon.xcassets",
      "AppIcon.appiconset",
      "AppIcon-legacy-trophy.png"
    ),
    to: path.join(
      projectRoot,
      "ios",
      "PokeDamageCalc",
      "PokeDamageCalc",
      "AppIcon.xcassets",
      "AppIcon.appiconset",
      "AppIcon.png"
    ),
  },
];

await Promise.all(copies.map(({ from, to }) => copyFile(from, to)));

console.log("Restored legacy trophy icons:");
for (const { from, to } of copies) {
  console.log(`- ${from} -> ${to}`);
}
