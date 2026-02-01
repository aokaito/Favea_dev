/**
 * robots.txt解析とクロール許可チェック
 */

interface RobotsRule {
  path: string
  allow: boolean
}

/**
 * robots.txtをパースしてルールを抽出
 */
function parseRobotsTxt(content: string): RobotsRule[] {
  const lines = content.split('\n')
  const rules: RobotsRule[] = []
  let isRelevantUserAgent = false

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()

    // コメントを除去
    const commentIndex = trimmed.indexOf('#')
    const cleanLine = commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed

    if (!cleanLine) continue

    // User-agent行をチェック
    if (cleanLine.startsWith('user-agent:')) {
      const agent = cleanLine.slice('user-agent:'.length).trim()
      isRelevantUserAgent = agent === '*' || agent === 'jina' || agent === 'jinaai'
      continue
    }

    // 関連するUser-agentブロック内のルールのみ処理
    if (!isRelevantUserAgent) continue

    if (cleanLine.startsWith('disallow:')) {
      const path = cleanLine.slice('disallow:'.length).trim()
      if (path) {
        rules.push({ path, allow: false })
      }
    } else if (cleanLine.startsWith('allow:')) {
      const path = cleanLine.slice('allow:'.length).trim()
      if (path) {
        rules.push({ path, allow: true })
      }
    }
  }

  return rules
}

/**
 * パスがルールにマッチするかチェック
 */
function matchesRule(urlPath: string, rulePath: string): boolean {
  // ワイルドカード対応
  if (rulePath.includes('*')) {
    const regex = new RegExp('^' + rulePath.replace(/\*/g, '.*').replace(/\$/g, '$'))
    return regex.test(urlPath)
  }

  // プレフィックスマッチ
  return urlPath.startsWith(rulePath)
}

/**
 * 指定URLへのクロールが許可されているかチェック
 */
export async function isScrapingAllowed(url: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const urlObj = new URL(url)
    const robotsUrl = `${urlObj.origin}/robots.txt`

    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Favea/1.0; +https://favea.app)',
      },
    })

    // robots.txtが存在しない場合は許可
    if (response.status === 404) {
      return { allowed: true }
    }

    if (!response.ok) {
      // サーバーエラーの場合は安全のため拒否
      if (response.status >= 500) {
        return { allowed: false, reason: 'robots.txtの取得に失敗しました' }
      }
      // その他のエラーは許可
      return { allowed: true }
    }

    const content = await response.text()
    const rules = parseRobotsTxt(content)

    if (rules.length === 0) {
      return { allowed: true }
    }

    const urlPath = urlObj.pathname + urlObj.search

    // より具体的なルールを優先（長いパスを先に）
    const sortedRules = [...rules].sort((a, b) => b.path.length - a.path.length)

    for (const rule of sortedRules) {
      if (matchesRule(urlPath, rule.path)) {
        if (rule.allow) {
          return { allowed: true }
        } else {
          return {
            allowed: false,
            reason: `このサイトはスクレイピングを許可していません (Disallow: ${rule.path})`
          }
        }
      }
    }

    // マッチするルールがない場合は許可
    return { allowed: true }

  } catch (error) {
    // URL解析エラーなどは許可（後続処理でエラーになる）
    console.error('robots.txt check error:', error)
    return { allowed: true }
  }
}
