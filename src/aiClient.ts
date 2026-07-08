// Lớp trung gian gọi AI.
// - Desktop Tauri: gọi lệnh Rust qua invoke.
// - Desktop Electron (bản cũ): qua window.electronAPI.
// - Web (dev/browser): fallback REST /api/gemini/*.

type AnyRecord = Record<string, any>;

const w: any = typeof window !== "undefined" ? window : {};
const tauri: any = w.__TAURI__;
const electronAPI: any = w.electronAPI;

function tauriInvoke(cmd: string, args: AnyRecord): Promise<any> {
  return tauri.core.invoke(cmd, args);
}

async function viaFetch(pathName: string, body: AnyRecord): Promise<AnyRecord> {
  const response = await fetch(pathName, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Yêu cầu không thành công.");
  }
  return data;
}

function ensureNoError(data: AnyRecord): AnyRecord {
  if (data && data.error) throw new Error(data.error);
  return data;
}

export async function geminiChat(payload: {
  message: string;
  referenceDate: string;
  currentEvents: any[];
  currentSubTasks: any[];
}): Promise<AnyRecord> {
  if (tauri?.core?.invoke) {
    return await tauriInvoke("ai_chat", {
      message: payload.message,
      referenceDate: payload.referenceDate,
      currentEvents: payload.currentEvents,
      currentSubtasks: payload.currentSubTasks,
    });
  }
  if (electronAPI?.geminiChat) {
    return ensureNoError(await electronAPI.geminiChat(payload));
  }
  return viaFetch("/api/gemini/chat", payload);
}

export async function geminiParseDocument(payload: {
  documentText: string;
  referenceDate: string;
}): Promise<AnyRecord> {
  if (tauri?.core?.invoke) {
    return await tauriInvoke("ai_parse_document", {
      documentText: payload.documentText,
      referenceDate: payload.referenceDate,
    });
  }
  if (electronAPI?.geminiParseDocument) {
    return ensureNoError(await electronAPI.geminiParseDocument(payload));
  }
  return viaFetch("/api/gemini/parse-document", payload);
}

// Bước 1: OCR ảnh/PDF -> trả về text thô (chỉ nội dung giao việc).
export async function geminiOcrText(payload: {
  fileData: string; // data URL base64
  mimeType: string;
  fileName: string;
}): Promise<AnyRecord> {
  if (tauri?.core?.invoke) {
    return await tauriInvoke("ai_ocr_text", {
      fileData: payload.fileData,
      mimeType: payload.mimeType,
      fileName: payload.fileName,
    });
  }
  if (electronAPI?.geminiOcrText) {
    return ensureNoError(await electronAPI.geminiOcrText(payload));
  }
  return viaFetch("/api/gemini/ocr-text", payload);
}
