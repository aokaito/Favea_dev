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
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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

    // AIによる検索のシミュレーション（実際のAPI実装時に置き換え）
    setTimeout(() => {
      onCollect(activeTab === 'name' ? keyword : '公式サイト', activeTab === 'url' ? url : undefined)
      setIsCollecting(false)
      setKeyword('')
      setUrl('')
      onClose()
    }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
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
              <TabsTrigger value="name">推し名</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
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
          <Button variant="outline" onClick={onClose} disabled={isCollecting}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
