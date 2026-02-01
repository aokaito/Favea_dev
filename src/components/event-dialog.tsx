'use client'

import { useState, useEffect } from 'react'
import { TicketEvent, EventStatus, statusConfig } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface EventDialogProps {
  event: TicketEvent | null
  open: boolean
  onClose: () => void
  onSave: (event: TicketEvent) => void
}

export function EventDialog({ event, open, onClose, onSave }: EventDialogProps) {
  const [formData, setFormData] = useState<Partial<TicketEvent>>({})

  useEffect(() => {
    if (event) {
      setFormData(event)
    } else {
      setFormData({
        status: 'waiting',
        isVerified: false,
        verifiedBy: 0,
      })
    }
  }, [event])

  const handleSave = () => {
    if (!formData.oshiName || !formData.eventName || !formData.eventDate) {
      toast.error('推し名、イベント名、開催日は必須です')
      return
    }

    onSave({
      ...event,
      ...formData,
      id: event?.id || String(Date.now()),
      isVerified: event?.isVerified || false,
      verifiedBy: event?.verifiedBy || 0,
    } as TicketEvent)
    onClose()
  }

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toISOString().slice(0, 16)
  }

  const handleDateChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value ? new Date(value) : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'イベント編集' : '新規イベント追加'}</DialogTitle>
          <DialogDescription>
            チケット申込・イベント情報を管理します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* コミュニティ検証バッジ */}
          {event?.isVerified && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-green-900">コミュニティ確認済み</p>
                <p className="text-xs text-green-700">{event.verifiedBy}人が情報の正確性を確認</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="oshiName">推し名 *</Label>
              <Input
                id="oshiName"
                value={formData.oshiName || ''}
                onChange={(e) => setFormData({ ...formData, oshiName: e.target.value })}
                placeholder="例: 星野アイ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">ステータス</Label>
              <Select
                value={formData.status || 'waiting'}
                onValueChange={(value) => setFormData({ ...formData, status: value as EventStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventName">イベント名 *</Label>
            <Input
              id="eventName"
              value={formData.eventName || ''}
              onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
              placeholder="例: アイドルライブ2026 Spring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lotteryStartDate">抽選開始日</Label>
              <Input
                id="lotteryStartDate"
                type="datetime-local"
                value={formatDateForInput(formData.lotteryStartDate)}
                onChange={(e) => handleDateChange('lotteryStartDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lotteryEndDate">抽選締切日</Label>
              <Input
                id="lotteryEndDate"
                type="datetime-local"
                value={formatDateForInput(formData.lotteryEndDate)}
                onChange={(e) => handleDateChange('lotteryEndDate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDeadline">入金締切日</Label>
              <Input
                id="paymentDeadline"
                type="datetime-local"
                value={formatDateForInput(formData.paymentDeadline)}
                onChange={(e) => handleDateChange('paymentDeadline', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventDate">イベント開催日 *</Label>
              <Input
                id="eventDate"
                type="datetime-local"
                value={formatDateForInput(formData.eventDate)}
                onChange={(e) => handleDateChange('eventDate', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">情報ソースURL</Label>
            <div className="flex gap-2">
              <Input
                id="sourceUrl"
                value={formData.sourceUrl || ''}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                placeholder="https://example.com/event-info"
              />
              {formData.sourceUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(formData.sourceUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">メモ</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="自由にメモを記入できます"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
