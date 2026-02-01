'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TicketEvent, EventStatus, statusConfig } from '@/lib/types'
import { EventCard } from '@/components/event-card'
import { EventDialog } from '@/components/event-dialog'
import { AICollectDialog } from '@/components/ai-collect-dialog'
import { CalendarView } from '@/components/calendar-view'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, Plus, Calendar, AlertCircle, Clock, List, CalendarDays } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'

// モックデータ（Supabase連携前のテスト用）
const mockEvents: TicketEvent[] = [
  {
    id: '1',
    oshiName: '星野アイ',
    eventName: 'アイドルライブ2026 Spring Tour',
    eventDate: new Date('2026-04-15T18:00:00'),
    lotteryStartDate: new Date('2026-02-01T12:00:00'),
    lotteryEndDate: new Date('2026-02-10T23:59:00'),
    paymentDeadline: new Date('2026-02-20T23:59:00'),
    status: 'lottery',
    sourceUrl: 'https://example.com/idol-live-2026',
    isVerified: true,
    verifiedBy: 15,
    notes: ''
  },
  {
    id: '2',
    oshiName: '星野アイ',
    eventName: 'ファンミーティング in 東京',
    eventDate: new Date('2026-03-20T14:00:00'),
    lotteryStartDate: new Date('2026-01-25T10:00:00'),
    lotteryEndDate: new Date('2026-02-05T23:59:00'),
    paymentDeadline: new Date('2026-02-15T23:59:00'),
    status: 'payment',
    sourceUrl: 'https://example.com/fan-meeting',
    isVerified: true,
    verifiedBy: 8,
    notes: '当選しました！'
  },
  {
    id: '3',
    oshiName: '桜木花道',
    eventName: 'スラムダンク展 追加公演',
    eventDate: new Date('2026-05-01T10:00:00'),
    lotteryStartDate: new Date('2026-02-15T10:00:00'),
    lotteryEndDate: new Date('2026-02-28T23:59:00'),
    status: 'waiting',
    sourceUrl: 'https://example.com/slamdunk',
    isVerified: false,
    verifiedBy: 3,
    notes: ''
  },
  {
    id: '4',
    oshiName: '神崎蘭子',
    eventName: 'シンデレラガールズ 10th Anniversary',
    eventDate: new Date('2026-06-10T17:00:00'),
    lotteryStartDate: new Date('2026-03-01T12:00:00'),
    lotteryEndDate: new Date('2026-03-15T23:59:00'),
    paymentDeadline: new Date('2026-03-31T23:59:00'),
    status: 'confirmed',
    sourceUrl: 'https://example.com/cinderella-10th',
    isVerified: true,
    verifiedBy: 42,
    notes: 'チケット確保済み'
  },
  {
    id: '5',
    oshiName: '竈門炭治郎',
    eventName: '鬼滅の刃 オーケストラコンサート',
    eventDate: new Date('2026-07-20T15:00:00'),
    lotteryStartDate: new Date('2026-04-01T10:00:00'),
    status: 'waiting',
    sourceUrl: 'https://example.com/kimetsu-orchestra',
    isVerified: false,
    verifiedBy: 0,
    notes: 'AI自動収集によるドラフト'
  }
]

