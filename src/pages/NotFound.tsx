import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F6F7FB] px-4 py-16">
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <div className="text-sm font-semibold text-zinc-900">页面不存在</div>
        <div className="mt-2 text-sm text-zinc-600">你访问的地址可能已被移除或暂不可用。</div>
        <div className="mt-4">
          <Link to="/">
            <Button>返回首页</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

