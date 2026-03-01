/**
 * [INPUT]: None（可选：若存在 public/screenshot.png 可替换为真实截图）
 * [OUTPUT]: 落地页 Hero 区域组件
 * [POS]: 组件层 - 页面头部区块
 */
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { staggerContainer, fadeInUp, scaleIn } from "@/lib/motion"

/** 扩展 Logo：圆 + 两条竖线 */
function LogoIcon({ className }) {
  const cx = 12
  const cy = 12
  const r = 10
  const xL = cx - r / 3
  const xR = cx + r / 3
  const dy = Math.sqrt(r * r - (r / 3) ** 2)
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
      <line x1={xL} y1={cy - dy} x2={xL} y2={cy + dy} stroke="currentColor" opacity={0.4} />
      <line x1={xR} y1={cy - dy} x2={xR} y2={cy + dy} stroke="currentColor" opacity={0.4} />
    </svg>
  )
}

/** 无图版：浏览器框 + 扩展弹窗 mock，纯设计系统色 */
function HeroProductMock() {
  const platforms = [
    { name: "ChatGPT", dot: "bg-primary" },
    { name: "Claude", dot: "bg-accent" },
    { name: "Gemini", dot: "bg-secondary" },
  ]
  return (
    <div className="flex flex-col items-center gap-6">
      {/* 浏览器窗口框 */}
      <div
        className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden"
        style={{ boxShadow: "0 24px 48px -12px color-mix(in oklch, var(--foreground) 12%, transparent), inset 0 1px 0 color-mix(in oklch, white 10%, transparent)" }}
      >
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex-1 rounded-lg bg-background/80 py-1.5 px-3 text-center text-xs text-muted-foreground">
            chrome://extensions — AI Broadcast
          </div>
        </div>
        <div className="relative flex justify-end bg-muted/20 p-6 min-h-[280px]">
          {/* 模拟页面背景：多标签页示意 */}
          <div className="absolute inset-6 flex gap-2 pt-8">
            <div className="h-20 flex-1 rounded-xl border border-border bg-card/60" />
            <div className="h-20 flex-1 rounded-xl border border-border bg-card/60" />
            <div className="h-20 flex-1 rounded-xl border border-primary/20 bg-primary/5" />
          </div>
          {/* 扩展弹窗 mock */}
          <div
            className="relative w-[320px] shrink-0 rounded-2xl border border-border bg-card p-0 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden"
            style={{ boxShadow: "0 16px 40px -8px color-mix(in oklch, var(--foreground) 18%, transparent), inset 0 1px 0 color-mix(in oklch, white 12%, transparent)" }}
          >
            <header className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <LogoIcon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-foreground">Broadcast</span>
              </div>
              <div className="h-7 w-7 rounded-full bg-muted" />
            </header>
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Active Sessions</p>
              <ul className="space-y-1.5">
                {platforms.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 shadow-sm"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />
                    <span className="text-xs font-medium text-foreground">{p.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[120px]">Session</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border bg-muted/20 px-4 py-3">
              <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Message AI Agents...</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Auto Send · New Chat</span>
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20 pb-32">
      <div className="absolute inset-0 z-0 bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
      </div>

      <motion.div
        className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <motion.div variants={fadeInUp} className="flex justify-center">
            <Badge variant="secondary" className="px-4 py-1.5 rounded-full text-sm">
              🚀 AI Broadcast Extension
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]"
          >
            同步掌控所有窗口 <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-accent">提升十倍生产力</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            一键将同一条消息同步广播到 ChatGPT、Claude、Gemini 等所有 AI 会话。极简拟物 UI，全键盘支持。
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Button size="xl" variant="primary" className="w-full sm:w-auto">
              立即开始使用
            </Button>
            <Button size="xl" variant="secondary" className="w-full sm:w-auto">
              查看开发文档
            </Button>
          </motion.div>

          <motion.p variants={fadeInUp} className="text-sm text-muted-foreground pt-4">
            已有超过 10,000+ 极客开发者安装
          </motion.p>
        </div>

        <motion.div variants={scaleIn} className="mt-16 mx-auto max-w-5xl">
          <HeroProductMock />
        </motion.div>
      </motion.div>
    </section>
  )
}
