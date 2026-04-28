export type ExamTimeStatus = {
  label: string;
  tone: "amber" | "blue" | "green" | "zinc" | "red";
  detail?: string;
};

/**
 * 计算考试时间状态
 * @param startAt 考试开始时间 (ISO string)
 * @param endAt 考试结束时间 (ISO string)
 * @param now 当前时间戳 (ms)，默认为服务器时间
 */
export function calculateExamTimeStatus(
  startAt?: string,
  endAt?: string,
  now: number = Date.now()
): ExamTimeStatus {
  if (!startAt) return { label: "未设置时间", tone: "zinc" };

  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : undefined;

  // 1. 考前状态
  if (now < start) {
    const diff = start - now;
    const days = Math.floor(diff / (24 * 3600 * 1000));
    
    if (days >= 1) {
      return {
        label: "未开始",
        tone: "amber",
        detail: `离考试开始还有 ${days} 天`,
      };
    }

    const hours = Math.floor(diff / (3600 * 1000));
    const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    
    if (hours >= 1) {
      return {
        label: "未开始",
        tone: "amber",
        detail: `离考试开始还有 ${hours} 小时 ${minutes} 分钟`,
      };
    }

    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    return {
      label: "未开始",
      tone: "red",
      detail: `离考试开始还有 ${minutes} 分钟 ${seconds} 秒`,
    };
  }

  // 2. 考后状态
  if (end && now > end) {
    return { label: "已结束", tone: "zinc" };
  }

  // 3. 考试中状态
  if (end) {
    const diff = end - now;
    const hours = Math.floor(diff / (3600 * 1000));
    const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    
    if (hours >= 1) {
      return {
        label: "考试中",
        tone: "green",
        detail: `离收卷还有 ${hours} 小时 ${minutes} 分钟`,
      };
    }

    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    return {
      label: "考试中",
      tone: "blue",
      detail: `离收卷还有 ${minutes} 分钟 ${seconds} 秒`,
    };
  }

  // 无结束时间的情况
  return { label: "考试中", tone: "green" };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
