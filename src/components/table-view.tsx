'use client'

import { TicketEvent, statusConfig } from '@/lib/types'
import { format, differenceInDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TableViewProps {
  events: TicketEvent[]
  onEventClick: (event: TicketEvent) => void
}

export function TableView({ events, onEventClick }: TableViewProps) {
  const getDeadlineInfo = (event: TicketEvent) => {
    const deadline = event.paymentDeadline || event.lotteryEndDate
    if (!deadline) return null

    const days = differenceInDays(deadline, new Date())
    return { deadline, days }
  }

  const getDeadlineClass = (days: number) => {
    if (days < 0) return 'text-gray-400'
    if (days <= 1) return 'text-red-600 font-bold'
    if (days <= 3) return 'text-orange-600 font-semibold'
    if (days <= 7) return 'text-yellow-600'
    return 'text-gray-600'
  }

  const formatDateShort = (date: Date) => {
    return format(date, 'M/d (E)', { locale: ja })
  }

  const formatDateTime = (date: Date) => {
    return format(date, 'M/d HH:mm', { locale: ja })
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[120px]">推し</TableHead>
              <TableHead className="min-w-[200px]">イベント名</TableHead>
              <TableHead className="w-[100px]">ステータス</TableHead>
              <TableHead className="w-[100px]">開催日</TableHead>
              <TableHead className="w-[120px]">抽選締切</TableHead>
              <TableHead className="w-[120px]">入金締切</TableHead>
              <TableHead className="w-[80px]">残り</TableHead>
              <TableHead className="w-[60px]">検証</TableHead>
              <TableHead className="w-[60px]">URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  該当するイベントがありません
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => {
                const deadlineInfo = getDeadlineInfo(event)
                const config = statusConfig[event.status]

                return (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => onEventClick(event)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        {event.oshiName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[250px] truncate" title={event.eventName}>
                        {event.eventName}
                      </div>
                      {event.notes && (
                        <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {event.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${config.bgColor} ${config.color} border-0`}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateShort(event.eventDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.lotteryEndDate ? formatDateTime(event.lotteryEndDate) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.paymentDeadline ? formatDateTime(event.paymentDeadline) : '-'}
                    </TableCell>
                    <TableCell>
                      {deadlineInfo && (
                        <span className={getDeadlineClass(deadlineInfo.days)}>
                          {deadlineInfo.days < 0 ? (
                            '終了'
                          ) : deadlineInfo.days === 0 ? (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              今日
                            </span>
                          ) : (
                            `${deadlineInfo.days}日`
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.isVerified ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs">{event.verifiedBy}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">未検証</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.sourceUrl && (
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
