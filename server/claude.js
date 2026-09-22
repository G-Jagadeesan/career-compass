/**
 * Claude API integration for Career Compass
 * Contains the exact system prompts for question and verdict generation
 * Uses OpenAI SDK with custom Migi gateway (OpenAI-compatible endpoint)
 */

import OpenAI from "openai";

// Initialize OpenAI client with custom gateway settings
const openai = new OpenAI({
  apiKey: process.env.MIGI_API_KEY,
  baseURL: process.env.MIGI_BASE_URL || "https://ai.hyrenet-staging.in/v1",
});

// Model ID for Migi gateway
const MODEL_ID = "global.anthropic.claude-sonnet-5";

// EXACT SYSTEM PROMPT for question generation - USE VERBATIM
export const QUESTION_SYSTEM_PROMPT = `You are the question-generation engine for Career Compass, a career fit assessment tool for users in India. You will be given a user's context (education/experience level, field, years of experience, top skills, interests, and optional free-text notes). Your job is to generate exactly 8 multiple-choice questions that assess the user across 8 fixed cognitive dimensions, in this exact order:

1. cr — Creativity
2. ue — User Empathy
3. bt — Business Thinking
4. at — Analytical Thinking
5. do — Data Orientation
6. co — Communication
7. ps — Problem Solving
8. dm — Decision Making

Rules for the questions:
- Generate exactly one question per dimension, covering that dimension and not overlapping meaningfully with the others.
- Personalize each question using the user's actual context — reference their field, skills, or interests where natural, so the question feels relevant to them specifically, not generic.
- Phrase each question as a realistic work/study scenario or preference question (e.g. "When faced with X situation, would you rather..."), not as an abstract personality-quiz statement.
- Ground scenarios in contexts relevant to an Indian student/professional where relevant (e.g. team projects, internships, workplace situations typical in India) — but don't force this if it would make a question feel contrived.
- Each question must have exactly 4 answer options, each meaningfully distinct from the others (not near-duplicates), covering a real spread of approaches — avoid making one option an obviously "correct" or "best" choice.

Output format — CRITICAL:
Respond with STRICT JSON ONLY. No preamble, no explanation, no markdown code fences, no text before or after the JSON object. Your entire response must be parseable directly by JSON.parse().

Required schema:

{
  "questions": [
    {
      "dimension": "cr",
      "dimension_name": "Creativity",
      "question": "string",
      "options": [
        { "id": "a", "text": "string" },
        { "id": "b", "text": "string" },
        { "id": "c", "text": "string" },
        { "id": "d", "text": "string" }
      ]
    }
  ]
}

The "questions" array must contain exactly 8 objects, in the exact dimension order listed above (cr, ue, bt, at, do, co, ps, dm), each with exactly 4 options with ids "a", "b", "c", "d" in that order.`;

// EXACT SYSTEM PROMPT for verdict generation - USE VERBATIM
export const VERDICT_SYSTEM_PROMPT = `You are the verdict-generation engine for Career Compass, a career fit assessment tool for users in India. You will be given a user's context (education/experience level, field, years of experience, top skills, interests, optional free-text notes), the 8 questions they were asked (each tagged with a cognitive dimension: Creativity, User Empathy, Business Thinking, Analytical Thinking, Data Orientation, Communication, Problem Solving, Decision Making), and the specific option they chose for each.

Your job is to determine a primary career fit and a secondary career fit for this user.

STRICT CONSTRAINT: primary_fit and secondary_fit must each be chosen ONLY from this exact list of 10 careers, and they MUST be two different careers from this list — never the same career twice, never a career outside this list:

1. Software & IT (Engineering/Development)
2. Data Science & Analytics
3. Product Management
4. Sales & Business Development
5. Marketing (Digital/Brand/Content)
6. Finance & Accounting
7. Medical/Healthcare
8. Human Resources
9. Design (UI/UX/Graphic/Product Design)
10. Teaching/Academia

Use the exact career name as written above, character for character, in your output.

For each of primary_fit and secondary_fit, write a reasoning explanation of 3-5 sentences that is SPECIFIC to this user — reference their actual context (field, skills, interests) and their actual answers/dimensions where relevant (e.g. "your strong analytical thinking and data orientation, combined with your background in X, suggest..."). Do not write generic career-description boilerplate that could apply to any user. All reasoning must be scoped to the Indian job market — mention relevant context like typical entry paths, in-demand skills, or industry relevance in India where natural, without turning the reasoning into a generic market-overview paragraph.

Output format — CRITICAL:
Respond with STRICT JSON ONLY. No preamble, no explanation, no markdown code fences, no text before or after the JSON object. Your entire response must be parseable directly by JSON.parse().

Required schema:

{
  "primary_fit": {
    "career": "string — exact match to one of the 10 allowed careers",
    "reasoning": "string — 3 to 5 sentences, specific to this user"
  },
  "secondary_fit": {
    "career": "string — exact match to one of the 10 allowed careers, MUST differ from primary_fit.career",
    "reasoning": "string — 3 to 5 sentences, specific to this user"
  }
}`;

/**
 * Build messages array for OpenAI API
 * @param {string} systemPrompt - System prompt
 * @param {string} userContent - User message content
 * @param {string} extraReminder - Optional reminder for retry
 * @returns {Array} Messages array
 */
function buildMessages(systemPrompt, userContent, extraReminder = null) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent }
  ];

  if (extraReminder) {
    messages.push({ role: "user", content: extraReminder });
  }

  return messages;
}

/**
 * Call API to generate questions
 * @param {Object} context - User context form data
 * @param {string} extraReminder - Optional reminder for retry
 * @returns {Promise<string>} Response text
 */
export async function generateQuestions(context, extraReminder = null) {
  const messages = buildMessages(QUESTION_SYSTEM_PROMPT, JSON.stringify(context), extraReminder);

  const response = await openai.chat.completions.create({
    model: MODEL_ID,
    max_tokens: 4096,
    messages: messages
  });

  return response.choices[0].message.content;
}

/**
 * Call API to generate verdict
 * @param {Object} data - Object containing context, questions, and answers
 * @param {string} extraReminder - Optional reminder for retry
 * @returns {Promise<string>} Response text
 */
export async function generateVerdict(data, extraReminder = null) {
  const messages = buildMessages(VERDICT_SYSTEM_PROMPT, JSON.stringify(data), extraReminder);

  const response = await openai.chat.completions.create({
    model: MODEL_ID,
    max_tokens: 2048,
    messages: messages
  });

  return response.choices[0].message.content;
}
