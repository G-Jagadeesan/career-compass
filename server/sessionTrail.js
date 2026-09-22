/**
 * Session trail persistence - flat JSON file with atomic writes
 * Records the session trail for debugging/transparency
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, "..", "sessions");

/**
 * Ensure sessions directory exists
 */
async function ensureSessionsDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}

/**
 * Generate a unique session ID
 * @returns {string} UUID
 */
export function generateSessionId() {
  return randomUUID();
}

/**
 * Create a new session trail
 * @param {string} sessionId - Session ID
 * @param {Object} context - Initial context form data
 * @returns {Promise<Object>} Session trail object
 */
export async function createTrail(sessionId, context) {
  await ensureSessionsDir();

  const trail = {
    sessionId,
    createdAt: new Date().toISOString(),
    context: {
      submitted: context,
      timestamp: new Date().toISOString()
    },
    questions: null,
    answers: null,
    verdict: null
  };

  await writeTrail(sessionId, trail);
  return trail;
}

/**
 * Write trail with atomic write (write to temp file, then rename)
 * @param {string} sessionId - Session ID
 * @param {Object} trail - Trail data
 */
async function writeTrail(sessionId, trail) {
  await ensureSessionsDir();

  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  const tempPath = path.join(SESSIONS_DIR, `${sessionId}.tmp`);

  // Write to temp file
  await fs.writeFile(tempPath, JSON.stringify(trail, null, 2), "utf-8");

  // Rename temp file to final file (atomic on most filesystems)
  await fs.rename(tempPath, filePath);
}

/**
 * Update session trail with questions
 * @param {string} sessionId - Session ID
 * @param {Array} questions - Generated questions
 */
export async function updateTrailQuestions(sessionId, questions) {
  const trail = await readTrail(sessionId);
  if (!trail) return;

  trail.questions = {
    received: questions,
    timestamp: new Date().toISOString()
  };

  await writeTrail(sessionId, trail);
}

/**
 * Update session trail with answers
 * @param {string} sessionId - Session ID
 * @param {Object} answers - User answers
 */
export async function updateTrailAnswers(sessionId, answers) {
  const trail = await readTrail(sessionId);
  if (!trail) return;

  trail.answers = {
    submitted: answers,
    timestamp: new Date().toISOString()
  };

  await writeTrail(sessionId, trail);
}

/**
 * Update session trail with verdict
 * @param {string} sessionId - Session ID
 * @param {Object} verdict - Generated verdict
 */
export async function updateTrailVerdict(sessionId, verdict) {
  const trail = await readTrail(sessionId);
  if (!trail) return;

  trail.verdict = {
    received: verdict,
    timestamp: new Date().toISOString()
  };

  await writeTrail(sessionId, trail);
}

/**
 * Read session trail
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Trail data or null
 */
export async function readTrail(sessionId) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}
