# OpenFigma MCP — Market Research & Launch Plan

> This document synthesizes public research and lays out a concrete plan to make
> OpenFigma the go-to free Figma MCP. It is deliberately honest about what is
> built today vs. what is still on the roadmap.

---

## 1. Competitive landscape (researched)

Data gathered from GitHub, the Figma developer docs/blog, and public engineering
write-ups (Medium, Stack Overflow). Numbers are point-in-time and will drift;
verify before quoting them publicly.

| Project | What it is | Signal | Notable gaps |
| --- | --- | --- | --- |
| **GLips / Figma-Context-MCP** (Framelink) | The dominant community server; `get_figma_data`, simplified output | ~15k★ — the benchmark to beat | No token export, single-framework focus, recurring **rate-limit** issues, an open prompt-injection concern, lists versions but can't diff |
| **Official Figma Dev Mode MCP** | First-party, can read context + write to canvas | Backed by Figma | **Paywalled** (Starter/View seats limited to ~6 tool calls/month); documented **token bloat** (one screen measured at 351k tokens, blowing past 25k caps); needs desktop app or remote server |
| TimHolden/figma-mcp-server, sichang824/mcp-figma, paulvandermeijs/figma-mcp, mohammeduvaiz/figma-mcp-server | Various smaller REST-based servers | Low★, intermittent maintenance | Thin feature sets, sparse docs/tests |
| southleft/figma-console-mcp | "Design system as an API" angle | Niche | Different scope (console/debugging) |

### The single biggest, repeatedly-documented pain point

**Context/token bloat.** AI agents choke on raw Figma JSON. Public write-ups
report a single Figma screen consuming **350k+ tokens** through the official MCP,
and Claude Code / Cursor users hitting "file content exceeds maximum allowed
tokens" walls. The official GitHub MCP is similarly criticized for ~42–55k tokens
of *tool definitions alone*.

**This is OpenFigma's wedge.** The simplification pipeline + `globalVars` dedup
already produces output ~3–4× smaller than raw API JSON (far more on style-heavy
files). That is the headline. Lead with it everywhere.

### Secondary pain points (all addressable / addressed)

1. **Rate limits** → OpenFigma caches to `.figma-cache` with stale-fallback on 429. ✅ built
2. **Paywall** → free PAT, no Dev seat. ✅ built
3. **Single framework** → 8 codegen targets. ✅ built
4. **No tokens/a11y/diff/drift** → all built. ✅
5. **Fabricated "success"** → honesty layer returns `supported:false`. ✅ built
6. **Prompt injection** → untrusted-text scanning. ✅ built

> Note on LinkedIn / X / YouTube / Discord / specific subreddits: those platforms
> are largely gated to automated search, so findings above are drawn from
> publicly indexed sources (GitHub issues, Figma docs, engineering blogs,
> academic papers on starring). Treat them as directionally strong, not as a
> scraped dataset. Do your own spot-checks before citing specific quotes.

---

## 2. Positioning

**One-liner:** *"The free Figma MCP that doesn't blow up your context window —
3–4× smaller design data, 8 frameworks of codegen, tokens, a11y, and diff, on a
free token."*

**Tagline options:**
- "Figma → code, without the Dev Mode tax or the 350k-token bill."
- "Your design system as a compact, honest API for AI agents."

Anchor every comparison on: **free**, **small/cheap context**, **breadth**
(tokens + 8-framework codegen + a11y + diff + drift), and **honesty** (no fake
canvas-write success).

---

## 3. Why developers star repos (and how we earn it)

