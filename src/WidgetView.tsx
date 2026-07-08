import React, { useEffect, useState } from "react";
import { MainEvent, SubTask } from "./types";
import { formatDateString, formatDisplayDate } from "./utils";
import { X, Clock, CheckCircle2, Circle, CalendarDays } from "lucide-react";

const drag = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

export function WidgetView() {
  const [events, setEvents] = useState<MainEvent[]>([]);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [time, setTime] = useState("");

  // Đồng bộ dữ liệu từ localStorage (cùng origin với cửa sổ chính)
  useEffect(() => {
    const sync = () => {
      setEvents(readList<MainEvent>("desktop_widget_events"));
      setSubTasks(readList<SubTask>("desktop_widget_subtasks"));
    };
    sync();
    window.addEventListener("storage", sync);
    const poll = setInterval(sync, 3000);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(poll);
    };
  }, []);

  // Đồng hồ
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(
        `${String(n.getHours()).padStart(2, "0")}:${String(
          n.getMinutes()
        ).padStart(2, "0")}`
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const today = formatDateString(new Date());

  const todayEvents = events.filter((e) => e.date === today);
  const todaySubs = subTasks.filter((t) => t.dueDate === today);
  const overdue = subTasks.filter((t) => !t.completed && t.dueDate < today);
  const upcoming = subTasks
    .filter((t) => !t.completed && t.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  const toggle = (id: string) => {
    const next = subTasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    setSubTasks(next);
    localStorage.setItem("desktop_widget_subtasks", JSON.stringify(next));
  };

  const pending = subTasks.filter((t) => !t.completed).length;

  return (
    <div className="h-screen w-screen p-2 font-sans text-slate-800">
      <div className="h-full w-full flex flex-col rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl overflow-hidden">
        {/* Thanh tiêu đề — kéo để di chuyển widget */}
        <div
          data-tauri-drag-region
          style={drag}
          className="flex items-center justify-between px-4 pt-3 pb-2 bg-gradient-to-br from-slate-50 to-white cursor-move select-none"
        >
          <div>
            <div className="flex items-baseline gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-2xl font-light tracking-tight tabular-nums">
                {time}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {formatDisplayDate(today)}
            </div>
          </div>
          <button
            style={noDrag}
            onClick={() => {
              const w: any = window as any;
              if (w.__TAURI__?.window?.getCurrentWindow) {
                w.__TAURI__.window.getCurrentWindow().hide();
              } else {
                w.electronAPI?.closeWidget?.();
              }
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Đóng widget"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nội dung */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {todayEvents.length > 0 && (
            <Section
              icon={<CalendarDays className="w-3.5 h-3.5 text-blue-500" />}
              title="Sự kiện hôm nay"
            >
              {todayEvents.map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-medium text-blue-900"
                >
                  {e.title}
                </div>
              ))}
            </Section>
          )}

          {overdue.length > 0 && (
            <Section title="Quá hạn" tone="rose">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} overdue />
              ))}
            </Section>
          )}

          <Section title="Việc hôm nay">
            {todaySubs.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-2">
                Không có việc đến hạn hôm nay 🎉
              </p>
            ) : (
              todaySubs.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} />
              ))
            )}
          </Section>

          {upcoming.length > 0 && (
            <Section title="Sắp tới">
              {upcoming.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} showDate />
              ))}
            </Section>
          )}
        </div>

        {/* Chân widget */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/80 text-[11px] text-slate-500 flex items-center justify-between">
          <span>{pending} việc chưa hoàn thành</span>
          <span className="font-semibold text-slate-600">Ghi Chú Chuẩn</span>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  tone?: "rose";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1 mb-1.5">
        {icon}
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            tone === "rose" ? "text-rose-600" : "text-slate-500"
          }`}
        >
          {title}
        </span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  overdue,
  showDate,
}: {
  task: SubTask;
  onToggle: (id: string) => void;
  overdue?: boolean;
  showDate?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs border transition ${
        overdue
          ? "bg-rose-50 border-rose-100"
          : "bg-slate-50 border-slate-100 hover:bg-slate-100"
      }`}
    >
      <button
        onClick={() => onToggle(task.id)}
        className="mt-0.5 shrink-0"
        title={task.completed ? "Bỏ đánh dấu" : "Đánh dấu hoàn thành"}
      >
        {task.completed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300 hover:text-slate-500" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`leading-snug ${
            task.completed ? "line-through text-slate-400" : "text-slate-700"
          }`}
        >
          {task.title}
        </div>
        {showDate && (
          <div className="text-[10px] text-slate-400 mt-0.5">
            {task.dueDate.split("-").reverse().join("/")}
          </div>
        )}
      </div>
      <span
        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
          PRIORITY_DOT[task.priority] || "bg-slate-300"
        }`}
      />
    </div>
  );
}
