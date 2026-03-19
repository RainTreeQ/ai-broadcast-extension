import { useSiteSettings } from "@/lib/site-settings";
import { useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const COPY = {
  en: {
    title: "Frequently Asked Questions",
    q1: "Is Sendol free?",
    a1: "Yes, the Community version is completely free and open source. It includes core broadcasting, auto-send, and draft protection features.",
    q2: "Which AI platforms are supported?",
    a2: "Currently supported platforms include: ChatGPT, Claude, Gemini, DeepSeek, Kimi, Doubao, Yuanbao, and Mistral.",
    q3: "Does it collect my data?",
    a3: "No. Sendol runs entirely locally on your browser. We do not collect, store, or upload any of your prompts or AI responses.",
    q4: "Why does auto-send fail sometimes?",
    a4: "Some AI platforms employ risk-control measures that might block automated injections if done too quickly. Also, UI changes on their side may occasionally break the detection.",
    q5: "Will it support Microsoft Copilot?",
    a5: "No, Microsoft Copilot is intentionally out of scope in the current version."
  },
  "zh-CN": {
    title: "常见问题",
    q1: "Sendol 是免费的吗？",
    a1: "是的，社区版完全免费且开源。它包含核心的多端广播、自动发送以及草稿保护功能。",
    q2: "目前支持哪些 AI 平台？",
    a2: "目前支持：ChatGPT、Claude、Gemini、DeepSeek、Kimi、豆包、元宝、Mistral。",
    q3: "插件会收集我的数据吗？",
    a3: "不会。Sendol 完全在你的本地浏览器中运行。我们不收集、不存储、不上传你的任何提问或 AI 的回答。",
    q4: "为什么有时自动发送会失败？",
    a4: "部分 AI 平台有风控机制，可能会拦截过快的自动化输入。此外，平台界面改版也偶尔会导致插件失效。",
    q5: "未来会支持 Microsoft Copilot 吗？",
    a5: "不会，当前版本明确不支持 Microsoft Copilot。"
  }
};

export function FAQ() {
  const { locale } = useSiteSettings();
  const copy = COPY[locale] || COPY.en;

  useEffect(() => {
    document.title = `${copy.title} | Sendol`;
  }, [copy.title]);

  return (
    <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl min-h-[calc(100vh-8rem)]">
      <h1 className="text-4xl font-bold mb-8 text-center">{copy.title}</h1>
      
      <Accordion type="single" collapsible className="w-full space-y-4 pb-12">
        <AccordionItem value="item-1" className="bg-card px-6 rounded-[20px] border border-border/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_8px_-2px_rgba(255,255,255,0.02),0_1px_3px_-1px_rgba(255,255,255,0.01)] transition-all duration-300 hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_16px_-4px_rgba(255,255,255,0.04),0_4px_8px_-2px_rgba(255,255,255,0.02)] hover:-translate-y-0.5 overflow-hidden">
          <AccordionTrigger className="text-left text-[17px] font-medium hover:no-underline transition-colors py-5 [&[data-state=open]]:text-foreground text-foreground/80">{copy.q1}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-6">
            {copy.a1}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="item-2" className="bg-card px-6 rounded-[20px] border border-border/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_8px_-2px_rgba(255,255,255,0.02),0_1px_3px_-1px_rgba(255,255,255,0.01)] transition-all duration-300 hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_16px_-4px_rgba(255,255,255,0.04),0_4px_8px_-2px_rgba(255,255,255,0.02)] hover:-translate-y-0.5 overflow-hidden">
          <AccordionTrigger className="text-left text-[17px] font-medium hover:no-underline transition-colors py-5 [&[data-state=open]]:text-foreground text-foreground/80">{copy.q2}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-6">
            {copy.a2}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="item-3" className="bg-card px-6 rounded-[20px] border border-border/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_8px_-2px_rgba(255,255,255,0.02),0_1px_3px_-1px_rgba(255,255,255,0.01)] transition-all duration-300 hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_16px_-4px_rgba(255,255,255,0.04),0_4px_8px_-2px_rgba(255,255,255,0.02)] hover:-translate-y-0.5 overflow-hidden">
          <AccordionTrigger className="text-left text-[17px] font-medium hover:no-underline transition-colors py-5 [&[data-state=open]]:text-foreground text-foreground/80">{copy.q3}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-6">
            {copy.a3}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="item-4" className="bg-card px-6 rounded-[20px] border border-border/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_8px_-2px_rgba(255,255,255,0.02),0_1px_3px_-1px_rgba(255,255,255,0.01)] transition-all duration-300 hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_16px_-4px_rgba(255,255,255,0.04),0_4px_8px_-2px_rgba(255,255,255,0.02)] hover:-translate-y-0.5 overflow-hidden">
          <AccordionTrigger className="text-left text-[17px] font-medium hover:no-underline transition-colors py-5 [&[data-state=open]]:text-foreground text-foreground/80">{copy.q4}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-6">
            {copy.a4}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="item-5" className="bg-card px-6 rounded-[20px] border border-border/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_8px_-2px_rgba(255,255,255,0.02),0_1px_3px_-1px_rgba(255,255,255,0.01)] transition-all duration-300 hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_16px_-4px_rgba(255,255,255,0.04),0_4px_8px_-2px_rgba(255,255,255,0.02)] hover:-translate-y-0.5 overflow-hidden">
          <AccordionTrigger className="text-left text-[17px] font-medium hover:no-underline transition-colors py-5 [&[data-state=open]]:text-foreground text-foreground/80">{copy.q5}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-6">
            {copy.a5}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </main>
  );
}