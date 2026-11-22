<p align="center">
  <img src="icon.svg" width="72" height="72" alt="dsh-memory-panel">
</p>

<h1 align="center">dsh-memory-panel</h1>

<p align="center">
  给 DeepSeek Harness 一份跨会话的长期记忆<br>
  <sub>我的性格 · 你对我的要求 · 你的背景 —— 每次新开对话自动带上</sub>
</p>

<p align="center">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="version" src="https://img.shields.io/badge/version-0.7.0-lightgrey.svg">
  <img alt="runtime deps" src="https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg">
  <img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-4d6bfe.svg">
</p>

<p align="center">
  <a href="README.md">English</a> · <b>中文</b>
</p>

---

## 解决什么问题

| 现在 | 装上之后 |
| --- | --- |
| 新开一个对话，之前说过的全忘了 | 不用重复交代，我一上来就知道 |
| 每次都要重申「先问清楚再动手」 | 工作方式存进记忆，一直生效 |
| 记忆越攒越多，全塞进去又吵又费钱 | 只递和当前这句话相关的那几条 |

## 三类记忆

| 类型 | 存什么 | 什么时候进提示词 |
| --- | --- | --- |
| `self` | 我的性格、说话方式 | 每次**全部**注入 |
| `preference` | 你要我遵守的工作方式 | 每次**全部**注入 |
| `fact` | 关于你的背景 | 超过 12 条时，按当前消息挑相关的 |

性格和规矩永远全量注入——不能因为关键词没匹配上就把性格丢了。只有事实会筛选。

## 安装

**推荐**：DSH → 插件 → 添加插件 → 选择本目录 → 重启 DSH。

<details>
<summary>手动安装（pnpm）</summary>

```bash
cd ~/.dsh/profiles/<你的 profile>
pnpm add github:Andy-awa/dsh-memory-panel
```

把 `"@andy-awa/dsh-memory-panel"` 加进同目录 `package.json` 的 `dsh.profile.bundles` 数组，重启 DSH。

> Host 插件没有热重载：改完代码必须重启才生效。

</details>

## 用法

| 你说 | 效果 |
| --- | --- |
| 记住：我更喜欢简洁的回答 | 存一条事实 |
| 你记得什么？ | 列出全部记忆 |
| 忘掉第 3 条 | 删除那一条 |
| 你以后说话再简短一点 | 存一条工作方式 |

左侧栏的「记忆」图标能看到全部条目，每条标着「我自己 / 偏好 / 事实」。面板只读，增删改通过对话完成。

你说出值得长期保留的内容时，我会自己记下来，不用你说「记住」。

## 大致原理

```
你的消息 ──▶ 给每条 fact 关键词打分 ──▶ 挑出相关的几条
                                          │
我的性格 + 你的规矩（全量）──────────────┴──▶ 注入本次请求 ──▶ 我回答
```

不是语义模型，是关键词匹配（中文按双字切片）。够快、零依赖、不花钱；代价是字面不重合的记忆捞不出来。

## 数据在哪

```
~/.dsh/memory/about-user.json   # 记忆本体，纯文本 JSON，可直接改
~/.dsh/memory/status.json       # 启动自检，排查"为什么没生效"
```

记忆**故意**放在 profile 之外：多个 profile 共用同一份。删掉 `about-user.json` 就等于清空记忆。

## 限制

> [!WARNING]
> 这是 0.7.0 实验版本，接口可能还会变。

- **关键词匹配，不是语义理解**。字面不重合的相关记忆捞不出来，这时可以用 `memory_list` 按关键词查。
- 只有 `fact` 会被筛选，`self` 和 `preference` 永远全量注入。
- 改完插件**必须重启 DSH**（Host 插件没有热重载）。
- 面板只读。
- 与 [@a9i5k4/dsh-auto-memory](https://github.com/Aik358/dsh-auto-memory) 冲突：两者都占 `sidebar.panellist` 的 `memory` 位置，别同时启用。
- 注入内容随对话变化，前缀缓存命中率会下降一点。
- 首次启动写入 5 条默认记忆（4 条性格 + 1 条「先问清楚再动手」），不想要就删。

## 结构

```
index.js           Host：存储、注入、联想、三个工具、面板数据接口
client.js          Client：侧栏图标 + 只读面板
cordis.patch.yml   注册行
locale/            插件管理器标题与描述（中/英）
icon.svg           图标
```

零运行时依赖，无构建步骤，两个 JS 文件直接跑。

## 许可

[MIT](LICENSE) © Andy-awa

欢迎提 issue 和 PR。
