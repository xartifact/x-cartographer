import { Link } from "@tanstack/react-router";
import { useProducts } from "@/lib/api/hooks";
import { Button } from "@x-cartographer/ui";
export function HomePage() {
  const { data: products = [], isLoading, error, refetch } = useProducts();
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">继续你的产品工作</h1>
          <p className="mt-1 text-muted-foreground">组织需求、跟踪交付、记录架构决定。</p>
        </div>
        <Button asChild>
          <Link to="/products">新建或管理产品</Link>
        </Button>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">最近更新的产品</h2>
        {isLoading ? (
          <p>加载中…</p>
        ) : error ? (
          <div role="alert">
            加载失败<Button onClick={() => refetch()}>重试</Button>
          </div>
        ) : !products.length ? (
          <p className="rounded-lg border p-6">创建第一个产品，从用户活动开始规划。</p>
        ) : (
          [...products]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, 6)
            .map((product) => (
              <Link
                key={product.id}
                to="/products/$productId"
                params={{ productId: product.id }}
                className="block rounded-lg border bg-card p-4 hover:border-primary"
              >
                <h3 className="font-medium">{product.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.description || "打开产品继续规划"}
                </p>
              </Link>
            ))
        )}
      </section>
      <Link to="/active" className="text-primary underline">
        打开并行工作台
      </Link>
    </main>
  );
}
