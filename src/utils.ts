import { MainEvent, SubTask, WorkflowRule } from "./types";

// Trả về ngày theo định dạng YYYY-MM-DD từ đối tượng Date
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Cộng/trừ số ngày từ một ngày định dạng YYYY-MM-DD
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

// Lấy thứ trong tuần tiếng Việt
export function getVietnameseDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  const days = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];
  return days[date.getDay()];
}

// Định dạng ngày hiển thị đẹp: "Thứ Hai, 15/07/2026"
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const dayOfWeek = getVietnameseDayOfWeek(dateStr);
  return `${dayOfWeek}, ${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Danh sách quy luật tự động hóa mẫu
export const DEFAULT_RULES: WorkflowRule[] = [
  {
    id: "rule-1",
    name: "Đôn đốc giải ngân trước thứ Hai",
    triggerKeyword: "giải ngân",
    offsetDays: -3, // Nếu họp thứ 2, trừ 3 ngày là thứ 6 tuần trước
    subTaskTitle: "Đôn đốc các đơn vị chuẩn bị báo cáo giải ngân",
    description: "Nhắc nhở và đôn đốc các phòng ban gửi báo cáo giải ngân đúng hạn để kịp tổng hợp đầu tuần.",
    priority: "high",
    category: "Đôn đốc",
    isActive: true,
  },
  {
    id: "rule-2",
    name: "Bài phát biểu Giám đốc trước cuộc họp",
    triggerKeyword: "họp",
    offsetDays: -2, // Trước họp 2 ngày
    subTaskTitle: "Hoàn thành bài phát biểu của Giám đốc",
    description: "Dự thảo nội dung, trình Giám đốc duyệt bài phát biểu khai mạc hoặc chỉ đạo cuộc họp.",
    priority: "high",
    category: "Báo cáo",
    isActive: true,
  },
  {
    id: "rule-3",
    name: "Hậu cần tài liệu cuộc họp",
    triggerKeyword: "họp",
    offsetDays: -1, // Trước họp 1 ngày
    subTaskTitle: "Chuẩn bị phòng họp, tài liệu và trà nước",
    description: "In tài liệu phát tay, kiểm tra mic, máy chiếu và chuẩn bị nước uống cho đại biểu.",
    priority: "medium",
    category: "Hậu cần",
    isActive: true,
  },
  {
    id: "rule-4",
    name: "Gửi thư mời họp",
    triggerKeyword: "họp",
    offsetDays: -4, // Trước họp 4 ngày
    subTaskTitle: "Phát hành thư mời và tài liệu kèm theo",
    description: "Gửi thư mời họp chính thức đến các thành viên tham dự kèm theo tài liệu dự thảo.",
    priority: "medium",
    category: "Chuẩn bị",
    isActive: true,
  },
];

// Hàm tự động áp dụng các quy luật kích hoạt lên một sự kiện chính mới
export function generateSubTasksFromRules(
  event: MainEvent,
  rules: WorkflowRule[]
): SubTask[] {
  const generated: SubTask[] = [];
  const eventTitleLower = event.title.toLowerCase();

  rules.forEach((rule) => {
    if (!rule.isActive) return;

    // Kiểm tra từ khóa kích hoạt có nằm trong tiêu đề sự kiện không
    if (eventTitleLower.includes(rule.triggerKeyword.toLowerCase())) {
      const calculatedDueDate = addDays(event.date, rule.offsetDays);

      generated.push({
        id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventId: event.id,
        title: rule.subTaskTitle,
        dueDate: calculatedDueDate,
        offsetDays: rule.offsetDays,
        description: rule.description,
        completed: false,
        priority: rule.priority,
        category: rule.category,
      });
    }
  });

  return generated;
}

// Sinh ID ngẫu nhiên
export function generateId(): string {
  return "id-" + Math.random().toString(36).substr(2, 9);
}
