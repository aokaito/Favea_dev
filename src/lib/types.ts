// チケット状態の定義
export type TicketStatus =
  | 'not_applied'  // 未申込
  | 'applied'      // 申込済
  | 'pending'      // 結果待ち
  | 'won'          // 当選
  | 'lost'         // 落選
  | 'paid'         // 入金済
  | 'confirmed'    // 確定

// フロントエンド表示用のシンプルなステータス
export type EventStatus =
  | 'waiting'    // 抽選開始待ち
  | 'lottery'    // 抽選中・当選待ち
  | 'payment'    // 入金待ち
  | 'confirmed'  // 確定

// 締切タイプ
export type DeadlineType = 'lottery_start' | 'lottery_end' | 'payment'

// ユーザープロフィール
export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// 推し（アイドル/グループ/作品）
export interface Idol {
  id: string
  name: string
  official_url: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

// イベント情報（コミュニティ共有）
export interface Event {
  id: string
  idol_id: string
  title: string
  event_date: string
  venue: string | null
  source_url: string | null
  is_draft: boolean
  verified_count: number
  created_by: string
  created_at: string
  updated_at: string
  // リレーション
  idol?: Idol
  ticket_deadlines?: TicketDeadline[]
}

// チケット締切情報
export interface TicketDeadline {
  id: string
  event_id: string
  deadline_type: DeadlineType
  start_at: string | null
  end_at: string
  description: string | null
  created_at: string
  updated_at: string
}

// ユーザー個別のイベント管理
export interface UserEvent {
  id: string
  user_id: string
  event_id: string
  status: TicketStatus
  notes: string | null
  created_at: string
  updated_at: string
  // リレーション
  event?: Event
}

// フロントエンド用の統合型
export interface TicketEvent {
  id: string
  oshiName: string
  eventName: string
  eventDate: Date
  lotteryStartDate?: Date
  lotteryEndDate?: Date
  paymentDeadline?: Date
  status: EventStatus
  sourceUrl?: string
  isVerified: boolean
  verifiedBy?: number
  notes?: string
  userEventId?: string // user_eventsテーブルのID
}

// ステータス設定
export interface StatusConfig {
  label: string
  color: string
  bgColor: string
}

export const statusConfig: Record<EventStatus, StatusConfig> = {
  waiting: {
    label: '抽選開始待ち',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100'
  },
  lottery: {
    label: '抽選中・当選待ち',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100'
  },
  payment: {
    label: '入金待ち',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100'
  },
  confirmed: {
    label: '確定',
    color: 'text-green-700',
    bgColor: 'bg-green-100'
  }
}

// チケット状態を表示用ステータスに変換
export function ticketStatusToEventStatus(status: TicketStatus): EventStatus {
  switch (status) {
    case 'not_applied':
    case 'applied':
      return 'waiting'
    case 'pending':
      return 'lottery'
    case 'won':
    case 'lost':
      return 'payment'
    case 'paid':
    case 'confirmed':
      return 'confirmed'
    default:
      return 'waiting'
  }
}

// データベース型（Supabase生成型との互換性）
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
      }
      idols: {
        Row: Idol
        Insert: Omit<Idol, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Idol, 'id' | 'created_at' | 'updated_at'>>
      }
      events: {
        Row: Event
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'verified_count'>
        Update: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>
      }
      ticket_deadlines: {
        Row: TicketDeadline
        Insert: Omit<TicketDeadline, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TicketDeadline, 'id' | 'created_at' | 'updated_at'>>
      }
      user_events: {
        Row: UserEvent
        Insert: Omit<UserEvent, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserEvent, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
