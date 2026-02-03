'use client'

import { useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'

interface ExtractedEvent {
  title: string
  event_date: string | null
  venue: string | null
  source_url: string
  deadlines: {
    type: 'lottery_start' | 'lottery_end' | 'payment'
    start_at?: string | null
    end_at: string
    description?: string
  }[]
}

interface CollectionResult {
  success: boolean
  data?: {
    idol_name: string
    events: ExtractedEvent[]
    message: string
  }
  error?: string
}

interface EditableEvent extends ExtractedEvent {
  selected: boolean
  isEditing: boolean
}

interface AICollectDialogProps {
  open: boolean
  onClose: () => void
  onCollect: (keyword: string, url?: string) => void
}

type Step = 'input' | 'select' | 'confirm'

export function AICollectDialog({ open, onClose, onCollect }: AICollectDialogProps) {
  const [keyword, setKeyword] = useState('')
  const [url, setUrl] = useState('')
  const [isCollecting, setIsCollecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'name' | 'url'>('name')
  const [step, setStep] = useState<Step>('input')
  const [events, setEvents] = useState<EditableEvent[]>([])
  const [artistName, setArtistName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleCollect = async () => {
    const input = activeTab === 'name' ? keyword : url

    if (!input.trim()) {
      toast.error(activeTab === 'name' ? '推し名を入力してください' : 'URLを入力してください')
      return
    }

    if (activeTab === 'url' && !input.startsWith('http')) {
      toast.error('正しいURLを入力してください (http://またはhttps://で始まる)')
      return
    }

    setIsCollecting(true)
    setError(null)

    try {
      const response = await fetch('/api/ai-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: activeTab === 'name' ? keyword : undefined,
          url: activeTab === 'url' ? url : undefined,
          mode: 'extract', // 抽出のみ、保存しない
        }),
      })

      const data: CollectionResult = await response.json()

      if (!response.ok) {
        setError(data.error || 'エラーが発生しました')
        toast.error(data.error || 'エラーが発生しました')
        return
      }

      if (data.data?.events && data.data.events.length > 0) {
        // 編集可能な形式に変換
        const editableEvents: EditableEvent[] = data.data.events.map((event) => ({
          ...event,
          selected: true,
          isEditing: false,
        }))
        setEvents(editableEvents)
        setArtistName(data.data.idol_name || keyword || '')
        setStep('select')
        toast.success(`${data.data.events.length}件のイベント情報が見つかりました`)
      } else {
        toast.info('イベント情報が見つかりませんでした')
      }
    } catch (error) {
      console.error('Collection error:', error)
      const message = 'ネットワークエラーが発生しました'
      setError(message)
      toast.error(message)
    } finally {
      setIsCollecting(false)
    }
  }

  const handleSave = async () => {
    const selectedEvents = events.filter((e) => e.selected)

    if (selectedEvents.length === 0) {
      toast.error('保存するイベントを選択してください')
      return
    }

    if (!artistName.trim()) {
      toast.error('アーティスト名を入力してください')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/ai-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'save',
          idol_name: artistName,
          events: selectedEvents.map((e) => ({
            title: e.title,
            event_date: e.event_date,
            venue: e.venue,
            source_url: e.source_url,
            deadlines: e.deadlines,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || '保存に失敗しました')
        return
      }

      toast.success(`${selectedEvents.length}件のイベントを保存しました`)
      onCollect(artistName)
      handleClose()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setStep('input')
    setEvents([])
    setArtistName('')
    setError(null)
    setKeyword('')
    setUrl('')
    onClose()
  }

  const toggleEventSelection = (index: number) => {
    setEvents((prev) =>
      prev.map((event, i) => (i === index ? { ...event, selected: !event.selected } : event))
    )
  }

  const toggleEventEditing = (index: number) => {
    setEvents((prev) =>
      prev.map((event, i) => (i === index ? { ...event, isEditing: !event.isEditing } : event))
    )
  }

  const updateEvent = (index: number, field: keyof ExtractedEvent, value: string | null) => {
    setEvents((prev) =>
      prev.map((event, i) => (i === index ? { ...event, [field]: value } : event))
    )
  }

  const updateDeadline = (
    eventIndex: number,
    deadlineIndex: number,
    field: string,
    value: string
  ) => {
    setEvents((prev) =>
      prev.map((event, i) => {
        if (i !== eventIndex) return event
        const newDeadlines = [...event.deadlines]
        newDeadlines[deadlineIndex] = { ...newDeadlines[deadlineIndex], [field]: value }
        return { ...event, deadlines: newDeadlines }
      })
    )
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '未定'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toISOString().slice(0, 16)
    } catch {
      return ''
    }
  }

  const getDeadlineTypeLabel = (type: string) => {
    switch (type) {
      case 'lottery_start':
        return '抽選開始'
      case 'lottery_end':
        return '抽選締切'
      case 'payment':
        return '入金締切'
      default:
        return type
    }
  }

  const selectedCount = events.filter((e) => e.selected).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI自動収集
            {step !== 'input' && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {step === 'select' ? '- イベント選択' : '- 保存確認'}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && '推し名やURLを入力すると、AIがチケット情報を自動で収集します'}
            {step === 'select' && '保存するイベントを選択し、必要に応じて修正してください'}
            {step === 'confirm' && 'アーティスト名を確認して保存してください'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Input */}
          {step === 'input' && (
            <>
              <Tabs
                defaultValue={activeTab}
                onValueChange={(v) => setActiveTab(v as 'name' | 'url')}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="name" disabled={isCollecting}>
                    推し名
                  </TabsTrigger>
                  <TabsTrigger value="url" disabled={isCollecting}>
                    URL
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="name">
                  <div className="space-y-2">
                    <Label htmlFor="keyword">推し名・キーワード</Label>
                    <Input
                      id="keyword"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="例: 星野アイ, アイドルライブ"
                      disabled={isCollecting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isCollecting) {
                          handleCollect()
                        }
                      }}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="url">
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="例: https://example.com/event"
                      disabled={isCollecting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isCollecting) {
                          handleCollect()
                        }
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {error && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                <p className="text-sm text-blue-900">AI自動収集について</p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>公式サイトやチケット販売サイトから情報を収集</li>
                  <li>収集後、保存するイベントを選択できます</li>
                  <li>間違った情報は手動で修正できます</li>
                </ul>
              </div>
            </>
          )}

          {/* Step 2: Select and Edit */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedCount}/{events.length}件選択中
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allSelected = events.every((e) => e.selected)
                    setEvents((prev) => prev.map((e) => ({ ...e, selected: !allSelected })))
                  }}
                >
                  {events.every((e) => e.selected) ? 'すべて解除' : 'すべて選択'}
                </Button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {events.map((event, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-colors ${
                      event.selected ? 'bg-white border-primary/50' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={event.selected}
                        onCheckedChange={() => toggleEventSelection(index)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        {event.isEditing ? (
                          // 編集モード
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">イベント名</Label>
                              <Input
                                value={event.title}
                                onChange={(e) => updateEvent(index, 'title', e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">開催日時</Label>
                                <Input
                                  type="datetime-local"
                                  value={formatDateForInput(event.event_date)}
                                  onChange={(e) =>
                                    updateEvent(
                                      index,
                                      'event_date',
                                      e.target.value ? new Date(e.target.value).toISOString() : null
                                    )
                                  }
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">会場</Label>
                                <Input
                                  value={event.venue || ''}
                                  onChange={(e) => updateEvent(index, 'venue', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            {event.deadlines.map((deadline, dIndex) => (
                              <div key={dIndex} className="p-2 bg-orange-50 rounded">
                                <Label className="text-xs text-orange-700">
                                  {getDeadlineTypeLabel(deadline.type)}
                                </Label>
                                <Input
                                  type="datetime-local"
                                  value={formatDateForInput(deadline.end_at)}
                                  onChange={(e) =>
                                    updateDeadline(
                                      index,
                                      dIndex,
                                      'end_at',
                                      new Date(e.target.value).toISOString()
                                    )
                                  }
                                  className="mt-1"
                                />
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleEventEditing(index)}
                            >
                              編集完了
                            </Button>
                          </div>
                        ) : (
                          // 表示モード
                          <>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{event.title}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleEventEditing(index)}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                編集
                              </Button>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>開催日: {formatDate(event.event_date)}</div>
                              {event.venue && <div>会場: {event.venue}</div>}
                              {event.deadlines.length > 0 && (
                                <div className="space-y-1">
                                  {event.deadlines.map((deadline, dIndex) => (
                                    <div key={dIndex} className="text-orange-600">
                                      {getDeadlineTypeLabel(deadline.type)}:{' '}
                                      {formatDate(deadline.end_at)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {event.source_url && (
                                <a
                                  href={event.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  ソースを確認
                                </a>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm artist name */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="artistName">アーティスト名</Label>
                <Input
                  id="artistName"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="例: 星野アイ"
                />
                <p className="text-xs text-muted-foreground">
                  保存するイベントに紐づけるアーティスト名を入力してください
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">{selectedCount}件のイベントを保存します</span>
                </div>
                <ul className="text-sm text-green-600 space-y-1">
                  {events
                    .filter((e) => e.selected)
                    .map((event, index) => (
                      <li key={index}>• {event.title}</li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isCollecting}>
                キャンセル
              </Button>
              <Button onClick={handleCollect} disabled={isCollecting}>
                {isCollecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    収集中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    収集開始
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={selectedCount === 0}>
                次へ
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')} disabled={isSaving}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !artistName.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
