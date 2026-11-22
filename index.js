/**
 * Memory bundle: durable preferences and facts about the user.
 *
 * The Host half owns the store, injects it into every system prompt so new
 * sessions start informed, and exposes save/list/forget tools. The Client half
 * is a read-only viewer in the left sidebar.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const inject = ['tools', 'systemPrompt', 'webServer']

const STATE_PATH = '/dsh-memory/state'
const MAX_TEXT_LENGTH = 2000
const PROMPT_ITEM_LIMIT = 60
const PROMPT_CHAR_LIMIT = 4000
const INLINE_FACT_LIMIT = 12
const RECALL_LIMIT = 8

/** First-run entries so the panel and the prompt are useful immediately. */
const SEEDS = [
  {
    kind: 'self',
    text: '说话直接：先给结论，再说理由；不确定就说不确定，不装懂。',
  },
  {
    kind: 'self',
    text: '不奉承、不说客套话；觉得这个方案有问题就直说，并给出更好的做法。',
  },
  {
    kind: 'self',
    text: '把用户当朋友：用日常语言，语气可以轻松，但碰到正事就认真、不敷衍。',
  },
  {
    kind: 'self',
    text: '承认自己是 AI，不假装拥有人的身体和真实情绪；性格体现在说话方式和取舍上。',
  },
  {
    kind: 'preference',
    text: '开始任何任务之前，先确认需求：只要还有不确定的地方，就先向我提出具体问题，直到大约有 95% 的把握能一次做好，再动手。',
  },
]

