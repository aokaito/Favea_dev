import Anthropic from '@anthropic-ai/sdk'

/**
 * Claude APIを使ったイベント情報抽出
 */

// 抽出されたイベント情報の型
export interface ExtractedEvent {
  title: string
  event_date: string | null
  venue: string | null
  deadlines: {
    type: 'lottery_start' | 'lottery_end' | 'payment'
    start_at?: string | null
    end_at: string
    description?: string
  }[]
  source_url: string
}

export interface ExtractionResult {
  idol_name: string
  events: ExtractedEvent[]
  raw_response?: string
}

const EXTRACTION_PROMPT = `あなたはイベント情報抽出AIです。以下のWebページ内容から、アイドル・アーティストのイベント（ライブ、コンサート、握手会、リリースイベント、ファンミーティング等）の情報を抽出してください。

抽出する情報:
- イベント名（title）: イベントの正式名称
- 開催日時（event_date）: ISO 8601形式（YYYY-MM-DDTHH:mm:ss）、時間が不明な場合は日付のみ
- 会場（venue）: 開催場所の名称
- 締切情報（deadlines）: 以下のタイプがあれば抽出
  - lottery_start: 抽選受付開始日
  - lottery_end: 抽選受付終了日/申込締切
  - payment: 入金締切/支払期限

重要な指示:
- 実際にページに記載されている情報のみを抽出してください
- 推測や補完はしないでください
- 日付が曖昧な場合（「○月上旬」など）は、その月の1日をデフォルトとしてください
- 年が明記されていない場合は、現在の年または次の年を適切に判断してください
- イベントが複数ある場合は、すべて抽出してください
- 関連するアーティスト/アイドル名も特定してください

以下のJSON形式で出力してください。説明文などは不要です:
{
  "idol_name": "アーティスト/アイドル名",
  "events": [
    {
      "title": "イベント名",
      "event_date": "2025-03-15T18:00:00",
      "venue": "会場名",
      "deadlines": [
        {
          "type": "lottery_end",
          "end_at": "2025-02-28T23:59:59",
          "description": "一般抽選"
        }
      ]
    }
  ]
}

イベント情報が見つからない場合は、events配列を空にしてください。

---

Webページ内容:
`

/**
 * Jina Reader APIでWebページをMarkdown形式で取得
 */
export async function fetchPageContent(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`

  const response = await fetch(jinaUrl, {
    headers: {
      Accept: 'text/markdown',
      'X-Return-Format': 'markdown',
    },
  })

  if (!response.ok) {
    throw new Error(`ページの取得に失敗しました: ${response.status}`)
  }

  const content = await response.text()

  // コンテンツが長すぎる場合は切り詰め（Claude APIの制限を考慮）
  const maxLength = 100000
  if (content.length > maxLength) {
    return content.slice(0, maxLength) + '\n\n[...コンテンツが長いため省略...]'
  }

  return content
}

/**
 * Claude APIでイベント情報を抽出
 */
export async function extractEventInfo(
  pageContent: string,
  sourceUrl: string
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEYが設定されていません')
  }

  const anthropic = new Anthropic({
    apiKey,
  })

  const currentYear = new Date().getFullYear()
  const prompt = EXTRACTION_PROMPT + pageContent + `\n\n現在の年: ${currentYear}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // レスポンスからテキストを取得
  const textContent = message.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('AIからの応答が取得できませんでした')
  }

  const responseText = textContent.text

  // JSONを抽出してパース
  try {
    // コードブロック内のJSONを探す
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim()

    const parsed = JSON.parse(jsonStr) as ExtractionResult

    // source_urlを各イベントに追加
    parsed.events = parsed.events.map((event) => ({
      ...event,
      source_url: sourceUrl,
    }))

    return {
      ...parsed,
      raw_response: responseText,
    }
  } catch {
    console.error('JSON parse error:', responseText)
    throw new Error('イベント情報の解析に失敗しました')
  }
}

/**
 * 推し名からGoogle検索URLを生成
 */
export function generateSearchUrl(keyword: string): string {
  const searchQuery = `${keyword} ライブ チケット 2025`
  return `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
}
