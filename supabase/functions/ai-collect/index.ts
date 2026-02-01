import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CollectRequest {
  keyword?: string;
  url?: string;
}

interface CollectedEvent {
  idol_name: string;
  title: string;
  event_date: string;
  deadlines: Array<{
    type: "lottery_start" | "lottery_end" | "payment";
    end_at: string;
  }>;
  source_url: string;
  is_draft: boolean;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 認証チェック
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "認証が必要です" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabaseクライアント作成
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // ユーザー取得
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "認証エラー" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // リクエストボディ取得
    const body: CollectRequest = await req.json();
    const { keyword, url } = body;

    if (!keyword && !url) {
      return new Response(
        JSON.stringify({ error: "キーワードまたはURLが必要です" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: 実際のAI収集ロジックを実装
    // 1. Web検索またはURL解析（Firecrawl, Puppeteer等）
    // 2. LLMによる情報抽出（OpenAI/Anthropic API）
    // 3. イベント・締切情報の構造化

    // 現時点ではモックデータを返す
    const mockEvent: CollectedEvent = {
      idol_name: keyword || "Unknown",
      title: `${keyword} 関連イベント`,
      event_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      deadlines: [
        {
          type: "lottery_end",
          end_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      source_url: url || `https://example.com/search?q=${encodeURIComponent(keyword || "")}`,
      is_draft: true,
    };

    // データベースに保存
    // 1. idolを取得または作成
    let { data: idol } = await supabase
      .from("idols")
      .select("id")
      .eq("name", mockEvent.idol_name)
      .single();

    if (!idol) {
      const { data: newIdol, error: idolError } = await supabase
        .from("idols")
        .insert({ name: mockEvent.idol_name })
        .select("id")
        .single();

      if (idolError) {
        console.error("Idol insert error:", idolError);
        throw idolError;
      }
      idol = newIdol;
    }

    // 2. eventを作成
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        idol_id: idol.id,
        title: mockEvent.title,
        event_date: mockEvent.event_date,
        source_url: mockEvent.source_url,
        is_draft: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (eventError) {
      console.error("Event insert error:", eventError);
      throw eventError;
    }

    // 3. deadlinesを作成
    for (const deadline of mockEvent.deadlines) {
      const { error: deadlineError } = await supabase
        .from("ticket_deadlines")
        .insert({
          event_id: event.id,
          deadline_type: deadline.type,
          end_at: deadline.end_at,
        });

      if (deadlineError) {
        console.error("Deadline insert error:", deadlineError);
      }
    }

    // 4. user_eventを作成
    const { error: userEventError } = await supabase
      .from("user_events")
      .insert({
        user_id: user.id,
        event_id: event.id,
        status: "not_applied",
        notes: "AI自動収集により作成されたドラフトです。",
      });

    if (userEventError) {
      console.error("User event insert error:", userEventError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          event_id: event.id,
          idol_name: mockEvent.idol_name,
          title: mockEvent.title,
          message: "AI収集が完了しました。情報を確認してください。",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "サーバーエラーが発生しました" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
