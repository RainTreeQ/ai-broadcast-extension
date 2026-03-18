# GitHub 仓库创建指南 - sendol-selectors

## 📝 表单填写说明

访问：https://github.com/new

### 必填字段：

**1. Repository name（仓库名称）**
```
sendol-selectors
```

**2. Description（描述）- 可选但建议填写**
```
Dynamic DOM selectors for Sendol AI Broadcast Extension
```
或中文：
```
Sendol AI 广播扩展的动态 DOM 选择器配置
```

**3. Public / Private（公开/私有）**
```
✅ 选择 Public（公开）
```
⚠️ **必须选 Public**，因为扩展需要通过 raw.githubusercontent.com 直接访问

**4. Initialize this repository with（初始化选项）**
```
❌ 不要勾选任何选项
   - Add a README file（不勾选）
   - Add .gitignore（不勾选）
   - Choose a license（不勾选）
```
⚠️ **全部不勾选**，因为我们已经在本地创建好了

### 许可证（License）说明：

由于你的主项目使用 **AGPL-3.0-or-later**，selectors 仓库建议：

**选项 1：不设置许可证（推荐）**
- selectors/ 只是配置文件，不是代码
- 不勾选 license 选项即可

**选项 2：使用相同许可证**
- 如果想保持一致，可以后续手动添加 AGPL-3.0 许可证
- 但对于纯配置文件来说不是必需的

**选项 3：使用 MIT（更宽松）**
- 如果希望其他人也能使用这些选择器
- 可以后续添加 MIT license

## 🎯 完整操作步骤

### Step 1: 创建仓库
1. 访问 https://github.com/new
2. Repository name: `sendol-selectors`
3. Description: `Dynamic DOM selectors for Sendol AI Broadcast Extension`
4. 选择 **Public**
5. **不勾选**任何 Initialize 选项
6. 点击 **Create repository**

### Step 2: 获取你的 GitHub 用户名
创建完成后，页面会显示类似：
```
https://github.com/YOUR_USERNAME/sendol-selectors
```
记下 `YOUR_USERNAME`（你的 GitHub 用户名）

### Step 3: 推送本地仓库
在终端执行（替换 YOUR_USERNAME）：
```bash
cd "/Users/quxianglin/Documents/vibe coding/sendol-selectors"
git remote add origin https://github.com/YOUR_USERNAME/sendol-selectors.git
git branch -M main
git push -u origin main
```

⚠️ 注意：如果 git 提示 `master` 分支，改用：
```bash
git push -u origin master
```

### Step 4: 验证
访问：
```
https://github.com/YOUR_USERNAME/sendol-selectors
```
应该能看到：
- README.md
- selectors/
- .gitignore

### Step 5: 测试 Raw URL
访问：
```
https://raw.githubusercontent.com/YOUR_USERNAME/sendol-selectors/main/selectors/{platform}.json
```
应该能看到 JSON 内容

## 🔐 如果需要身份验证

如果 `git push` 时要求输入密码：

**不要使用 GitHub 密码！** 需要使用 Personal Access Token：

1. 访问：https://github.com/settings/tokens
2. 点击 **Generate new token (classic)**
3. Note: `sendol-selectors-push`
4. Expiration: 选择有效期（建议 90 days）
5. 勾选权限：
   - ✅ repo（完整的仓库访问权限）
6. 点击 **Generate token**
7. **复制 token**（只显示一次！）
8. 在 git push 时，用户名填你的 GitHub 用户名，密码填这个 token

## 📋 快速检查清单

创建前：
- [ ] 仓库名称：sendol-selectors
- [ ] 可见性：Public
- [ ] 不勾选任何初始化选项

创建后：
- [ ] 记下你的 GitHub 用户名
- [ ] 执行 git remote add
- [ ] 执行 git push
- [ ] 验证仓库可访问
- [ ] 测试 raw URL 可访问

## 🆘 常见问题

**Q: 我应该选 Public 还是 Private？**
A: 必须选 **Public**，否则扩展无法访问 raw 文件

**Q: 需要添加 LICENSE 吗？**
A: 不是必需的，这只是配置文件。如果要加，建议用 MIT

**Q: git push 要求密码怎么办？**
A: 使用 Personal Access Token，不要用 GitHub 密码

**Q: 分支是 master 还是 main？**
A: 看你的 git 默认设置，两者都可以。创建后可以在 GitHub 仓库设置里改

---

完成后，告诉我你的 GitHub 用户名，我会帮你更新 background.js！
