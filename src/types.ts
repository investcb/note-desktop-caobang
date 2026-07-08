export interface MainEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  description: string;
  createdAt: string;
}

export interface SubTask {
  id: string;
  eventId: string; // References MainEvent.id
  title: string;
  dueDate: string; // YYYY-MM-DD
  offsetDays: number | null; // null if custom date, negative integer if rule/AI based
  description: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
  category: string; // "Đôn đốc" | "Báo cáo" | "Hậu cần" | "Chuẩn bị" | "Khác"
}

export interface WorkflowRule {
  id: string;
  name: string; // Tên luật
  triggerKeyword: string; // Từ khóa kích hoạt trong tiêu đề sự kiện (không phân biệt hoa thường)
  offsetDays: number; // Ví dụ: -3 (3 ngày trước)
  subTaskTitle: string; // Tiêu đề việc phụ tự động tạo
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
  isActive: boolean;
}

export interface Wallpaper {
  id: string;
  name: string;
  cssClass: string;
}
