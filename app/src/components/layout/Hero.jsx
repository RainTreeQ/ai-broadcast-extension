import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Coins, Crown, Globe, HandHeart, Languages, MoonStar, ShieldCheck, Sparkles, SunMoon, Wallet } from "lucide-react";
import { Claude, DeepSeek, Doubao, Gemini, Kimi, Mistral, OpenAI, Yuanbao } from "@lobehub/icons";
import { useSiteSettings } from "@/lib/site-settings";
import { HeroShapeGrid } from "@/components/landing/HeroShapeGrid";

const COPY = {
  "zh-CN": {
    heroBadge: "Chrome / Edge 浏览器扩展",
    title1: "一次输入，",
    title2: "同时对比不同 AI 的回答",
    subtitle:
      "Sendol 帮你把多个 AI 输入聚合在一个弹窗中。只需输入一次，即可一键多发，同时支持自动发送与开启新对话。",
    ctaPricing: "查看收费方案",
    ctaSupport: "支持项目",
    ctaInstall: "安装与使用指南",
    statPlatforms: "支持平台",
    statMode: "发送模式",
    statDraft: "草稿保护",
    statModeValue: "手动/自动/新对话",
    statDraftValue: "意外关闭自动恢复",
    popupScreenshotAlt: "Sendol 扩展弹窗演示",
    featureTitle: "核心功能",
    featureDesc: "化繁为简：输入、勾选、发送，就这么简单。",
    featureOneTitle: "一次输入，多端同步",
    featureOneBody: "告别在多个 AI 平台间的繁琐复制粘贴，让提问更高效。",
    featureTwoTitle: "状态可视，发送无忧",
    featureTwoBody: "智能识别当前已打开的 AI 标签页，并清晰展示发送状态及错误提示。",
    featureThreeTitle: "草稿保护，内容不丢",
    featureThreeBody: "即使弹窗意外关闭或发生中断，未发送的草稿也会被优先恢复。",
    pricingTitle: "免费可用，灵活升级",
    pricingDesc: "社区版即可满足日常核心需求，Pro 版为您解锁更强大的效率工具。",
    communityTitle: "社区版",
    communityDesc: "完全免费 / 核心开源",
    communityBody1: "包含基础广播、自动发送及草稿保护功能。",
    communityBody2: "满足个人轻量化、高频次的提问需求。",
    communityBtn: "查看开源代码",
    proTitle: "专业版",
    proDesc: "预计定价: ¥19/月 或 ¥149/年",
    proBody1: "即将推出：提示词模板、内容整理笔记、历史记录、自定义规则、以上支持本地保存。",
    proBody2: "享受平台改版的优先适配服务，确保工作流不中断。",
    proBtn: "加入 Pro 候补名单",
    sponsorTitle: "赞助支持",
    sponsorDesc: "用爱发电 / 支持独立开发者",
    sponsorBody1: "如果您觉得这个工具对您有帮助，欢迎以赞助的方式支持项目维护。",
    sponsorBody2: "您的支持将成为产品持续迭代的最大动力。",
    sponsorBtn: "前往赞助页面",
    languageTitle: "多语言与深色模式",
    languageDesc: "界面提供中英双语，支持自动跟随系统切换深浅色模式。",
    languagePractice1: "初次使用会自动匹配您的浏览器语言设置。",
    languagePractice2: "可通过顶部菜单手动切换语言，偏好会自动保存。",
    languagePractice3: "如果遇到暂未翻译的语种，将自动回退为英文。",
    languagePractice4: "界面和演示截图均支持 System / Light / Dark 模式实时切换。",
    roadmapTitle: "计划支持的语言",
    roadmapDesc: "后续将持续添加更多语言支持，并不断完善本地化体验。",
    supportTitle: "适用场景",
    supportDesc: "专为需要同时向多个 AI 提问的高效工作者设计。",
    supportBody1: "极具竞争力的工具，适用于写作、研发、运营等多平台并行提问。",
    supportBody2: "快速将同一个问题发给多个大模型，直观对比并获取最佳回答。",
    supportCtaTitle: "即刻开始",
    supportCtaDesc: "零配置上手：安装扩展后，只需打开所需的 AI 页面即可使用。",
    supportCtaBody1: "建议先用社区版体验流畅工作流，如有进阶需求再考虑升级。",
    supportCtaBody2: "随时欢迎通过反馈或赞助来支持我们的持续迭代。",
  },
  en: {
    heroBadge: "Chrome / Edge Extension",
    title1: "Type Once,",
    title2: "Ask Every AI Instantly",
    subtitle:
      "Sendol brings your favorite AI tabs into one unified popup. Write your prompt once and broadcast it everywhere, with optional auto-send and new chat features.",
    ctaPricing: "View Pricing",
    ctaSupport: "Support the Creator",
    ctaInstall: "Install Guide",
    statPlatforms: "Supported Platforms",
    statMode: "Send Modes",
    statDraft: "Draft Protection",
    statModeValue: "Manual/Auto/New",
    statDraftValue: "Auto-restores on close",
    popupScreenshotAlt: "Sendol extension popup interface",
    featureTitle: "Core Features",
    featureDesc: "Keeping it beautifully simple: write, select, and send.",
    featureOneTitle: "One Prompt, Multiple AI",
    featureOneBody: "Stop copying and pasting across tabs. Broadcast your message to multiple AI platforms instantly.",
    featureTwoTitle: "Clear Sending Status",
    featureTwoBody: "Automatically detects your open AI tabs and provides transparent status and error feedback.",
    featureThreeTitle: "Reliable Draft Recovery",
    featureThreeBody: "Accidentally closed the popup? Your unsent drafts are automatically saved and restored.",
    pricingTitle: "Free Core, Pro Options",
    pricingDesc: "The Community version covers all your essential needs. Upgrade to Pro for advanced productivity.",
    communityTitle: "Community",
    communityDesc: "Free / Open Source",
    communityBody1: "Includes core broadcasting, auto-send, and reliable draft saving.",
    communityBody2: "Perfect for personal, lightweight, and high-frequency usage.",
    communityBtn: "View on GitHub",
    proTitle: "Pro",
    proDesc: "Expected: $5/mo or $49/yr",
    proBody1: "Coming soon: Template library, notes, history panel, and custom rules. All saved locally.",
    proBody2: "Priority updates to adapt to AI platform UI changes, minimizing disruptions.",
    proBtn: "Join Pro Waitlist",
    sponsorTitle: "Sponsor",
    sponsorDesc: "Back the Developer",
    sponsorBody1: "Love the tool? Direct sponsorship helps maintain and improve the project.",
    sponsorBody2: "Ideal for long-term users who want to ensure continuous active development.",
    sponsorBtn: "Sponsor this Project",
    languageTitle: "Languages & Themes",
    languageDesc: "Enjoy a consistent experience with EN/CN support and automatic Light/Dark mode.",
    languagePractice1: "Automatically defaults to your browser's preferred language.",
    languagePractice2: "Easily switch languages in the header, and we'll remember your choice.",
    languagePractice3: "Seamlessly falls back to English for unsupported languages.",
    languagePractice4: "Full support for System / Light / Dark themes, complete with synchronized screenshots.",
    roadmapTitle: "Upcoming Languages",
    roadmapDesc: "We will continue to add support for more languages and improve localization.",
    supportTitle: "Perfect For...",
    supportDesc: "Designed for power users who consult multiple AI models simultaneously.",
    supportBody1: "Ideal for coding, writing, and research tasks requiring parallel AI assistance.",
    supportBody2: "Easily compare responses from different models to find the absolute best answer.",
    supportCtaTitle: "Get Started",
    supportCtaDesc: "Zero setup required: Just install the extension and open your favorite AI tabs.",
    supportCtaBody1: "Try the free Community version first to see how it transforms your workflow.",
    supportCtaBody2: "Feel free to support our ongoing development via feedback or sponsorship.",
  },
  "zh-TW": {
    heroBadge: "Chrome / Edge 瀏覽器擴展",
    title1: "一次輸入，",
    title2: "同時對比不同 AI 的回答",
    subtitle:
      "Sendol 幫你把多個 AI 平台聚合在一個彈窗中。只需輸入一次，即可一鍵多發，同時支援自動發送與開啟新對話。",
    ctaPricing: "查看收費方案",
    ctaSupport: "支持項目",
    ctaInstall: "安裝與使用指南",
    statPlatforms: "支援平台",
    statMode: "發送模式",
    statDraft: "草稿保護",
    statModeValue: "手動/自動/新對話",
    statDraftValue: "意外關閉自動恢復",
    popupScreenshotAlt: "Sendol 擴展彈窗演示",
    featureTitle: "核心功能",
    featureDesc: "化繁為簡：輸入、勾選、發送，就這麼簡單。",
    featureOneTitle: "一次輸入，多端同步",
    featureOneBody: "告別在多個 AI 平台間的繁瑣複製貼上，讓提問更高效。",
    featureTwoTitle: "狀態可視，發送無憂",
    featureTwoBody: "智能識別當前已打開的 AI 標籤頁，並清晰展示發送狀態及錯誤提示。",
    featureThreeTitle: "草稿保護，內容不丟",
    featureThreeBody: "即使彈窗意外關閉或發生中斷，未發送的草稿也會被優先恢復。",
    pricingTitle: "免費可用，靈活升級",
    pricingDesc: "社區版即可滿足日常核心需求，Pro 版為您解鎖更強大的效率工具。",
    communityTitle: "社區版",
    communityDesc: "完全免費 / 核心開源",
    communityBody1: "包含基礎廣播、自動發送及草稿保護功能。",
    communityBody2: "滿足個人輕量化、高頻次的提問需求。",
    communityBtn: "查看開源代碼",
    proTitle: "專業版",
    proDesc: "預計定價: ¥19/月 或 ¥149/年",
    proBody1: "即將推出：提示詞模板、內容整理筆記、歷史記錄、自定義規則、以上支持本地保存。",
    proBody2: "享受平台改版的優先適配服務，確保工作流不中斷。",
    proBtn: "加入 Pro 候補名單",
    sponsorTitle: "贊助支持",
    sponsorDesc: "用愛發電 / 支持獨立開發者",
    sponsorBody1: "如果您覺得這個工具對您有幫助，歡迎以贊助的方式支持項目維護。",
    sponsorBody2: "您的支持將成為產品持續迭代的最大動力。",
    sponsorBtn: "前往贊助頁面",
    languageTitle: "多語言與深色模式",
    languageDesc: "界面提供多語言支持，並支援自動跟隨系統切換深淺色模式。",
    languagePractice1: "初次使用會自動匹配您的瀏覽器語言設置。",
    languagePractice2: "可通過頂部菜單手動切換語言，偏好會自動保存。",
    languagePractice3: "如果遇到暫未翻譯的語種，將自動回退為英文。",
    languagePractice4: "界面和演示截圖均支援 System / Light / Dark 模式實時切換。",
    roadmapTitle: "計劃支持的語言",
    roadmapDesc: "後續將持續添加更多語言支援，並不斷完善本地化體驗。",
    supportTitle: "適用場景",
    supportDesc: "專為需要同時向多個 AI 提問的高效工作者設計。",
    supportBody1: "極具競爭力的工具，適用於寫作、研發、運營等多平台並行提問。",
    supportBody2: "快速將同一個問題發給多個大模型，直觀對比並獲取最佳回答。",
    supportCtaTitle: "即刻開始",
    supportCtaDesc: "零配置上手：安裝擴展後，只需打開所需的 AI 頁面即可使用。",
    supportCtaBody1: "建議先用社區版體驗流暢工作流，如有進階需求再考慮升級。",
    supportCtaBody2: "隨時歡迎通過反饋或贊助來支持我們的持續迭代。",
  },
  "ja": {
    heroBadge: "Chrome / Edge 拡張機能",
    title1: "一度の入力で、",
    title2: "すべての AI に同時質問",
    subtitle:
      "Sendol は複数の AI タブを1つのポップアップに統合します。一度の入力で一斉送信でき、自動送信や新しいチャットもサポートします。",
    ctaPricing: "料金プラン",
    ctaSupport: "プロジェクトを支援",
    ctaInstall: "インストールと使い方",
    statPlatforms: "対応プラットフォーム",
    statMode: "送信モード",
    statDraft: "下書き保護",
    statModeValue: "手動/自動/新規",
    statDraftValue: "閉じた時に自動復元",
    popupScreenshotAlt: "Sendol 拡張機能のUI",
    featureTitle: "主な機能",
    featureDesc: "シンプルさを追求：入力、選択、送信、それだけです。",
    featureOneTitle: "一度の入力で複数に同期",
    featureOneBody: "AI プラットフォーム間での面倒なコピペ作業から解放され、より効率的に質問できます。",
    featureTwoTitle: "送信ステータスが明確",
    featureTwoBody: "開いている AI タブを自動検出し、送信状況やエラーをわかりやすく表示します。",
    featureThreeTitle: "下書き保護で安心",
    featureThreeBody: "ポップアップを誤って閉じても、未送信の下書きは自動的に保存・復元されます。",
    pricingTitle: "無料の基本機能、柔軟なアップグレード",
    pricingDesc: "日常的なニーズにはコミュニティ版で十分です。Pro 版ではさらに強力な効率化ツールを利用できます。",
    communityTitle: "コミュニティ版",
    communityDesc: "完全無料 / オープンソース",
    communityBody1: "一斉送信、自動送信、下書き保護の基本機能が含まれます。",
    communityBody2: "個人の軽量かつ高頻度な利用に最適です。",
    communityBtn: "GitHub で見る",
    proTitle: "Pro 版",
    proDesc: "予定価格: $5/月 または $49/年",
    proBody1: "近日公開: テンプレート、ノート、履歴、カスタムルール。すべてローカル保存。",
    proBody2: "AI プラットフォームの UI 変更に優先的に対応し、作業の中断を防ぎます。",
    proBtn: "Pro 版のウェイティングリストに参加",
    sponsorTitle: "スポンサー",
    sponsorDesc: "開発者を支援",
    sponsorBody1: "このツールが役立つと感じたら、プロジェクトの維持のために支援をお願いします。",
    sponsorBody2: "皆様の支援が製品の継続的なアップデートの最大の原動力となります。",
    sponsorBtn: "スポンサーページへ",
    languageTitle: "多言語とダークモード",
    languageDesc: "安定した多言語対応と、ライト/ダークモードの自動切り替え機能。",
    languagePractice1: "初回利用時はブラウザの言語設定に自動で合わせます。",
    languagePractice2: "ヘッダーから簡単に言語を切り替えられ、設定は保存されます。",
    languagePractice3: "未対応の言語の場合は、自動的に英語にフォールバックします。",
    languagePractice4: "UI とスクリーンショットは System / Light / Dark テーマに対応しています。",
    roadmapTitle: "対応予定の言語",
    roadmapDesc: "今後も引き続き多くの言語を追加し、ローカリゼーションを改善していきます。",
    supportTitle: "こんな方におすすめ",
    supportDesc: "複数の AI モデルを同時に利用するパワーユーザー向けに設計されています。",
    supportBody1: "執筆、開発、リサーチなど、並行して AI の支援が必要な作業に最適です。",
    supportBody2: "異なるモデルの回答を素早く比較し、最良の答えを見つけることができます。",
    supportCtaTitle: "今すぐ始める",
    supportCtaDesc: "設定は不要：拡張機能をインストールし、必要な AI タブを開くだけです。",
    supportCtaBody1: "まずは無料のコミュニティ版でスムーズなワークフローを体験してください。",
    supportCtaBody2: "フィードバックやスポンサー支援での応援をお待ちしております。",
  },
  "ko": {
    heroBadge: "Chrome / Edge 확장 프로그램",
    title1: "한 번의 입력으로,",
    title2: "모든 AI에게 동시 질문",
    subtitle:
      "Sendol은 여러 AI 탭을 하나의 팝업으로 통합합니다. 한 번만 입력하여 모든 AI에 전송할 수 있으며, 자동 전송 및 새 채팅 시작도 지원합니다.",
    ctaPricing: "가격 확인",
    ctaSupport: "프로젝트 후원",
    ctaInstall: "설치 및 사용 가이드",
    statPlatforms: "지원 플랫폼",
    statMode: "전송 모드",
    statDraft: "초안 보호",
    statModeValue: "수동/자동/신규",
    statDraftValue: "종료 시 자동 복구",
    popupScreenshotAlt: "Sendol 확장 프로그램 팝업",
    featureTitle: "주요 기능",
    featureDesc: "가장 단순한 워크플로우: 입력, 선택, 그리고 전송.",
    featureOneTitle: "한 번 입력으로 여러 곳에 동기화",
    featureOneBody: "AI 플랫폼 간의 번거로운 복사-붙여넣기 없이 더 효율적으로 질문하세요.",
    featureTwoTitle: "명확한 전송 상태",
    featureTwoBody: "열려있는 AI 탭을 자동으로 감지하고, 전송 상태 및 오류를 명확하게 표시합니다.",
    featureThreeTitle: "안전한 초안 복구",
    featureThreeBody: "팝업이 예기치 않게 닫혀도 전송하지 않은 초안은 자동으로 저장되고 복구됩니다.",
    pricingTitle: "무료 핵심 기능, 유연한 업그레이드",
    pricingDesc: "커뮤니티 버전으로 일상적인 요구를 모두 충족하세요. Pro 버전으로 더 강력한 기능을 만나볼 수 있습니다.",
    communityTitle: "커뮤니티 버전",
    communityDesc: "완전 무료 / 오픈 소스",
    communityBody1: "핵심 동시 전송, 자동 전송 및 초안 보호 기능이 포함됩니다.",
    communityBody2: "개인적이고 가벼운 고빈도 사용에 적합합니다.",
    communityBtn: "GitHub에서 보기",
    proTitle: "Pro 버전",
    proDesc: "예상 가격: $5/월 또는 $49/년",
    proBody1: "출시 예정: 프롬프트 템플릿, 노트, 기록, 사용자 지정 규칙 (모두 로컬에 저장).",
    proBody2: "AI 플랫폼의 UI 변경에 대한 우선 업데이트를 제공하여 작업 중단을 방지합니다.",
    proBtn: "Pro 대기자 명단 참여",
    sponsorTitle: "스폰서",
    sponsorDesc: "개발자 후원",
    sponsorBody1: "이 도구가 유용하다면 프로젝트 유지를 위해 후원해 주세요.",
    sponsorBody2: "여러분의 후원은 지속적인 제품 업데이트의 가장 큰 원동력이 됩니다.",
    sponsorBtn: "스폰서 페이지로 이동",
    languageTitle: "다국어 및 다크 모드",
    languageDesc: "안정적인 다국어 지원과 자동 라이트/다크 모드를 제공합니다.",
    languagePractice1: "처음 사용할 때는 브라우저의 언어 설정에 자동으로 맞춰집니다.",
    languagePractice2: "상단 메뉴에서 언어를 쉽게 전환할 수 있으며, 설정은 저장됩니다.",
    languagePractice3: "지원되지 않는 언어의 경우 자동으로 영어로 표시됩니다.",
    languagePractice4: "인터페이스 및 스크린샷은 시스템 / 라이트 / 다크 테마를 실시간으로 지원합니다.",
    roadmapTitle: "지원 예정 언어",
    roadmapDesc: "앞으로 계속해서 더 많은 언어를 추가하고 현지화 환경을 개선할 예정입니다.",
    supportTitle: "이런 분들께 추천",
    supportDesc: "여러 AI 모델을 동시에 활용해야 하는 파워 유저를 위해 설계되었습니다.",
    supportBody1: "글쓰기, 개발, 리서치 등 AI의 병렬 지원이 필요한 작업에 이상적입니다.",
    supportBody2: "서로 다른 모델의 답변을 빠르게 비교하고 최선의 결과를 얻을 수 있습니다.",
    supportCtaTitle: "지금 시작하기",
    supportCtaDesc: "설정 불필요: 확장 프로그램을 설치하고 원하는 AI 탭을 열기만 하면 됩니다.",
    supportCtaBody1: "먼저 무료 커뮤니티 버전으로 원활한 워크플로우를 경험해 보세요.",
    supportCtaBody2: "피드백이나 후원을 통해 지속적인 개발을 언제든 응원해 주세요.",
  },
  "es": {
    heroBadge: "Extensión para Chrome / Edge",
    title1: "Escribe una vez,",
    title2: "Pregunta a cada AI al instante",
    subtitle:
      "Sendol reúne tus pestañas de IA favoritas en una ventana emergente. Escribe tu mensaje una vez y envíalo a todas partes, con envío automático y nuevos chats.",
    ctaPricing: "Ver Precios",
    ctaSupport: "Apoyar el proyecto",
    ctaInstall: "Guía de instalación",
    statPlatforms: "Plataformas",
    statMode: "Modos de envío",
    statDraft: "Protección de borrador",
    statModeValue: "Manual/Auto/Nuevo",
    statDraftValue: "Auto-restauración al cerrar",
    popupScreenshotAlt: "Interfaz de la extensión Sendol",
    featureTitle: "Características principales",
    featureDesc: "Manteniéndolo maravillosamente simple: escribe, selecciona y envía.",
    featureOneTitle: "Un Mensaje, Múltiples IA",
    featureOneBody: "Deja de copiar y pegar entre pestañas. Envía tu mensaje a múltiples plataformas de IA al instante.",
    featureTwoTitle: "Estado de envío claro",
    featureTwoBody: "Detecta automáticamente las pestañas de IA abiertas y proporciona comentarios transparentes sobre el estado.",
    featureThreeTitle: "Recuperación fiable de borradores",
    featureThreeBody: "¿Cerraste la ventana accidentalmente? Tus borradores no enviados se guardan y restauran automáticamente.",
    pricingTitle: "Núcleo gratuito, Opciones Pro",
    pricingDesc: "La versión Community cubre todas tus necesidades. Actualiza a Pro para una productividad avanzada.",
    communityTitle: "Community",
    communityDesc: "Gratis / Código abierto",
    communityBody1: "Incluye transmisión principal, envío automático y guardado fiable de borradores.",
    communityBody2: "Perfecto para uso personal, ligero y de alta frecuencia.",
    communityBtn: "Ver en GitHub",
    proTitle: "Pro",
    proDesc: "Precio esperado: $5/mes o $49/año",
    proBody1: "Próximamente: Plantillas, notas, historial y reglas personalizadas. Todo guardado localmente.",
    proBody2: "Actualizaciones prioritarias para adaptarse a los cambios de la interfaz de la IA.",
    proBtn: "Unirse a la lista de espera Pro",
    sponsorTitle: "Patrocinador",
    sponsorDesc: "Apoya al desarrollador",
    sponsorBody1: "¿Te encanta la herramienta? El patrocinio directo ayuda a mantener y mejorar el proyecto.",
    sponsorBody2: "Tus contribuciones son la mayor fuerza impulsora para nuestro desarrollo continuo.",
    sponsorBtn: "Patrocinar proyecto",
    languageTitle: "Idiomas y Temas",
    languageDesc: "Disfruta de una experiencia coherente con soporte multilingüe y modo claro/oscuro.",
    languagePractice1: "Utiliza por defecto el idioma preferido de tu navegador.",
    languagePractice2: "Cambia fácilmente de idioma en el encabezado, recordaremos tu elección.",
    languagePractice3: "Vuelve al inglés sin problemas para idiomas no compatibles.",
    languagePractice4: "Soporte completo para temas del sistema / claro / oscuro en toda la interfaz.",
    roadmapTitle: "Próximos Idiomas",
    roadmapDesc: "Continuaremos añadiendo soporte para más idiomas en el futuro.",
    supportTitle: "Perfecto para...",
    supportDesc: "Diseñado para usuarios avanzados que consultan múltiples modelos de IA simultáneamente.",
    supportBody1: "Ideal para programación, redacción e investigación que requieren asistencia paralela de IA.",
    supportBody2: "Compara fácilmente las respuestas de diferentes modelos para encontrar la mejor.",
    supportCtaTitle: "Empezar",
    supportCtaDesc: "Cero configuración: Instala la extensión y abre tus pestañas de IA favoritas.",
    supportCtaBody1: "Prueba primero la versión Community para ver cómo transforma tu flujo de trabajo.",
    supportCtaBody2: "Siéntete libre de apoyar nuestro desarrollo a través de comentarios o patrocinios.",
  },
  "de": {
    heroBadge: "Chrome / Edge Erweiterung",
    title1: "Einmal tippen,",
    title2: "Alle KIs gleichzeitig fragen",
    subtitle:
      "Sendol vereint Ihre KI-Tabs in einem Popup. Schreiben Sie Ihren Prompt einmal und senden Sie ihn überallhin, mit automatischem Senden und neuen Chats.",
    ctaPricing: "Preise ansehen",
    ctaSupport: "Projekt unterstützen",
    ctaInstall: "Installationsanleitung",
    statPlatforms: "Plattformen",
    statMode: "Sendemodi",
    statDraft: "Entwurfschutz",
    statModeValue: "Manuell/Auto/Neu",
    statDraftValue: "Auto-Wiederherstellung",
    popupScreenshotAlt: "Sendol Erweiterung Popup",
    featureTitle: "Kernfunktionen",
    featureDesc: "Einfach und effizient: schreiben, auswählen und senden.",
    featureOneTitle: "Ein Prompt, mehrere KIs",
    featureOneBody: "Kein lästiges Kopieren und Einfügen zwischen Tabs mehr. Senden Sie Ihre Nachricht sofort an mehrere KI-Plattformen.",
    featureTwoTitle: "Klarer Sendestatus",
    featureTwoBody: "Erkennt automatisch Ihre offenen KI-Tabs und liefert transparentes Status- und Fehler-Feedback.",
    featureThreeTitle: "Zuverlässige Wiederherstellung",
    featureThreeBody: "Popup versehentlich geschlossen? Ihre ungesendeten Entwürfe werden automatisch gespeichert und wiederhergestellt.",
    pricingTitle: "Kostenlose Basis, Pro Optionen",
    pricingDesc: "Die Community-Version deckt Ihren Grundbedarf. Upgrade auf Pro für fortgeschrittene Produktivität.",
    communityTitle: "Community",
    communityDesc: "Kostenlos / Open Source",
    communityBody1: "Beinhaltet Kernfunktionen: Broadcasting, automatisches Senden und Entwurfschutz.",
    communityBody2: "Perfekt für den persönlichen, leichten und hochfrequenten Gebrauch.",
    communityBtn: "Auf GitHub ansehen",
    proTitle: "Pro",
    proDesc: "Erwartet: $5/Monat oder $49/Jahr",
    proBody1: "Demnächst: Vorlagen, Notizen, Verlauf und eigene Regeln. Alles lokal gespeichert.",
    proBody2: "Priorisierte Updates zur Anpassung an Änderungen der KI-Benutzeroberflächen.",
    proBtn: "Pro-Warteliste beitreten",
    sponsorTitle: "Sponsor",
    sponsorDesc: "Entwickler unterstützen",
    sponsorBody1: "Gefällt Ihnen das Tool? Direkte Unterstützung hilft, das Projekt zu pflegen.",
    sponsorBody2: "Ihre Unterstützung ist der größte Antrieb für unsere kontinuierliche Entwicklung.",
    sponsorBtn: "Projekt sponsern",
    languageTitle: "Sprachen & Designs",
    languageDesc: "Genießen Sie eine konsistente Erfahrung mit mehrsprachiger Unterstützung und Hell/Dunkel-Modus.",
    languagePractice1: "Verwendet standardmäßig die bevorzugte Sprache Ihres Browsers.",
    languagePractice2: "Einfacher Sprachwechsel im Header, Ihre Auswahl wird gespeichert.",
    languagePractice3: "Nahtloser Fallback auf Englisch für nicht unterstützte Sprachen.",
    languagePractice4: "Volle Unterstützung für System- / Hell- / Dunkel-Themes in der gesamten Benutzeroberfläche.",
    roadmapTitle: "Geplante Sprachen",
    roadmapDesc: "Wir werden in Zukunft weitere Sprachen hinzufügen und die Lokalisierung verbessern.",
    supportTitle: "Perfekt für...",
    supportDesc: "Entwickelt für Power-User, die mehrere KI-Modelle gleichzeitig konsultieren.",
    supportBody1: "Ideal für Programmierung, Schreiben und Forschung mit paralleler KI-Unterstützung.",
    supportBody2: "Vergleichen Sie Antworten verschiedener Modelle einfach, um die beste zu finden.",
    supportCtaTitle: "Loslegen",
    supportCtaDesc: "Keine Einrichtung erforderlich: Installieren Sie die Erweiterung und öffnen Sie Ihre KI-Tabs.",
    supportCtaBody1: "Probieren Sie zuerst die Community-Version aus, um Ihren Workflow zu verbessern.",
    supportCtaBody2: "Unterstützen Sie unsere Entwicklung gerne durch Feedback oder Sponsoring.",
  },
  "fr": {
    heroBadge: "Extension Chrome / Edge",
    title1: "Tapez une fois,",
    title2: "Interrogez chaque IA instantanément",
    subtitle:
      "Sendol rassemble vos onglets d'IA dans un seul popup. Rédigez votre prompt une fois et diffusez-le partout, avec l'envoi automatique et de nouveaux chats.",
    ctaPricing: "Voir les tarifs",
    ctaSupport: "Soutenir le projet",
    ctaInstall: "Guide d'installation",
    statPlatforms: "Plateformes",
    statMode: "Modes d'envoi",
    statDraft: "Protection brouillon",
    statModeValue: "Manuel/Auto/Nouveau",
    statDraftValue: "Restauration auto",
    popupScreenshotAlt: "Interface de l'extension Sendol",
    featureTitle: "Fonctionnalités clés",
    featureDesc: "La simplicité avant tout : écrivez, sélectionnez et envoyez.",
    featureOneTitle: "Un seul Prompt, Plusieurs IA",
    featureOneBody: "Finis les copier-coller entre les onglets. Diffusez votre message sur plusieurs plateformes d'IA instantanément.",
    featureTwoTitle: "Statut d'envoi clair",
    featureTwoBody: "Détecte automatiquement vos onglets d'IA ouverts et fournit des retours transparents sur l'état.",
    featureThreeTitle: "Récupération fiable",
    featureThreeBody: "Popup fermé accidentellement ? Vos brouillons non envoyés sont automatiquement sauvegardés et restaurés.",
    pricingTitle: "Cœur gratuit, Options Pro",
    pricingDesc: "La version Community couvre tous vos besoins essentiels. Passez à Pro pour plus de productivité.",
    communityTitle: "Community",
    communityDesc: "Gratuit / Open Source",
    communityBody1: "Comprend la diffusion, l'envoi automatique et la sauvegarde des brouillons.",
    communityBody2: "Parfait pour un usage personnel, léger et à haute fréquence.",
    communityBtn: "Voir sur GitHub",
    proTitle: "Pro",
    proDesc: "Prix prévu : 5 $/mois ou 49 $/an",
    proBody1: "Bientôt : Modèles, notes, historique et règles personnalisées. Tout sauvegardé localement.",
    proBody2: "Mises à jour prioritaires pour s'adapter aux changements d'interface des IA.",
    proBtn: "Rejoindre la liste d'attente Pro",
    sponsorTitle: "Sponsor",
    sponsorDesc: "Soutenir le développeur",
    sponsorBody1: "Vous aimez l'outil ? Le parrainage direct aide à maintenir et améliorer le projet.",
    sponsorBody2: "Votre soutien est le plus grand moteur de notre développement continu.",
    sponsorBtn: "Sponsoriser le projet",
    languageTitle: "Langues et Thèmes",
    languageDesc: "Profitez d'une expérience cohérente avec un support multilingue et le mode clair/sombre.",
    languagePractice1: "Utilise par défaut la langue préférée de votre navigateur.",
    languagePractice2: "Changez facilement de langue dans l'en-tête, votre choix sera mémorisé.",
    languagePractice3: "Retour transparent à l'anglais pour les langues non prises en charge.",
    languagePractice4: "Support complet des thèmes Système / Clair / Sombre.",
    roadmapTitle: "Langues à venir",
    roadmapDesc: "Nous continuerons d'ajouter la prise en charge de plus de langues à l'avenir.",
    supportTitle: "Idéal pour...",
    supportDesc: "Conçu pour les utilisateurs avancés qui consultent plusieurs modèles d'IA simultanément.",
    supportBody1: "Idéal pour le codage, la rédaction et la recherche nécessitant l'assistance de l'IA en parallèle.",
    supportBody2: "Comparez facilement les réponses de différents modèles pour trouver la meilleure.",
    supportCtaTitle: "Commencer",
    supportCtaDesc: "Aucune configuration requise : Installez l'extension et ouvrez vos onglets d'IA.",
    supportCtaBody1: "Essayez d'abord la version Community pour voir comment elle transforme votre flux de travail.",
    supportCtaBody2: "N'hésitez pas à soutenir notre développement via des retours ou un parrainage.",
  },
};

