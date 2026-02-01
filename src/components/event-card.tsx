'use client'

import { TicketEvent, statusConfig } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ja } from 'date-fns/locale'

interface EventCardProps {
  event: TicketEvent
  onEdit: (event: TicketEvent) => void
}

export function EventCard({ event, onEdit }: EventCardProps) {
  const config = statusConfig[event.status]

  // 最も近い締切を取得
  const getClosestDeadline = () => {
    const now = new Date()
    const deadlines = [
      { date: event.lotteryEndDate, label: '抽選締切' },
      { date: event.paymentDeadline, label: '入金締切' },
      { date: event.eventDate, label: 'イベント' }
    ].filter(d => d.date && d.date > now)

    if (deadlines.length === 0) return null

    deadlines.sort((a, b) => a.date!.getTime() - b.date!.getTime())
    return deadlines[0]
  }

  const closestDeadline = getClosestDeadline()
  const daysUntilDeadline = closestDeadline
    ? differenceInDays(closestDeadline.date!, new Date())
    : null

  const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 3

  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-md ${isUrgent ? 'border-orange-500 border-2' : ''}`}>
      {isUrgent && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                {event.oshiName}
              </span>
              {event.isVerified && (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
            </div>
            <h3 className="font-semibold mb-2">{event.eventName}</h3>
            <Badge className={`${config.bgColor} ${config.color} hover:${config.bgColor}`}>
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 締切アラート */}
        {closestDeadline && (
          <div className={`flex items-center gap-2 p-2 rounded-lg ${isUrgent ? 'bg-orange-50' : 'bg-blue-50'}`}>
            {isUrgent ? (
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${isUrgent ? 'text-orange-900' : 'text-blue-900'}`}>
                {closestDeadline.label}: あと{daysUntilDeadline}日
              </p>
              <p className={`text-xs ${isUrgent ? 'text-orange-700' : 'text-blue-700'}`}>
                {format(closestDeadline.date!, 'M月d日(E) HH:mm', { locale: ja })}
              </p>
            </div>
          </div>
        )}

        {/* イベント詳細 */}
        <div className="space-y-2 text-sm">
          {event.lotteryStartDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>抽選開始: {format(event.lotteryStartDate, 'M月d日(E)', { locale: ja })}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>開催日: {format(event.eventDate, 'M月d日(E)', { locale: ja })}</span>
          </div>
        </div>

        {/* コミュニティ検証 */}
        {event.isVerified && (
          <div className="text-xs text-muted-foreground">
            {event.verifiedBy}人が情報を確認済み
          </div>
        )}

        {/* アクション */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(event)}
          >
            詳細・編集
          </Button>
          {event.sourceUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(event.sourceUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
