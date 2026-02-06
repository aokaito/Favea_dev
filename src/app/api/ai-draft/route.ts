import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isScrapingAllowed } from '@/lib/robots-checker'
import {
  fetchPageContent,
  extractEventInfo,
  generateSearchUrl,
  type ExtractedEvent,
} from '@/lib/ai-extract'

// リクエストボディの型定義
interface ExtractRequestBody {
  mode?: 'extract'
  keyword?: string
  url?: string
}

interface SaveRequestBody {
  mode: 'save'
  idol_name: string
  events: ExtractedEvent[]
}

type RequestBody = ExtractRequestBody | SaveRequestBody

// 抽出のみ（保存しない）
async function handleExtract(body: ExtractRequestBody) {
  const { keyword, url } = body

  if (!keyword && !url) {
    return NextResponse.json({ error: 'キーワードまたはURLが必要です' }, { status: 400 })
  }

  // 処理対象のURLを決定
  let targetUrl: string
  if (url) {
    targetUrl = url
  } else {
    // 推し名からGoogle検索URLを生成
    targetUrl = generateSearchUrl(keyword!)
  }

  // robots.txtチェック
  const robotsCheck = await isScrapingAllowed(targetUrl)
  if (!robotsCheck.allowed) {
    return NextResponse.json(
      {
        error: robotsCheck.reason || 'このサイトからの情報取得は許可されていません',
      },
      { status: 403 }
    )
  }

  // Jina Reader APIでページ内容を取得
  let pageContent: string
  try {
    pageContent = await fetchPageContent(targetUrl)
  } catch (error) {
    console.error('Page fetch error:', error)
    return NextResponse.json({ error: 'ページの取得に失敗しました' }, { status: 502 })
  }

  // Claude APIでイベント情報を抽出
  let extractionResult
  try {
    extractionResult = await extractEventInfo(pageContent, targetUrl)
  } catch (error) {
    console.error('Extraction error:', error)
    const message = error instanceof Error ? error.message : 'イベント情報の抽出に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 抽出結果を返す（保存はしない）
  return NextResponse.json({
    success: true,
    data: {
      idol_name: extractionResult.idol_name || keyword || 'Unknown',
      events: extractionResult.events,
      message: extractionResult.events.length > 0
        ? `${extractionResult.events.length}件のイベント情報が見つかりました`
        : 'イベント情報が見つかりませんでした',
    },
  })
}

// 保存処理
async function handleSave(body: SaveRequestBody) {
  const supabase = await createClient()

  // 認証チェック
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { idol_name, events } = body

  console.log('handleSave called with:', { idol_name, eventsCount: events?.length })

  if (!idol_name || !events || events.length === 0) {
    return NextResponse.json({ error: 'アーティスト名とイベント情報が必要です' }, { status: 400 })
  }

  const savedEvents: ExtractedEvent[] = []

  // まずIdolを取得または作成（1回だけ）
  let idolId: string

  const { data: existingIdol } = await supabase
    .from('idols')
    .select('id')
    .eq('name', idol_name)
    .single()

  if (existingIdol) {
    idolId = existingIdol.id
    console.log('Found existing idol:', idolId)
  } else {
    const { data: newIdol, error: idolError } = await supabase
      .from('idols')
      .insert({ name: idol_name, tags: [] })
      .select('id')
      .single()

    if (idolError || !newIdol) {
      console.error('Idol creation error:', idolError)
      return NextResponse.json({ error: 'アーティストの作成に失敗しました' }, { status: 500 })
    }
    idolId = newIdol.id
    console.log('Created new idol:', idolId)
  }

  // 各イベントを保存
  for (const event of events) {
    try {
      console.log('Saving event:', event.title)

      // Eventを作成
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          idol_id: idolId,
          title: event.title,
          event_date: event.event_date,
          venue: event.venue,
          source_url: event.source_url,
          is_draft: false,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (eventError || !newEvent) {
        console.error('Event creation error:', eventError)
        continue
      }
      const eventId = newEvent.id
      console.log('Created event:', eventId)

      // 締切情報を作成
      if (event.deadlines && event.deadlines.length > 0) {
        for (const deadline of event.deadlines) {
          const { error: deadlineError } = await supabase
            .from('ticket_deadlines')
            .insert({
              event_id: eventId,
              deadline_type: deadline.type,
              start_at: deadline.start_at || null,
              end_at: deadline.end_at,
              description: deadline.description || null,
            })

          if (deadlineError) {
            console.error('Deadline creation error:', deadlineError)
          } else {
            console.log('Created deadline:', deadline.type)
          }
        }
      }

      // UserEventを作成
      const { error: userEventError } = await supabase
        .from('user_events')
        .insert({
          user_id: user.id,
          event_id: eventId,
          status: 'not_applied',
        })

      if (userEventError) {
        console.error('UserEvent creation error:', userEventError)
      } else {
        console.log('Created user_event')
      }

      savedEvents.push(event)
    } catch (error) {
      console.error('Event save error:', error)
      continue
    }
  }

  console.log('Total saved events:', savedEvents.length)

  return NextResponse.json({
    success: true,
    data: {
      saved_count: savedEvents.length,
      message: `${savedEvents.length}件のイベントを保存しました`,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    // ボディを1回だけ読み取る
    const body: RequestBody = await request.json()
    console.log('API received body:', JSON.stringify(body, null, 2))

    if (body.mode === 'save') {
      return handleSave(body as SaveRequestBody)
    } else {
      return handleExtract(body as ExtractRequestBody)
    }
  } catch (error) {
    console.error('AI Draft API Error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// 収集履歴の取得
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // ユーザーのイベントを取得
    const { data: userEvents, error: fetchError } = await supabase
      .from('user_events')
      .select(
        `
        id,
        status,
        created_at,
        event:events (
          id,
          title,
          event_date,
          venue,
          source_url,
          is_draft,
          idol:idols (
            name
          ),
          ticket_deadlines (
            deadline_type,
            start_at,
            end_at,
            description
          )
        )
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: userEvents || [],
    })
  } catch (error) {
    console.error('AI Draft API Error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
