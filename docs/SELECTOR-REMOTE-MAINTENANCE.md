# Selector 远程维护手册

本手册用于维护 `sendol-selectors` 远程仓库中的 `selectors.json`，目标是：

- 不发扩展新版本，快速修复平台 DOM 变动。
- 通过远程配置统一控制各平台输入框与发送按钮定位。

关联文档：

- 平台维护模板：`docs/SELECTOR-PLATFORM-RUNBOOK.md`
- 变更日志模板：`docs/SELECTOR-CHANGELOG-TEMPLATE.md`

## 1) 当前架构

- 远程源：`sendol-selectors` 仓库 `selectors.json`
- 拉取方：扩展 `background.js` 定时拉取并缓存到 `chrome.storage.local.aib_dynamic_selectors`
- 使用方：`src/content/selectors.js`
  - `getDynamicSelectors()`
  - `findInputForPlatform(platformId)`
  - `findSendBtnForPlatform(platformId)`
- 兜底：`src/content/heuristics.js`（当 selector 不命中时）

## 2) selectors.json v2 规范

顶层字段：

```json
{
  "version": 2,
  "chatgpt": {
    "mode": "override",
    "findInput": ["#prompt-textarea"],
    "findSendBtn": ["[data-testid=\"send-button\"]"]
  }
}
```

字段说明：

- `version`: 必须为 `2`
- `<platformId>.mode`:
  - `override`: 远程列表完全覆盖本地默认列表（推荐）
  - `merge`: 远程列表优先，再拼接本地默认列表（过渡期可用）
  - `disabled`: 禁用该平台 selector 层（直接走 heuristic）
- `<platformId>.findInput`: 输入框选择器数组
- `<platformId>.findSendBtn`: 发送按钮选择器数组

当前支持平台：

- `chatgpt`
- `claude`
- `gemini`
- `grok`
- `deepseek`
- `doubao`
- `qianwen`
- `yuanbao`
- `kimi`
- `mistral`

## 3) 维护原则

- 选择器顺序按命中稳定性排序（最稳的放前面）。
- 优先语义属性：`data-testid`、`aria-label`、稳定结构属性。
- 尽量避免哈希 class 和明显易变路径。
- 一个平台最少保留 2~3 条可替代 selector。
- 修改后先在真实页面验证：`findInput` 命中正确元素、`findSendBtn` 命中可点击按钮。

## 4) 发布流程（远程仓库）

1. 在 `sendol-selectors` 更新 `selectors.json`。
2. 本地 JSON 校验通过（格式合法、逗号/转义正确）。
3. 提交并 push 到默认分支。
4. 等待扩展拉取周期生效（安装时 + 定时拉取）。

建议提交信息模板：

- `fix(selectors): update gemini send button selectors after dom change`
- `chore(selectors): switch deepseek to override mode`

## 5) 回滚策略

出现误匹配或大面积失败时：

1. 立即回滚到上一版 `selectors.json`。
2. 对异常平台临时设置 `mode: "disabled"`，让其走 heuristic。
3. 补充新 selector 后再切回 `override`。

## 6) 常见问题

### Q1: 远程改了但效果不明显？

- 检查是否推送到正确分支。
- 检查扩展是否已触发拉取（等待周期或重装/重新触发流程）。
- 检查该平台是否仍被业务逻辑兜底路径接管（heuristic/按键发送）。

### Q2: 只改了 `findInput`，`send` 失败？

- `findInput` 与 `findSendBtn` 应成对维护。
- 某些平台发送按钮会延迟渲染，需保留多个 selector。

### Q3: 新平台接入最小步骤？

1. 在 `selectors.json` 增加平台节点（`mode/findInput/findSendBtn`）。
2. 在扩展 `platform-registry` 与 `platformAdapters` 增加平台映射与基础 adapter。
3. 回归验证输入与发送两条链路。

## 7) 发布前检查清单

- [ ] `version` 为 `2`
- [ ] 变更平台都显式声明 `mode`
- [ ] `findInput` 至少 2 条候选
- [ ] `findSendBtn` 至少 2 条候选（如平台允许）
- [ ] 不含明显哈希 class 依赖
- [ ] 目标平台实际页面验证通过
- [ ] 失败平台有回滚方案（上一版 JSON）
