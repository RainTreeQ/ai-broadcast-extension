import { HashRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Home } from "@/pages/Home";
import { Privacy } from "@/pages/Privacy";
import { Terms } from "@/pages/Terms";
import { Install } from "@/pages/Install";
import { FAQ } from "@/pages/FAQ";
import { Changelog } from "@/pages/Changelog";
import { Contact } from "@/pages/Contact";

/**
 * 落地页应用：仅包含对外发布的营销落地页。设计系统已拆分为独立站点（本地开发用）。
 */
function App() {
  return (
    <HashRouter>
      <div className="relative flex min-h-screen flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only absolute left-4 top-2 z-[60] rounded-md bg-card px-3 py-2 text-sm text-foreground shadow-md focus:not-sr-only focus:outline-none"
        >
          Skip to main content / 跳转到主内容
        </a>
        <Header />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/install" element={<Install />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </HashRouter>
  );
}

export default App;
