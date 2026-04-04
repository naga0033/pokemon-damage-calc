import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const source = path.join(projectRoot, "public", "icon.svg");

const targets = [
  { size: 192, output: path.join(projectRoot, "public", "icon-192.png") },
  { size: 512, output: path.join(projectRoot, "public", "icon-512.png") },
  {
    size: 1024,
    output: path.join(
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

const svg = await readFile(source);

await Promise.all(
  targets.map(({ size, output }) =>
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile(output)
  )
);

console.log("Generated app icons:");
for (const target of targets) {
  console.log(`- ${target.size}px -> ${target.output}`);
}
