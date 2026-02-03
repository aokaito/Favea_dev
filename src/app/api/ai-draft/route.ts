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

// Helper function to execute Supabase queries
async function querySupabase<T>(
  supabase: ReturnType<typeof createClient> extends Promise<infer R> ? R : never,
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
    // Use any to bypass TypeScript's strict type checking for dynamic Supabase queries
    const client = supabase as { from: (t: string) => unknown }
    let query = client.from(table) as Record<string, unknown>

    if (operation === 'select') {
      query = (query as { select: (c: string) => unknown }).select(options.columns || '*') as Record<string, unknown>
      if (options.filter) {
        query = (query as { eq: (c: string, v: string) => unknown }).eq(options.filter.column, options.filter.value) as Record<string, unknown>
      }
    } else if (operation === 'insert') {
      query = (query as { insert: (d: unknown) => unknown }).insert(options.data) as Record<string, unknown>
      if (options.columns) {
        query = (query as { select: (c: string) => unknown }).select(options.columns) as Record<string, unknown>
      }
    }

    if (options.single) {
      return await (query as unknown as { single: () => Promise<QueryResult<T>> }).single()
    }

    return await (query as unknown as Promise<QueryResult<T>>)
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

// 抽出のみ（保存しない）
async function handleExtract(request: NextRequest) {
  const body = await request.json()
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
    targetUrl = generateSearchUrl(keyword)
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
async function handleSave(request: NextRequest) {
  const supabase = await createClient()

  // 認証チェック
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { idol_name, events } = body as { idol_name: string; events: ExtractedEvent[] }

  if (!idol_name || !events || events.length === 0) {
    return NextResponse.json({ error: 'アーティスト名とイベント情報が必要です' }, { status: 400 })
  }

  const savedEvents: ExtractedEvent[] = []

  for (const event of events) {
    try {
      // 1. Idolを取得または作成
      let idolId: string

      const existingIdolResult = await querySupabase<IdRecord>(supabase, 'idols', 'select', {
        columns: 'id',
        filter: { column: 'name', value: idol_name },
        single: true,
      })

      if (existingIdolResult.data) {
        idolId = existingIdolResult.data.id
      } else {
        const newIdolResult = await querySupabase<IdRecord>(supabase, 'idols', 'insert', {
          data: { name: idol_name, tags: [] },
          columns: 'id',
          single: true,
        })

        if (newIdolResult.error || !newIdolResult.data) {
          console.error('Idol creation error:', newIdolResult.error)
          continue
        }
        idolId = newIdolResult.data.id
      }

      // 2. Eventを作成
      const newEventResult = await querySupabase<IdRecord>(supabase, 'events', 'insert', {
        data: {
          idol_id: idolId,
          title: event.title,
          event_date: event.event_date,
          venue: event.venue,
          source_url: event.source_url,
          is_draft: true,
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

      // 3. 締切情報を作成
      if (event.deadlines && event.deadlines.length > 0) {
        const deadlineInserts = event.deadlines.map((deadline) => ({
          event_id: eventId,
          deadline_type: deadline.type,
          start_at: deadline.start_at || null,
          end_at: deadline.end_at,
          description: deadline.description || null,
        }))

        const deadlineResult = await querySupabase<null>(supabase, 'ticket_deadlines', 'insert', {
          data: deadlineInserts,
        })

        if (deadlineResult.error) {
          console.error('Deadline creation error:', deadlineResult.error)
        }
      }

      // 4. UserEventを作成（ドラフトとして）
      const userEventResult = await querySupabase<null>(supabase, 'user_events', 'insert', {
        data: {
          user_id: user.id,
          event_id: eventId,
          status: 'not_applied',
        },
      })

      if (userEventResult.error) {
        console.error('UserEvent creation error:', userEventResult.error)
      }

      savedEvents.push(event)
    } catch (error) {
      console.error('Event save error:', error)
      continue
    }
  }

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
    // リクエストボディをクローンして読み取る（2回読めないため）
    const clonedRequest = request.clone()
    const body = await clonedRequest.json()
    const { mode } = body

    if (mode === 'save') {
      return handleSave(request)
    } else {
      // デフォルトは抽出モード
      return handleExtract(request)
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

    // ユーザーのドラフトイベントを取得
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