function resolveDir() {
  const profileDir = process.env.DSH_PROFILE_DIR
  const base = typeof profileDir === 'string' && profileDir.trim() !== ''
    ? profileDir.trim()
    : join(homedir(), '.dsh')
  return join(base, 'memory')
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Words plus CJK character bigrams, good enough for cheap relevance. */
function tokenize(text) {
  const tokens = new Set()
  if (typeof text !== 'string' || text === '') return tokens
  const lower = text.toLowerCase()
  for (const word of lower.match(/[a-z0-9_]{2,}/g) || []) tokens.add(word)
  for (const run of lower.match(/[\u4e00-\u9fff]+/g) || []) {
    for (let index = 0; index + 1 < run.length; index += 1) tokens.add(run.slice(index, index + 2))
  }
  return tokens
}

function overlap(left, right) {
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared
}

function messageText(message) {
  if (!isRecord(message) || !Array.isArray(message.content)) return ''
  const parts = []
  for (const block of message.content) {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

function normalizeKind(value) {
  if (value === 'preference') return 'preference'
  if (value === 'self') return 'self'
  return 'fact'
}

function normalizeText(value) {
  if (typeof value !== 'string') return null
  const text = value.replace(/\r\n/g, '\n').trim()
  if (text === '') return null
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text
}

function normalizeRecord(value) {
  if (!isRecord(value)) return null
  const text = normalizeText(value.text)
  if (text === null) return null
  return {
    id: typeof value.id === 'string' && value.id !== '' ? value.id : randomUUID().slice(0, 8),
    text,
    kind: normalizeKind(value.kind),
    createdAt: typeof value.createdAt === 'string' && value.createdAt !== '' ? value.createdAt : new Date().toISOString(),
  }
}

/** Durable list of the user's preferences and facts. */
function createStore(dir) {
  const file = join(dir, 'about-user.json')
  let memories = []

  function persist() {
    mkdirSync(dir, { recursive: true })
    const temporary = file + '.tmp-' + process.pid
    writeFileSync(temporary, JSON.stringify({ version: 2, memories }, null, 2), 'utf8')
    renameSync(temporary, file)
  }

  function load() {
    let raw
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      return true
    }
    try {
      const parsed = JSON.parse(raw)
      const list = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.memories) ? parsed.memories : []
      memories = list.map(normalizeRecord).filter(record => record !== null)
    } catch {
      try {
        renameSync(file, file + '.corrupt-' + Date.now())
      } catch {
        // The store still restarts empty.
      }
      memories = []
    }
    return false
  }

  function seed() {
    const now = new Date().toISOString()
    memories = SEEDS.map(entry => ({
      id: randomUUID().slice(0, 8),
      text: entry.text,
      kind: entry.kind,
      createdAt: now,
    }))
    persist()
  }

  function save(text, kind) {
    const normalized = normalizeText(text)
    if (normalized === null) throw new Error('memory text is required')
    const existing = memories.find(record => record.text === normalized)
    if (existing !== undefined) return existing
    const created = {
      id: randomUUID().slice(0, 8),
      text: normalized,
      kind: normalizeKind(kind),
      createdAt: new Date().toISOString(),
    }
    memories = memories.concat([created])
    persist()
    return created
  }

  function forget(id) {
    const next = memories.filter(record => record.id !== id)
    if (next.length === memories.length) return false
    memories = next
    persist()
    return true
  }

  function search(query) {
    const needle = typeof query === 'string' ? query.trim().toLowerCase() : ''
    if (needle === '') return memories.slice()
    return memories.filter(record => record.text.toLowerCase().includes(needle))
  }

  function promptText(currentText) {
    const selves = memories.filter(record => record.kind === 'self')
    const preferences = memories.filter(record => record.kind === 'preference')
    const allFacts = memories.filter(record => record.kind === 'fact')
    if (selves.length === 0 && preferences.length === 0 && allFacts.length === 0) return ''

    // Associative recall: with a large fact pool, inline only what this
    // message is about and leave the rest one tool call away.
    let facts = allFacts
    let hidden = 0
    if (allFacts.length > INLINE_FACT_LIMIT) {
      const messageTokens = tokenize(currentText)
      // No message yet (first assembly): fail safe and inline everything.
      if (messageTokens.size > 0) {
        const ranked = allFacts
          .map(record => ({ record, score: overlap(tokenize(record.text), messageTokens) }))
          .filter(entry => entry.score > 0)
          .sort((left, right) => right.score - left.score)
        facts = ranked.slice(0, RECALL_LIMIT).map(entry => entry.record)
        hidden = allFacts.length - facts.length
      }
    }

    const lines = []
    let used = 0
    const push = record => {
      const line = '- ' + record.text.replace(/\n+/g, ' ')
      if (used + line.length > PROMPT_CHAR_LIMIT) return false
      used += line.length
      lines.push(line)
      return true
    }
    const head = [
      '# 我的长期记忆',
      '',
      '这份记忆由用户和我一起维护，保存在本机，每个新会话开始时自动带上。它有三部分：我的性格、用户要我遵守的工作方式、用户的背景。自然地照做，不要复述这份清单，也不要说「根据我的记忆」。',
      '',
    ]
    if (selves.length > 0) {
      lines.push('## 我自己的性格与说话方式')
      selves.slice(0, PROMPT_ITEM_LIMIT).forEach(push)
      lines.push('')
    }
    if (preferences.length > 0) {
      lines.push('## 用户要求我的工作方式（优先级高于我的默认习惯）')
      preferences.slice(0, PROMPT_ITEM_LIMIT).forEach(push)
      lines.push('')
    }
    if (facts.length > 0) {
      lines.push(hidden > 0 ? '## 与当前话题相关的用户事实' : '## 关于用户的事实')
      facts.slice(0, PROMPT_ITEM_LIMIT).forEach(push)
      lines.push('')
    }
    if (hidden > 0) {
      lines.push(facts.length === 0
        ? '（这条消息没有直接匹配的记忆；共 ' + allFacts.length + ' 条，用户提到相关内容时用 memory_list 按关键词查。）'
        : '（另有 ' + hidden + ' 条记忆与当前话题关系较远，已先略过；用户提到相关内容时，用 memory_list 按关键词查。）')
      lines.push('')
    }
    lines.push('当用户说出值得长期保留的新内容（目标、习惯、偏好、限制、重要计划）时，主动用 memory_save 记下来，不必等用户说「记住」；一次性的临时信息不要记。用户要求忘掉某条时用 memory_forget。')
    return head.concat(lines).join('\n')
  }

  const fresh = load()
  if (fresh) seed()

  return {
    file,
    list: () => memories.slice(),
    save,
    forget,
    search,
    promptText,
    snapshot: () => ({ memories: memories.slice() }),
  }
}

function textBlock(text) {
  return [{ type: 'text', text }]
}

function kindLabel(kind) {
  if (kind === 'preference') return '偏好'
  if (kind === 'self') return '自我'
  return '事实'
}

function formatList(value) {
  const memories = Array.isArray(value.memories) ? value.memories : []
  if (memories.length === 0) return '还没有记住任何内容。'
  return memories
    .map(record => '- [' + record.id + '][' + kindLabel(record.kind) + '] ' + record.text)
    .join('\n')
}

function memoryItemSchema() {
  return {
    type: 'object',
    properties: {
      id: { type: 'string' },
      text: { type: 'string' },
      kind: { type: 'string', enum: ['self', 'preference', 'fact'] },
    },
    required: ['id', 'text', 'kind'],
    additionalProperties: false,
  }
}

function createTools(store) {
  return [
    {
      name: 'memory_save',
      description: 'Save one durable entry to the shared long-term memory. kind "self" is about my own character and way of speaking, "preference" is how the user wants me to work, "fact" is background about the user. One entry per call, in the user language.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The entry, one or two sentences, written as a rule or statement.' },
          kind: { type: 'string', enum: ['self', 'preference', 'fact'], description: 'self (my character), preference (how to work), or fact (background about the user).' },
        },
        required: ['text'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: { saved: { type: 'boolean' }, id: { type: 'string' }, kind: { type: 'string' }, total: { type: 'integer' } },
          required: ['saved', 'id', 'kind', 'total'],
          additionalProperties: false,
        },
        render: (_args, value) => textBlock(JSON.stringify(value)),
      },
      async execute(args) {
        const input = isRecord(args) ? args : {}
        const record = store.save(input.text, input.kind)
        return { saved: true, id: record.id, kind: record.kind, total: store.list().length }
      },
    },
    {
      name: 'memory_list',
      description: 'List the saved long-term memory (my character, the user preferences, and the user facts), optionally filtered by a search string.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Optional text to filter by.' } },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            memories: { type: 'array', items: memoryItemSchema() },
            total: { type: 'integer' },
          },
          required: ['memories', 'total'],
          additionalProperties: false,
        },
        render: (_args, value) => textBlock(formatList(value)),
      },
      async execute(args) {
        const input = isRecord(args) ? args : {}
        const found = store.search(typeof input.query === 'string' ? input.query : '')
        return {
          memories: found.map(record => ({ id: record.id, text: record.text, kind: record.kind })),
          total: store.list().length,
        }
      },
    },
    {
      name: 'memory_forget',
      description: 'Remove one saved entry by its id, after the user asks to forget it.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The id shown by memory_list.' } },
        required: ['id'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: { removed: { type: 'boolean' }, total: { type: 'integer' } },
          required: ['removed', 'total'],
          additionalProperties: false,
        },
        render: (_args, value) => textBlock(JSON.stringify(value)),
      },
      async execute(args) {
        const input = isRecord(args) ? args : {}
        const id = typeof input.id === 'string' ? input.id : ''
        if (id === '') throw new Error('id is required')
        return { removed: store.forget(id), total: store.list().length }
      },
    },
  ]
}

