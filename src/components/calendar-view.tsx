'use client'

import { useState } from 'react'
import { TicketEvent } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

interface CalendarViewProps {
  events: TicketEvent[]
  onEventClick: (event: TicketEvent) => void
}

export function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // 月の最初の日の曜日を取得（0=日曜日）
  const startDayOfWeek = monthStart.getDay()

  // カレンダーの前の空白セルを作成
  const emptyDays = Array(startDayOfWeek).fill(null)

  // 日付ごとのイベントを取得
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDates = [
        event.eventDate,
        event.lotteryStartDate,
        event.lotteryEndDate,
        event.paymentDeadline
      ].filter(d => d && isSameDay(d, date))
      return eventDates.length > 0
    })
  }

  // 日付のイベントタイプを取得
  const getEventTypesForDate = (date: Date, event: TicketEvent) => {
    const types: { label: string; color: string }[] = []

    if (event.eventDate && isSameDay(event.eventDate, date)) {
      types.push({ label: 'イベント', color: 'bg-slate-600' })
    }
    if (event.lotteryStartDate && isSameDay(event.lotteryStartDate, date)) {
      types.push({ label: '抽選開始', color: 'bg-slate-500' })
    }
    if (event.lotteryEndDate && isSameDay(event.lotteryEndDate, date)) {
      types.push({ label: '抽選締切', color: 'bg-amber-600' })
    }
    if (event.paymentDeadline && isSameDay(event.paymentDeadline, date)) {
      types.push({ label: '入金締切', color: 'bg-red-600' })
    }

    return types
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleToday = () => {
    setCurrentMonth(new Date())
  }

  const weekDays = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="space-y-4">
      {/* カレンダーヘッダー */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarIcon className="w-5 h-5" />
              {format(currentMonth, 'yyyy年 M月', { locale: ja })}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
                今日
              </Button>
              <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* カレンダーグリッド */}
          <div className="grid grid-cols-7 gap-1">
            {/* 曜日ヘッダー */}
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={`text-center py-2 text-sm ${
                  index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-muted-foreground'
                }`}
              >
                {day}
              </div>
            ))}

            {/* 空白セル */}
            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[100px] bg-muted/20" />
            ))}

            {/* 日付セル */}
            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDate(day)
              const isToday = isSameDay(day, new Date())
              const dayOfWeek = day.getDay()

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[100px] border rounded-lg p-2 transition-colors ${
                    isToday ? 'bg-primary/5 border-primary' : 'bg-white hover:bg-muted/30'
                  }`}
                >
                  <div
                    className={`text-sm mb-1 ${
                      isToday
                        ? 'font-bold text-primary'
                        : dayOfWeek === 0
                        ? 'text-red-600'
                        : dayOfWeek === 6
                        ? 'text-blue-600'
                        : 'text-foreground'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>

                  {/* イベント表示 */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => {
                      const eventTypes = getEventTypesForDate(day, event)
                      return (
                        <div key={`${event.id}-${day.toISOString()}`}>
                          {eventTypes.map((type, idx) => (
                            <button
                              key={idx}
                              onClick={() => onEventClick(event)}
                              className="w-full text-left"
                            >
                              <div className={`text-xs p-1 rounded ${type.color} text-white truncate hover:opacity-80 transition-opacity`}>
                                {type.label}: {event.oshiName}
                              </div>
                            </button>
                          ))}
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayEvents.length - 3}件
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 凡例 */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-slate-600" />
                <span>イベント開催</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-slate-500" />
                <span>抽選開始</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-600" />
                <span>抽選締切</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-600" />
                <span>入金締切</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
