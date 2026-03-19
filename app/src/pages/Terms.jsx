import { useSiteSettings } from "@/lib/site-settings";
import { useEffect } from "react";

const COPY = {
  en: {
    title: "Terms of Service",
    disclaimer: "Disclaimer: This is a general terms of service. Please consult a legal professional for formal legal advice.",
    acceptance: "1. Acceptance of Terms",
    acceptanceText: "By installing and using the Sendol extension, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use the extension.",
    usage: "2. Usage",
    usageText: "Sendol is provided 'as is' without any warranties. You agree to use it responsibly and not for any malicious purposes. The extension automates interactions with third-party AI services, and you are responsible for complying with the terms of those individual services.",
    liability: "3. Limitation of Liability",
    liabilityText: "In no event shall the developers of Sendol be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the extension.",
    changes: "4. Changes to Terms",
    changesText: "We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes a material change will be determined at our sole discretion."
  },
  "zh-CN": {
    title: "使用条款",
    disclaimer: "免责声明：此为通用使用条款，如需正式法律建议请咨询专业人士。",
    acceptance: "1. 接受条款",
    acceptanceText: "安装并使用 Sendol 扩展程序，即表示您同意受这些使用条款的约束。如果您不同意这些条款的任何部分，请勿使用该扩展程序。",
    usage: "2. 使用规范",
    usageText: "Sendol 是“按原样”提供的，不提供任何保证。您同意负责任地使用它，不用于任何恶意目的。该扩展可自动化与第三方 AI 服务的交互，您有责任遵守这些单独服务的条款。",
    liability: "3. 责任限制",
    liabilityText: "在任何情况下，Sendol 的开发者均不对因您访问、使用或无法访问、使用该扩展程序而导致的任何间接、偶然、特殊、后果性或惩罚性损害负责，包括但不限于利润、数据、使用、商誉的损失或其他无形损失。",
    changes: "4. 条款修改",
    changesText: "我们保留随时自行决定修改或替换这些条款的权利。构成重大变更的内容将由我们自行决定。"
  }
};

export function Terms() {
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
          <h2 className="text-2xl font-semibold mb-3">{copy.acceptance}</h2>
          <p className="text-foreground/80 leading-7">{copy.acceptanceText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">{copy.usage}</h2>
          <p className="text-foreground/80 leading-7">{copy.usageText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">{copy.liability}</h2>
          <p className="text-foreground/80 leading-7">{copy.liabilityText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">{copy.changes}</h2>
          <p className="text-foreground/80 leading-7">{copy.changesText}</p>
        </section>
      </div>
    </main>
  );
}