import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isScrapingAllowed } from '@/lib/robots-checker'
import {
  fetchPageContent,
  extractEventInfo,
  generateSearchUrl,
  type ExtractedEvent,
} from '@/lib/ai-extract'

// Helper types for Supabase queries without generated types
interface IdRecord {
  id: string
}

interface QueryResult<T> {
  data: T | null
  error: Error | null
}

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

// Helper function to execute Supabase queries
async function querySupabase<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  operation: 'select' | 'insert',
  options: {
    columns?: string
    filter?: { column: string; value: string }
    data?: Record<string, unknown> | Record<string, unknown>[]
    single?: boolean
  }
): Promise<QueryResult<T>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from(table)

    if (operation === 'select') {
      query = query.select(options.columns || '*')
      if (options.filter) {
        query = query.eq(options.filter.column, options.filter.value)
      }
    } else if (operation === 'insert') {
      query = query.insert(options.data)
      if (options.columns) {
        query = query.select(options.columns)
      }
    }

    if (options.single) {
      return await query.single()
    }

    return await query
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

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

  const existingIdolResult = await querySupabase<IdRecord>(supabase, 'idols', 'select', {
    columns: 'id',
    filter: { column: 'name', value: idol_name },
    single: true,
  })

  if (existingIdolResult.data) {
    idolId = existingIdolResult.data.id
    console.log('Found existing idol:', idolId)
  } else {
    const newIdolResult = await querySupabase<IdRecord>(supabase, 'idols', 'insert', {
      data: { name: idol_name, tags: [] },
      columns: 'id',
      single: true,
    })

    if (newIdolResult.error || !newIdolResult.data) {
      console.error('Idol creation error:', newIdolResult.error)
      return NextResponse.json({ error: 'アーティストの作成に失敗しました' }, { status: 500 })
    }
    idolId = newIdolResult.data.id
    console.log('Created new idol:', idolId)
  }

  // 各イベントを保存
  for (const event of events) {
    try {
      console.log('Saving event:', event.title)

      // Eventを作成
      const newEventResult = await querySupabase<IdRecord>(supabase, 'events', 'insert', {
        data: {
          idol_id: idolId,
          title: event.title,
          event_date: event.event_date,
          venue: event.venue,
          source_url: event.source_url,
          is_draft: false, // ユーザーが確認して保存したのでドラフトではない
          created_by: user.id,
        },
        columns: 'id',
        single: true,
      })

      if (newEventResult.error || !newEventResult.data) {
        console.error('Event creation error:', newEventResult.error)
        continue
      }
      const eventId = newEventResult.data.id
      console.log('Created event:', eventId)

      // 締切情報を作成
      if (event.deadlines && event.deadlines.length > 0) {
        for (const deadline of event.deadlines) {
          const deadlineResult = await querySupabase<IdRecord>(supabase, 'ticket_deadlines', 'insert', {
            data: {
              event_id: eventId,
              deadline_type: deadline.type,
              start_at: deadline.start_at || null,
              end_at: deadline.end_at,
              description: deadline.description || null,
            },
            columns: 'id',
            single: true,
          })

          if (deadlineResult.error) {
            console.error('Deadline creation error:', deadlineResult.error)
          } else {
            console.log('Created deadline:', deadline.type)
          }
        }
      }

      // UserEventを作成
      const userEventResult = await querySupabase<IdRecord>(supabase, 'user_events', 'insert', {
        data: {
          user_id: user.id,
          event_id: eventId,
          status: 'not_applied',
        },
        columns: 'id',
        single: true,
      })

      if (userEventResult.error) {
        console.error('UserEvent creation error:', userEventResult.error)
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
