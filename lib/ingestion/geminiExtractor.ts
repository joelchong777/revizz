export interface StagingOption {
  label: 'A' | 'B' | 'C' | 'D';
  content_markdown: string;
  is_correct: boolean;
}

export interface StagingDiagram {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  page_number: number;
}

export interface StagingQuestion {
  question_number: number;
  stem_markdown: string;
  options: StagingOption[];
  explanation_markdown: string;
  diagrams?: StagingDiagram[];
}

interface ExtractionOptions {
  batchSize?: number;
  startQuestion?: number;
  endQuestion?: number;
  model?: string;
  maxRetries?: number;
}

export async function extractQuestionsChunked(
  qpBuffer: Buffer,
  msBuffer: Buffer,
  apiKey: string,
  options: ExtractionOptions = {}
): Promise<StagingQuestion[]> {
  const batchSize = options.batchSize || 10;
  const startQuestion = options.startQuestion || 1;
  const endQuestion = options.endQuestion || 40;
  const model = options.model || 'gemini-2.0-flash';
  const maxRetries = options.maxRetries || 3;

  const allQuestions: StagingQuestion[] = [];

  for (let currentStart = startQuestion; currentStart <= endQuestion; currentStart += batchSize) {
    const currentEnd = Math.min(currentStart + batchSize - 1, endQuestion);
    
    let attempt = 0;
    let success = false;
    
    while (attempt < maxRetries && !success) {
      try {
        const questions = await extractBatch(
          qpBuffer, 
          msBuffer, 
          currentStart, 
          currentEnd, 
          apiKey,
          model
        );
        allQuestions.push(...questions);
        success = true;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error(`Failed to extract questions ${currentStart}-${currentEnd} after ${maxRetries} attempts.`, error);
          throw error;
        }
        // Exponential backoff
        await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
      }
    }
  }

  return allQuestions;
}

async function extractBatch(
  qpBuffer: Buffer,
  msBuffer: Buffer,
  startQ: number,
  endQ: number,
  apiKey: string,
  model: string
): Promise<StagingQuestion[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are an expert Cambridge Assessment International Education (CAIE) Examination Ingestion Specialist.
Your task is to extract questions ${startQ} to ${endQ} from the provided Question Paper (QP) PDF and match them with the official Mark Scheme (MS) PDF.

CRITICAL INSTRUCTIONS:
1. Match each question number exactly with its official Mark Scheme key (where is_correct is true for that option).
2. Detect any diagrams, graphs, circuits, or other visual elements in the question. If a diagram exists, provide normalized bounding boxes: [ymin, xmin, ymax, xmax] (on a 0 to 1000 scale) and the page_number (1-indexed).
3. Generate a high-yield 'explanation_markdown' structured into:
   - Concept & Formula
   - Step-by-Step Derivation
   - Distractor Analysis (diagnosing specific misconceptions for incorrect options)
4. Output strict JSON conforming exactly to an array of StagingQuestion objects:
[
  {
    "question_number": number,
    "stem_markdown": string,
    "options": [
      { "label": "A", "content_markdown": string, "is_correct": boolean },
      { "label": "B", "content_markdown": string, "is_correct": boolean },
      { "label": "C", "content_markdown": string, "is_correct": boolean },
      { "label": "D", "content_markdown": string, "is_correct": boolean }
    ],
    "explanation_markdown": string,
    "diagrams": [
      { "ymin": number, "xmin": number, "ymax": number, "xmax": number, "page_number": number }
    ] // omit if no diagrams
  }
]
Do not include any markdown wrappers like \`\`\`json around the output. Output pure JSON array.`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: "application/pdf",
              data: qpBuffer.toString("base64")
            }
          },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: msBuffer.toString("base64")
            }
          },
          {
            text: `Extract questions ${startQ} to ${endQ} as a JSON array.`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No text returned from Gemini API.');
  }

  return extractJsonFromMarkdown(text);
}

function extractJsonFromMarkdown(text: string): StagingQuestion[] {
  let jsonStr = text.trim();
  // Fallback to extract JSON substring from markdown fences
  if (jsonStr.startsWith('```')) {
    const firstNewline = jsonStr.indexOf('\n');
    const lastBacktick = jsonStr.lastIndexOf('```');
    if (firstNewline !== -1 && lastBacktick > firstNewline) {
      jsonStr = jsonStr.substring(firstNewline + 1, lastBacktick).trim();
    }
  }
  
  // Find first [ and last ]
  const firstBracket = jsonStr.indexOf('[');
  const lastBracket = jsonStr.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed JSON is not an array.');
    }
    return parsed as StagingQuestion[];
  } catch (err) {
    console.error("Failed to parse JSON. Raw string:", jsonStr);
    throw err;
  }
}
