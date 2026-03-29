"use client";
import { PokemonType } from "@/lib/types";
import { TYPE_COLORS, TYPE_NAMES_JA } from "@/lib/type-chart";

interface Props {
  type: PokemonType;
  size?: "sm" | "md";
}

export default function TypeBadge({ type, size = "md" }: Props) {
  const color = TYPE_COLORS[type];
  const name = TYPE_NAMES_JA[type];

  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-block rounded-full font-bold text-white ${padding}`}
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}
