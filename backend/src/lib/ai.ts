import { env } from "../config/env.js";

export type GeneratedQuestion = {
  content: string;
  difficulty: string;
  answers: Array<{
    content: string;
    isCorrect: boolean;
  }>;
};

function extractJsonArray(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("[");
  if (start < 0) {
    throw new Error("AI không trả về JSON array.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") inString = true;
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, i + 1);
      }
    }
  }

  throw new Error("AI trả về JSON không hoàn chỉnh.");
}

export async function generateQuestionsWithGemini(prompt: string): Promise<GeneratedQuestion[]> {
  if (!env.GEMINI_API_KEYS) {
    throw new Error("Thiếu GEMINI_API_KEYS.");
  }

  const apiKeys = env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
  if (!apiKeys.length) {
    throw new Error("Không tìm thấy cấu hình API keys hợp lệ.");
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Hãy tạo danh sách câu hỏi trắc nghiệm bằng tiếng Việt. " +
              "Trả về DUY NHẤT một JSON array, mỗi phần tử có dạng {" +
              "\"content\": string, \"difficulty\": \"DE\" | \"TB\" | \"KHO\", " +
              "\"answers\": [{\"content\": string, \"isCorrect\": boolean}, ...]}. " +
              "Mỗi câu hỏi phải có đúng 4 đáp án, chỉ 1 đáp án đúng. " +
              "Nội dung yêu cầu: " +
              prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.5,
      topP: 0.9,
      responseMimeType: "application/json"
    }
  };

  let lastError: Error | null = null;
  const models = Array.from(new Set([env.GEMINI_MODEL, "gemini-1.5-pro", "gemini-1.5-flash-latest"]));

  for (const apiKey of apiKeys) {
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
          }
        );

        const payload = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
          error?: { message?: string };
        };

        if (!response.ok) {
          throw new Error(payload.error?.message || `Gemini trả về HTTP ${response.status}.`);
        }

        const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = JSON.parse(extractJsonArray(text)) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("AI trả về dữ liệu không hợp lệ.");
        }

        const parsedQuestions = parsed as GeneratedQuestion[];
        
        // Trộn ngẫu nhiên vị trí các đáp án để tránh AI luôn xếp đáp án đúng ở một vị trí cố định
        for (const q of parsedQuestions) {
          if (Array.isArray(q.answers)) {
            // Fisher-Yates shuffle
            for (let i = q.answers.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [q.answers[i], q.answers[j]] = [q.answers[j], q.answers[i]];
            }
          }
        }

        return parsedQuestions;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`Lỗi tạo đề với key ${apiKey.substring(0, 8)}... model ${model}:`, lastError.message);
      }
    }
  }

  throw lastError || new Error("Tất cả API keys và models đều không khả dụng.");
}

export async function generateInsightReportWithGemini(statsData: string): Promise<string> {
  if (!env.GEMINI_API_KEYS) {
    throw new Error("Thiếu GEMINI_API_KEYS.");
  }

  const apiKeys = env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
  if (!apiKeys.length) {
    throw new Error("Không tìm thấy cấu hình API keys hợp lệ.");
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Bạn là một Chuyên gia sư phạm phân tích dữ liệu trắc nghiệm. Dưới đây là dữ liệu thống kê về các câu hỏi mà học sinh thường làm sai nhiều nhất trong một bộ đề thi.\n\n" +
              "DỮ LIỆU THỐNG KÊ:\n" + statsData + "\n\n" +
              "YÊU CẦU BÁO CÁO:\n" +
              "Hãy viết một báo cáo phân tích ngắn gọn, chuyên nghiệp bằng Markdown (có sử dụng heading, bullet points, in đậm).\n" +
              "Báo cáo cần có 3 phần chính:\n" +
              "1. **Tổng quan vấn đề**: Đánh giá sơ bộ xem học sinh đang hổng kiến thức ở mảng nào.\n" +
              "2. **Phân tích chi tiết**: Nhìn vào từng câu sai phổ biến và phân tích nguyên nhân tại sao học sinh lại hay chọn sai đáp án đó (có thể do bẫy, hoặc hiểu lầm khái niệm nào).\n" +
              "3. **Đề xuất giảng dạy**: Lời khuyên cụ thể cho giáo viên cần nhấn mạnh điểm gì trong tiết học tới.\n" +
              "Lưu ý: Không giải thích quá dài dòng, hãy đi thẳng vào trọng tâm chuyên môn."
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.5,
      topP: 0.9,
    }
  };

  let lastError: Error | null = null;

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );

      const payload = (await response.json()) as any;
      if (!response.ok) {
        throw new Error(payload?.error?.message || `HTTP ${response.status}`);
      }

      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("AI không trả về nội dung hợp lệ.");
      }

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("Không thể gọi API Gemini.");
}
