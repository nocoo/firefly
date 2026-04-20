import Link from "next/link";

export default async function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-blog-muted">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-blog-text">
        未找到
      </h2>
      <p className="mt-2 text-blog-muted">
        您访问的页面不存在或已被移除。
      </p>
      <Link
        href="/"
        className="mt-6 text-sm text-blog-muted transition-colors hover:text-blog-text"
      >
        ← 返回首页
      </Link>
    </main>
  );
}
