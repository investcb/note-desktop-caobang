import React, { useState, useEffect } from "react";
import { MainEvent, SubTask, Wallpaper } from "./types";
import { formatDateString, formatDisplayDate } from "./utils";
import { CalendarWidget } from "./components/CalendarWidget";
import { TaskWidget } from "./components/TaskWidget";
import { Clock, Info, CheckCircle, Flame, Monitor, Palette, Sparkles } from "lucide-react";

const WALLPAPERS: Wallpaper[] = [
  { id: "wp-1", name: "Slate Minimalist", cssClass: "bg-[#F8FAFC]" },
  { id: "wp-2", name: "Soft Blue", cssClass: "bg-[#F1F5F9]" },
  { id: "wp-3", name: "Soft Ivory", cssClass: "bg-[#FAF9F6]" },
  { id: "wp-4", name: "Mint Fresh", cssClass: "bg-[#F4FBF7]" },
];

export default function App() {
  // Lấy dữ liệu từ Local Storage; mặc định lịch trống (không tạo dữ liệu mẫu)
  const [events, setEvents] = useState<MainEvent[]>(() => {
    const saved = localStorage.getItem("desktop_widget_events");
    return saved ? JSON.parse(saved) : [];
  });

  const [subTasks, setSubTasks] = useState<SubTask[]>(() => {
    const saved = localStorage.getItem("desktop_widget_subtasks");
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return formatDateString(new Date());
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Tự động chọn sự kiện chính đầu tiên của ngày được click
  useEffect(() => {
    const dayEvents = events.filter((e) => e.date === selectedDate);
    if (dayEvents.length > 0) {
      const isCurrentSelectedInDay = dayEvents.some((e) => e.id === selectedEventId);
      if (!isCurrentSelectedInDay) {
        setSelectedEventId(dayEvents[0].id);
      }
    } else {
      setSelectedEventId(null);
    }
  }, [selectedDate, events]);

  const [activeWallpaper, setActiveWallpaper] = useState<string>(() => {
    return localStorage.getItem("desktop_widget_wallpaper") || "wp-1";
  });

  const [time, setTime] = useState<string>("");

  // Đồng hồ cập nhật mỗi giây
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setTime(`${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Lưu vào Local Storage khi có thay đổi
  useEffect(() => {
    localStorage.setItem("desktop_widget_events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("desktop_widget_subtasks", JSON.stringify(subTasks));
  }, [subTasks]);

  useEffect(() => {
    localStorage.setItem("desktop_widget_wallpaper", activeWallpaper);
  }, [activeWallpaper]);

  // Thêm sự kiện mới chính
  const handleAddEvent = (newEvent: MainEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
    setSelectedDate(newEvent.date);
    setSelectedEventId(newEvent.id);
  };

  // Thêm sự kiện kèm việc phụ được AI lập lịch sẵn
  const handleAddEventWithSubTasks = (newEvent: MainEvent, newSubs: SubTask[]) => {
    setEvents((prev) => [newEvent, ...prev]);
    setSubTasks((prev) => [...prev, ...newSubs]);
    setSelectedDate(newEvent.date);
    setSelectedEventId(newEvent.id);
  };

  // Thêm dữ liệu import hàng loạt (cho công văn)
  const handleAddImportedData = (importedList: Array<{ event: MainEvent; subTasks: SubTask[] }>) => {
    const newEvents = importedList.map(item => item.event);
    const newSubTasks = importedList.flatMap(item => item.subTasks);

    setEvents((prev) => [...newEvents, ...prev]);
    setSubTasks((prev) => [...newSubTasks, ...prev]);

    if (newEvents.length > 0) {
      setSelectedDate(newEvents[0].date);
      setSelectedEventId(newEvents[0].id);
    }
  };

  // Thêm việc phụ thủ công
  const handleAddSubTask = (newSub: SubTask) => {
    setSubTasks((prev) => [...prev, newSub]);
  };

  // Toggle hoàn thành việc phụ
  const handleToggleSubTask = (id: string) => {
    setSubTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  // Xóa việc phụ
  const handleDeleteSubTask = (id: string) => {
    setSubTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Xóa toàn bộ sự kiện chính và các việc phụ kèm theo
  const handleDeleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setSubTasks((prev) => prev.filter((t) => t.eventId !== eventId));
  };

  const currentWp = WALLPAPERS.find((w) => w.id === activeWallpaper) || WALLPAPERS[0];

  // Tính toán dữ liệu thống kê thực tế cho Clean Minimalism
  const totalSubTasksCount = subTasks.length;
  const completedSubTasksCount = subTasks.filter((t) => t.completed).length;
  const overallCompletionRate = totalSubTasksCount > 0 
    ? Math.round((completedSubTasksCount / totalSubTasksCount) * 100) 
    : 100;

  const todayStr = formatDateString(new Date());
  const todayTasksCount = subTasks.filter((t) => t.dueDate === todayStr).length + events.filter((e) => e.date === todayStr).length;

  const pendingAxCount = subTasks.filter((t) => !t.completed).length;

  // Trích xuất tháng/năm hiện tại để làm header hoành tráng
  const now = new Date();
  const currentMonthName = `Tháng ${now.getMonth() + 1}`;
  const currentYear = now.getFullYear();

  return (
    <div className={`min-h-screen ${currentWp.cssClass} transition-all duration-1000 p-6 md:p-8 flex flex-col font-sans text-slate-800 antialiased relative overflow-x-hidden`}>
      
      {/* Top Header Area - Clean Minimalism Style */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4 border-b border-slate-200/60 pb-5">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-slate-900">
            {currentMonthName} <span className="font-semibold">{currentYear}</span>
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <span>Hôm nay là {formatDisplayDate(todayStr)}</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-600 bg-slate-200/50 px-2 py-0.5 rounded text-xs">{time || "00:00:00"}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Progress Indicator */}
          <div className="bg-white border border-slate-200/80 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${overallCompletionRate === 100 ? "bg-emerald-500" : "bg-blue-500"}`}></div>
            <span className="text-xs font-semibold text-slate-700">
              {overallCompletionRate}% Hoàn thành tổng quát
            </span>
          </div>

          {/* Wallpaper selector - Minimalist pill */}
          <div className="bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-sm flex gap-1.5 items-center">
            <Palette className="w-3.5 h-3.5 text-slate-400" />
            {WALLPAPERS.map((wp) => (
              <button
                id={`wallpaper-select-${wp.id}`}
                key={wp.id}
                onClick={() => setActiveWallpaper(wp.id)}
                title={wp.name}
                className={`w-4 h-4 rounded-full border cursor-pointer transition-all duration-300
                  ${activeWallpaper === wp.id ? "border-slate-800 scale-125 shadow-sm" : "border-slate-200 opacity-60 hover:opacity-100"}
                `}
                style={{
                  background: wp.id === "wp-1" ? "#F8FAFC" : wp.id === "wp-2" ? "#F1F5F9" : wp.id === "wp-3" ? "#FAF9F6" : "#F4FBF7"
                }}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 items-stretch">
        
        {/* Left: Calendar & AI Chat Integrated (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex-1 min-h-[500px] flex flex-col">
            <CalendarWidget
              events={events}
              subTasks={subTasks}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onAddEvent={handleAddEvent}
              onAddSubTask={handleAddSubTask}
              selectedEventId={selectedEventId}
              onSelectEventId={setSelectedEventId}
            />
          </div>
        </div>

        {/* Right: Dynamic Timeline (8 cols) - Giao diện cực rộng cho công việc tổng thể */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex-1 min-h-[520px] flex flex-col">
            <TaskWidget
              events={events}
              subTasks={subTasks}
              onAddEvent={handleAddEvent}
              onAddSubTask={handleAddSubTask}
              onAddEventWithSubTasks={handleAddEventWithSubTasks}
              onToggleSubTask={handleToggleSubTask}
              onDeleteSubTask={handleDeleteSubTask}
              onDeleteEvent={handleDeleteEvent}
              selectedDate={selectedDate}
              selectedEventId={selectedEventId}
              onSelectEventId={setSelectedEventId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

