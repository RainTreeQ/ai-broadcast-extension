import { useSiteSettings } from "@/lib/site-settings";
import { useEffect } from "react";

const COPY = {
  en: {
    title: "Privacy Policy",
    disclaimer: "Disclaimer: This is a general privacy policy. Please consult a legal professional for formal legal advice.",
    dataCollection: "Data Collection",
    dataCollectionText: "We do not collect, use, save, or have access to any of your personal data recorded in the extension. All operations are performed locally on your device. The extension does not use tracking cookies, analytics services, or cloud synchronization for your chat history.",
    permissions: "Permissions",
    perm1: "activeTab / tabs: Required to find and inject messages into the open AI chat windows.",
    perm2: "scripting: Required to interact with the input elements on the AI chat websites.",
    perm3: "storage: Required to save your extension preferences (e.g., Auto Send toggle state) locally.",
    perm4: "clipboardRead / clipboardWrite: Required for advanced copy-paste interactions within the extension interface if used.",
    contact: "Contact Us",
    contactText: "If you have any questions about this Privacy Policy, feel free to open an issue on our GitHub repository."
  },
  "zh-CN": {
    title: "隐私政策",
    disclaimer: "免责声明：此为通用隐私政策，如需正式法律建议请咨询专业人士。",
    dataCollection: "数据收集",
    dataCollectionText: "我们不会收集、使用、保存或访问您在扩展中记录的任何个人数据。所有操作均在您的设备上本地执行。该扩展不使用跟踪 Cookie、分析服务或用于同步聊天记录的云服务。",
    permissions: "权限说明",
    perm1: "activeTab / tabs: 用于查找并向打开的 AI 聊天窗口注入消息。",
    perm2: "scripting: 用于与 AI 聊天网站上的输入元素进行交互。",
    perm3: "storage: 用于在本地保存您的扩展首选项（例如，自动发送开关状态）。",
    perm4: "clipboardRead / clipboardWrite: 用于在扩展界面内的高级复制粘贴交互（如果使用）。",
    contact: "联系我们",
    contactText: "如果您对本隐私政策有任何疑问，请随时在我们的 GitHub 仓库中提交 Issue。"
  }
};

export function Privacy() {
  const { locale } = useSiteSettings();
  const copy = COPY[locale] || COPY.en;

  useEffect(() => {
    document.title = `${copy.title} | Sendol`;
  }, [copy.title]);

  return (
    <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl min-h-[calc(100vh-8rem)]">
      <h1 className="text-4xl font-bold mb-4">{copy.title}</h1>
      <div className="bg-muted text-muted-foreground p-4 rounded-xl mb-8 text-sm">
        {copy.disclaimer}
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-3">{copy.dataCollection}</h2>
          <p className="text-foreground/80 leading-7">{copy.dataCollectionText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">{copy.permissions}</h2>
          <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-7">
            <li><code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">activeTab</code> / <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">tabs</code>: {copy.perm1.split(':')[1]}</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">scripting</code>: {copy.perm2.split(':')[1]}</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">storage</code>: {copy.perm3.split(':')[1]}</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">clipboardRead</code> / <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">clipboardWrite</code>: {copy.perm4.split(':')[1]}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">{copy.contact}</h2>
          <p className="text-foreground/80 leading-7">{copy.contactText}</p>
        </section>
      </div>
    </main>
  );
}