# 📧 GitHub Secrets 邮箱配置指南

## 🎯 目的

配置邮箱通知后，当平台选择器失效时，系统会自动发送邮件提醒你。

---

## 📋 需要配置的 3 个 Secrets

1. **MAIL_USERNAME** - 发件邮箱地址
2. **MAIL_PASSWORD** - 邮箱应用专用密码（不是登录密码！）
3. **NOTIFY_EMAIL** - 接收通知的邮箱地址

---

## 🔧 配置步骤

### Step 1: 生成 Gmail 应用专用密码（5 分钟）

#### 1.1 开启两步验证（如果还没开启）

1. 访问：https://myaccount.google.com/security
2. 找到"登录 Google"部分
3. 点击"两步验证"
4. 按照提示开启（需要手机验证）

#### 1.2 生成应用专用密码

1. 访问：https://myaccount.google.com/apppasswords
2. 如果提示"此设置不适用于您的账号"，说明需要先开启两步验证
3. 在"选择应用"下拉菜单中选择"邮件"
4. 在"选择设备"下拉菜单中选择"其他（自定义名称）"
5. 输入名称：`Sendol GitHub Actions`
6. 点击"生成"
7. **复制显示的 16 位密码**（格式：xxxx xxxx xxxx xxxx）
8. ⚠️ 这个密码只显示一次，请立即复制保存

**示例**：
```
生成的密码：abcd efgh ijkl mnop
```

---

### Step 2: 在 GitHub 添加 Secrets（2 分钟）

#### 2.1 进入 Secrets 设置页面

1. 访问你的仓库：https://github.com/RainTreeQ/sendall-extension
2. 点击顶部的 **Settings** 标签
3. 在左侧菜单找到 **Secrets and variables**
4. 点击 **Actions**
5. 你会看到 "Repository secrets" 页面

#### 2.2 添加第一个 Secret: MAIL_USERNAME

1. 点击右上角绿色按钮 **New repository secret**
2. Name: `MAIL_USERNAME`
3. Secret: 输入你的 Gmail 地址（例如：`your-email@gmail.com`）
4. 点击 **Add secret**

#### 2.3 添加第二个 Secret: MAIL_PASSWORD

1. 再次点击 **New repository secret**
2. Name: `MAIL_PASSWORD`
3. Secret: 粘贴刚才生成的 16 位应用专用密码
   - ⚠️ 注意：粘贴时可以包含空格，也可以去掉空格，都可以
   - 例如：`abcdefghijklmnop` 或 `abcd efgh ijkl mnop`
4. 点击 **Add secret**

#### 2.4 添加第三个 Secret: NOTIFY_EMAIL

1. 再次点击 **New repository secret**
2. Name: `NOTIFY_EMAIL`
3. Secret: 输入接收通知的邮箱地址
   - 可以和 MAIL_USERNAME 相同（发给自己）
   - 也可以是其他邮箱（例如：`alerts@example.com`）
4. 点击 **Add secret**

---

## ✅ 验证配置

配置完成后，你应该在 Secrets 页面看到 3 个 secrets：

```
MAIL_USERNAME     Updated now by you
MAIL_PASSWORD     Updated now by you
NOTIFY_EMAIL      Updated now by you
```

⚠️ **注意**：Secret 的值是加密的，添加后无法查看，只能更新或删除。

---

## 🧪 测试邮件通知

### 方法 1: 等待自动测试（推荐）

- 等到下次定时测试（08:00 或 20:00 北京时间）
- 如果有平台失效，你会收到邮件

### 方法 2: 手动触发测试

1. 访问：https://github.com/RainTreeQ/sendall-extension/actions
2. 点击 "E2E Monitor (Daily)"
3. 点击 "Run workflow"
4. 选择 branch: master
5. 点击 "Run workflow"
6. 如果测试失败，你会收到邮件

### 方法 3: 模拟失败（高级）

```bash
# 临时破坏一个选择器
cd "/Users/quxianglin/Documents/vibe coding/sendol-selectors"
vim selectors/chatgpt.json
# 修改 chatgpt.findInput[0] 为 "#nonexistent"
git add selectors/
git commit -m "test: simulate failure"
git push

# 手动触发测试
# 你应该会收到邮件通知

# 恢复
git revert HEAD
git push
```

---

## 📧 邮件内容示例

