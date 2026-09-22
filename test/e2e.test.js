/**
 * Career Compass - End-to-End Tests (Puppeteer)
 * Tests the complete user flow in a headless browser
 */

import puppeteer from "puppeteer-core";
import { spawn } from "child_process";
import process from "process";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const HEADLESS = process.env.HEADLESS !== "false";

/**
 * Helper to wait for a specified duration
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Find Chrome executable
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe"
].filter(Boolean);

let browser = null;
let page = null;
let serverProcess = null;

async function findChrome() {
  for (const path of CHROME_PATHS) {
    try {
      const { spawn } = await import("child_process");
      const { execSync } = await import("child_process");
      execSync(`"${path}" --version`, { encoding: "utf-8" });
      return path;
    } catch {
      continue;
    }
  }
  throw new Error("Chrome not found. Set CHROME_PATH environment variable.");
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
        setTimeout(resolve, 1000); // Give server a moment to fully start
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
  console.log("\n=== Career Compass E2E Tests ===\n");

  try {
    // Start server if testing locally
    if (BASE_URL === "http://localhost:3000") {
      console.log("Starting server...");
      await startServer();
      console.log("Server started.");
    }

    // Find Chrome
    const chromePath = await findChrome();
    console.log(`Using Chrome at: ${chromePath}`);

    // Launch browser
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    page = await browser.newPage();

    console.log("\nRunning tests...\n");

    // Test 1: Load homepage
    console.log("Test 1: Load homepage");
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    const title = await page.title();
    if (title === "Career Compass") {
      console.log("✓ Homepage loads with correct title");
    } else {
      console.log(`✗ Expected title "Career Compass", got "${title}"`);
    }

    // Test 2: Click demo profile button
    console.log("\nTest 2: Load demo profile");
    await page.waitForSelector("[data-action='load-demo']");
    await page.click("[data-action='load-demo']");
    await wait(500);

    // Check if form is filled
    const educationValue = await page.$eval("#education_level", el => el.value);
    if (educationValue === "Recent Graduate") {
      console.log("✓ Demo profile pre-fills form correctly");
    } else {
      console.log(`✗ Expected education "Recent Graduate", got "${educationValue}"`);
    }

    // Test 3: Submit form and generate questions
    console.log("\nTest 3: Generate questions");
    await page.waitForSelector("[data-action='generate-questions']");
    await page.click("[data-action='generate-questions']");

    // Wait for questions to load (this may take a while with real API)
    console.log("  Waiting for questions...");
    try {
      await page.waitForSelector("#step-2.active", { timeout: 60000 });
      console.log("✓ Questions generated successfully");

      // Check if 8 questions appear
      const questionCount = await page.$$eval(".question-card", cards => cards.length);
      if (questionCount === 8) {
        console.log(`✓ ${questionCount} questions displayed`);
      } else {
        console.log(`✗ Expected 8 questions, got ${questionCount}`);
      }
    } catch (err) {
      console.log("✗ Questions generation failed or timed out");
      // Check for error message
      const errorVisible = await page.$eval("#error-1", el => el.classList.contains("show"));
      if (errorVisible) {
        const errorText = await page.$eval("#error-1", el => el.textContent);
        console.log(`  Error: ${errorText}`);
      }
    }

    // Test 4: Answer all questions
    console.log("\nTest 4: Answer questions");
    const optionCards = await page.$$("[data-action='select-option']");

    if (optionCards.length > 0) {
      // Click one option per question (each question has 4 options)
      for (let i = 0; i < 8; i++) {
        const qIndex = i * 4; // First option for each question
        if (optionCards[qIndex]) {
          await optionCards[qIndex].click();
          await wait(100);
        }
      }

      // Check progress indicator
      const progressText = await page.$eval("#progress-indicator", el => el.textContent);
      if (progressText === "8 of 8 answered") {
        console.log("✓ All 8 questions answered");
      } else {
        console.log(`✗ Expected "8 of 8 answered", got "${progressText}"`);
      }

      // Check if submit button is enabled
      const submitEnabled = await page.$eval("#submit-answers-btn", btn => !btn.disabled);
      if (submitEnabled) {
        console.log("✓ Submit button enabled after all questions answered");
      } else {
        console.log("✗ Submit button still disabled");
      }
    } else {
      console.log("✗ No option cards found");
    }

    // Test 5: Submit answers and get verdict
    console.log("\nTest 5: Generate verdict");
    await page.click("[data-action='submit-answers']");
    console.log("  Waiting for verdict...");

    try {
      await page.waitForSelector("#step-3.active", { timeout: 120000 });
      console.log("✓ Verdict generated successfully");

      // Check if results are displayed
      const primaryCareer = await page.$eval("#primary-career", el => el.textContent);
      if (primaryCareer && primaryCareer.length > 0) {
        console.log(`✓ Primary career displayed: ${primaryCareer}`);
      } else {
        console.log("✗ Primary career not displayed");
      }

      const secondaryCareer = await page.$eval("#secondary-career", el => el.textContent);
      if (secondaryCareer && secondaryCareer.length > 0) {
        console.log(`✓ Secondary career displayed: ${secondaryCareer}`);
      } else {
        console.log("✗ Secondary career not displayed");
      }

      // Check if careers are different
      if (primaryCareer !== secondaryCareer) {
        console.log("✓ Primary and secondary careers are different");
      } else {
        console.log("✗ Primary and secondary careers should be different");
      }
    } catch (err) {
      console.log("✗ Verdict generation failed or timed out");
      const errorVisible = await page.$eval("#error-2", el => el.classList.contains("show"));
      if (errorVisible) {
        const errorText = await page.$eval("#error-2", el => el.textContent);
        console.log(`  Error: ${errorText}`);
      }
    }

    // Test 6: Start over
    console.log("\nTest 6: Start over");
    await page.click("[data-action='start-over']");
    await page.waitForSelector("#step-1.active");

    const stepIndicator = await page.$eval("#step-indicator", el => el.textContent);
    if (stepIndicator === "Step 1 of 3: Your Profile") {
      console.log("✓ Returned to step 1");
    } else {
      console.log(`✗ Expected "Step 1 of 3: Your Profile", got "${stepIndicator}"`);
    }

    // Check if form is reset
    const eduValue = await page.$eval("#education_level", el => el.value);
    if (eduValue === "") {
      console.log("✓ Form reset correctly");
    } else {
      console.log("✗ Form not reset");
    }

    console.log("\n=== E2E Tests Complete ===\n");

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopServer();
    process.exit(0);
  }
}

runTests();
