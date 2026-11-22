# dsh-memory-panel · 长期记忆

> 给 DeepSeek Harness 加一份跨会话的长期记忆：**我的性格、你对我的要求、你的背景**三类内容存在本机，每次新开对话自动带上；记忆变多后只递相关的那几条。
>
> An experimental long-term memory plugin for DeepSeek Harness — character, working preferences and background facts, injected into every new session, with keyword-based associative recall.

## 它做什么

- **三类记忆**：`self`（我的性格与说话方式）、`preference`（你要我遵守的工作方式）、`fact`（关于你的背景）。
- **自动带上**：每次请求都会注入系统提示词，新开对话不用重复交代。
- **自动联想**：`fact` 超过 12 条时，只注入与**当前这句话**相关的那几条；`self` 和 `preference` 永远全量注入——性格和规矩不能因为关键词没匹配上就丢掉。
- **主动记下**：你说出值得长期保留的内容，我会自己调用工具记住，不用你说"记住"。
- **可查可删**：左侧栏「记忆」入口能看到全部条目；说「忘掉第几条」即可删除。

## 安装

### 方式一：从目录安装（开发中推荐）

DSH → **插件** → **添加插件** → 选择本目录 → 重启 DSH。

### 方式二：手动

```bash
cd ~/.dsh/profiles/<你的 profile>
pnpm add @andy-awa/dsh-memory-panel
```

把 `"@andy-awa/dsh-memory-panel"` 加进同目录 `package.json` 的 `dsh.profile.bundles` 数组，然后重启 DSH。

> 从 GitHub 直接装也可以：`pnpm add github:Andy-awa/dsh-memory-panel`。

## 用法

| 你说 | 效果 |
| --- | --- |
| 记住：我更喜欢简洁的回答 | 存一条事实 |
| 你记得什么？ | 列出全部记忆 |
| 忘掉第 3 条 | 删除那一条 |
| 你以后说话再简短一点 | 存一条工作方式 |

左侧栏的「记忆」图标显示同一份列表，标着「我自己 / 偏好 / 事实」。

## 数据在哪

```
~/.dsh/memory/about-user.json   # 记忆本体，纯文本 JSON
~/.dsh/memory/status.json       # 启动自检，排查"为什么没生效"
```

记忆**故意**放在 profile 之外：多个 profile 共用同一份。它是纯 JSON，可以直接用编辑器改；删掉 `about-user.json` 就等于清空记忆。

`status.json` 记录每次启动时各项注册是否成功、有没有报错——插件没反应时先看它。

## 限制（说实话）

- **联想是关键词匹配，不是语义理解**。中文用双字切片，字面不重合的相关记忆捞不出来；那时可以用 `memory_list` 按关键词查。
- 只有 `fact` 会被筛选。`self` 和 `preference` 永远全量注入。
- 改完插件**必须重启 DSH**：Host 插件没有热重载。
- 面板只读，增删改都通过对话完成。
- 与 [`@a9i5k4/dsh-auto-memory`](https://github.com/Aik358/dsh-auto-memory) 的侧栏入口**冲突**：两者都占用 `sidebar.panellist` 的 `memory` 位置，别同时启用。
- 注入内容会随对话变化，前缀缓存命中率会下降一点（理论上略费 token，量很小）。
- 首次启动会写入 5 条默认记忆（4 条性格 + 1 条「先问清楚再动手」）。不想要就在面板里删，或直接删 `about-user.json` 后重新配。

## 结构

```
index.js           Host：存储、提示词注入、联想、三个工具、面板数据接口
client.js          Client：侧栏图标 + 只读面板
cordis.patch.yml   注册行
locale/            插件管理器里的标题与描述（中/英）
icon.svg           图标
```

零运行时依赖，无构建步骤，两个 JS 文件直接跑。

## 许可证

MIT，见 [LICENSE](LICENSE)。
