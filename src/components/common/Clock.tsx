import { useState, useEffect } from "react";

export default function Clock() {
  const [time, setTime] = useState<Date>(new Date());

  const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });

  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-end mr-4 text-zinc-700 select-none">
      <div className="text-2xl font-bold leading-none font-mono tracking-wide tabular-nums">
        {timeFormatter.format(time)}
      </div>
      <div className="text-xs opacity-80 mt-1 font-sans">
        {dateFormatter.format(time)}
      </div>
    </div>
  );
}