Synthesized from research on starring behavior (3 of 4 devs check star count
before adopting; README quality correlates strongly with stars; "answer-first +
quick start + visual hierarchy" converts visitors 3–5×):

| Driver | What we do |
| --- | --- |
| **Instant comprehension** | Answer-first README hook + a comparison table above the fold |
| **Visual appeal** | Badges; add a demo GIF (see §6 — still TODO) |
| **5-minute quick start** | `npx open-figma-mcp ... --stdio` one-liner up top |
| **Credibility** | CI badge, passing tests, MIT license, CHANGELOG, CoC |
| **"It solves *my* problem"** | The token-bloat hook speaks to a felt pain |
| **Low adoption risk** | Drop-in superset of Framelink; same `get_figma_data` |
| **Maintained & welcoming** | Issue templates, CONTRIBUTING, "good first issue" labels |
| **Bookmark-worthy** | Breadth means people star "to come back to it" |

---

## 4. Pre-launch checklist

**Done in this repo:**
- [x] MIT `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- [x] `CHANGELOG.md`, `.gitignore`, `.env.example`
- [x] Issue templates (bug/feature) + PR template + discussions/security links
- [x] GitHub Actions CI (matrix: Node 18/20/22 × Linux/macOS/Windows) + publish workflow
- [x] README badges + token-bloat hook + 8-framework matrix
- [x] Full npm metadata in `package.json` (keywords, repo, engines, files)
- [x] 167 passing unit tests + integration test

**Do before you announce:**
- [ ] Add a **demo GIF/video** to the top of the README (record an agent in
      Cursor/Lovable fetching a design + generating code). This is the single
      highest-leverage missing asset.
- [ ] Set the repo **About** blurb + topics: `figma`, `mcp`,
      `model-context-protocol`, `design-to-code`, `ai`, `cursor`, `claude`,
      `design-tokens`, `codegen`.
- [ ] Pin a "Star if this saved you tokens 🌟" note.
- [ ] Publish to npm (`npm publish`) so the npm badge resolves and `npx` works.
- [ ] Submit to MCP directories: the official MCP servers list,
      `mcp.so`, `glama.ai/mcp`, `smithery.ai`, PulseMCP, Cursor Directory.

---

## 5. Launch sequence

**Week 0 — soft launch**
1. Publish v1.3.0 to npm. Tag a GitHub Release (fires the publish workflow).
2. List on the MCP directories above. These send steady, high-intent traffic.
3. Ask 5–10 friendly devs to try the quick start and (honestly) star.

**Week 1 — announcement**
4. Write one strong launch post. Lead with the token-bloat number and a GIF.
   - **Reddit**: r/webdev, r/Frontend, r/reactjs, r/SideProject (read each
     sub's self-promo rules; frame as "I built a free tool that fixes X").
   - **X/Twitter**: thread — problem (350k tokens) → fix → demo GIF → repo link.
   - **Hacker News**: "Show HN: OpenFigma — a free Figma MCP that's 3–4× smaller
     on context." Post at a US-morning slot; reply to every comment.
   - **dev.to / Hashnode**: a tutorial post ("Figma → React in Cursor for free").
   - **LinkedIn**: same story, professional framing, tag relevant communities.
5. Engage relentlessly for 48h — the trending algorithm rewards a burst of
   stars + activity in a short window. Answer every issue and comment fast.

**Week 2+ — sustain**
6. Ship a visible improvement weekly (a framework, a format, a fix) and note it
   in CHANGELOG + a short post. Momentum compounds.
7. Open 3–5 "good first issue" tickets to convert visitors into contributors.

---

## 6. Honest roadmap (NOT yet built — don't advertise as done)

The original brief asked for a very large surface. Here is what is **real today**
(see README "Tools") and what remains, in priority order. Shipping these as
clearly-scoped milestones is itself good launch content.

| Capability | Status | Notes |
| --- | --- | --- |
| Simplified data + dedup, tokens (8), codegen (8), a11y, diff, drift, vectors, comments, versions, image fills, caching, dual transport, proxy, honesty layer | ✅ **built & tested** | This is already a strong, shippable product |
| **Streamable HTTP transport** (modern MCP) | ⏳ next | Currently SSE; add the newer `StreamableHTTPServerTransport` alongside it |
| **OAuth 2.0 web flow** (not just a pasted Bearer token) | ⏳ | Real authorize/callback/refresh; today it accepts an OAuth token but doesn't run the flow |
| **Webhooks** (real-time design-change notifications) | ⏳ | Figma webhooks v2 → local handler + MCP notifications |
| **Batch operations** (multi-file/multi-node pipelines) | ⏳ | Partially possible via `nodeIds`; add first-class batch tooling |
| **Plugin architecture** (third-party tool extensions) | ⏳ | Define a `plugins/` loader + a stable internal API |
| **Cloud deploy templates** (Docker, Railway, Fly, Vercel) | ⏳ | Add a `Dockerfile` + one-click deploy buttons; mind the auth note in SECURITY.md |
| **Structured logging + log levels** | ⏳ | Currently `console.error`; add leveled, optionally-JSON logs |
| **Canvas write** (create/edit frames, variants) | ❌ **impossible over REST** | Needs the Figma *Plugin* API. The honesty layer correctly refuses to fake this. A separate companion Figma plugin would be required. |

**Guiding principle:** never mark a roadmap item as shipped in the README until
it has tests and works. That honesty is part of the brand and, ironically, a
differentiator from competitors that overpromise.

---

## 7. Metrics to watch

- ⭐ stars/day and referral sources (GitHub Insights → Traffic)
- npm weekly downloads
- Issues opened vs. closed (responsiveness is visible and trusted)
- Directory listing click-throughs
- README → quick-start conversion (proxy: clones + npm installs)