当平台失效时，你会收到类似这样的邮件：

```
主题: [Sendol] Auto-fix triggered for chatgpt

内容:
E2E tests detected failures on the following platforms:
chatgpt

Auto-fix workflow has been triggered.
A Pull Request will be created shortly with suggested fixes.

Check the PR: https://github.com/RainTreeQ/sendol-selectors/pulls

If the PR looks good, simply click "Merge pull request".
```

---

## 🔒 安全说明

### 为什么需要应用专用密码？

- Gmail 不允许第三方应用使用你的登录密码
- 应用专用密码是专门为第三方应用生成的
- 即使泄露，也不会影响你的 Google 账号安全
- 你可以随时撤销这个密码

### Secrets 安全吗？

- ✅ GitHub Secrets 是加密存储的
- ✅ 只有 GitHub Actions 可以访问
- ✅ 不会出现在日志中（自动脱敏）
- ✅ 无法通过 API 读取
- ✅ 只有仓库管理员可以修改

### 最佳实践

1. ✅ 使用应用专用密码，不要用登录密码
2. ✅ 定期更换应用专用密码（每 6-12 个月）
3. ✅ 不要在代码或文档中硬编码密码
4. ✅ 如果怀疑泄露，立即在 Google 账号中撤销

---

## 🆘 常见问题

### Q: 我没有 Gmail，可以用其他邮箱吗？

A: 可以，但需要修改 workflow 配置：

**QQ 邮箱**:
```yaml
server_address: smtp.qq.com
server_port: 465
```

**163 邮箱**:
```yaml
server_address: smtp.163.com
server_port: 465
```

**Outlook**:
```yaml
server_address: smtp.office365.com
server_port: 587
secure: true
```

### Q: 应用专用密码生成失败？

A: 可能原因：
1. 没有开启两步验证 → 先开启两步验证
2. 使用的是企业 Google 账号 → 联系管理员
3. 账号安全设置限制 → 检查账号安全设置

### Q: 配置后没收到邮件？

A: 检查清单：
1. ✅ 三个 Secrets 都配置了吗？
2. ✅ MAIL_PASSWORD 是应用专用密码，不是登录密码？
3. ✅ 测试确实失败了吗？（查看 workflow 日志）
4. ✅ 检查垃圾邮件文件夹
5. ✅ 查看 GitHub Actions 日志中的错误信息

### Q: 可以不配置邮件吗？

A: **可以！** 邮件通知是完全可选的。

不配置邮件的情况下：
- ✅ 系统仍然正常工作
- ✅ 自动修复仍然触发
- ✅ PR 仍然自动创建
- ✅ 你可以通过 GitHub 通知（App/网页）查看

GitHub 原生通知：
- 📱 GitHub 手机 App 会推送通知
- 📧 GitHub 会发送邮件（如果你开启了）
- 🔔 网页右上角会有通知图标

---

## 📱 推荐配置

### 最小配置（推荐）

**不配置邮件 Secrets**，依赖 GitHub 原生通知：
- 优点：零配置，安全
- 缺点：通知可能不够即时

### 标准配置

配置邮件 Secrets：
- 优点：即时通知，自定义邮件内容
- 缺点：需要 5 分钟配置

### 高级配置（未来可选）

集成企业微信/钉钉/Slack：
- 优点：团队协作，更即时
- 缺点：需要额外配置 webhook

---

## 🎯 快速配置链接

1. **生成应用专用密码**: https://myaccount.google.com/apppasswords
2. **添加 GitHub Secrets**: https://github.com/RainTreeQ/sendall-extension/settings/secrets/actions
3. **测试 workflow**: https://github.com/RainTreeQ/sendall-extension/actions

---

## ✅ 配置完成检查清单

- [ ] 开启了 Google 两步验证
- [ ] 生成了应用专用密码并保存
- [ ] 在 GitHub 添加了 MAIL_USERNAME
- [ ] 在 GitHub 添加了 MAIL_PASSWORD
- [ ] 在 GitHub 添加了 NOTIFY_EMAIL
- [ ] 在 Secrets 页面看到 3 个 secrets
- [ ] （可选）手动触发测试验证邮件

---

**配置时间**: 约 5-7 分钟
**难度**: ⭐⭐☆☆☆ (简单)

如果遇到问题，可以参考 GitHub Actions 的日志输出来排查。