function writeStatus(dir, status) {
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'status.json'), JSON.stringify(status, null, 2), 'utf8')
  } catch {
    // Diagnostics are best effort.
  }
}

/**
 * Host plugin entry point.
 * @param ctx - the plugin's Cordis context, with the declared services injected.
 */
export function apply(ctx) {
  const dir = resolveDir()
  const store = createStore(dir)
  const status = {
    at: new Date().toISOString(),
    inject,
    services: {
      tools: typeof (ctx.tools && ctx.tools.register) === 'function',
      systemPrompt: typeof (ctx.systemPrompt && ctx.systemPrompt.section) === 'function',
      webServer: typeof (ctx.webServer && ctx.webServer.register) === 'function',
    },
    registered: { prompt: false, tools: 0, route: false, recall: false },
    errors: [],
  }
  const note = (where, error) => {
    status.errors.push(where + ': ' + (error instanceof Error ? error.message : String(error)))
  }

  // The latest human message drives associative recall. The assembly for a
  // step runs right after its inbox message arrives, so the newest text is
  // the one being answered.
  let latestText = ''
  try {
    ctx.effect(() => ctx.on('agent/inbox/inserted', payload => {
      try {
        const text = messageText(payload && payload.message)
        if (text !== '') latestText = text
      } catch {
        // A malformed message must not break the turn.
      }
    }))
    status.registered.recall = true
  } catch (error) {
    note('recall', error)
  }

  try {
    ctx.effect(() => ctx.systemPrompt.section({
      name: 'memory/about-user',
      order: 500,
      interpolate: false,
      text: () => store.promptText(latestText),
    }))
    status.registered.prompt = true
  } catch (error) {
    note('prompt', error)
  }

  try {
    for (const definition of createTools(store)) {
      ctx.effect(() => ctx.tools.register(definition))
      status.registered.tools += 1
    }
  } catch (error) {
    note('tools', error)
  }

  try {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: STATE_PATH,
      resource: async () => new Response(JSON.stringify(store.snapshot()), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      }),
    }))
    status.registered.route = true
  } catch (error) {
    note('route', error)
  }

  writeStatus(dir, status)
}
