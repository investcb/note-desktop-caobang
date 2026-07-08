use crate::config::load_settings;
use serde_json::{json, Value};
use tauri::AppHandle;

const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

/// Một số model bọc JSON trong ```json ... ``` — cắt bỏ trước khi parse.
fn extract_json(text: &str) -> String {
    let trimmed = text.trim();
    let mut body = trimmed.to_string();
    if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        let after = after.strip_prefix("json").unwrap_or(after);
        if let Some(end) = after.find("```") {
            body = after[..end].trim().to_string();
        }
    }
    // Cắt gọn về đúng object JSON ngoài cùng nếu còn thừa ký tự.
    if let (Some(f), Some(l)) = (body.find('{'), body.rfind('}')) {
        if l > f {
            body = body[f..=l].to_string();
        }
    }
    body
}

/// Gửi 1 request tới OpenRouter, trả về chuỗi nội dung thô của model.
async fn send(app: &AppHandle, mut body: Value) -> Result<String, String> {
    let settings = load_settings(app);
    let api_key = settings.openrouter_api_key.trim().to_string();
    if api_key.is_empty() {
        return Err(
            "Chưa cấu hình API Key OpenRouter. Vui lòng nhập khóa trong Cài đặt.".to_string(),
        );
    }
    body["model"] = json!(settings.openrouter_model);

    let client = reqwest::Client::new();
    let resp = client
        .post(OPENROUTER_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://autowork.local/ghi-chu-chuan")
        .header("X-Title", "Ghi Chu Chuan")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối OpenRouter: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        let snippet: String = txt.chars().take(300).collect();
        return Err(format!("OpenRouter HTTP {}: {}", status, snippet));
    }

    let data: Value = resp
        .json()
        .await
        .map_err(|e| format!("Lỗi đọc phản hồi JSON: {}", e))?;

    let content = data
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("");
    Ok(content.to_string())
}

/// Gọi và yêu cầu JSON, trả về Value đã parse.
async fn call_json(
    app: &AppHandle,
    messages: Value,
    plugins: Option<Value>,
) -> Result<Value, String> {
    let mut body = json!({
        "messages": messages,
        "response_format": { "type": "json_object" },
        "temperature": 0.4
    });
    if let Some(p) = plugins {
        body["plugins"] = p;
    }
    let content = send(app, body).await?;
    let cleaned = extract_json(&content);
    serde_json::from_str::<Value>(&cleaned)
        .map_err(|e| format!("Không phân tích được JSON từ AI: {}", e))
}

/// Gọi và trả về text thô (dùng cho OCR).
async fn call_raw(
    app: &AppHandle,
    messages: Value,
    plugins: Option<Value>,
) -> Result<String, String> {
    let mut body = json!({
        "messages": messages,
        "temperature": 0.3
    });
    if let Some(p) = plugins {
        body["plugins"] = p;
    }
    let content = send(app, body).await?;
    Ok(content.trim().to_string())
}

const EVENTS_JSON_SHAPE: &str = r#"{
  "events": [
    {
      "title": "string",
      "date": "YYYY-MM-DD",
      "description": "string",
      "subTasks": [
        {
          "title": "string",
          "dueDate": "YYYY-MM-DD",
          "offsetDays": -3,
          "description": "string",
          "priority": "high",
          "category": "Đôn đốc"
        }
      ]
    }
  ]
}"#;

// ----------------------------------------------------------------------------
// Lệnh 1: phân tích văn bản (text) -> lịch biểu
// ----------------------------------------------------------------------------
#[tauri::command]
pub async fn ai_parse_document(
    app: AppHandle,
    document_text: String,
    reference_date: String,
) -> Result<Value, String> {
    let reference = if reference_date.trim().is_empty() {
        "2026-07-07".to_string()
    } else {
        reference_date
    };

    let prompt = format!(
        r#"Bạn là một trợ lý ảo phân tích văn bản hành chính chuyên nghiệp.
Dựa trên nội dung công văn/văn bản dưới đây và ngày tham chiếu hiện tại là: {reference} (dùng để quy đổi các mốc ngày tương đối):

NỘI DUNG VĂN BẢN:
"{document_text}"

Yêu cầu:
1. Phát hiện các sự kiện chính (cuộc họp, hội nghị, hạn nộp lớn) với ngày định dạng YYYY-MM-DD.
2. Phát hiện các việc chuẩn bị/đôn đốc/báo cáo/hậu cần liên quan; tính offsetDays (số ngày lệch âm so với sự kiện chính), category ("Đôn đốc"|"Báo cáo"|"Hậu cần"|"Chuẩn bị"|"Khác"), priority ("high"|"medium"|"low").

CHỈ trả về JSON hợp lệ (không kèm giải thích, không markdown) theo đúng cấu trúc:
{shape}"#,
        reference = reference,
        document_text = document_text,
        shape = EVENTS_JSON_SHAPE
    );

    let messages = json!([{ "role": "user", "content": prompt }]);
    let v = call_json(&app, messages, None).await?;
    Ok(json!({
        "events": v.get("events").cloned().unwrap_or_else(|| json!([]))
    }))
}

