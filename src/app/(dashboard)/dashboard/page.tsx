'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TicketEvent, EventStatus } from '@/lib/types'
import { EventCard } from '@/components/event-card'
import { EventDialog } from '@/components/event-dialog'
import { AICollectDialog } from '@/components/ai-collect-dialog'
import { CalendarView } from '@/components/calendar-view'
import { TableView } from '@/components/table-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, Plus, Calendar, AlertCircle, Clock, List, CalendarDays, Table2, Loader2 } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'

// DBから取得したデータをTicketEvent形式に変換
interface DBUserEvent {
  id: string
  status: string
  created_at: string
  event: {
    id: string
    title: string
    event_date: string | null
    venue: string | null
    source_url: string | null
    is_draft: boolean
    idol: {
      name: string
    } | null
    ticket_deadlines: {
      deadline_type: string
      start_at: string | null
      end_at: string
      description: string | null
    }[]
  } | null
}

function convertToTicketEvent(dbEvent: DBUserEvent): TicketEvent | null {
  if (!dbEvent.event) return null

  const event = dbEvent.event
  const deadlines = event.ticket_deadlines || []

  // 締切情報を取得
  const lotteryStart = deadlines.find(d => d.deadline_type === 'lottery_start')
  const lotteryEnd = deadlines.find(d => d.deadline_type === 'lottery_end')
  const payment = deadlines.find(d => d.deadline_type === 'payment')

  // ステータスを決定
  let status: EventStatus = 'waiting'
  const now = new Date()

  if (lotteryStart && new Date(lotteryStart.end_at) > now) {
    status = 'waiting'
  } else if (lotteryEnd && new Date(lotteryEnd.end_at) > now) {
    status = 'lottery'
  } else if (payment && new Date(payment.end_at) > now) {
    status = 'payment'
  } else if (dbEvent.status === 'confirmed' || dbEvent.status === 'paid') {
    status = 'confirmed'
  }

  return {
    id: dbEvent.id,
    oshiName: event.idol?.name || 'Unknown',
    eventName: event.title,
    eventDate: event.event_date ? new Date(event.event_date) : new Date(),
    lotteryStartDate: lotteryStart ? new Date(lotteryStart.end_at) : undefined,
    lotteryEndDate: lotteryEnd ? new Date(lotteryEnd.end_at) : undefined,
    paymentDeadline: payment ? new Date(payment.end_at) : undefined,
    status,
    sourceUrl: event.source_url || undefined,
    isVerified: !event.is_draft,
    verifiedBy: 0,
    notes: '',
  }
}

export default function DashboardPage() {
  const [events, setEvents] = useState<TicketEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<TicketEvent | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<EventStatus | 'all'>('all')
  const [filterOshi, setFilterOshi] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'table'>('list')

  // DBからイベントを取得
  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/ai-draft', {
        method: 'GET',
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Fetch error:', error)
        return
      }

      const result = await response.json()

      if (result.success && result.data) {
        const ticketEvents = result.data
          .map((dbEvent: DBUserEvent) => convertToTicketEvent(dbEvent))
          .filter((e: TicketEvent | null): e is TicketEvent => e !== null)

        setEvents(ticketEvents)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初回読み込み
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

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

  const handleAICollect = async () => {
    // AI収集後にDBから再取得
    await fetchEvents()
    toast.success('イベント一覧を更新しました')
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
        const getNextDeadline = (e: TicketEvent) => {
          const deadlines = [e.lotteryEndDate, e.paymentDeadline].filter(Boolean) as Date[]
          const futureDeadlines = deadlines.filter(d => d > new Date())
          return futureDeadlines.length > 0 ? Math.min(...futureDeadlines.map(d => d.getTime())) : Infinity
        }
        return getNextDeadline(a) - getNextDeadline(b)
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* アクションボタン */}
      <div className="flex justify-end gap-2 mb-6">
        <Button
          onClick={() => setIsAIDialogOpen(true)}
          className="bg-primary hover:bg-primary/90"
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
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <Table2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* イベントコンテンツ */}
      {viewMode === 'list' ? (
        <div className="space-y-8">
          {Object.entries(eventsByOshi).length === 0 ? (
            <Card className="p-8 text-center">
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  まだイベントがありません
                </p>
                <Button onClick={() => setIsAIDialogOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI自動収集で始める
                </Button>
              </CardContent>
            </Card>
          ) : (
            Object.entries(eventsByOshi).map(([oshi, oshiEvents]) => (
              <div key={oshi}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  {oshi}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({oshiEvents.length}件)
                  </span>
                </h2>
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
            ))
          )}
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarView events={filteredEvents} onEventClick={handleEditEvent} />
      ) : (
        <TableView events={filteredEvents} onEventClick={handleEditEvent} />
      )}

      {/* ダイアログ */}
      <EventDialog
        open={isEventDialogOpen}
        onClose={() => setIsEventDialogOpen(false)}
        event={selectedEvent}
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
