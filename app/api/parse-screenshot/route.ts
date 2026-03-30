import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolvePokemonJaName } from "@/lib/pokemon-names";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "画像データがありません" }, { status: 400 });
    }

    // base64のdata URLプレフィックスがあれば除去
    const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/png",
                data: cleanBase64,
              },
            },
            {
              type: "text",
              text: `あなたはポケモンのスクリーンショットからポケモンの情報を読み取る専門家です。
この画像からポケモン名・持ち物・特性・性格・努力値・実数値・技を読み取ってください。

【対応する画像の種類】
1. 白背景の構築テキスト形式（育成論・共有用テキストを含む）
2. ゲーム内ステータス画面（暗い背景・独特なフォント）
3. SVのボックス画面
4. ポケモンHOMEの画面
5. Pokemon Champions の能力画面

【出力形式】このJSONのみを出力してください（コードブロック不要）:
{
  "pokemonName": "日本語のポケモン名（例: コライドン）",
  "item": "持ち物の日本語名（例: こだわりハチマキ）",
  "teraType": "テラスタイプの日本語名（例: でんき）",
  "nature": "性格のひらがな（例: いじっぱり）",
  "ability": "特性の日本語名（例: ひひいろのこどう）",
  "evs": {
    "hp": 数値, "attack": 数値, "defense": 数値,
    "spAtk": 数値, "spDef": 数値, "speed": 数値
  },
  "stats": {
    "hp": 数値, "attack": 数値, "defense": 数値,
    "spAtk": 数値, "spDef": 数値, "speed": 数値
  },
  "moves": ["技名1", "技名2", "技名3", "技名4"],
  "typeName": "型名（例: はちまきASコライドン）。推測できなければnull"
}

【読み取りルール】
- EVテキスト形式: "H252 B236 C4 D4 S12" → H=HP, A=こうげき, B=ぼうぎょ, C=とくこう, D=とくぼう, S=すばやさ
- 画像内に H/A/B/C/D/S のアルファベットと数字が並んでいたら、努力値の略記として最優先で解釈する
- "H 252 A 252 S 4" や "H:252/A:252/S:4" のように区切り記号や空白が入っていても同じ意味として扱う
- JSONの evs は {"hp":252,"attack":244,...} の形式が理想だが、もし H/A/B/C/D/S キーで抽出した場合もその意味で返してよい
- 実数値(EV)形式: "201(204)-198(196)-136(4)-94-122(12)-167(92)" → かっこ内がEV、かっこ外が実数値
- ゲーム内画面: HP/こうげき/ぼうぎょ/とくこう/とくぼう/すばやさ の横の数値を stats に入れる
- Pokemon Champions の能力画面では、各能力の左側や中央に大きく表示される数値が実数値。右端の小さい数値や VP 表示は努力値扱いせず、evs には入れない
- Pokemon Champions の画面では evs は null か 0 でよい。stats を優先して埋める
- 努力値が画面に表示されていなければ evs は全て null にする
- 技は "/" や 全角スペース 区切り。日本語の技名のみ
- 読み取れない項目は null にする

重要: JSONのみ出力。コードブロックで囲わないでください。`,
            },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    // JSONを抽出（コードブロックで囲まれている場合も対応）
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "画像からポケモン情報を読み取れませんでした。テキストが鮮明な画像をお試しください。", raw: text }, { status: 422 });
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed?.pokemonName) {
        parsed.pokemonName = resolvePokemonJaName(parsed.pokemonName) ?? parsed.pokemonName;
      }
      return NextResponse.json(parsed);
    } catch {
      // JSONパース失敗時、余分な文字列を除去して再試行
      const cleaned = jsonStr.replace(/[\x00-\x1f]/g, " ").trim();
      const retryMatch = cleaned.match(/\{[\s\S]*\}/);
      if (retryMatch) {
        try {
          const parsed = JSON.parse(retryMatch[0]);
          if (parsed?.pokemonName) {
            parsed.pokemonName = resolvePokemonJaName(parsed.pokemonName) ?? parsed.pokemonName;
          }
          return NextResponse.json(parsed);
        } catch { /* fall through */ }
      }
      return NextResponse.json({ error: "解析結果のJSON変換に失敗しました", raw: jsonStr }, { status: 422 });
    }
  } catch (err) {
    console.error("Parse screenshot error:", err);
    const message = err instanceof Error ? err.message : "不明なエラー";
    if (message.includes("401") || message.includes("authentication")) {
      return NextResponse.json({ error: "APIキーが無効です。ANTHROPIC_API_KEY を確認してください。" }, { status: 401 });
    }
    if (message.includes("rate") || message.includes("429")) {
      return NextResponse.json({ error: "API制限に達しました。しばらく待ってから再度お試しください。" }, { status: 429 });
    }
    return NextResponse.json({ error: `解析エラー: ${message}` }, { status: 500 });
  }
}
