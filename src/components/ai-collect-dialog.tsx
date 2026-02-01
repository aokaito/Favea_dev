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
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface ExtractedEvent {
  title: string
  event_date: string | null
  venue: string | null
  source_url: string
  deadlines: {
    type: string
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

interface AICollectDialogProps {
  open: boolean
  onClose: () => void
  onCollect: (keyword: string, url?: string) => void
}

export function AICollectDialog({ open, onClose, onCollect }: AICollectDialogProps) {
  const [keyword, setKeyword] = useState('')
  const [url, setUrl] = useState('')
  const [isCollecting, setIsCollecting] = useState(false)
  const [activeTab, setActiveTab] = useState<'name' | 'url'>('name')
  const [result, setResult] = useState<CollectionResult | null>(null)

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
    setResult(null)

    try {
      const response = await fetch('/api/ai-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: activeTab === 'name' ? keyword : undefined,
          url: activeTab === 'url' ? url : undefined,
        }),
      })

      const data: CollectionResult = await response.json()

      if (!response.ok) {
        setResult({ success: false, error: data.error || 'エラーが発生しました' })
        toast.error(data.error || 'エラーが発生しました')
        return
      }

      setResult(data)

      if (data.data?.events && data.data.events.length > 0) {
        toast.success(data.data.message)
        onCollect(activeTab === 'name' ? keyword : '公式サイト', activeTab === 'url' ? url : undefined)
      } else {
        toast.info('イベント情報が見つかりませんでした')
      }
    } catch (error) {
      console.error('Collection error:', error)
      const message = 'ネットワークエラーが発生しました'
      setResult({ success: false, error: message })
      toast.error(message)
    } finally {
      setIsCollecting(false)
    }
  }

  const handleClose = () => {
    setResult(null)
    setKeyword('')
    setUrl('')
    onClose()
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI自動収集
          </DialogTitle>
          <DialogDescription>
            推し名やイベント名を入力すると、AIがWeb上からチケット情報を自動で収集します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Tabs defaultValue={activeTab} onValueChange={(v) => setActiveTab(v as 'name' | 'url')}>
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

          {/* 収集結果表示 */}
          {result && (
            <div className="space-y-3">
              {result.success && result.data?.events && result.data.events.length > 0 ? (
                <div className="p-4 bg-green-50 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{result.data.message}</span>
                  </div>
                  <div className="space-y-3">
                    {result.data.events.map((event, index) => (
                      <div key={index} className="p-3 bg-white rounded border space-y-2">
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>開催日: {formatDate(event.event_date)}</div>
                          {event.venue && <div>会場: {event.venue}</div>}
                          {event.deadlines && event.deadlines.length > 0 && (
                            <div className="space-y-1">
                              {event.deadlines.map((deadline, dIndex) => (
                                <div key={dIndex} className="text-orange-600">
                                  {getDeadlineTypeLabel(deadline.type)}: {formatDate(deadline.end_at)}
                                  {deadline.description && ` (${deadline.description})`}
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
                      </div>
                    ))}
                  </div>
                </div>
              ) : result.success && result.data?.events?.length === 0 ? (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <AlertCircle className="w-5 h-5" />
                    <span>イベント情報が見つかりませんでした</span>
                  </div>
                </div>
              ) : result.error ? (
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span>{result.error}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg space-y-2">
            <p className="text-sm text-blue-900">AI自動収集について</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>公式サイトやチケット販売サイトから情報を収集</li>
              <li>収集した情報は「ドラフト」として保存されます</li>
              <li>必ずソースURLと共に表示されます</li>
              <li>コミュニティで情報の正確性を確認できます</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCollecting}>
            {result?.success && result.data?.events && result.data.events.length > 0 ? '閉じる' : 'キャンセル'}
          </Button>
          {(!result || !result.success || result.data?.events?.length === 0) && (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
