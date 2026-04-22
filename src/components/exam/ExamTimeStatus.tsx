import { useState, useEffect } from "react";
import { calculateExamTimeStatus, formatDuration, formatTime, ExamTimeStatus } from "@/utils/examTime";
import { ExamTimeBadge } from "./ExamTimeBadge";

type Props = {
  exam: {
    startAt?: string;
    endAt?: string;
    durationMinutes: number;
  };
  showDetail?: boolean; // controls the extra block (start/end/duration)
  showCountdown?: boolean; // controls the countdown text
};

export default function ExamTimeStatusDisplay({ exam, showDetail = true, showCountdown = true }: Props) {
  const [status, setStatus] = useState<ExamTimeStatus>({ label: "加载中", tone: "zinc" });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    setStatus(calculateExamTimeStatus(exam.startAt, exam.endAt, now));
  }, [now, exam.startAt, exam.endAt]);

  if (!exam.startAt) {
    return <ExamTimeBadge tone="zinc" label="未设置时间" icon="alert" />;
  }

  // Map tone to icon
  const getIcon = (tone: string) => {
    switch (tone) {
      case "amber": return "clock";
      case "blue": return "loading"; // In progress
      case "green": return "play"; // Started
      case "zinc": return "check"; // Ended
      case "red": return "alert"; // Urgent
      default: return undefined;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <ExamTimeBadge 
          tone={status.tone} 
          label={status.label} 
          icon={getIcon(status.tone) as any} 
        />
        {showCountdown && status.detail && (
          status.tone === 'blue' || status.tone === 'red' ? (
            <span className={`text-xs font-mono tabular-nums tracking-wide font-bold ${status.tone === 'red' ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
              {status.detail}
            </span>
          ) : (
            <span className="text-xs text-zinc-500 font-mono tabular-nums">
              {status.detail}
            </span>
          )
        )}
      </div>
      {showDetail && (
        <div className="text-xs text-zinc-500 space-y-0.5 pl-0.5 border-l-2 border-zinc-100 ml-1">
          <div className="pl-2">开始：{formatTime(exam.startAt)}</div>
          {exam.endAt && <div className="pl-2">结束：{formatTime(exam.endAt)}</div>}
          <div className="pl-2">时长：{formatDuration(exam.durationMinutes)}</div>
        </div>
      )}
    </div>
  );
}
