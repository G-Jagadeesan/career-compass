/**
 * Career Compass - Smoke Tests
 * Tests API endpoints and validation logic
 */

import "dotenv/config";
import { validateQuestions, validateVerdict, stripMarkdownFences } from "../server/validation.js";
import { spawn } from "child_process";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

// Test results tracking
let passed = 0;
let failed = 0;
let serverProcess = null;

function logResult(name, success, message = "") {
  if (success) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    if (message) console.log(`  Error: ${message}`);
    failed++;
  }
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn("node", ["server/index.js"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: false
    });

    let started = false;
    const timeout = setTimeout(() => {
      reject(new Error("Server startup timeout"));
    }, 10000);

    serverProcess.stdout.on("data", (data) => {
      if (!started && data.toString().includes("Server running")) {
        started = true;
        clearTimeout(timeout);
        setTimeout(resolve, 1000);
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error("Server error:", data.toString());
    });

    serverProcess.on("error", reject);
  });
}

async function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
  }
}

async function runTests() {
  console.log("\n=== Career Compass Smoke Tests ===\n");

  // Start server if testing locally
  if (BASE_URL === "http://localhost:3000") {
    console.log("Starting server...");
    try {
      await startServer();
      console.log("Server started.\n");
    } catch (err) {
      console.log("Could not start server, skipping API tests:", err.message);
    }
  }

  // Test 1: Validate correct questions format
  console.log("Running validation tests...");
  {
    const validQuestions = {
      questions: [
        { dimension: "cr", dimension_name: "Creativity", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "ue", dimension_name: "User Empathy", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "bt", dimension_name: "Business Thinking", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "at", dimension_name: "Analytical Thinking", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "do", dimension_name: "Data Orientation", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "co", dimension_name: "Communication", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "ps", dimension_name: "Problem Solving", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "dm", dimension_name: "Decision Making", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]}
      ]
    };

    const result = validateQuestions(validQuestions);
    logResult("Valid questions schema passes validation", result.valid, result.error);
  }

  // Test 2: Validate incorrect questions format (wrong dimension order)
  {
    const invalidQuestions = {
      questions: [
        { dimension: "ue", dimension_name: "User Empathy", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]},
        { dimension: "cr", dimension_name: "Creativity", question: "Test?", options: [
          { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }
        ]}
      ]
    };

    const result = validateQuestions(invalidQuestions);
    logResult("Invalid dimension order fails validation", !result.valid, result.error);
  }

  // Test 3: Validate correct verdict format
  {
    const validVerdict = {
      primary_fit: {
        career: "Software & IT (Engineering/Development)",
        reasoning: "Test reasoning for primary fit."
      },
      secondary_fit: {
        career: "Data Science & Analytics",
        reasoning: "Test reasoning for secondary fit."
      }
    };

    const result = validateVerdict(validVerdict);
    logResult("Valid verdict schema passes validation", result.valid, result.error);
  }

  // Test 4: Validate identical careers fails
  {
    const invalidVerdict = {
      primary_fit: {
        career: "Software & IT (Engineering/Development)",
        reasoning: "Test reasoning"
      },
      secondary_fit: {
        career: "Software & IT (Engineering/Development)",
        reasoning: "Test reasoning"
      }
    };

    const result = validateVerdict(invalidVerdict);
    logResult("Identical careers fails validation", !result.valid, result.error);
  }

  // Test 5: Validate invalid career fails
  {
    const invalidVerdict = {
      primary_fit: {
        career: "Invalid Career",
        reasoning: "Test reasoning"
      },
      secondary_fit: {
        career: "Data Science & Analytics",
        reasoning: "Test reasoning"
      }
    };

    const result = validateVerdict(invalidVerdict);
    logResult("Invalid career name fails validation", !result.valid, result.error);
  }

  // Test 6: Strip markdown fences
  {
    const markdownJson = '```json\n{"test": "value"}\n```';
    const stripped = stripMarkdownFences(markdownJson);
    const expected = '{"test": "value"}';
    logResult("Strip markdown code fences", stripped === expected, `Got: ${stripped}`);
  }

  // Test 7: Demo profile endpoint
  console.log("\nRunning API tests...");
  try {
    const demoRes = await fetch(`${BASE_URL}/api/demo-profile`);
    const demoData = await demoRes.json();
    logResult("Demo profile endpoint returns data", demoRes.ok && demoData.education_level, JSON.stringify(demoData));
  } catch (err) {
    logResult("Demo profile endpoint returns data", false, err.message);
  }

  // Test 8: Generate questions with mock data (skip if no API key)
  if (process.env.MIGI_API_KEY && process.env.MIGI_API_KEY !== "your_api_key_here") {
    console.log("\nRunning live API tests (API key detected)...");
    try {
      const context = {
        education_level: "Student",
        field: "Engineering",
        top_skills: ["Programming", "Problem Solving"],
        interests: ["AI", "Web Development"]
      };

      const questionsRes = await fetch(`${BASE_URL}/api/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context)
      });

      const questionsData = await questionsRes.json();
      logResult("Generate questions endpoint works", 
        questionsRes.ok && questionsData.questions && questionsData.questions.length === 8,
        questionsRes.ok ? `Got ${questionsData.questions?.length} questions` : questionsData.error
      );

      // Test 9: Generate verdict if questions succeeded
      if (questionsRes.ok && questionsData.questions) {
        const answers = {
          cr: "a", ue: "b", bt: "c", at: "d",
          do: "a", co: "b", ps: "c", dm: "d"
        };

        const verdictRes = await fetch(`${BASE_URL}/api/generate-verdict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: questionsData.sessionId,
            context,
            questions: questionsData.questions,
            answers
          })
        });

        const verdictData = await verdictRes.json();
        logResult("Generate verdict endpoint works",
          verdictRes.ok && verdictData.verdict && verdictData.verdict.primary_fit,
          verdictRes.ok ? `Got verdict: ${verdictData.verdict?.primary_fit?.career}` : verdictData.error
        );
      }
    } catch (err) {
      logResult("Live API tests", false, err.message);
    }
  } else {
    console.log("\nSkipping live API tests (no API key configured)");
  }

  // Summary
  console.log("\n=== Test Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  await stopServer();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
