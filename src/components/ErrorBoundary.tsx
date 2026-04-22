import type { ReactNode } from "react";
import { Component } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

function safeClearAppStorage() {
  try {
    localStorage.removeItem("oex_auth_v1");
  } catch {
    return;
  }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch() {
    return;
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F6F7FB] px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-white p-6">
          <div className="text-base font-semibold text-zinc-900">页面渲染失败</div>
          <div className="mt-2 text-sm text-zinc-600">
            这是前端运行时错误导致的白屏。你可以先清理本地缓存并刷新页面。
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                safeClearAppStorage();
                location.reload();
              }}
              type="button"
            >
              清理缓存并刷新
            </button>
            <button
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              onClick={() => this.setState({ error: null })}
              type="button"
            >
              尝试继续
            </button>
          </div>
          <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-800">错误详情</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-zinc-700">{String(this.state.error.stack ?? this.state.error.message)}</pre>
          </details>
        </div>
      </div>
    );
  }
}

