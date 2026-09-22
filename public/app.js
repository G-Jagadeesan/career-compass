/**
 * Career Compass - Client-side JavaScript
 * Handles form submission, question display, results, and session management
 */

// State
let currentStep = 1;
let sessionId = null;
let context = null;
let questions = null;
let answers = {};
let verdict = null;

// Tag input state
const topSkills = [];
const interests = [];

// DOM Elements
const stepIndicator = document.getElementById("step-indicator");
const contextForm = document.getElementById("context-form");
const progressChips = document.getElementById("progress-chips");
const questionsContainer = document.getElementById("questions-container");
const submitAnswersBtn = document.getElementById("submit-answers-btn");
const startOverBtn = document.getElementById("start-over-btn");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initTagsInput("top-skills", topSkills);
  initTagsInput("interests", interests);
  initEventListeners();
});

/**
 * Initialize tags input functionality
 */
function initTagsInput(type, array) {
  const list = document.getElementById(`${type}-list`);
  const field = document.getElementById(`${type}-field`);
  const hidden = document.getElementById(type.replace("-", "_"));

  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = field.value.trim();
      if (value && array.length < 10) {
        addTag(array, list, hidden, value);
        field.value = "";
      }
    } else if (e.key === "Backspace" && !field.value && array.length > 0) {
      removeTag(array, list, hidden, array.length - 1);
    }
  });
}

/**
 * Add a tag
 */
function addTag(array, list, hidden, value) {
  array.push(value);
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.innerHTML = `
    ${escapeHtml(value)}
    <button type="button" class="tag-remove" data-action="remove-tag">&times;</button>
  `;
  list.appendChild(tag);
  updateHiddenField(array, hidden);
}

/**
 * Remove a tag
 */
function removeTag(array, list, hidden, index) {
  array.splice(index, 1);
  const tag = list.children[index];
  if (tag) tag.remove();
  updateHiddenField(array, hidden);
}

/**
 * Update hidden field with JSON array
 */
function updateHiddenField(array, hidden) {
  hidden.value = JSON.stringify(array);
}

/**
 * Initialize event listeners (delegated)
 */
function initEventListeners() {
  document.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset?.action;
    if (!action) return;

    switch (action) {
      case "load-demo":
        loadDemoProfile();
        break;
      case "generate-questions":
        // Handled by form submit
        break;
      case "submit-answers":
        submitAnswers();
        break;
      case "start-over":
        startOver();
        break;
      case "select-option":
        selectOption(e);
        break;
      case "remove-tag":
        handleRemoveTag(e);
        break;
      case "retry-step-1":
        generateQuestions();
        break;
      case "retry-step-2":
        submitAnswers();
        break;
    }
  });

  // Form submit
  contextForm.addEventListener("submit", (e) => {
    e.preventDefault();
    generateQuestions();
  });
}

/**
 * Handle remove tag button click
 */
function handleRemoveTag(e) {
  const tag = e.target.closest(".tag");
  const list = tag.parentElement;
  const array = list.id === "top-skills-list" ? topSkills : interests;
  const hidden = document.getElementById(list.id === "top-skills-list" ? "top_skills" : "interests");
  const index = Array.from(list.children).indexOf(tag);
  removeTag(array, list, hidden, index);
}

/**
 * Load demo profile
 */
async function loadDemoProfile() {
  try {
    const response = await fetch("/api/demo-profile");
    const profile = await response.json();

    // Fill form fields
    document.getElementById("education_level").value = profile.education_level;
    document.getElementById("field").value = profile.field;
    document.getElementById("additional_notes").value = profile.additional_notes || "";

    // Clear existing tags
    topSkills.length = 0;
    interests.length = 0;
    document.getElementById("top-skills-list").innerHTML = "";
    document.getElementById("interests-list").innerHTML = "";

    // Add skills
    const topSkillsList = document.getElementById("top-skills-list");
    const topSkillsHidden = document.getElementById("top_skills");
    profile.top_skills.forEach(skill => addTag(topSkills, topSkillsList, topSkillsHidden, skill));

    // Add interests
    const interestsList = document.getElementById("interests-list");
    const interestsHidden = document.getElementById("interests");
    profile.interests.forEach(interest => addTag(interests, interestsList, interestsHidden, interest));

    showToast("Demo profile loaded");
  } catch (err) {
    showError(1, "Failed to load demo profile. Please try again.");
  }
}

/**
 * Generate questions
 */
async function generateQuestions() {
  // Validate form
  if (!validateForm()) {
    return;
  }

  // Collect context data
  context = {
    education_level: document.getElementById("education_level").value,
    field: document.getElementById("field").value,
    top_skills: topSkills,
    interests: interests,
    additional_notes: document.getElementById("additional_notes").value
  };

  showLoading(1, true);
  hideError(1);

  try {
    const response = await fetch("/api/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate questions");
    }

    sessionId = data.sessionId;
    questions = data.questions;
    answers = {};

    showToast("Questions generated successfully");
    goToStep(2);
    renderQuestions();
    renderProgressChips();
  } catch (err) {
    showError(1, err.message);
  } finally {
    showLoading(1, false);
  }
}

/**
 * Validate form
 */
