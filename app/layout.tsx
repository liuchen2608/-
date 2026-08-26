import type { Metadata } from "next";
import { headers } from "next/headers";
import { getChatGPTUser } from "./chatgpt-auth";
import "./globals.css";
import "./motion.css";
import "./auth.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-v2.png`;
  const title = "大象阿宝｜健康生活助手";
  const description = "面向普通成年人的生活方式推荐助手，提供简单、温和、可执行的饮食、作息、运动和习惯建议。";
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1731, height: 909 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getChatGPTUser();
  return (
    <html lang="zh-CN">
      <body>{user ? children : <SignedOutPage />}</body>
    </html>
  );
}

function SignedOutPage() {
  return (
    <main className="signed-out-page">
      <section className="signed-out-card" aria-labelledby="signed-out-title">
        <span className="logo-mark" aria-hidden="true" />
        <span className="eyebrow">大象阿宝 · 健康生活助手</span>
        <h1 id="signed-out-title">登录后开始你的生活计划</h1>
        <p>登录用于安全保存你的生活偏好、建议记录和习惯计划。未登录时不会读取或写入个人数据。</p>
        <a className="primary-button" href="/signin-with-chatgpt?return_to=%2F">使用 ChatGPT 登录</a>
        <small>大象阿宝只提供饮食、作息、运动和日常习惯建议。</small>
      </section>
    </main>
  );
}
