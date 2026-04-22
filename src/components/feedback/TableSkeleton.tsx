import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function TableSkeleton({ title, columns = 5, rows = 5 }: { title: string; columns?: number; rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>
                {Array.from({ length: columns }).map((_, index) => (
                  <th key={index} className="border-b border-zinc-200 px-3 py-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-zinc-50">
                  {Array.from({ length: columns }).map((__, columnIndex) => (
                    <td key={columnIndex} className="border-b border-zinc-100 px-3 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