function validateForm() {
  const education = document.getElementById("education_level").value;
  const field = document.getElementById("field").value;

  if (!education) {
    showError(1, "Please select your education/experience level");
    return false;
  }

  if (!field.trim()) {
    showError(1, "Please enter your field of study or work domain");
    return false;
  }

  if (topSkills.length < 1) {
    showError(1, "Please add at least 1 skill");
    return false;
  }

  if (interests.length < 1) {
    showError(1, "Please add at least 1 interest");
    return false;
  }

  return true;
}

/**
 * Render questions
 */
function renderQuestions() {
  questionsContainer.innerHTML = "";

  questions.forEach((q, index) => {
    const questionCard = document.createElement("div");
    questionCard.className = "question-card";
    questionCard.id = `question-${q.dimension}`;

    questionCard.innerHTML = `
      <div class="question-header">
        <span class="question-dimension">${q.dimension_name}</span>
        <span class="question-number">Question ${index + 1} of 8</span>
      </div>
      <p class="question-text">${escapeHtml(q.question)}</p>
      <div class="options-container">
        ${q.options.map(opt => `
          <div class="option-card" data-action="select-option" data-dimension="${q.dimension}" data-option="${opt.id}">
            <div class="option-radio"></div>
            <span class="option-text">${escapeHtml(opt.text)}</span>
          </div>
        `).join("")}
      </div>
    `;

    questionsContainer.appendChild(questionCard);
  });
}

/**
 * Render progress chips
 */
function renderProgressChips() {
  const answered = Object.keys(answers).length;
  progressChips.innerHTML = `
    <span class="progress-chip ${answered > 0 ? "answered" : ""}" id="progress-indicator">
      ${answered} of 8 answered
    </span>
  `;
}

/**
 * Select an option
 */
function selectOption(e) {
  const card = e.target.closest(".option-card");
  if (!card) return;

  const dimension = card.dataset.dimension;
  const optionId = card.dataset.option;

  // Remove previous selection
  const questionCard = card.closest(".question-card");
  questionCard.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));

  // Add selection
  card.classList.add("selected");

  // Update answers
  answers[dimension] = optionId;

  // Update progress
  renderProgressChips();

  // Enable submit if all answered
  submitAnswersBtn.disabled = Object.keys(answers).length < 8;
}

/**
 * Submit answers
 */
async function submitAnswers() {
  showLoading(2, true);
  hideError(2);

  try {
    const response = await fetch("/api/generate-verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        context,
        questions,
        answers
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate verdict");
    }

    verdict = data.verdict;
    sessionId = data.sessionId;

    showToast("Analysis complete");
    goToStep(3);
    renderResults();
    loadSessionDetails();
  } catch (err) {
    showError(2, err.message);
  } finally {
    showLoading(2, false);
  }
}

/**
 * Render results
 */
function renderResults() {
  document.getElementById("primary-career").textContent = verdict.primary_fit.career;
  document.getElementById("primary-reasoning").textContent = verdict.primary_fit.reasoning;

  document.getElementById("secondary-career").textContent = verdict.secondary_fit.career;
  document.getElementById("secondary-reasoning").textContent = verdict.secondary_fit.reasoning;
}

/**
 * Load session details
 */
async function loadSessionDetails() {
  if (!sessionId) return;

  try {
    const response = await fetch(`/api/session/${sessionId}`);
    const trail = await response.json();

    const sessionContent = document.getElementById("session-content");
    sessionContent.textContent = JSON.stringify(trail, null, 2);
  } catch (err) {
    console.error("Failed to load session details:", err);
  }
}

/**
 * Start over
 */
function startOver() {
  currentStep = 1;
  sessionId = null;
  context = null;
  questions = null;
  answers = {};
  verdict = null;

  // Clear form
  contextForm.reset();
  topSkills.length = 0;
  interests.length = 0;
  document.getElementById("top-skills-list").innerHTML = "";
  document.getElementById("interests-list").innerHTML = "";
  document.getElementById("top_skills").value = "";
  document.getElementById("interests").value = "";

  // Clear questions
  questionsContainer.innerHTML = "";
  progressChips.innerHTML = "";

  // Clear results
  document.getElementById("primary-career").textContent = "";
  document.getElementById("primary-reasoning").textContent = "";
  document.getElementById("secondary-career").textContent = "";
  document.getElementById("secondary-reasoning").textContent = "";
  document.getElementById("session-content").textContent = "";

  // Go to step 1
  goToStep(1);
}

/**
 * Go to a specific step
 */
function goToStep(step) {
  currentStep = step;

  // Hide all steps
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));

  // Show current step
  document.getElementById(`step-${step}`).classList.add("active");

  // Update indicator
  const labels = [
    "Step 1 of 3: Your Profile",
    "Step 2 of 3: Questions",
    "Step 3 of 3: Results"
  ];
  stepIndicator.textContent = labels[step - 1];
}

/**
 * Show loading
 */
function showLoading(step, show) {
  const loading = document.getElementById(`loading-${step}`);
  if (show) {
    loading.classList.add("active");
  } else {
    loading.classList.remove("active");
  }
}

/**
 * Show error
 */
function showError(step, message) {
  const errorEl = document.getElementById(`error-${step}`);
  errorEl.innerHTML = `
    <p>${escapeHtml(message)}</p>
    <button type="button" class="btn btn-secondary" data-action="retry-step-${step}">Try again</button>
  `;
  errorEl.classList.add("show");
}

/**
 * Hide error
 */
function hideError(step) {
  const errorEl = document.getElementById(`error-${step}`);
  errorEl.classList.remove("show");
  errorEl.innerHTML = "";
}

/**
 * Show toast
 */
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