// ----------------------------------------------------------------------------
// Lệnh 2: trò chuyện lập lịch
// ----------------------------------------------------------------------------
#[tauri::command]
pub async fn ai_chat(
    app: AppHandle,
    message: String,
    reference_date: String,
    current_events: Value,
    current_subtasks: Value,
) -> Result<Value, String> {
    let reference = if reference_date.trim().is_empty() {
        "2026-07-07".to_string()
    } else {
        reference_date
    };

    let prompt = format!(
        r#"Bạn là một Trợ lý Lập lịch & Nhắc việc văn phòng thông minh.
Lắng nghe yêu cầu bằng tiếng Việt, trò chuyện thân thiện và chuyển thành các tác vụ lập lịch cụ thể.

Ngày hiện tại (tham chiếu): {reference} (dùng để tính 'thứ Sáu tới', '15h00 hàng tuần', v.v.).

Thông tin lịch trình hiện tại:
- Lịch hiện có: {events}
- Việc phụ hiện có: {subs}

Yêu cầu người dùng: "{message}"

Hãy phân tích:
1. Nếu là việc định kỳ, tạo khoảng 4 sự kiện cho 4 tuần liên tiếp tiếp theo.
2. Nếu là việc thường, xác định ngày chính xác và tạo đầu việc tương ứng.

CHỈ trả về JSON hợp lệ (không kèm giải thích, không markdown) theo đúng cấu trúc:
{{
  "reply": "câu trả lời tiếng Việt thân thiện",
  "actions": [
    {{
      "type": "CREATE_EVENT | CREATE_SUBTASK | CREATE_EVENT_WITH_SUBTASKS",
      "payload": {{
        "event": {{ "title": "string", "date": "YYYY-MM-DD", "description": "string" }},
        "subTasks": [
          {{ "title": "string", "dueDate": "YYYY-MM-DD", "offsetDays": -2, "description": "string", "priority": "high", "category": "Chuẩn bị" }}
        ],
        "subTaskOnly": {{ "title": "string", "dueDate": "YYYY-MM-DD", "priority": "medium", "category": "Chuẩn bị", "description": "string", "eventId": "" }}
      }}
    }}
  ]
}}
Quy tắc: CREATE_EVENT_WITH_SUBTASKS dùng "event"+"subTasks"; CREATE_EVENT chỉ dùng "event"; CREATE_SUBTASK chỉ dùng "subTaskOnly"."#,
        reference = reference,
        events = current_events.to_string(),
        subs = current_subtasks.to_string(),
        message = message
    );

    let messages = json!([{ "role": "user", "content": prompt }]);
    let v = call_json(&app, messages, None).await?;
    Ok(json!({
        "reply": v.get("reply").cloned().unwrap_or_else(|| json!("")),
        "actions": v.get("actions").cloned().unwrap_or_else(|| json!([]))
    }))
}

// ----------------------------------------------------------------------------
// Lệnh 3: OCR ảnh/PDF -> chỉ lấy NỘI DUNG GIAO VIỆC (text thô để người dùng sửa)
// ----------------------------------------------------------------------------
#[tauri::command]
pub async fn ai_ocr_text(
    app: AppHandle,
    file_data: String,
    mime_type: String,
    file_name: String,
) -> Result<Value, String> {
    let is_pdf = mime_type.contains("pdf") || file_name.to_lowercase().ends_with(".pdf");

    let prompt = r#"Bạn là công cụ đọc văn bản hành chính tiếng Việt bằng thị giác (Vision OCR).

Hãy đọc TOÀN BỘ tệp công văn/văn bản đính kèm (ảnh hoặc bản scan CÓ DẤU), NHƯNG chỉ TRÍCH RA phần NỘI DUNG GIAO VIỆC:
- Các nhiệm vụ, yêu cầu, chỉ đạo được giao cho cơ quan/đơn vị/cá nhân thực hiện.
- Đơn vị/người chịu trách nhiệm thực hiện (nếu có nêu).
- Thời hạn, mốc thời gian gắn với từng việc.
- Sự kiện chính liên quan (cuộc họp/hội nghị và ngày tổ chức) nếu có.

BỎ QUA: quốc hiệu - tiêu ngữ, nơi nhận, phần "Kính gửi", các căn cứ pháp lý, lời chào, nơi ký, chức danh người ký, con dấu.

Cách trả về:
- Giữ NGUYÊN VĂN phần nội dung giao việc, mỗi việc trên một dòng/đoạn riêng.
- Có thể giữ 1 dòng ngắn số/trích yếu ở đầu để làm bối cảnh.
- KHÔNG tóm tắt, KHÔNG bình luận, KHÔNG dùng markdown.
- Nếu không có nội dung giao việc, trả về đúng chữ: (không có nội dung giao việc)"#;

    let mut content = vec![json!({ "type": "text", "text": prompt })];
    let mut plugins: Option<Value> = None;

    if is_pdf {
        content.push(json!({
            "type": "file",
            "file": { "filename": file_name, "file_data": file_data }
        }));
        plugins = Some(json!([{ "id": "file-parser", "pdf": { "engine": "native" } }]));
    } else {
        content.push(json!({
            "type": "image_url",
            "image_url": { "url": file_data }
        }));
    }

    let messages = json!([{ "role": "user", "content": content }]);
    let text = call_raw(&app, messages, plugins).await?;
    Ok(json!({ "text": text }))
}
