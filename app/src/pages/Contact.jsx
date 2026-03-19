import { useSiteSettings } from "@/lib/site-settings";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, Mail, MessageSquare } from "lucide-react";

const COPY = {
  en: {
    title: "Contact Us",
    subtitle: "We'd love to hear from you",
    github: "GitHub Issues",
    githubDesc: "Report bugs or request features on our GitHub repository.",
    email: "Email Support",
    emailDesc: "Send us an email for general inquiries or support.",
    discord: "Community",
    discordDesc: "Join our community to discuss features and get help."
  },
  "zh-CN": {
    title: "联系我们",
    subtitle: "我们很乐意倾听您的反馈",
    github: "提交 Issue",
    githubDesc: "在 GitHub 上反馈 Bug 或提出功能建议。",
    email: "邮件支持",
    emailDesc: "如需一般咨询或支持，请发送邮件给我们。",
    discord: "社区交流",
    discordDesc: "加入我们的社区，讨论功能并获取帮助。"
  }
};

export function Contact() {
  const { locale } = useSiteSettings();
  const copy = COPY[locale] || COPY.en;

  useEffect(() => {
    document.title = `${copy.title} | Sendol`;
  }, [copy.title]);

  return (
    <main id="main-content" className="container mx-auto px-4 py-16 max-w-4xl min-h-[calc(100vh-8rem)]">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">{copy.title}</h1>
        <p className="text-xl text-muted-foreground">{copy.subtitle}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="text-center transition-all hover:-translate-y-1 hover:shadow-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Github className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{copy.github}</h3>
            <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">
              {copy.githubDesc}
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href="https://github.com/RainTreeQ/sendol-extension/issues" target="_blank" rel="noreferrer">
                Open GitHub
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="text-center transition-all hover:-translate-y-1 hover:shadow-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{copy.email}</h3>
            <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">
              {copy.emailDesc}
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href="mailto:support@sendol.com">
                Send Email
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="text-center transition-all hover:-translate-y-1 hover:shadow-md">
          <CardContent className="pt-8 pb-8 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{copy.discord}</h3>
            <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">
              {copy.discordDesc}
            </p>
            <Button asChild variant="outline" className="w-full" disabled>
              <span>Coming Soon</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}