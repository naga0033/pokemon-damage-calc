import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "画像データがありません" }, { status: 400 });

    // base64のdata URLプレフィックスがあれば除去
    const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: cleanBase64 } },
          {
            type: "text",
            text: `このポケモンのステータス画面から数値を読み取ってください。

表示されている努力値(EV)・個体値(IV)・実数値を読み取り、以下のJSON形式のみで回答してください:
{
  "hp":     { "ev": 0, "iv": 31, "actual": 170 },
  "attack": { "ev": 0, "iv": 31, "actual": 100 },
  "defense":{ "ev": 0, "iv": 31, "actual": 100 },
  "spAtk":  { "ev": 0, "iv": 31, "actual": 100 },
  "spDef":  { "ev": 0, "iv": 31, "actual": 100 },
  "speed":  { "ev": 0, "iv": 31, "actual": 100 }
}

- 努力値が読み取れない場合は0
- 個体値が読み取れない場合は31
- 実数値が読み取れない場合はnull
- 説明文は一切不要です。JSONのみ返してください。`,
          },
        ],
      }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "解析できませんでした" }, { status: 422 });
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    console.error("analyze-stats error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "解析に失敗しました" }, { status: 500 });
  }
}
