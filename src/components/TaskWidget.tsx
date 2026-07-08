import React, { useState } from "react";
import { MainEvent, SubTask } from "../types";
import { generateId, getVietnameseDayOfWeek, formatDisplayDate } from "../utils";
import { 
  CheckSquare, 
  Calendar, 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ListTodo,
  Sparkles,
  ChevronRight,
  X
} from "lucide-react";

interface TaskWidgetProps {
  events: MainEvent[];
  subTasks: SubTask[];
  onAddEvent: (event: MainEvent) => void;
  onAddSubTask: (subTask: SubTask) => void;
  onAddEventWithSubTasks?: (event: MainEvent, subTasks: SubTask[]) => void;
  onToggleSubTask: (id: string) => void;
  onDeleteSubTask: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  selectedDate: string;
  selectedEventId: string | null;
  onSelectEventId: (id: string | null) => void;
}

export const TaskWidget: React.FC<TaskWidgetProps> = ({
  events,
  subTasks,
  onAddEvent,
  onAddSubTask,
  onAddEventWithSubTasks,
  onToggleSubTask,
  onDeleteSubTask,
  onDeleteEvent,
  selectedDate,
  selectedEventId,
  onSelectEventId,
}) => {
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(selectedDate || "");
  const [eventDesc, setEventDesc] = useState("");

  // Temp list of subtasks during main event creation
  const [tempSubTasks, setTempSubTasks] = useState<Array<{
    id: string;
    title: string;
    offsetDays: number;
    priority: "high" | "medium" | "low";
    category: string;
  }>>([]);

  // Form inputs for temp subtask
  const [tempSubTaskTitle, setTempSubTaskTitle] = useState("");
  const [tempSubTaskDaysOffset, setTempSubTaskDaysOffset] = useState("-1");
  const [tempSubTaskPriority, setTempSubTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [tempSubTaskCategory, setTempSubTaskCategory] = useState("Chuẩn bị");

  // States for general subtask form (when event is already created and selected)
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [subTaskDaysOffset, setSubTaskDaysOffset] = useState("-1");
  const [subTaskPriority, setSubTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [subTaskCategory, setSubTaskCategory] = useState("Chuẩn bị");

  const categories = ["Chuẩn bị", "Báo cáo", "Hậu cần", "Đôn đốc", "Khác"];

  // Find the currently selected event
  const activeEvent = events.find((e) => e.id === selectedEventId);

  // Filter subtasks for the selected event
  const activeSubTasks = activeEvent ? subTasks.filter((t) => t.eventId === activeEvent.id) : [];

  // Sort subtasks by due date (closest first)
  const sortedSubTasks = [...activeSubTasks].sort((a, b) => {
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const completedCount = activeSubTasks.filter((t) => t.completed).length;
  const totalCount = activeSubTasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isCompleted = totalCount > 0 && completedCount === totalCount;

  // Add subtask locally to the new event form list
  const handleAddTempSubTask = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!tempSubTaskTitle.trim()) return;

    const newTemp = {
      id: generateId(),
      title: tempSubTaskTitle.trim(),
      offsetDays: Number(tempSubTaskDaysOffset),
      priority: tempSubTaskPriority,
      category: tempSubTaskCategory,
    };

    setTempSubTasks((prev) => [...prev, newTemp]);
    setTempSubTaskTitle("");
  };

  // Remove subtask locally from the new event form list
  const handleRemoveTempSubTask = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setTempSubTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Create the main event and all manually defined subtasks
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventDate) return;

    const eventId = generateId();
    const newEvent: MainEvent = {
      id: eventId,
      title: eventTitle,
      date: eventDate,
      description: eventDesc,
      createdAt: new Date().toISOString(),
    };

    // Calculate dates for subtasks relative to the main event date
    const subTasksToCreate: SubTask[] = tempSubTasks.map((t) => {
      const date = new Date(eventDate);
      date.setDate(date.getDate() + t.offsetDays);
      const calculatedDueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      return {
        id: generateId(),
        eventId: eventId,
        title: t.title,
        dueDate: calculatedDueDate,
        offsetDays: t.offsetDays,
        description: "",
        completed: false,
        priority: t.priority,
        category: t.category,
      };
    });

    if (onAddEventWithSubTasks) {
      onAddEventWithSubTasks(newEvent, subTasksToCreate);
    } else {
      onAddEvent(newEvent);
      subTasksToCreate.forEach((st) => onAddSubTask(st));
    }

    // Reset Form & states
    setEventTitle("");
    setEventDesc("");
    setTempSubTasks([]);
    setTempSubTaskTitle("");
    setShowAddEvent(false);
  };

  // Xử lý tạo việc phụ thủ công cho sự kiện đang chọn
  const handleCreateSubTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !subTaskTitle) return;

    // Tính toán hạn nộp dựa trên offset ngày
    const offsetNum = Number(subTaskDaysOffset);
    const date = new Date(activeEvent.date);
    date.setDate(date.getDate() + offsetNum);
    
    // Định dạng YYYY-MM-DD
    const calculatedDueDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const newSub: SubTask = {
      id: generateId(),
      eventId: activeEvent.id,
      title: subTaskTitle,
      dueDate: calculatedDueDate,
      offsetDays: offsetNum,
      description: "",
      completed: false,
      priority: subTaskPriority,
      category: subTaskCategory,
    };

    onAddSubTask(newSub);

    // Reset form phụ
    setSubTaskTitle("");
  };

  return (
    <div id="task-widget-container" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Tiến độ & Việc chuẩn bị</h2>
        </div>
        <button
          id="toggle-add-event-btn"
          onClick={() => {
            setShowAddEvent(!showAddEvent);
            setEventDate(selectedDate);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Tạo sự kiện chính
        </button>
      </div>

      {/* Form Tạo Sự Kiện Chính kèm Việc Chuẩn Bị Thủ Công */}
      {showAddEvent && (
        <form onSubmit={handleCreateEvent} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 mb-5 space-y-4 shrink-0 animate-in slide-in-from-top-2 duration-200">
          <div className="border-b border-slate-200/60 pb-2">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Tạo sự kiện chính & Lập lịch việc chuẩn bị (Thủ công)
            </h3>
          </div>

          {/* SỰ KIỆN CHÍNH */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên sự kiện chính</label>
              <input
                id="event-title-input"
                type="text"
                required
                placeholder="Ví dụ: Hội nghị giao ban giải ngân quý II..."
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày diễn ra</label>
                <input
                  id="event-date-input"
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thứ dự kiến</label>
                <div className="text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded-lg px-3 py-2.5 font-bold">
                  {eventDate ? getVietnameseDayOfWeek(eventDate) : "Chưa chọn ngày"}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mô tả tóm tắt</label>
              <input
                id="event-desc-input"
                type="text"
                placeholder="Nội dung tóm tắt sự kiện lớn..."
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700"
              />
            </div>
          </div>

          {/* LẬP LỊCH VIỆC CHUẨN BỊ THỦ CÔNG */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-3">
            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Thêm công việc chuẩn bị cho sự kiện này (A-x)
            </span>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-5">
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tên việc chuẩn bị</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Hoàn thiện báo cáo gửi Sở Tài chính"
                  value={tempSubTaskTitle}
                  onChange={(e) => setTempSubTaskTitle(e.target.value)}
                  className="w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 bg-slate-50/20"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Thời hạn thực hiện</label>
                <select
                  value={tempSubTaskDaysOffset}
                  onChange={(e) => setTempSubTaskDaysOffset(e.target.value)}
                  className="w-full text-[11px] border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
                >
                  <option value="0">Cùng ngày diễn ra (A)</option>
                  <option value="-1">Trước 1 ngày (A-1)</option>
                  <option value="-2">Trước 2 ngày (A-2)</option>
                  <option value="-3">Trước 3 ngày (A-3)</option>
                  <option value="-4">Trước 4 ngày (A-4)</option>
                  <option value="-5">Trước 5 ngày (A-5)</option>
                  <option value="-7">Trước 7 ngày (A-7)</option>
                  <option value="-10">Trước 10 ngày (A-10)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Độ ưu tiên</label>
                <select
                  value={tempSubTaskPriority}
                  onChange={(e) => setTempSubTaskPriority(e.target.value as any)}
                  className="w-full text-[11px] border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
                >
                  <option value="high">Cao</option>
                  <option value="medium">Vừa</option>
                  <option value="low">Thấp</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleAddTempSubTask}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold py-2 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>

            {/* Phân loại phụ */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Phân loại việc trên:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTempSubTaskCategory(cat)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition
                    ${tempSubTaskCategory === cat 
                      ? "bg-indigo-600 text-white border-indigo-600" 
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* LIST OF CURRENTLY ADDED TEMP SUBTASKS */}
            <div className="border-t border-slate-100 pt-2.5 max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
              {tempSubTasks.length === 0 ? (
                <div className="text-center py-3 text-[10px] text-slate-400 font-medium italic">
                  Chưa thêm công việc chuẩn bị nào cho sự kiện này.
                </div>
              ) : (
                tempSubTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between bg-slate-50 border border-slate-200/65 rounded-lg p-2 text-[10px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-extrabold text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded font-mono shrink-0">
                        A{t.offsetDays >= 0 ? `+${t.offsetDays}` : t.offsetDays}
                      </span>
                      <span className="font-bold text-slate-700 truncate">{t.title}</span>
                      <span className="text-[8px] font-bold bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded shrink-0">{t.category}</span>
                      {t.priority === "high" && (
                        <span className="text-[8px] font-extrabold bg-red-150 text-red-700 px-1 rounded">Gấp</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveTempSubTask(t.id, e)}
                      className="text-slate-400 hover:text-red-500 p-0.5 hover:bg-slate-200/50 rounded transition shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-2 pt-2 border-t border-slate-200/60">
            <button
              id="submit-event-btn"
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-xs cursor-pointer"
            >
              Lưu sự kiện chính & Lịch chuẩn bị ({tempSubTasks.length} việc)
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddEvent(false);
                setTempSubTasks([]);
              }}
              className="px-4 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Main Event Details Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeEvent ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-5">
            {/* Banner sự kiện đang chọn */}
            <div className="bg-gradient-to-br from-indigo-50/50 to-slate-50/50 border border-indigo-100/70 rounded-2xl p-4.5 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDisplayDate(activeEvent.date)} ({getVietnameseDayOfWeek(activeEvent.date)})
                  </span>
                  {isCompleted ? (
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      ĐÃ HOÀN THÀNH ✓
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      ĐANG TIẾN HÀNH
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-slate-800 mt-2 break-words leading-tight">{activeEvent.title}</h3>
                {activeEvent.description && (
                  <p className="text-xs text-slate-500 mt-1">{activeEvent.description}</p>
                )}
              </div>

              <div className="flex sm:flex-col items-end gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-indigo-100/40">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Tổng tiến độ</span>
                    <span className="text-xs font-mono font-extrabold text-slate-700">
                      {completedCount}/{totalCount} hoàn thành ({percent}%)
                    </span>
                  </div>
                  
                  {/* Circular/pill graphical representation */}
                  <div className="w-12 h-12 rounded-full border-4 border-slate-100 flex items-center justify-center font-mono font-bold text-xs text-indigo-600 relative shrink-0">
                    <div 
                      className="absolute inset-0 rounded-full border-4 border-indigo-500 transition-all duration-300"
                      style={{ 
                        clipPath: `polygon(50% 50%, 50% 0%, ${percent >= 25 ? "100% 0%" : "50% 0%"}, ${percent >= 50 ? "100% 100%" : percent >= 25 ? "100% 50%" : "50% 50%"}, ${percent >= 75 ? "0% 100%" : percent >= 50 ? "50% 100%" : "50% 50%"}, ${percent >= 100 ? "0% 0%" : percent >= 75 ? "0% 50%" : "50% 50%"}, 50% 50%)`,
                        opacity: percent > 0 ? 1 : 0
                      }}
                    />
                    <span className="relative z-10 text-slate-800">{percent}%</span>
                  </div>
                </div>

                <button
                  id={`delete-event-${activeEvent.id}`}
                  onClick={() => {
                    if (confirm("Bạn có chắc chắn muốn xóa sự kiện chính này và tất cả các việc chuẩn bị đính kèm?")) {
                      onDeleteEvent(activeEvent.id);
                      onSelectEventId(null);
                    }
                  }}
                  className="px-2.5 py-1 text-[10px] border border-red-200 hover:border-red-300 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg transition font-bold flex items-center gap-1 cursor-pointer w-full sm:w-auto justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa Sự Kiện</span>
                </button>
              </div>
            </div>

            {/* Layout nội dung việc phụ và Form thêm nhanh */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {/* Cột trái: Danh sách việc phụ (8/12 cols) */}
              <div className="md:col-span-8 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2.5 shrink-0">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Danh sách các việc chuẩn bị để Tổng Xong (A-x)
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 min-h-[220px]">
                  {sortedSubTasks.length === 0 ? (
                    <div className="h-full border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center bg-slate-50/20">
                      <CheckCircle className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                      <p className="text-xs text-slate-400 font-bold">Chưa có công việc chuẩn bị nào</p>
                      <p className="text-[10px] text-slate-400 max-w-[250px] mt-1">Sử dụng ô thêm nhanh bên phải để lên lịch các công việc chuẩn bị.</p>
                    </div>
                  ) : (
                    sortedSubTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`px-3.5 py-3 border rounded-xl bg-white flex items-center justify-between gap-3 hover:border-slate-300 hover:shadow-xs transition-all duration-200
                          ${task.completed ? "bg-slate-50/50 text-slate-400 border-slate-100" : "border-slate-200/80"}
                        `}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            id={`toggle-subtask-completed-${task.id}`}
                            onClick={() => onToggleSubTask(task.id)}
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200
                              ${task.completed
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 hover:border-indigo-500"
                              }
                            `}
                          >
                            {task.completed && <CheckSquare className="w-3.5 h-3.5 stroke-[3px]" />}
                          </button>

                          <div className="min-w-0">
                            <p className={`text-xs font-bold break-words leading-tight ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                Hạn: {formatDisplayDate(task.dueDate)} {task.offsetDays !== null && `(A${task.offsetDays >= 0 ? `+${task.offsetDays}` : task.offsetDays})`}
                              </span>
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase
                                ${task.completed 
                                  ? "bg-slate-100 text-slate-400" 
                                  : "bg-indigo-50 text-indigo-700"
                                }
                              `}>
                                {task.category}
                              </span>
                              {task.priority === "high" && !task.completed && (
                                <span className="text-[8px] font-extrabold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Gấp
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          id={`delete-subtask-${task.id}`}
                          onClick={() => onDeleteSubTask(task.id)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded-lg hover:bg-slate-50 transition cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cột phải: Form thêm việc chuẩn bị nhanh (4/12 cols) */}
              <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5 flex flex-col shrink-0">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  + Thêm việc chuẩn bị mới
                </h4>

                <form onSubmit={handleCreateSubTask} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nội dung công việc</label>
                    <input
                      type="text"
                      required
                      placeholder="Tên công việc cụ thể..."
                      value={subTaskTitle}
                      onChange={(e) => setSubTaskTitle(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 bg-slate-50/30 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thời hạn thực hiện</label>
                    <select
                      value={subTaskDaysOffset}
                      onChange={(e) => setSubTaskDaysOffset(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
                    >
                      <option value="0">Cùng ngày diễn ra (A)</option>
                      <option value="-1">Trước 1 ngày (A-1)</option>
                      <option value="-2">Trước 2 ngày (A-2)</option>
                      <option value="-3">Trước 3 ngày (A-3)</option>
                      <option value="-4">Trước 4 ngày (A-4)</option>
                      <option value="-5">Trước 5 ngày (A-5)</option>
                      <option value="-7">Trước 7 ngày (A-7)</option>
                      <option value="-10">Trước 10 ngày (A-10)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Độ ưu tiên</label>
                      <select
                        value={subTaskPriority}
                        onChange={(e) => setSubTaskPriority(e.target.value as any)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
                      >
                        <option value="high">Cao</option>
                        <option value="medium">Vừa</option>
                        <option value="low">Thấp</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân loại</label>
                      <select
                        value={subTaskCategory}
                        onChange={(e) => setSubTaskCategory(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lưu việc phụ</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 animate-pulse">
              <CheckSquare className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Chưa có sự kiện chính được chọn</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
              Vui lòng bấm chọn một **Sự kiện chính** dưới Lịch Tháng ở cột bên trái để quản lý danh sách công việc chuẩn bị chi tiết và theo dõi tiến độ tổng thể.
            </p>
            <div className="flex items-center gap-1 mt-4 text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
              <span>Bấm chọn ô sự kiện ở lịch bên trái</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
