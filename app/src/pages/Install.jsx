import { useSiteSettings } from "@/lib/site-settings";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

const COPY = {
  en: {
    title: "Installation Guide",
    subtitle: "Currently in Developer Mode",
    intro: "Sendol is not yet available on the Chrome Web Store. Please load it manually in Developer mode.",
    step1: "1. Get the code",
    step1Desc: "Download the ZIP file from our GitHub repository and unzip it.",
    step2: "2. Open Extensions",
    step2Desc: "In Chrome, go to chrome://extensions/. In Edge, go to edge://extensions/.",
    step3: "3. Enable Developer Mode",
    step3Desc: "Toggle the Developer mode switch in the top right corner.",
    step4: "4. Load Unpacked",
    step4Desc: "Click the 'Load unpacked' button and select the project root folder (the one containing manifest.json).",
    done: "All set! You can now click the Sendol icon in your toolbar to start broadcasting."
  },
  "zh-CN": {
    title: "安装指南",
    subtitle: "当前需通过开发者模式安装",
    intro: "Sendol 暂未上架 Chrome 网上应用店。请通过开发者模式手动加载：",
    step1: "1. 获取代码",
    step1Desc: "从 GitHub 仓库下载 ZIP 压缩包并解压。",
    step2: "2. 打开扩展程序页面",
    step2Desc: "Chrome 浏览器访问 chrome://extensions/，Edge 浏览器访问 edge://extensions/。",
    step3: "3. 开启开发者模式",
    step3Desc: "打开页面右上角的“开发者模式”开关。",
    step4: "4. 加载已解压的扩展程序",
    step4Desc: "点击“加载已解压的扩展程序”按钮，选择解压后的项目根目录（包含 manifest.json 的文件夹）。",
    done: "安装完成！现在你可以点击工具栏的 Sendol 图标开始广播了。"
  }
};

export function Install() {
  const { locale } = useSiteSettings();
  const copy = COPY[locale] || COPY.en;

  useEffect(() => {
    document.title = `${copy.title} | Sendol`;
  }, [copy.title]);

  return (
    <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl min-h-[calc(100vh-8rem)]">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">{copy.title}</h1>
        <p className="text-xl text-muted-foreground">{copy.subtitle}</p>
      </div>

      <div className="bg-muted/50 p-6 rounded-2xl mb-8">
        <p className="text-foreground/80 text-lg text-center">{copy.intro}</p>
      </div>

      <div className="space-y-4">
        <Card variant="default">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-2">{copy.step1}</h3>
            <p className="text-muted-foreground">{copy.step1Desc}</p>
          </CardContent>
        </Card>
        
        <Card variant="default">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-2">{copy.step2}</h3>
            <p className="text-muted-foreground">{copy.step2Desc}</p>
          </CardContent>
        </Card>
        
        <Card variant="default">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-2">{copy.step3}</h3>
            <p className="text-muted-foreground">{copy.step3Desc}</p>
          </CardContent>
        </Card>
        
        <Card variant="default">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold mb-2">{copy.step4}</h3>
            <p className="text-muted-foreground">{copy.step4Desc}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 text-center p-8 bg-primary/5 rounded-2xl border border-primary/10">
        <p className="text-lg font-medium text-foreground">{copy.done}</p>
      </div>
    </main>
  );
}