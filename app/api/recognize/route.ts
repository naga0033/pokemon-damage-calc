import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/png",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `この画像に写っているポケモンを特定してください。

ポケモンのバトル画面、図鑑、またはスクリーンショットから、登場しているポケモンを認識してください。

以下のJSON形式のみで回答してください（説明文は不要）:
{
  "attacker": { "en": "英語名（PokeAPIのスラッグ形式・小文字・ハイフン区切り）", "ja": "日本語名" },
  "defender": { "en": "英語名", "ja": "日本語名" }
}

ポケモンが1匹だけの場合は "defender" を null にしてください。
認識できない場合は { "attacker": null, "defender": null } としてください。`,
            },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    // JSONを抽出
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "認識結果を解析できませんでした" }, { status: 422 });
    }

    const parsed = JSON.parse(match[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("recognize error:", err);
    const message = err instanceof Error ? err.message : "認識に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
