import { useState } from "react";
import type { StemBlock } from "@/types/domain";
import Modal from "@/components/ui/Modal";

export default function StemViewer({ blocks }: { blocks: StemBlock[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {blocks.map((b, idx) => {
        if (b.type === "text") return <p key={idx} className="text-sm text-zinc-800 leading-relaxed">{b.text}</p>;
        if (b.type === "image")
          return (
            <div key={idx} className="w-fit max-w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
              <img 
                src={b.url} 
                alt={b.alt || "image"} 
                className="h-auto max-h-[300px] w-auto max-w-full cursor-zoom-in transition-transform hover:scale-[1.02]" 
                onClick={() => setPreviewUrl(b.url)}
              />
            </div>
          );
        if (b.type === "formula")
          return (
            <div
              key={idx}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700"
            >
              {b.latex}
            </div>
          );
        return (
          <div key={idx} className="overflow-auto rounded-lg border border-zinc-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr>
                  {b.headers.map((h) => (
                    <th key={h} className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="odd:bg-zinc-50">
                    {row.map((cell, c) => (
                      <td key={c} className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <Modal 
        isOpen={!!previewUrl} 
        onClose={() => setPreviewUrl(null)} 
        title="查看大图"
        width="max-w-4xl"
      >
        <div className="flex items-center justify-center p-2">
          {previewUrl && (
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="h-auto max-h-[80vh] w-auto max-w-full rounded-md shadow-lg"
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

