/**
 * Client half of the memory bundle.
 *
 * Registers the left-sidebar entry and a read-only panel that shows what the
 * Host half currently remembers about the user.
 */

window.__ModuleLoader__.load({
  id: '@local/memory-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const PANEL_ID = 'memory'
    const NS = 'memory-panel'
    const STATE_URL = '/dsh-memory/state'

    const DICTIONARIES = {
      en: {
        sidebar: 'Memory',
        title: 'Long-term memory',
        subtitle: 'My character, how you want me to work, and your background — carried into every new session.',
        loading: 'Reading…',
        empty: 'Nothing remembered yet.',
        emptyHint: 'Tell me “remember: …” in the chat and it lands here.',
        errorTitle: 'Memory is on, but this panel cannot read the list right now.',
        errorHint: 'Just ask me “what do you remember about me?” in the chat.',
        retry: 'Retry',
        count: '{n} saved',
        countOne: '1 saved',
        kindSelf: 'Me',
        kindPreference: 'Preference',
        kindFact: 'Fact',
        crash: 'The memory panel stopped rendering.',
      },
      zh: {
        sidebar: '记忆',
        title: '长期记忆',
        subtitle: '我的性格、你对我的要求、你的背景，都在这里；每个新会话都会带上。',
        loading: '正在读取…',
        empty: '我还没有记住任何事。',
        emptyHint: '在对话里说「记住：……」，我就会记在这里。',
        errorTitle: '记忆是开着的，只是这个面板暂时读不到列表。',
        errorHint: '直接在对话里问我「你记得我什么」就能看到。',
        retry: '重试',
        count: '已记 {n} 条',
        countOne: '已记 1 条',
        kindSelf: '我自己',
        kindPreference: '偏好',
        kindFact: '事实',
        crash: '记忆面板渲染失败。',
      },
    }

    const STYLE = [
      '.dsh-memory-root{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5}',
      '.dsh-memory-head{flex:0 0 auto;padding:20px 24px 12px}',
      '.dsh-memory-title{margin:0;font-size:18px;font-weight:600}',
      '.dsh-memory-subtitle{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-memory-count{margin:10px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-memory-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 24px 24px}',
      '.dsh-memory-item{display:flex;align-items:flex-start;gap:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:11px 13px;margin:0 0 8px}',
      '.dsh-memory-item-text{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;flex:1 1 auto;min-width:0}',
      '.dsh-memory-tag{flex:0 0 auto;font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 8px}',
      '.dsh-memory-message{padding:28px 24px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.dsh-memory-message-title{color:var(--dsw-alias-label-primary);font-size:14px;margin:0 0 6px}',
      '.dsh-memory-button{display:inline-flex;align-items:center;padding:6px 12px;margin-top:10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}',
      '.dsh-memory-button:hover:enabled{border-color:var(--dsw-alias-border-l2)}',
    ].join('\n')

    function currentLanguage(context) {
      try {
        const locale = context.get('locale')
        if (locale !== undefined && locale !== null && typeof locale.getLocale === 'function') {
          const snapshot = locale.getLocale()
          const active = snapshot !== null && typeof snapshot === 'object' && typeof snapshot.active === 'string'
            ? snapshot.active.toLowerCase()
            : 'en'
          if (active.indexOf('zh') === 0) return 'zh'
        }
      } catch {
        // Fall through to the baseline language.
      }
      return 'en'
    }

    function translate(language, key, params) {
      const dictionary = DICTIONARIES[language] || DICTIONARIES.en
      const fallback = DICTIONARIES.en
      const template = typeof dictionary[key] === 'string'
        ? dictionary[key]
        : typeof fallback[key] === 'string' ? fallback[key] : key
      if (params === undefined || params === null) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => (
        params[name] === undefined ? match : String(params[name])
      ))
    }

    function kindKey(kind) {
      if (kind === 'self') return 'kindSelf'
      if (kind === 'preference') return 'kindPreference'
      return 'kindFact'
    }

    function normalizeMemories(value) {
      if (!Array.isArray(value)) return []
      const normalized = []
      for (const item of value) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
        const text = typeof item.text === 'string' ? item.text : ''
        if (text.trim() === '') continue
        normalized.push({
          id: typeof item.id === 'string' ? item.id : text,
          text,
          kind: item.kind === 'self' ? 'self' : item.kind === 'preference' ? 'preference' : 'fact',
        })
      }
      return normalized
    }

    /** Content of the left-sidebar entry; the shell owns the button around it. */
    function PanelIcon(props) {
      const requested = props !== null && props !== undefined && typeof props.size === 'number' ? props.size : 20
      const size = requested > 0 ? requested : 20
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      }, [
        h('rect', { key: 'card', x: 3.2, y: 4.8, width: 17.6, height: 14.4, rx: 3.2 }),
        h('path', { key: 'lines', d: 'M7.2 9.7h9.6M7.2 13.3h6.2' }),
        h('circle', { key: 'dot', cx: 16.7, cy: 15.5, r: 1.4, fill: 'currentColor', stroke: 'none' }),
      ])
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const element = document.createElement('style')
          element.setAttribute('data-dsh-plugin', NS)
          element.textContent = STYLE
          document.head.appendChild(element)
          return () => {
            element.remove()
          }
        })

        try {
          const locale = ctx.get('locale')
          if (locale !== undefined && locale !== null && typeof locale.register === 'function') {
            ctx.effect(() => {
              const disposers = []
              for (const language of Object.keys(DICTIONARIES)) {
                try {
                  const dispose = locale.register(NS, language, DICTIONARIES[language])
                  if (typeof dispose === 'function') disposers.push(dispose)
                } catch {
                  // A namespace collision must not break the panel.
                }
              }
              return () => {
                for (const dispose of disposers) {
                  try {
                    dispose()
                  } catch {
                    // Ignore a disposer that already ran.
                  }
                }
              }
            })
          }
        } catch {
          // Localization stays on the baseline language.
        }

        function useLocale() {
          const [revision, setRevision] = React.useState(0)
          React.useEffect(() => {
            let unsubscribe
            try {
              const locale = ctx.get('locale')
              if (locale !== undefined && locale !== null && typeof locale.subscribe === 'function') {
                unsubscribe = locale.subscribe(() => setRevision(value => value + 1))
              }
            } catch {
              // Keep the baseline language.
            }
            return () => {
              try {
                if (typeof unsubscribe === 'function') unsubscribe()
              } catch {
                // Ignore an already removed subscription.
              }
            }
          }, [])
          return React.useMemo(() => {
            const language = currentLanguage(ctx)
            return { language, t: (key, params) => translate(language, key, params) }
          }, [revision])
        }

        class PanelBoundary extends React.Component {
          constructor(props) {
            super(props)
            this.state = { failed: false }
          }

          static getDerivedStateFromError() {
            return { failed: true }
          }

          componentDidCatch(error) {
            try {
              console.error('[memory-panel] panel render failed', error)
            } catch {
              // Logging is best effort.
            }
          }

          render() {
            if (this.state.failed) {
              return h('div', { className: 'dsh-memory-root' },
                h('div', { className: 'dsh-memory-message' }, this.props.fallback))
            }
            return this.props.children
          }
        }

        function Panel() {
          const { t } = useLocale()
          const [status, setStatus] = React.useState('loading')
          const [memories, setMemories] = React.useState([])

          const load = React.useCallback(() => {
            let cancelled = false
            setStatus('loading')
            fetch(STATE_URL, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
              .then(response => {
                if (!response.ok) throw new Error('HTTP ' + response.status)
                return response.json()
              })
              .then(payload => {
                if (cancelled) return
                setMemories(normalizeMemories(payload === null ? [] : payload.memories))
                setStatus('ready')
              })
              .catch(() => {
                if (cancelled) return
                setStatus('error')
              })
            return () => {
              cancelled = true
            }
          }, [])

          React.useEffect(() => load(), [load])

          let body
          if (status === 'loading') {
            body = h('div', { className: 'dsh-memory-message' }, t('loading'))
          } else if (status === 'error') {
            body = h('div', { className: 'dsh-memory-message' },
              h('p', { className: 'dsh-memory-message-title' }, t('errorTitle')),
              h('span', null, t('errorHint')),
              h('div', null,
                h('button', { type: 'button', className: 'dsh-memory-button', onClick: load }, t('retry'))))
          } else if (memories.length === 0) {
            body = h('div', { className: 'dsh-memory-message' },
              h('p', { className: 'dsh-memory-message-title' }, t('empty')),
              h('span', null, t('emptyHint')))
          } else {
            body = memories.map(item => h('div', { key: item.id, className: 'dsh-memory-item' },
              h('p', { className: 'dsh-memory-item-text' }, item.text),
              h('span', { className: 'dsh-memory-tag' }, t(kindKey(item.kind)))))
          }

          const countLabel = status !== 'ready'
            ? null
            : memories.length === 1 ? t('countOne') : t('count', { n: memories.length })

          return h('div', { className: 'dsh-memory-root' },
            h('div', { className: 'dsh-memory-head' },
              h('h1', { className: 'dsh-memory-title' }, t('title')),
              h('p', { className: 'dsh-memory-subtitle' }, t('subtitle')),
              countLabel === null ? null : h('p', { className: 'dsh-memory-count' }, countLabel)),
            h('div', { className: 'dsh-memory-body' }, body))
        }

        function PanelEntry() {
          const { t } = useLocale()
          return h(PanelBoundary, { fallback: t('crash') }, h(Panel, null))
        }

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          label: () => translate(currentLanguage(ctx), 'sidebar'),
        }, PanelIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
        }, PanelEntry))
      },
    }
  },
})
