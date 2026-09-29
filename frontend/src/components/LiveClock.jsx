import { useEffect, useState } from "react";

function format(date) {
  return {
    time: date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
    date: date.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
  };
}

export default function LiveClock() {
  const [now, setNow] = useState(() => format(new Date()));

  useEffect(() => {
    const t = setInterval(() => setNow(format(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="live-clock">
      <div className="clock-time">{now.time}</div>
      <div className="clock-date">{now.date}</div>
    </div>
  );
}
