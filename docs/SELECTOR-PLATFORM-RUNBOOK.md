# Selector 平台维护模板

本文件用于平台级 selector 维护与回归记录，配合 `docs/SELECTOR-REMOTE-MAINTENANCE.md` 使用。

关联文档：

- 远程维护手册：`docs/SELECTOR-REMOTE-MAINTENANCE.md`
- 变更日志模板：`docs/SELECTOR-CHANGELOG-TEMPLATE.md`

使用方式：

- 每次平台 DOM 更新时，仅更新对应平台小节。
- 改完后在“回归记录”填写结果，便于追溯。

## 通用记录模板

```md
### <platformId>
- 站点域名：
- mode：override | merge | disabled
- findInput（按优先级）：
  -
  -
- findSendBtn（按优先级）：
  -
  -
- 风险点：
  -
- 回归记录：
  - 日期：
  - 页面：
  - 输入定位：通过/失败
  - 发送定位：通过/失败
  - 兜底路径：未触发/heuristic/enter
  - 备注：
```

---

## 平台清单

### chatgpt
- 站点域名：`chatgpt.com`、`chat.openai.com`
- 关键点：`#prompt-textarea` 通常最稳；发送按钮常见 `data-testid="send-button"`
- 风险点：A/B UI 导致 aria 文案变化
- 回归步骤：
  - 输入框注入文本后应完整显示
  - 点击发送按钮后输入框内容应变化/清空

### claude
- 站点域名：`claude.ai`
- 关键点：`div.ProseMirror[contenteditable="true"]`
- 风险点：附件/上传按钮与发送按钮语义接近，易误命中
- 回归步骤：
  - 验证发送命中的不是 attach/upload 按钮

### gemini
- 站点域名：`gemini.google.com`
- 关键点：`ql-editor` 与 `mattooltip` 相关按钮
- 风险点：发送按钮常延迟渲染；不同语言文案差异大
- 回归步骤：
  - 注入后立即发送和等待 1~2 秒发送都要测试

### grok
- 站点域名：`grok.com`
- 关键点：`textarea[placeholder]` 与 submit/send 变体
- 风险点：按钮可能为 `role="button"`，并非原生 button
- 回归步骤：
  - 验证 selector 命中失败时 heuristic 仍可发送

### deepseek
- 站点域名：`deepseek.com`
- 关键点：`chat-input` 相关 textarea/contenteditable 双路径
- 风险点：输入容器从 textarea 切到 contenteditable 时易失效
- 回归步骤：
  - 同时验证 textarea 版和 contenteditable 版页面

### doubao
- 站点域名：`doubao.com`
- 关键点：需排除人机验证页干扰
- 风险点：验证页会导致输入发送都不可用
- 回归步骤：
  - 正常页验证通过
  - 验证页应返回明确错误而非误注入

### qianwen
- 站点域名：`tongyi.aliyun.com`、`qianwen.com`
- 关键点：Slate editor 定位稳定性
- 风险点：任务助手弹层影响发送按钮命中
- 回归步骤：
  - 注入后发送前确认任务助手已关闭

### yuanbao
- 站点域名：`yuanbao.tencent.com`
- 关键点：Quill 编辑器路径
- 风险点：发送按钮文本和 aria 可能不稳定
- 回归步骤：
  - selector 发送失败时 Enter 兜底应可工作

### kimi
- 站点域名：`moonshot.cn`、`kimi.ai`、`kimi.com`
- 关键点：`chat-input-editor` 与 `send-button-container`
- 风险点：容器 class 变体较多
- 回归步骤：
  - 验证容器可点击状态（非 disabled）

### mistral
- 站点域名：`chat.mistral.ai`
- 关键点：基础通用路径（textarea/contenteditable + submit/send）
- 风险点：新接入平台，优先观察稳定性
- 回归步骤：
  - 至少验证 3 次连续注入发送成功率

---

## 每次变更后的最小回归

- 仅改 1 个平台时：回归该平台 + 任意 1 个未改平台
- 改多个平台时：每个平台至少 1 次输入/发送完整链路
- 若出现误命中：优先回滚远程 JSON，再定位具体 selector
