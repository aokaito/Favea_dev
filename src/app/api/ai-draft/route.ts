import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// AI自動収集のAPI Route
// MVP Phase 1では基本的なスクレイピング/検索機能を提供
// Phase 2以降でLLMによる高度な情報抽出を実装

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { keyword, url } = body

    if (!keyword && !url) {
      return NextResponse.json(
        { error: 'キーワードまたはURLが必要です' },
        { status: 400 }
      )
    }

    // TODO: 実際のAI収集ロジックを実装
    // 1. Web検索またはURL解析
    // 2. LLMによる情報抽出
    // 3. イベント・締切情報の構造化

    // 現時点ではモックデータを返す
    const mockResult = {
      success: true,
      data: {
        idol_name: keyword || 'Unknown',
        events: [
          {
            title: `${keyword} 関連イベント`,
            event_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            deadlines: [
              {
                type: 'lottery_end',
                end_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              }
            ],
            source_url: url || `https://example.com/search?q=${encodeURIComponent(keyword || '')}`,
            is_draft: true,
          }
        ],
        message: 'AI収集が完了しました。情報を確認してください。'
      }
    }

    return NextResponse.json(mockResult)
  } catch (error) {
    console.error('AI Draft API Error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// 収集履歴の取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    // TODO: ユーザーのAI収集履歴を取得
    // const { data, error } = await supabase
    //   .from('ai_collection_history')
    //   .select('*')
    //   .eq('user_id', user.id)
    //   .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      data: [],
      message: 'AI収集履歴機能は今後実装予定です'
    })
  } catch (error) {
    console.error('AI Draft API Error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
