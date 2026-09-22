/**
 * Validation and retry logic for Claude API responses
 */

// Expected dimensions in exact order
const EXPECTED_DIMENSIONS = ["cr", "ue", "bt", "at", "do", "co", "ps", "dm"];

// Valid career list for verdict validation
const VALID_CAREERS = [
  "Software & IT (Engineering/Development)",
  "Data Science & Analytics",
  "Product Management",
  "Sales & Business Development",
  "Marketing (Digital/Brand/Content)",
  "Finance & Accounting",
  "Medical/Healthcare",
  "Human Resources",
  "Design (UI/UX/Graphic/Product Design)",
  "Teaching/Academia"
];

/**
 * Strip markdown code fences from response
 * @param {string} text - Raw response text
 * @returns {string} Cleaned text
 */
export function stripMarkdownFences(text) {
  // Remove ```json and ``` fences
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Validate questions response schema
 * @param {Object} data - Parsed JSON data
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateQuestions(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Response is not a valid object" };
  }

  if (!Array.isArray(data.questions)) {
    return { valid: false, error: "'questions' is not an array" };
  }

  if (data.questions.length !== 8) {
    return { valid: false, error: `Expected 8 questions, got ${data.questions.length}` };
  }

  // Check each question
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];

    if (q.dimension !== EXPECTED_DIMENSIONS[i]) {
      return { valid: false, error: `Question ${i + 1} has dimension '${q.dimension}', expected '${EXPECTED_DIMENSIONS[i]}'` };
    }

    if (!q.dimension_name || typeof q.dimension_name !== "string") {
      return { valid: false, error: `Question ${i + 1} missing 'dimension_name'` };
    }

    if (!q.question || typeof q.question !== "string") {
      return { valid: false, error: `Question ${i + 1} missing 'question'` };
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      return { valid: false, error: `Question ${i + 1} must have exactly 4 options` };
    }

    const expectedIds = ["a", "b", "c", "d"];
    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j];
      if (opt.id !== expectedIds[j]) {
        return { valid: false, error: `Question ${i + 1} option ${j + 1} has id '${opt.id}', expected '${expectedIds[j]}'` };
      }
      if (!opt.text || typeof opt.text !== "string") {
        return { valid: false, error: `Question ${i + 1} option ${j + 1} missing 'text'` };
      }
    }
  }

  return { valid: true, error: null };
}

/**
 * Validate verdict response schema
 * @param {Object} data - Parsed JSON data
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateVerdict(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Response is not a valid object" };
  }

  if (!data.primary_fit || typeof data.primary_fit !== "object") {
    return { valid: false, error: "Missing 'primary_fit' object" };
  }

  if (!data.secondary_fit || typeof data.secondary_fit !== "object") {
    return { valid: false, error: "Missing 'secondary_fit' object" };
  }

  // Validate primary_fit
  if (!data.primary_fit.career || !VALID_CAREERS.includes(data.primary_fit.career)) {
    return { valid: false, error: `primary_fit.career '${data.primary_fit.career}' is not in the valid careers list` };
  }

  if (!data.primary_fit.reasoning || typeof data.primary_fit.reasoning !== "string") {
    return { valid: false, error: "primary_fit missing 'reasoning'" };
  }

  // Validate secondary_fit
  if (!data.secondary_fit.career || !VALID_CAREERS.includes(data.secondary_fit.career)) {
    return { valid: false, error: `secondary_fit.career '${data.secondary_fit.career}' is not in the valid careers list` };
  }

  if (!data.secondary_fit.reasoning || typeof data.secondary_fit.reasoning !== "string") {
    return { valid: false, error: "secondary_fit missing 'reasoning'" };
  }

  // Check they are different
  if (data.primary_fit.career === data.secondary_fit.career) {
    return { valid: false, error: "primary_fit and secondary_fit must be different careers" };
  }

  return { valid: true, error: null };
}

/**
 * Parse and validate questions with retry
 * @param {Function} apiCall - Function that makes the API call
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function parseQuestionsWithRetry(apiCall) {
  const reminder = "Your previous response did not match the required schema. Return ONLY valid JSON matching the schema exactly.";

  // First attempt
  try {
    const rawResponse = await apiCall(null);
    const cleaned = stripMarkdownFences(rawResponse);
    const parsed = JSON.parse(cleaned);
    const validation = validateQuestions(parsed);

    if (validation.valid) {
      return { success: true, data: parsed };
    }

    // Retry with reminder
    const retryResponse = await apiCall(reminder);
    const retryCleaned = stripMarkdownFences(retryResponse);
    const retryParsed = JSON.parse(retryCleaned);
    const retryValidation = validateQuestions(retryParsed);

    if (retryValidation.valid) {
      return { success: true, data: retryParsed };
    }

    return { success: false, error: retryValidation.error };
  } catch (err) {
    // Retry on parse error
    try {
      const retryResponse = await apiCall(reminder);
      const retryCleaned = stripMarkdownFences(retryResponse);
      const retryParsed = JSON.parse(retryCleaned);
      const retryValidation = validateQuestions(retryParsed);

      if (retryValidation.valid) {
        return { success: true, data: retryParsed };
      }

      return { success: false, error: retryValidation.error };
    } catch (retryErr) {
      return { success: false, error: `Failed to parse response: ${retryErr.message}` };
    }
  }
}

/**
 * Parse and validate verdict with retry
 * @param {Function} apiCall - Function that makes the API call
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function parseVerdictWithRetry(apiCall) {
  const reminder = "Your previous response did not match the required schema. primary_fit.career and secondary_fit.career MUST be two DIFFERENT careers from the exact 10-career list provided. Return ONLY valid JSON matching the schema exactly.";

  // First attempt
  try {
    const rawResponse = await apiCall(null);
    const cleaned = stripMarkdownFences(rawResponse);
    const parsed = JSON.parse(cleaned);
    const validation = validateVerdict(parsed);

    if (validation.valid) {
      return { success: true, data: parsed };
    }

    // Retry with reminder
    const retryResponse = await apiCall(reminder);
    const retryCleaned = stripMarkdownFences(retryResponse);
    const retryParsed = JSON.parse(retryCleaned);
    const retryValidation = validateVerdict(retryParsed);

    if (retryValidation.valid) {
      return { success: true, data: retryParsed };
    }

    return { success: false, error: retryValidation.error };
  } catch (err) {
    // Retry on parse error
    try {
      const retryResponse = await apiCall(reminder);
      const retryCleaned = stripMarkdownFences(retryResponse);
      const retryParsed = JSON.parse(retryCleaned);
      const retryValidation = validateVerdict(retryParsed);

      if (retryValidation.valid) {
        return { success: true, data: retryParsed };
      }

      return { success: false, error: retryValidation.error };
    } catch (retryErr) {
      return { success: false, error: `Failed to parse response: ${retryErr.message}` };
    }
  }
}