function PlatformLogos() {
  // Single source of truth: matches `src/content/index.js` platformAdapters
  const supported = [
    { name: "ChatGPT", Icon: OpenAI },
    { name: "Claude", Icon: Claude },
    { name: "Gemini", Icon: Gemini },
    { name: "DeepSeek", Icon: DeepSeek },
    { name: "Mistral", Icon: Mistral },
    { name: "Doubao", Icon: Doubao },
    { name: "Yuanbao", Icon: Yuanbao },
    { name: "Kimi", Icon: Kimi },
  ];

  const maxShown = 7;
  const shown = supported.slice(0, maxShown);
  const remaining = Math.max(0, supported.length - shown.length);

  return (
    <div className="mt-1 flex flex-wrap gap-x-1 gap-y-2">
      <div className="flex flex-wrap items-center [&>*:nth-child(n+2)]:-ml-1.5">
        {shown.map((item, i) => (
          <div
            key={item.name}
            title={item.name}
            aria-label={item.name}
            className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-foreground ring-1 ring-border/20"
            style={{ zIndex: shown.length + 1 - i }}
          >
            {item.Icon ? (
              <item.Icon size={14} aria-hidden />
            ) : (
              <span className="text-[10px] font-bold tracking-tighter" aria-hidden>
                {item.short || item.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        ))}
        {remaining > 0 ? (
          <div
            title={`+${remaining}`}
            aria-label={`+${remaining}`}
            className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-background text-foreground ring-1 ring-border/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
            style={{ zIndex: 0 }}
          >
            <span className="text-[12px] font-bold tracking-tighter leading-none mb-1">...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 首页：面向转化的落地页，视觉与 popup 一致。
 */
export function Hero() {
  const { locale, plannedLocales, resolvedTheme } = useSiteSettings();
  const copy = COPY[locale] || COPY.en;
  const screenshotSrc = resolvedTheme === "dark" ? "/screenshot-dark.png" : "/screenshot-light.png";

  const handleScrollTo = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-0 h-[520px]">
        <HeroShapeGrid />
        <div className="absolute -left-36 top-4 h-72 w-72 rounded-full bg-foreground/8 blur-3xl" />
        <div className="absolute -right-32 top-20 h-72 w-72 rounded-full bg-foreground/6 blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 pb-20 pt-12 md:px-6 md:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          <div className="space-y-7">
            <Badge variant="outline" className="px-3 py-1 text-[10px] uppercase tracking-[0.16em]">
              {copy.heroBadge}
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl md:leading-[1.15]">
                {copy.title1}
                <span className="mt-1 block bg-linear-to-br from-foreground to-foreground/50 bg-clip-text text-transparent md:mt-2">
                  {copy.title2}
                </span>
              </h1>
              <p className="max-w-xl text-[15px] leading-7 text-muted-foreground md:text-base">
                {copy.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={(e) => handleScrollTo(e, "pricing")}>
                {copy.ctaPricing}
              </Button>
              <Button variant="outline" size="lg" onClick={(e) => handleScrollTo(e, "support")}>
                {copy.ctaSupport}
                <HandHeart className="h-4 w-4" />
              </Button>
              <Button asChild variant="ghost" size="lg">
                <a href="https://github.com/RainTreeQ/sendol-extension#-installation--安装" target="_blank" rel="noreferrer">
                  {copy.ctaInstall}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card variant="inset" className="rounded-2xl min-w-0">
                <CardHeader className="space-y-1 p-4">
                  <CardDescription className="text-[11px] uppercase tracking-[0.12em] wrap-break-word">{copy.statPlatforms}</CardDescription>
                  <PlatformLogos />
                </CardHeader>
              </Card>
              <Card variant="inset" className="rounded-2xl">
                <CardHeader className="space-y-1 p-4">
                  <CardDescription className="text-[11px] uppercase tracking-[0.12em]">{copy.statMode}</CardDescription>
                  <CardTitle className="text-xl">{copy.statModeValue}</CardTitle>
                </CardHeader>
              </Card>
              <Card variant="inset" className="rounded-2xl">
                <CardHeader className="space-y-1 p-4">
                  <CardDescription className="text-[11px] uppercase tracking-[0.12em]">{copy.statDraft}</CardDescription>
                  <CardTitle className="text-xl">{copy.statDraftValue}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="group relative max-w-[380px] overflow-hidden rounded-[24px] shadow-[0_30px_60px_-35px_rgba(0,0,0,0.65)] dark:shadow-[0_20px_60px_-25px_rgba(255,255,255,0.08)] ring-1 ring-border/50 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_45px_75px_-30px_rgba(0,0,0,0.8)] dark:hover:shadow-[0_30px_70px_-20px_rgba(255,255,255,0.12)] hover:ring-border/80">
              {/* 微拟物：顶部光泽遮罩，悬浮时稍微加强 */}
              <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-b from-white/10 to-transparent opacity-40 mix-blend-overlay transition-opacity duration-700 group-hover:opacity-70 dark:from-white/5" />
              <img
                src={screenshotSrc}
                alt={copy.popupScreenshotAlt}
                className="block h-auto w-full transition-transform duration-700 group-hover:scale-[1.015]"
                loading="eager"
              />
            </div>
          </div>
        </div>

        <section id="features" aria-labelledby="features-heading" className="mt-24 space-y-6 md:mt-32 md:space-y-8">
          <div className="flex flex-col items-center text-center gap-3">
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{copy.featureTitle}</h2>
            <p className="text-sm text-muted-foreground md:text-base">{copy.featureDesc}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card variant="default" className="group relative overflow-hidden transition-colors hover:border-foreground/20">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-foreground/5 blur-2xl transition-all duration-500 group-hover:bg-foreground/10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> {copy.featureOneTitle}</CardTitle>
              </CardHeader>
              <CardContent className="text-[15px] text-foreground/80">
                <p>{copy.featureOneBody}</p>
              </CardContent>
            </Card>
            <Card variant="default" className="group relative overflow-hidden transition-colors hover:border-foreground/20">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-foreground/5 blur-2xl transition-all duration-500 group-hover:bg-foreground/10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> {copy.featureTwoTitle}</CardTitle>
              </CardHeader>
              <CardContent className="text-[15px] text-foreground/80">
                <p>{copy.featureTwoBody}</p>
              </CardContent>
            </Card>
            <Card variant="default" className="group relative overflow-hidden transition-colors hover:border-foreground/20">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-foreground/5 blur-2xl transition-all duration-500 group-hover:bg-foreground/10" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> {copy.featureThreeTitle}</CardTitle>
              </CardHeader>
              <CardContent className="text-[15px] text-foreground/80">
                <p>{copy.featureThreeBody}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="pricing" aria-labelledby="pricing-heading" className="mt-24 space-y-6 md:mt-32 md:space-y-8">
          <div className="flex flex-col items-center text-center gap-3">
            <h2 id="pricing-heading" className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{copy.pricingTitle}</h2>
            <p className="text-sm text-muted-foreground md:text-base">
              {copy.pricingDesc}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card variant="default" className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Coins className="h-4 w-4" /> {copy.communityTitle}</CardTitle>
                <CardDescription>{copy.communityDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[15px] text-foreground/80">
                <p>{copy.communityBody1}</p>
                <p>{copy.communityBody2}</p>
                <Button asChild variant="outline" className="mt-3 w-full">
                  <a href="https://github.com/RainTreeQ/sendol-extension" target="_blank" rel="noreferrer">{copy.communityBtn}</a>
                </Button>
              </CardContent>
            </Card>

            <Card variant="raised" className="relative overflow-hidden rounded-2xl border-foreground/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-foreground/5 to-transparent mix-blend-overlay opacity-50 transition-opacity duration-300 group-hover:opacity-100" />
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 text-lg"><Crown className="h-4 w-4" /> {copy.proTitle}</CardTitle>
                <CardDescription>{copy.proDesc}</CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-2 text-[15px] text-foreground/80">
                <p>{copy.proBody1}</p>
                <p>{copy.proBody2}</p>
                <Button asChild className="mt-3 w-full">
                  <a href="https://github.com/RainTreeQ/sendol-extension/issues" target="_blank" rel="noreferrer">{copy.proBtn}</a>
                </Button>
              </CardContent>
            </Card>

            <Card variant="default" className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><HandHeart className="h-4 w-4" /> {copy.sponsorTitle}</CardTitle>
                <CardDescription>{copy.sponsorDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[15px] text-foreground/80">
                <p>{copy.sponsorBody1}</p>
                <p>{copy.sponsorBody2}</p>
                <Button asChild variant="secondary" className="mt-3 w-full">
                  <a href="https://github.com/sponsors" target="_blank" rel="noreferrer">{copy.sponsorBtn}</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="support" aria-labelledby="support-heading" className="mt-24 space-y-6 md:mt-32 md:space-y-8">
          <div className="flex flex-col items-center text-center gap-3">
            <h2 id="support-heading" className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{copy.ctaSupport}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card variant="inset" className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">{copy.supportTitle}</CardTitle>
                <CardDescription>{copy.supportDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[15px] text-foreground/80">
                <p>{copy.supportBody1}</p>
                <p>{copy.supportBody2}</p>
              </CardContent>
            </Card>
            <Card variant="inset" className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">{copy.supportCtaTitle}</CardTitle>
                <CardDescription>{copy.supportCtaDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-[15px] text-foreground/80">
                <p>{copy.supportCtaBody1}</p>
                <p>{copy.supportCtaBody2}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm">
                    <a href="https://github.com/RainTreeQ/sendol-extension#-installation--安装" target="_blank" rel="noreferrer">
                      {copy.ctaInstall}
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={(e) => handleScrollTo(e, "pricing")}>
                    {copy.ctaPricing}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="language" aria-labelledby="language-heading" className="mt-24 space-y-6 md:mt-32 md:space-y-8">
          <div className="flex flex-col items-center text-center gap-3">
            <h2 id="language-heading" className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{copy.languageTitle}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card variant="inset" className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Languages className="h-4 w-4" /> {copy.languageTitle}</CardTitle>
                <CardDescription>{copy.languageDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[15px] text-foreground/80">
                <p>{copy.languagePractice1}</p>
                <p>{copy.languagePractice2}</p>
                <p>{copy.languagePractice3}</p>
                <p className="flex items-center gap-2">
                  <SunMoon className="h-4 w-4" />
                  {copy.languagePractice4}
                </p>
              </CardContent>
            </Card>

            <Card variant="inset" className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Globe className="h-4 w-4" /> {copy.roadmapTitle}</CardTitle>
                <CardDescription>{copy.roadmapDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {plannedLocales.map((item) => (
                    <Badge key={item.code} variant="outline" className="px-3 py-1 text-[11px]">
                      {item.label}
                    </Badge>
                  ))}
                </div>
                <p className="flex items-center gap-2 text-[15px] text-foreground/80">
                  <MoonStar className="h-4 w-4" />
                  system/light/dark
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </section>
  );
}
