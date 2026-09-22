/**
 * Hono routes for Career Compass API
 */

import { Hono } from "hono";
import { generateQuestions, generateVerdict } from "./claude.js";
import { parseQuestionsWithRetry, parseVerdictWithRetry } from "./validation.js";
import { generateSessionId, createTrail, updateTrailQuestions, updateTrailAnswers, updateTrailVerdict, readTrail } from "./sessionTrail.js";
import { DEMO_PROFILE } from "./seed.js";

const routes = new Hono();

// In-memory session store for active sessions (maps sessionId to trail data)
const activeSessions = new Map();

/**
 * POST /api/generate-questions
 * Generate 8 personalized MCQ questions based on user context
 */
routes.post("/api/generate-questions", async (c) => {
  try {
    const context = await c.req.json();

    // Generate session ID and create trail
    const sessionId = generateSessionId();
    await createTrail(sessionId, context);

    // Generate questions with retry
    const result = await parseQuestionsWithRetry(async (reminder) => {
      return await generateQuestions(context, reminder);
    });

    if (!result.success) {
      return c.json({
        error: "Failed to generate valid questions. Please try again.",
        details: result.error
      }, 500);
    }

    // Update trail with questions
    await updateTrailQuestions(sessionId, result.data.questions);

    // Store session info
    activeSessions.set(sessionId, {
      context,
      questions: result.data.questions
    });

    return c.json({
      sessionId,
      questions: result.data.questions
    });
  } catch (err) {
    console.error("Error generating questions:", err);
    return c.json({
      error: "An unexpected error occurred. Please try again.",
      details: err.message
    }, 500);
  }
});

/**
 * POST /api/generate-verdict
 * Generate career fit verdict based on context, questions, and answers
 */
routes.post("/api/generate-verdict", async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, context, questions, answers } = body;

    // Create or update trail
    let trailSessionId = sessionId;
    if (!trailSessionId) {
      trailSessionId = generateSessionId();
      await createTrail(trailSessionId, context);
    }

    // Update answers in trail
    await updateTrailAnswers(trailSessionId, answers);

    // Generate verdict with retry
    const result = await parseVerdictWithRetry(async (reminder) => {
      return await generateVerdict({ context, questions, answers }, reminder);
    });

    if (!result.success) {
      return c.json({
        error: "Failed to generate valid verdict. Please try again.",
        details: result.error
      }, 500);
    }

    // Update trail with verdict
    await updateTrailVerdict(trailSessionId, result.data);

    return c.json({
      sessionId: trailSessionId,
      verdict: result.data
    });
  } catch (err) {
    console.error("Error generating verdict:", err);
    return c.json({
      error: "An unexpected error occurred. Please try again.",
      details: err.message
    }, 500);
  }
});

/**
 * GET /api/session/:sessionId
 * Get session trail details
 */
routes.get("/api/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  try {
    const trail = await readTrail(sessionId);
    if (!trail) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(trail);
  } catch (err) {
    return c.json({ error: "Failed to read session" }, 500);
  }
});

/**
 * GET /api/demo-profile
 * Get the demo profile data
 */
routes.get("/api/demo-profile", (c) => {
  return c.json(DEMO_PROFILE);
});

export default routes;