export default function DashboardPage() {
  const [events, setEvents] = useState<TicketEvent[]>(mockEvents)
  const [selectedEvent, setSelectedEvent] = useState<TicketEvent | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<EventStatus | 'all'>('all')
  const [filterOshi, setFilterOshi] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  // 推し名のリストを取得
  const oshiList = useMemo(() => {
    const oshis = Array.from(new Set(events.map(e => e.oshiName)))
    return oshis.sort()
  }, [events])

  const handleEditEvent = (event: TicketEvent) => {
    setSelectedEvent(event)
    setIsEventDialogOpen(true)
  }

  const handleAddEvent = () => {
    setSelectedEvent(null)
    setIsEventDialogOpen(true)
  }

  const handleSaveEvent = (event: TicketEvent) => {
    setEvents(prevEvents => {
      const index = prevEvents.findIndex(e => e.id === event.id)
      if (index >= 0) {
        const newEvents = [...prevEvents]
        newEvents[index] = event
        return newEvents
      } else {
        return [...prevEvents, event]
      }
    })
    toast.success('イベントを保存しました')
  }

  const handleAICollect = (keyword: string, url?: string) => {
    // AIによる収集のシミュレーション
    const newEvent: TicketEvent = {
      id: String(Date.now()),
      oshiName: keyword,
      eventName: `${keyword} 関連イベント (AI収集)`,
      eventDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      lotteryStartDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'waiting',
      sourceUrl: url || 'https://example.com/ai-collected',
      isVerified: false,
      verifiedBy: 0,
      notes: 'AI自動収集により作成されたドラフトです。情報を確認してください。'
    }
    setEvents(prev => [newEvent, ...prev])
    toast.success('AI収集が完了しました', {
      description: '新しいイベント情報がドラフトとして追加されました'
    })
  }

  const filteredEvents = events.filter(event => {
    if (filterStatus !== 'all' && event.status !== filterStatus) {
      return false
    }
    if (filterOshi !== 'all' && event.oshiName !== filterOshi) {
      return false
    }
    return true
  })

  // 推しごとにグループ化
  const eventsByOshi = useMemo(() => {
    const grouped: Record<string, TicketEvent[]> = {}
    filteredEvents.forEach(event => {
      if (!grouped[event.oshiName]) {
        grouped[event.oshiName] = []
      }
      grouped[event.oshiName].push(event)
    })

    // 各グループ内で緊急度順にソート
    Object.keys(grouped).forEach(oshi => {
      grouped[oshi].sort((a, b) => {
        const getUrgency = (event: TicketEvent) => {
          const deadline = event.paymentDeadline || event.lotteryEndDate || event.eventDate
          return differenceInDays(deadline, new Date())
        }
        return getUrgency(a) - getUrgency(b)
      })
    })

    return grouped
  }, [filteredEvents])

  // 統計情報
  const stats = {
    total: events.length,
    urgent: events.filter(e => {
      const deadline = e.paymentDeadline || e.lotteryEndDate
      if (!deadline) return false
      const days = differenceInDays(deadline, new Date())
      return days >= 0 && days <= 3
    }).length,
    payment: events.filter(e => e.status === 'payment').length,
    lottery: events.filter(e => e.status === 'lottery').length,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* アクションボタン */}
      <div className="flex justify-end gap-2 mb-6">
        <Button
          onClick={() => setIsAIDialogOpen(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          AI自動収集
        </Button>
        <Button onClick={handleAddEvent} variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          手動追加
        </Button>
      </div>

      {/* 統計ダッシュボード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総イベント数</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-700">緊急締切</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.urgent}</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-700">抽選中</CardDescription>
            <CardTitle className="text-3xl text-slate-600">{stats.lottery}</CardTitle>
          </CardHeader>
          <CardContent>
            <Clock className="w-4 h-4 text-slate-600" />
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-700">入金待ち</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{stats.payment}</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </CardContent>
        </Card>
      </div>

      {/* フィルター付きイベントリスト */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* 推しフィルター */}
          <div className="flex items-center gap-2">
            <label className="text-sm whitespace-nowrap">推しで絞り込み:</label>
            <Select value={filterOshi} onValueChange={setFilterOshi}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="すべての推し" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての推し</SelectItem>
                {oshiList.map(oshi => (
                  <SelectItem key={oshi} value={oshi}>
                    {oshi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 表示切り替え */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-2" />
            リスト
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            カレンダー
          </Button>
        </div>
      </div>

      {/* カレンダー表示 */}
      {viewMode === 'calendar' ? (
        <CalendarView events={filteredEvents} onEventClick={handleEditEvent} />
      ) : (
        /* リスト表示 */
        <Tabs defaultValue="all" className="w-full" onValueChange={(v) => setFilterStatus(v as EventStatus | 'all')}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="waiting">抽選待ち</TabsTrigger>
            <TabsTrigger value="lottery">抽選中</TabsTrigger>
            <TabsTrigger value="payment">入金待ち</TabsTrigger>
            <TabsTrigger value="confirmed">確定</TabsTrigger>
          </TabsList>

          <TabsContent value={filterStatus} className="mt-0">
            {filteredEvents.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {filterStatus === 'all' && filterOshi === 'all'
                    ? 'まだイベントがありません'
                    : 'この条件に該当するイベントはありません'}
                </p>
                <Button onClick={handleAddEvent} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  イベントを追加
                </Button>
              </Card>
            ) : (
              <div className="space-y-8">
                {Object.entries(eventsByOshi).map(([oshiName, oshiEvents]) => (
                  <div key={oshiName}>
                    {/* 推し名ヘッダー */}
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-purple-600" />
                        <h3 className="text-lg text-purple-900">{oshiName}</h3>
                        <span className="text-sm text-purple-700">({oshiEvents.length}件)</span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-purple-200 to-transparent" />
                    </div>

                    {/* イベントカード */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {oshiEvents.map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          onEdit={handleEditEvent}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* フッター情報 */}
      <div className="mt-12 p-6 bg-white rounded-lg border">
        <h3 className="mb-3 font-semibold">Faveaの特徴</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">AI自動収集</h4>
            <p className="text-muted-foreground">
              推し名を入力するだけで、Web上のチケット情報を自動収集。ソースURLも記録されます。
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">工程ステータス管理</h4>
            <p className="text-muted-foreground">
              抽選待ち→抽選中→入金待ち→確定の4段階で、チケット取得の進捗を明確に管理。
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">コミュニティ校閲</h4>
            <p className="text-muted-foreground">
              AI収集情報をコミュニティで検証。複数ユーザーの確認で情報の正確性を担保。
            </p>
          </div>
        </div>
      </div>

      {/* ダイアログ */}
      <EventDialog
        event={selectedEvent}
        open={isEventDialogOpen}
        onClose={() => setIsEventDialogOpen(false)}
        onSave={handleSaveEvent}
      />

      <AICollectDialog
        open={isAIDialogOpen}
        onClose={() => setIsAIDialogOpen(false)}
        onCollect={handleAICollect}
      />
    </div>
  )
}
