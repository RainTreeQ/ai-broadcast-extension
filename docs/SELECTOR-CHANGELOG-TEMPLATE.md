# Selector 变更日志模板

用于记录每次远程 `selectors.json` 发布，建议在 `sendol-selectors` 仓库按版本或日期维护。

## 模板

```md
## <YYYY-MM-DD> <version-or-tag>

### 变更概览
- 目标：
- 范围平台：
- 风险等级：低/中/高

### 变更详情
- <platformId>
  - mode: <override|merge|disabled>
  - findInput: 新增/删除/调整顺序（列关键 selector）
  - findSendBtn: 新增/删除/调整顺序（列关键 selector）
  - 原因: DOM 变更 / 误命中修复 / 稳定性优化

### 验证结果
- 手工验证平台：
- 输入定位：通过/失败
- 发送定位：通过/失败
- 兜底触发：无 / heuristic / enter

### 回滚信息
- 回滚目标版本：
- 回滚条件：
- 回滚执行人：

### 备注
-
```

## 示例

```md
## 2026-03-12 v2.3.1

### 变更概览
- 目标：修复 Gemini 改版后发送按钮失效
- 范围平台：gemini
- 风险等级：中

### 变更详情
- gemini
  - mode: override
  - findInput: 保持不变
  - findSendBtn: 新增 `button[jsname="Qx7uuf"]`，上调 `button[mattooltip="Send"]` 优先级
  - 原因: DOM 结构调整，旧 selector 命中率下降

### 验证结果
- 手工验证平台：gemini, chatgpt
- 输入定位：通过
- 发送定位：通过
- 兜底触发：无

### 回滚信息
- 回滚目标版本：v2.3.0
- 回滚条件：发送按钮误命中率 > 10%
- 回滚执行人：oncall-maintainer

### 备注
- 无
```
