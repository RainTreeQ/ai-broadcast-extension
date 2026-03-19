import { useSiteSettings } from "@/lib/site-settings";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";

const COPY = {
  en: {
    title: "Changelog",
    recent: "Recent Updates",
  },
  "zh-CN": {
    title: "更新日志",
    recent: "最近更新",
  }
};

const LOGS = [
  {
    version: "v2.31.0",
    date: "2026-03-18",
    changes: ["Add ShapeGrid components", "Refactor Hero section", "Update dependencies"]
  },
  {
    version: "v2.30.0",
    date: "2026-03-17",
    changes: ["Redesign popup UI with shadcn", "Fix deepseek adapter", "Improve dark mode support"]
  },
  {
    version: "v2.29.0",
    date: "2026-03-16",
    changes: ["Add support for Grok", "Improve extension performance"]
  },
  {
    version: "v2.28.0",
    date: "2026-03-16",
    changes: ["Fix ChatGPT injection", "Improve auto-send reliability"]
  }
];

export function Changelog() {
  const { locale } = useSiteSettings();
  const copy = COPY[locale] || COPY.en;

  useEffect(() => {
    document.title = `${copy.title} | Sendol`;
  }, [copy.title]);

  return (
    <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl min-h-[calc(100vh-8rem)]">
      <h1 className="text-4xl font-bold mb-2">{copy.title}</h1>
      <p className="text-muted-foreground mb-12 text-lg">{copy.recent}</p>

      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-border before:to-transparent">
        {LOGS.map((log, index) => (
          <div key={log.version} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background bg-muted shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-card border shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <Badge variant="outline" className="font-mono">{log.version}</Badge>
                <time className="text-sm text-muted-foreground">{log.date}</time>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
                {log.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}