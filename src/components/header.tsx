'use client'

import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sparkles, Plus, User as UserIcon, LogOut } from 'lucide-react'
import { toast } from 'sonner'

interface HeaderProps {
  user: User
  onAICollect?: () => void
  onAddEvent?: () => void
}

export function Header({ user, onAICollect, onAddEvent }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('ログアウトしました')
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-gray-800">Favea</h1>
            <p className="text-sm text-muted-foreground mt-1">
              推し活チケット・デッドライン管理
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onAICollect && (
              <Button
                onClick={onAICollect}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI自動収集
              </Button>
            )}
            {onAddEvent && (
              <Button onClick={onAddEvent} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                手動追加
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <UserIcon className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
