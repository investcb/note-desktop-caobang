import React, { useState, useRef, useEffect } from "react";
import { MainEvent, SubTask } from "../types";
import { formatDateString, generateId, formatDisplayDate } from "../utils";
import { geminiChat, geminiParseDocument, geminiOcrText } from "../aiClient";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Clock,
  Sparkles, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  HelpCircle, 
  CheckCircle, 
  Plus, 
  AlertCircle, 
  FileUp,
  X,
  Upload,
  FileText,
  Trash2
} from "lucide-react";

interface CalendarWidgetProps {
  events: MainEvent[];
  subTasks: SubTask[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onAddEvent: (event: MainEvent) => void;
  onAddSubTask: (subTask: SubTask) => void;
  selectedEventId: string | null;
  onSelectEventId: (id: string | null) => void;
}

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  actionsApplied?: boolean;
  parsedEvents?: Array<{
    title: string;
    date: string;
    description: string;
    subTasks: Array<{
      title: string;
      dueDate: string;
      offsetDays: number;
      description: string;
      priority: "high" | "medium" | "low";
      category: string;
    }>;
  }>;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  events,
  subTasks,
  selectedDate,
  onSelectDate,
  onAddEvent,
  onAddSubTask,
  selectedEventId,
  onSelectEventId,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate || Date.now()));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lấy ngày đầu tiên trong tháng rơi vào thứ mấy (0 = Thứ 2, 6 = Chủ Nhật)
  const firstDayIndex = (() => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  })();

  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);
    onSelectDate(formatDateString(clickedDate));
  };

  // Kiểm tra xem một ngày cụ thể có sự kiện lớn hay việc phụ không
  const getDayStatus = (day: number) => {
    const dateStr = formatDateString(new Date(year, month, day));
    const hasMainEvent = events.some((e) => e.date === dateStr);
    const daySubTasks = subTasks.filter((t) => t.dueDate === dateStr);
    const hasSubTask = daySubTasks.length > 0;
    const allCompleted = hasSubTask && daySubTasks.every((t) => t.completed);

    return { hasMainEvent, hasSubTask, allCompleted };
  };

  const days = [];
  // Thêm các ô trống đầu tháng
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(<div key={`empty-${i}`} className="h-9" />);
  }

  // Thêm các ngày trong tháng
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = formatDateString(dateObj);
    const isSelected = dateStr === selectedDate;
    const isToday = formatDateString(new Date()) === dateStr;
    const { hasMainEvent, hasSubTask, allCompleted } = getDayStatus(d);

    days.push(
      <button
        id={`calendar-day-${dateStr}`}
        key={`day-${d}`}
        onClick={() => handleDayClick(d)}
        className={`relative h-9 w-full rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all duration-200 cursor-pointer
          ${isSelected 
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-150" 
            : isToday 
              ? "bg-indigo-55 text-indigo-700 border border-indigo-200/60" 
              : "hover:bg-slate-100/80 text-slate-700"
          }
        `}
      >
        <span>{d}</span>
        
        {/* Chỉ báo sự kiện nhỏ ở dưới ngày */}
        <div className="absolute bottom-0.5 flex gap-0.5 justify-center items-center">
          {hasMainEvent && (
            <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-red-500"}`} />
          )}
          {hasSubTask && (
            <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-indigo-200" : allCompleted ? "bg-green-500" : "bg-amber-500"}`} />
          )}
        </div>
      </button>
    );
  }

  // --- AI Trợ Lý Lập Lịch States ---
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState<string>("");
  
  // States for document import panel
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  // Dữ liệu tệp ảnh/PDF (base64 data URL) để AI đọc trực tiếp bằng OCR
  const [importFileData, setImportFileData] = useState<string | null>(null);
  const [importFileMime, setImportFileMime] = useState<string>("");
  const [loadingImport, setLoadingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedEventsPending, setParsedEventsPending] = useState<any[] | null>(null);
  const [editParsed, setEditParsed] = useState(false); // chế độ chỉnh sửa kết quả OCR

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    setInput("");
    setLoading(true);
    setAssistantStatus("Đang xử lý yêu cầu lập lịch...");

    try {
      const data = await geminiChat({
        message: textToSend,
        referenceDate: selectedDate,
        currentEvents: events,
        currentSubTasks: subTasks,
      });

      let actionsCount = 0;
      let createdTitles: string[] = [];
      if (data.actions && Array.isArray(data.actions)) {
        data.actions.forEach((act: any) => {
          const payload = act.payload;

          if (act.type === "CREATE_EVENT" && payload?.event) {
            const eventId = generateId();
            onAddEvent({
              id: eventId,
              title: payload.event.title,
              date: payload.event.date,
              description: payload.event.description || "",
              createdAt: new Date().toISOString(),
            });
            createdTitles.push(payload.event.title);
            actionsCount++;
          } else if (act.type === "CREATE_SUBTASK" && payload?.subTaskOnly) {
            onAddSubTask({
              id: generateId(),
              eventId: payload.subTaskOnly.eventId || "custom-task",
              title: payload.subTaskOnly.title,
              dueDate: payload.subTaskOnly.dueDate,
              offsetDays: null,
              description: payload.subTaskOnly.description || "",
              completed: false,
              priority: payload.subTaskOnly.priority || "medium",
              category: payload.subTaskOnly.category || "Chuẩn bị",
            });
            actionsCount++;
          } else if (act.type === "CREATE_EVENT_WITH_SUBTASKS" && payload?.event) {
            const eventId = generateId();
            onAddEvent({
              id: eventId,
              title: payload.event.title,
              date: payload.event.date,
              description: payload.event.description || "",
              createdAt: new Date().toISOString(),
            });
            createdTitles.push(payload.event.title);

            if (payload.subTasks && Array.isArray(payload.subTasks)) {
              payload.subTasks.forEach((st: any) => {
                onAddSubTask({
                  id: generateId(),
                  eventId,
                  title: st.title,
                  dueDate: st.dueDate,
                  offsetDays: st.offsetDays || null,
                  description: st.description || "",
                  completed: false,
                  priority: st.priority || "medium",
                  category: st.category || "Chuẩn bị",
                });
              });
            }
            actionsCount++;
          }
        });
      }

      if (actionsCount > 0) {
        setAssistantStatus(`Đã lập lịch thành công: ${createdTitles.join(", ") || "công việc chuẩn bị"}`);
      } else {
        setAssistantStatus(data.reply || "Tôi đã nhận được yêu cầu nhưng không bóc tách được lịch biểu mới.");
      }
    } catch (err: any) {
      console.error(err);
      setAssistantStatus(`Lỗi: ${err.message || "Không thể kết nối dịch vụ AI."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError(null);
    setImportFileData(null);
    setImportFileMime("");

    const name = file.name.toLowerCase();
    const isTxt = file.type === "text/plain" || name.endsWith(".txt");
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|bmp|heic|tiff?)$/.test(name);

    if (isTxt) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setImportText(event.target.result as string);
      };
      reader.readAsText(file);
      return;
    }

    if (isPdf || isImage) {
      // Đọc thành base64 để BƯỚC 1 gửi cho AI OCR ra text (người dùng sửa sau)
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImportFileData(dataUrl);
        setImportFileMime(file.type || (isPdf ? "application/pdf" : "image/*"));
        setImportText(""); // ô chữ sẽ được điền bằng kết quả OCR
      };
      reader.readAsDataURL(file);
      return;
    }

    setImportError(
      "Định dạng chưa hỗ trợ đọc trực tiếp. Vui lòng dùng ảnh (JPG/PNG), PDF, hoặc dán nội dung dạng chữ."
    );
  };

  // BƯỚC 1: OCR ảnh/PDF -> đổ text thô vào ô chữ để người dùng sửa.
  const handleOcrToText = async () => {
    if (!importFileData) return;

    setLoadingImport(true);
    setImportError(null);

    try {
      const data = await geminiOcrText({
        fileData: importFileData,
        mimeType: importFileMime,
        fileName: importFileName || "cong-van",
      });

      const text = (data.text || "").trim();
      if (!text || text === "(không có nội dung giao việc)") {
        throw new Error(
          "Không tìm thấy nội dung giao việc trong tệp. Thử ảnh rõ nét hơn hoặc dán nội dung thủ công."
        );
      }

      setImportText(text);
      // Đã có text -> chuyển sang luồng chỉnh sửa text, bỏ tệp đính kèm
      setImportFileData(null);
      setImportFileMime("");
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Đã xảy ra lỗi khi OCR tệp.");
    } finally {
      setLoadingImport(false);
    }
  };

  // BƯỚC 2: gửi text (đã sửa) cho AI để xếp việc thành lịch biểu.
  const handleAnalyzeDocument = async () => {
    if (!importText.trim()) {
      setImportError("Vui lòng OCR đọc chữ hoặc dán nội dung công văn trước.");
      return;
    }

    setLoadingImport(true);
    setImportError(null);

    try {
      const data = await geminiParseDocument({
        documentText: importText,
        referenceDate: selectedDate,
      });

      if (data.events && Array.isArray(data.events) && data.events.length > 0) {
        setParsedEventsPending(data.events);
        setEditParsed(false);
      } else {
        throw new Error(
          "Không nhận diện được sự kiện nào trong nội dung. Hãy kiểm tra/sửa lại phần chữ."
        );
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Đã xảy ra lỗi khi phân tích công văn.");
    } finally {
      setLoadingImport(false);
    }
  };

  // --- Chỉnh sửa kết quả OCR trước khi lưu ---
  const updateParsedEvent = (eIdx: number, patch: any) => {
    setParsedEventsPending((prev) =>
      prev ? prev.map((e, i) => (i === eIdx ? { ...e, ...patch } : e)) : prev
    );
  };

  const removeParsedEvent = (eIdx: number) => {
    setParsedEventsPending((prev) =>
      prev ? prev.filter((_, i) => i !== eIdx) : prev
    );
  };

  const updateParsedSubTask = (eIdx: number, sIdx: number, patch: any) => {
    setParsedEventsPending((prev) =>
      prev
        ? prev.map((e, i) =>
            i === eIdx
              ? {
                  ...e,
                  subTasks: (e.subTasks || []).map((s: any, j: number) =>
                    j === sIdx ? { ...s, ...patch } : s
                  ),
                }
              : e
          )
        : prev
    );
  };

  const removeParsedSubTask = (eIdx: number, sIdx: number) => {
    setParsedEventsPending((prev) =>
      prev
        ? prev.map((e, i) =>
            i === eIdx
              ? {
                  ...e,
                  subTasks: (e.subTasks || []).filter(
                    (_: any, j: number) => j !== sIdx
                  ),
                }
              : e
          )
        : prev
    );
  };

  const addParsedSubTask = (eIdx: number) => {
    setParsedEventsPending((prev) =>
      prev
        ? prev.map((e, i) =>
            i === eIdx
              ? {
                  ...e,
                  subTasks: [
                    ...(e.subTasks || []),
                    {
                      title: "Việc chuẩn bị mới",
                      dueDate: e.date,
                      offsetDays: null,
                      description: "",
                      priority: "medium",
                      category: "Chuẩn bị",
                    },
                  ],
                }
              : e
          )
        : prev
    );
  };

  const handleApplyImportedEventsDirectly = (eventsList: any[]) => {
    eventsList.forEach((e) => {
      const eventId = generateId();
      onAddEvent({
        id: eventId,
        title: e.title,
        date: e.date,
        description: e.description || "",
        createdAt: new Date().toISOString(),
      });

      if (e.subTasks && Array.isArray(e.subTasks)) {
        e.subTasks.forEach((st: any) => {
          onAddSubTask({
            id: generateId(),
            eventId,
            title: st.title,
            dueDate: st.dueDate,
            offsetDays: st.offsetDays !== undefined ? st.offsetDays : null,
            description: st.description || "",
            completed: false,
            priority: st.priority || "medium",
            category: st.category || "Chuẩn bị",
          });
        });
      }
    });

    setAssistantStatus(`Đã trích xuất và lưu thành công ${eventsList.length} sự kiện cùng các việc chuẩn bị vào lịch trình!`);
    setShowImportPanel(false);
    setParsedEventsPending(null);
    setEditParsed(false);
    setImportText("");
    setImportFileName(null);
    setImportFileData(null);
    setImportFileMime("");
  };

  const dayEvents = events.filter((e) => e.date === selectedDate);

  return (
    <div id="calendar-widget-container" className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm flex flex-col h-full relative overflow-hidden">
      
      {/* Slide-over document parser overlay inside calendar widget */}
      {showImportPanel && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xs p-4 flex flex-col z-20 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">Trích lịch công văn hành chính</span>
            </div>
            <button 
              onClick={() => {
                setShowImportPanel(false);
                setImportText("");
                setImportFileName(null);
                setImportError(null);
              }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded hover:bg-slate-50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {parsedEventsPending ? (
            <div className="flex-1 flex flex-col min-h-0">
              <span className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wider mb-2 block">
                🔍 Đã trích xuất {parsedEventsPending.length} sự kiện:
              </span>
              {editParsed && (
                <p className="text-[10px] text-slate-500 mb-2 -mt-1">
                  Sửa trực tiếp nội dung, xóa việc không cần, hoặc thêm việc mới. Xong bấm <b>Duyệt &amp; Lưu</b>.
                </p>
              )}
              <div className="flex-1 overflow-y-auto space-y-3 bg-slate-50 border border-slate-200/60 rounded-xl p-3 max-h-[300px]">
                {parsedEventsPending.map((evt, eIdx) =>
                  editParsed ? (
                    // ---- Chế độ CHỈNH SỬA ----
                    <div key={eIdx} className="border border-indigo-100 bg-white rounded-lg p-2.5 space-y-2 shadow-2xs">
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1 space-y-1.5">
                          <input
                            value={evt.title || ""}
                            onChange={(e) => updateParsedEvent(eIdx, { title: e.target.value })}
                            placeholder="Tên sự kiện chính"
                            className="w-full text-[11px] font-bold bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                          <input
                            type="date"
                            value={evt.date || ""}
                            onChange={(e) => updateParsedEvent(eIdx, { date: e.target.value })}
                            className="text-[11px] font-mono bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                          <textarea
                            value={evt.description || ""}
                            onChange={(e) => updateParsedEvent(eIdx, { description: e.target.value })}
                            placeholder="Mô tả / bối cảnh (tùy chọn)"
                            rows={2}
                            className="w-full text-[10px] bg-white border border-slate-200 rounded px-1.5 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeParsedEvent(eIdx)}
                          title="Xóa cả sự kiện này"
                          className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="pt-1 pl-2 border-l-2 border-indigo-200 space-y-1.5">
                        <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 block">
                          Việc chuẩn bị:
                        </span>
                        {(evt.subTasks || []).map((st: any, sIdx: number) => (
                          <div key={sIdx} className="bg-slate-50 border border-slate-100 rounded p-1.5 space-y-1">
                            <div className="flex items-center gap-1">
                              <input
                                value={st.title || ""}
                                onChange={(e) => updateParsedSubTask(eIdx, sIdx, { title: e.target.value })}
                                placeholder="Nội dung việc chuẩn bị"
                                className="flex-1 text-[10px] font-semibold bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              />
                              <button
                                type="button"
                                onClick={() => removeParsedSubTask(eIdx, sIdx)}
                                title="Xóa việc này"
                                className="text-rose-400 hover:text-rose-600 p-0.5 shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex gap-1">
                              <input
                                type="date"
                                value={st.dueDate || ""}
                                onChange={(e) => updateParsedSubTask(eIdx, sIdx, { dueDate: e.target.value, offsetDays: null })}
                                className="flex-1 text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              />
                              <select
                                value={st.priority || "medium"}
                                onChange={(e) => updateParsedSubTask(eIdx, sIdx, { priority: e.target.value })}
                                className="text-[10px] bg-white border border-slate-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              >
                                <option value="high">Ưu tiên cao</option>
                                <option value="medium">Trung bình</option>
                                <option value="low">Thấp</option>
                              </select>
                            </div>
                            <input
                              value={st.description || ""}
                              onChange={(e) => updateParsedSubTask(eIdx, sIdx, { description: e.target.value })}
                              placeholder="Chi tiết cụ thể hơn (tùy chọn)"
                              className="w-full text-[10px] bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addParsedSubTask(eIdx)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 mt-1"
                        >
                          <Plus className="w-3 h-3" /> Thêm việc chuẩn bị
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ---- Chế độ XEM ----
                    <div key={eIdx} className="border border-indigo-100 bg-white rounded-lg p-2.5 space-y-1.5 shadow-2xs">
                      <div className="font-bold text-xs text-indigo-950 flex items-center justify-between gap-1">
                        <span className="break-words">📅 {evt.title}</span>
                        <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono shrink-0">
                          {evt.date}
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-[10px] text-slate-500 italic">{evt.description}</p>
                      )}
                      {evt.subTasks && evt.subTasks.length > 0 && (
                        <div className="pt-1.5 pl-2 border-l-2 border-indigo-200 space-y-1">
                          <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 block">Việc chuẩn bị (A-x):</span>
                          {evt.subTasks.map((st: any, sIdx: number) => (
                            <div key={sIdx} className="text-[10px] text-slate-700 flex justify-between items-center gap-1">
                              <span className="font-semibold break-words">• {st.title}</span>
                              <span className="text-[8px] font-mono text-slate-500 shrink-0">Hạn: {st.dueDate}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyImportedEventsDirectly(parsedEventsPending)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Duyệt & Lưu lịch trình</span>
                </button>
                {editParsed ? (
                  <button
                    type="button"
                    onClick={() => setEditParsed(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Xong
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditParsed(true)}
                    className="px-4 py-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Sửa lại
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {importFileData && (
                <div className="mb-2 p-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-[10px] flex items-start gap-1">
                  <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>
                    Đã đính kèm <b>{importFileName}</b>. Bấm <b>“Đọc nội dung giao việc”</b> —
                    AI sẽ đọc cả văn bản nhưng chỉ lấy phần giao việc ra ô bên dưới; sửa cho đúng
                    rồi bấm “Phân tích &amp; xếp việc”.
                  </span>
                </div>
              )}
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Dán nội dung công văn, hoặc tải ảnh/PDF rồi bấm “Đọc nội dung giao việc” để lấy phần giao việc vào đây. Sửa lại cho đúng rồi bấm “Phân tích & xếp việc”."
                className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none font-sans text-slate-700 leading-relaxed"
              />

              {importError && (
                <div className="mt-2 p-1.5 bg-red-50 border border-red-100 rounded-lg text-red-700 text-[10px] flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.pdf,image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 border border-slate-200 hover:bg-slate-50 rounded text-[10px] font-bold text-slate-600 cursor-pointer transition"
                >
                  <Upload className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{importFileName ? importFileName : "Tải ảnh/PDF/TXT..."}</span>
                </button>

                {importFileData ? (
                  // BƯỚC 1: OCR ảnh/PDF ra chữ
                  <button
                    type="button"
                    onClick={handleOcrToText}
                    disabled={loadingImport}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-[10px] font-bold px-3 py-1.5 rounded transition shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    {loadingImport ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Đang đọc nội dung giao việc...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3" />
                        <span>Đọc nội dung giao việc (bước 1)</span>
                      </>
                    )}
                  </button>
                ) : (
                  // BƯỚC 2: gửi text đã sửa cho AI xếp việc
                  <button
                    type="button"
                    onClick={handleAnalyzeDocument}
                    disabled={loadingImport || !importText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-[10px] font-bold px-3 py-1.5 rounded transition shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    {loadingImport ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Đang xếp việc...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>Phân tích &amp; xếp việc</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Header Lịch */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4.5 h-4.5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800">
            {monthNames[month]} {year}
          </h2>
        </div>
        <div className="flex gap-1">
          <button
            id="prev-month-btn"
            onClick={handlePrevMonth}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            id="next-month-btn"
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Ngày Lịch */}
      <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5 text-center mb-2.5">
        {weekDays.map((wd) => (
          <div key={wd} className="text-[10px] font-bold text-slate-400 py-0.5">
            {wd}
          </div>
        ))}
        {days}
      </div>

      <hr className="border-slate-100 my-2" />

      {/* Sự kiện chính trong ngày */}
      <div className="my-2.5 flex-1 min-h-[140px] max-h-[180px] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Sự kiện chính ngày {formatDisplayDate(selectedDate)}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 font-mono">
            {dayEvents.length} sự kiện
          </span>
        </div>

        {dayEvents.length === 0 ? (
          <div className="flex-1 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-3 text-center bg-slate-50/40">
            <CalendarIcon className="w-5 h-5 text-slate-300 stroke-[1.5] mb-1" />
            <p className="text-[10px] text-slate-400 font-medium">Chưa có sự kiện chính cho ngày này.</p>
            <p className="text-[9px] text-slate-400">Hãy dùng Chat AI ở dưới hoặc Import Công Văn để lên lịch.</p>
          </div>
        ) : (
          <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5">
            {dayEvents.map((event) => {
              const isSelected = event.id === selectedEventId;
              const eventSubs = subTasks.filter((t) => t.eventId === event.id);
              const completedCount = eventSubs.filter((t) => t.completed).length;
              const totalCount = eventSubs.length;
              const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <button
                  key={event.id}
                  onClick={() => onSelectEventId(event.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 flex flex-col gap-1.5 cursor-pointer
                    ${isSelected 
                      ? "bg-indigo-50/70 border-indigo-200 ring-1 ring-indigo-100" 
                      : "bg-white hover:bg-slate-50/60 border-slate-200/80"
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-bold leading-tight ${isSelected ? "text-indigo-900" : "text-slate-800"}`}>
                      {event.title}
                    </span>
                    {totalCount > 0 && (
                      <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 font-mono
                        ${percent === 100 
                          ? "bg-emerald-100 text-emerald-800" 
                          : "bg-slate-100 text-slate-600"
                        }
                      `}>
                        {completedCount}/{totalCount} việc
                      </span>
                    )}
                  </div>
                  
                  {/* Progress bar inside event card */}
                  {totalCount > 0 && (
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${percent === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <hr className="border-slate-100 my-2" />

      {/* Trợ lý AI Mini Chat Panel */}
      <div className="flex flex-col gap-2 pt-1.5 shrink-0">
        {loading && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold text-indigo-600 animate-pulse flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Đang lập lịch...
            </span>
          </div>
        )}

        {/* Compact status notification box */}
        {assistantStatus && (
          <div className="text-[10px] text-slate-600 bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-start gap-2">
            <Bot className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <span className="leading-normal font-medium">{assistantStatus}</span>
          </div>
        )}

        {/* Input Message Form with integrated Import button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-1.5 items-center"
        >
          {/* Quick Import Button */}
          <button
            type="button"
            onClick={() => setShowImportPanel(true)}
            title="Import công văn chính thức"
            className="p-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 text-blue-600 rounded-xl transition cursor-pointer shrink-0"
          >
            <FileUp className="w-4 h-4" />
          </button>

          {/* Mini input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Yêu cầu lập lịch nhanh hoặc dán công văn..."
            className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl px-2.5 py-2 text-[11px] font-medium text-slate-700 transition-all placeholder:text-slate-400"
          />

          {/* Send */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white p-2 rounded-xl transition cursor-pointer shadow-xs shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

    </div>
  );
};
