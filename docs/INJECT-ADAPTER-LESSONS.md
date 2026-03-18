# 注入层经验总结

本文记录 `src/content/core/injection.js` 和各平台 adapter 的关键行为约束，用于避免反复踩坑。

关联文档：
- 平台维护模板：`docs/SELECTOR-PLATFORM-RUNBOOK.md`

---

## 核心原则

### 1. 通用改动影响全平台，改前必须明确影响面

`injection.js` 里的 `runStrategies`、`verifyContent`、`setReactValue`、`clearElement` 是所有平台共用的路径。改动这些函数时：

- **不要**为了修一个平台而改通用逻辑
- 每次改动后必须回归**全部平台**（不只是目标平台）
- 优先在平台 adapter 里加平台专属路径，而不是修改通用函数

### 2. `verifyContent` 对短文本直接返回 false

`verifyContent` 和 `verifyContentStrict` 在 `expected.length <= 8` 时直接返回 false（`6aa4966` 引入）。这意味着：

- 测试时不要用 "test"、"hi" 等短文字——用 9 字符以上的文本
- 这个行为是故意的（避免误判），不要移除这个条件

### 3. `clearElement` 会破坏 Slate/ProseMirror 状态

`runStrategies` 在策略失败后会调用 `clearElement`（`execCommand selectAll + delete`）。对于：

- **Slate editor（千问）**：必须传 `{ skipClear: true }`，否则 Slate 内部 state 损坏导致"发生未知错误"
- **ProseMirror（Kimi）**：策略链内部自己管理清空，不依赖 runStrategies 的 clearElement

---

## 各平台注入行为

### ChatGPT — 混合编辑器

**关键行为**：
- `#prompt-textarea` 可能是 `<textarea>` 或 `<div>` — 依赖 `el.tagName` 判断
- `<textarea>` → `setReactValue` 直接返回，不做 verifyContent 验证（验证会失败）
- `<div data-lexical-editor>` → ClipboardEvent paste → `execCommand insertText` 降级
- **主页 `chatgpt.com/` 没有可见输入框时，inject 会失败** — 这是正常行为

**不要做**：
- 不要在 TEXTAREA 分支加 verifyContent 检查（会导致短文本注入失败）
- 不要把 Lexical 失败的情况 fallthrough 到 `setContentEditable` 里的 verifyContent（同样问题）

### Grok — React 受控 textarea

**关键行为**：
- 2026年3月后从 ProseMirror 迁移到 React 受控 `<textarea>`
- `setReactValue`（native setter + `_valueTracker.setValue('')` + input/change event）设值后，DOM 有值（`inputLen > 0`），但 React 在下一渲染周期可能用空 state 覆盖 DOM 值
- 发送按钮 `button[type="submit"]` 在 React state 为空时 `disabled=true` 且父容器 `class="hidden"`
- 强制 enable 按钮并 click → React 读的是空 state → 发送空消息（假阳性）

**confirmSendCheck 设计**：
- 不能只检查"输入框是否清空"（React 已经清空了，但消息没发出）
- 必须同时检查**页面线程内容是否包含发送的文字**
- `before = getContent(target) || options.text` — 当 React 重置了 DOM 值时用 options.text 兜底

**tryKeySend 设计**：
- 在 Enter 键之前重新触发 React state 更新（nativeSetter + _valueTracker + input/change）
- 三种 Enter 变体：plain Enter、ctrl+Enter、meta+Enter
- 找不到按钮时不 throw，直接走 tryKeySend

**不要做**：
- 不要在 send 前加 `el.value = ''` 清空（会触发 React 把 state 设为空，然后 setReactValue 无效）
- 不要用 `!before` 作为 confirmSendCheck 的成功条件（before 为空时直接假阳性，发空消息）
- 不要用 `fiber.memoizedProps.onChange` 直接调用（Grok 的 onChange 不接受合成对象，只接受真实 SyntheticEvent）

### 千问（Qianwen）— Slate.js

**关键行为**：
- 优先走 React fiber 找 Slate editor 实例，调用 `editor.deleteFragment()` + `editor.insertText()`
- **fiber 循环找到 editor 后必须立刻 `break`**，不能继续循环——多次 deleteFragment + insertText 会累积文字或崩溃
- fiber 找不到时 fallback 到 `runStrategies`，必须传 `{ skipClear: true }`

**不要做**：
- 不要在 fiber 循环里让 editor 处理多次（`break` 是必须的）
- 不要让 `runStrategies` 的 `clearElement` 在 Slate 策略之间执行（Slate state 损坏）

### Kimi — ProseMirror-like

**关键行为**：
- 专用注入链：kimi-paste（ClipboardEvent）→ kimi-insertText → kimi-clipboard → kimi-datatransfer → kimi-direct-dom
- paste 验证需要 400ms+（ProseMirror 异步 flush）
- `runStrategies` 的 `clearElement` 对 Kimi 是安全的（不需要 skipClear）

### 通用 setReactValue

**正确用法**：
```js
const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
if (setter) setter.call(el, value);
else el.value = value;
const tracker = el._valueTracker;
if (tracker) tracker.setValue('');  // 设为 '' 让 React 检测到 oldValue→newValue 变化
el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
el.dispatchEvent(new Event('change', { bubbles: true }));
```

- `tracker.setValue('')` 在 setter 之后调用，让 React 认为 oldValue='' → newValue=text，触发 onChange
- 对于 Grok 这类强受控组件，React 仍可能在渲染周期里覆盖 DOM 值（这是 Grok 的设计，不是 bug）

---

## 已知的稳定性边界

| 场景 | 结论 |
|------|------|
| 改 `verifyContent` 阈值 | 影响全平台，极高风险 |
| 改 `runStrategies` | 影响全平台，需全平台回归 |
| 改 `setReactValue` | 影响 ChatGPT、Grok、千问、Kimi 的 textarea 分支 |
| 改 `clearElement` | 影响所有走 runStrategies 的平台 |
| 改平台 adapter 的 inject/send | 仅影响该平台，安全 |
| 改 selectors/ | 仅影响 findInput/findSendBtn，不影响注入逻辑 |

---

## 调试日志字段说明

`inject-failure` 日志格式：
```
platform=ChatGPT | stage=inject | error=输入注入失败 | strategy=n/a | inputLen=0
```

- `strategy=n/a` + `inputLen=0`：inject 方法直接 throw（没有执行到任何策略）
- `strategy=react-value` + `inputLen=4`：setReactValue 设值成功（DOM有值），但后续发送失败
- `stage=send` + `error=Grok发送未执行`：注入成功，但 React state 为空导致发送无效
- `matched=none` + `clicked=true`：找不到按钮，但代码到达了 click 分支（逻辑 bug）
