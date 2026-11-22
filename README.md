<p align="center">
  <img src="icon.svg" width="72" height="72" alt="dsh-memory-panel">
</p>

<h1 align="center">dsh-memory-panel</h1>

<p align="center">
  Long-term memory for DeepSeek Harness<br>
  <sub>my character · how you want me to work · your background — carried into every new session</sub>
</p>

<p align="center">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="version" src="https://img.shields.io/badge/version-0.7.0-lightgrey.svg">
  <img alt="runtime deps" src="https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg">
  <img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-4d6bfe.svg">
</p>

<p align="center">
  <b>English</b> · <a href="README.zh-CN.md">中文</a>
</p>

---

## Why

| Today | With this plugin |
| --- | --- |
| A new session forgets everything you said | No re-briefing — I know it from the first message |
| You restate "ask before you start" every time | Working rules are stored and always apply |
| Memory piles up and gets noisy, and costs tokens | Only the entries related to this message are injected |

## Three kinds of entries

| Kind | What it holds | When it enters the prompt |
| --- | --- | --- |
| `self` | My character and way of speaking | **Always**, in full |
| `preference` | How you want me to work | **Always**, in full |
| `fact` | Background about you | Filtered by relevance once there are more than 12 |

Character and rules are always injected in full: a keyword miss must never drop my personality. Only facts are filtered.

## Install

**Recommended:** DSH → Plugins → Add plugin → pick this directory → restart DSH.

<details>
<summary>Manual install (pnpm)</summary>

```bash
cd ~/.dsh/profiles/<your profile>
pnpm add github:Andy-awa/dsh-memory-panel
```

Add `"@andy-awa/dsh-memory-panel"` to the `dsh.profile.bundles` array in that directory's `package.json`, then restart DSH.

> Host plugins have no hot reload: restart DSH after every code change.

</details>

## Usage

| You say | What happens |
| --- | --- |
| Remember: I prefer concise answers | Saves one fact |
| What do you remember? | Lists every entry |
| Forget number 3 | Deletes that entry |
| From now on, be shorter | Saves one working preference |

The Memory icon in the left sidebar lists every entry, tagged *me / preference / fact*. The panel is read-only; add and remove through the chat.

When you share something worth keeping long term, I save it myself — you do not have to say "remember".

## How it works

```
your message ──▶ score every fact by keyword ──▶ keep the relevant ones
                                                     │
my character + your rules (always, in full) ─────────┴──▶ inject into this request ──▶ answer
```

Keyword matching, not a semantic model — CJK text is split into character bigrams. It is fast, dependency-free and free to run; the trade-off is that a memory with no literal overlap is missed.

## Where the data lives

```
~/.dsh/memory/about-user.json   # the entries, plain JSON, editable by hand
~/.dsh/memory/status.json       # activation self-check, for "why is it not working"
```

Memory deliberately lives outside the profile directory, so every profile shares one set. Delete `about-user.json` to clear it.

## Limitations

> [!WARNING]
> Experimental 0.7.0 — interfaces may still change.

- **Keyword matching, not semantics.** A related memory with no overlapping words will not surface; use `memory_list` with a keyword then.
- Only `fact` is filtered. `self` and `preference` are always injected in full.
- **Restart DSH after every change** — Host plugins have no hot reload.
- The sidebar panel is read-only.
- Conflicts with [@a9i5k4/dsh-auto-memory](https://github.com/Aik358/dsh-auto-memory): both claim the `memory` slot in `sidebar.panellist`. Do not enable both.
- Injected text changes with the conversation, so the prefix cache hit rate drops slightly.
- First run writes 5 default entries (4 character traits + 1 "confirm before starting"); delete them if you do not want them.

## Layout

```
index.js           Host: storage, prompt injection, recall, three tools, panel route
client.js          Client: sidebar icon + read-only panel
cordis.patch.yml   registration row
locale/            plugin-manager title and description (en / zh)
icon.svg           icon
```

Zero runtime dependencies, no build step — two plain JS files.

## License

[MIT](LICENSE) © Andy-awa

Issues and pull requests are welcome.
