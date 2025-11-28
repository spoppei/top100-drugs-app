// =====================================
// GLOBAL STATE
// =====================================
let drugs = [];
let allIndications = [];

let questionType = "brand";   // "brand" or "indications"
let totalQuestions = 10;      // 0 means endless
let currentIndex = 0;         // how many questions have been shown
let score = 0;
let currentQuestion = null;
let quizActive = false;
let discoMode = false;


// Study vs exam mode
// false = study mode (instant feedback and confetti)
// true  = exam mode (no feedback until the end)
let examMode = false;

// For exam mode summary
let examAnswers = [];


// =====================================
// DATA LOADING
// =====================================
async function loadDrugs() {
  const res = await fetch("drugs.json");
  drugs = await res.json();

  // Build deduplicated pool of all indications (global)
  const set = new Set();
  drugs.forEach(d => {
    (d.indications || []).forEach(ind => set.add(ind));
  });
  allIndications = Array.from(set);

  updateScoreAndProgress();
}


// =====================================
// UI HELPERS
// =====================================

// Update label of the check/submit button based on mode
function updateCheckButtonLabel() {
  const checkBtn = document.getElementById("check-answer");
  if (!checkBtn) return;
  checkBtn.innerText = examMode ? "Submit Answer" : "Check Answer";
}

// Update text score, question counter, and progress bar
function updateScoreAndProgress() {
  const progressEl = document.getElementById("progress");
  const scoreEl = document.getElementById("score");
  const fill = document.getElementById("progress-fill");

  if (!quizActive) {
    progressEl.innerText = "";
    scoreEl.innerText = "";
    if (fill) fill.style.width = "0%";
    return;
  }

  if (totalQuestions === 0) {
    // Endless mode
    progressEl.innerText = `Question ${currentIndex}`;
  } else {
    progressEl.innerText = `Question ${currentIndex} of ${totalQuestions}`;
  }

  // Hide score in exam mode
  scoreEl.innerText = examMode ? "" : `Score: ${score}`;

  // Progress bar fill (only when not endless)
  if (fill) {
    if (totalQuestions !== 0) {
      const pct = (currentIndex / totalQuestions) * 100;
      fill.style.width = `${pct}%`;
    } else {
      fill.style.width = "0%";
    }
  }
}


// =====================================
// QUIZ FILTERING AND CONTROL
// =====================================

// Return only drugs whose quiz number is checked.
// If no boxes are checked, return all drugs.
function getFilteredDrugs() {
  const checks = document.querySelectorAll(".quiz-check:checked");
  const selected = Array.from(checks).map(c => c.value);

  if (selected.length === 0) return drugs;

  return drugs.filter(d => {
    // expects d.quiz like "Quiz 3"
    if (!d.quiz) return false;
    const num = d.quiz.replace("Quiz ", "").trim();
    return selected.includes(num);
  });
}

function startQuiz() {
  quizActive = true;
  currentIndex = 0;
  score = 0;
  currentQuestion = null;
  examAnswers = [];

  document.getElementById("feedback").innerText = "";
  document.getElementById("next-question").disabled = true;

  generateQuestion();
  updateScoreAndProgress();
}

function chooseQuestionType(type) {
  questionType = type;
  document.querySelectorAll(".qtype-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.qtype === type);
  });
}

// Main question generation. Stops when reaching totalQuestions.
function generateQuestion() {
  if (totalQuestions !== 0 && currentIndex >= totalQuestions) {
    endQuiz();
    return;
  }

  let q;
  if (questionType === "brand") {
    q = buildBrandQuestion();
  } else {
    q = buildIndicationsQuestion();
  }

  // If building the question failed (for example, no drugs match the filter)
  if (!q) {
    quizActive = false;
    document.getElementById("feedback").innerText = "No questions available for this selection.";
    return;
  }

  currentQuestion = q;
  currentIndex += 1;
  renderQuestion(q);
  updateScoreAndProgress();
}


// =====================================
// QUESTION BUILDERS
// =====================================

// Brand question: single correct brand
function buildBrandQuestion() {
  const pool = getFilteredDrugs();
  const candidates = pool.filter(d => d.brand && d.brand.length > 0);

  if (candidates.length === 0) {
    alert("No drugs available for these quiz selections.");
    return null;
  }

  const drug = candidates[Math.floor(Math.random() * candidates.length)];
  const correctBrand = drug.brand[Math.floor(Math.random() * drug.brand.length)];

  // Build distractor brand list (from filtered pool)
  const otherBrands = [];
  pool.forEach(d => {
    if (!d.brand) return;
    d.brand.forEach(b => {
      if (b !== correctBrand) {
        otherBrands.push(b);
      }
    });
  });

  shuffleArray(otherBrands);
  const distractors = otherBrands.slice(0, 3);

  const options = [
    { text: correctBrand, correct: true },
    ...distractors.map(b => ({ text: b, correct: false }))
  ];

  shuffleArray(options);

  return {
    type: "brand",
    drug,
    prompt: `Which brand name corresponds to ${drug.generic}?`,
    options,
    multiSelect: false
  };
}

// Indications question: select all that apply
function buildIndicationsQuestion() {
  const pool = getFilteredDrugs();
  const candidates = pool.filter(d => d.indications && d.indications.length > 0);

  if (candidates.length === 0) {
    alert("No drugs available for these quiz selections.");
    return null;
  }

  const drug = candidates[Math.floor(Math.random() * candidates.length)];
  const correctInds = drug.indications;

  // All indications from filtered pool
  const allFilteredInds = Array.from(new Set(pool.flatMap(d => d.indications || [])));

  // Decoys are indications that are not correct for this drug
  const decoyPool = allFilteredInds.filter(i => !correctInds.includes(i));
  shuffleArray(decoyPool);

  // Aim for total about 5 to 7 options
  const maxDecoys = Math.max(1, 6 - correctInds.length);
  const decoys = decoyPool.slice(0, maxDecoys);

  const options = [
    ...correctInds.map(i => ({ text: i, correct: true })),
    ...decoys.map(i => ({ text: i, correct: false }))
  ];

  shuffleArray(options);

  return {
    type: "indications",
    drug,
    prompt: `Which of the following are FDA indications for ${drug.generic}? Select all that apply.`,
    options,
    multiSelect: true
  };
}


// =====================================
// RENDERING
// =====================================
function renderQuestion(q) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-container");
  const feedbackEl = document.getElementById("feedback");
  const quizArea = document.getElementById("quiz-area");

  questionEl.innerText = q.prompt;
  optionsEl.innerHTML = "";
  feedbackEl.innerText = "";

  // Trigger fade animation
  quizArea.classList.remove("fade");
  void quizArea.offsetWidth; // force reflow
  quizArea.classList.add("fade");

  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerText = opt.text;
    btn.dataset.index = idx;

    btn.onclick = () => {
      if (q.multiSelect) {
        btn.classList.toggle("selected");
      } else {
        document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      }
    };

    optionsEl.appendChild(btn);
  });

  document.getElementById("check-answer").disabled = false;
  document.getElementById("next-question").disabled = true;
}


// =====================================
// CONFETTI
// =====================================
function shootConfetti() {
  const bursts = [
    { x: 0,   y: 0 },
    { x: 1,   y: 0 },
    { x: 0,   y: 1 },
    { x: 1,   y: 1 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 1 },
    { x: 0,   y: 0.5 },
    { x: 1,   y: 0.5 },
    { x: 0.5, y: 0.5 }
  ];

  bursts.forEach(origin => {
    confetti({
      particleCount: 200,
      spread: 120,
      startVelocity: 55,
      scalar: 1,
      origin
    });
  });
}

function launchDiscoConfetti() {
  // Confetti rainbow storms every time disco mode turns on
  const colors = ['#ff66a3', '#6a5acd', '#39d0ff', '#32cd32', '#ffa500'];

  for (let i = 0; i < 8; i++) {
    confetti({
      particleCount: 80,
      spread: 140,
      scalar: 1.2,
      origin: { x: Math.random(), y: Math.random() },
      colors: colors
    });
  }
}


// =====================================
// ANSWER CHECKING AND QUIZ FLOW
// =====================================
function checkAnswer() {
  if (!currentQuestion) return;

  const q = currentQuestion;
  const buttons = Array.from(document.querySelectorAll(".option-btn"));
  const selectedIndices = buttons
    .map((btn, idx) => (btn.classList.contains("selected") ? idx : null))
    .filter(i => i !== null);

  if (selectedIndices.length === 0) {
    document.getElementById("feedback").innerText = "Select at least one answer.";
    return;
  }

  // Determine correctness
  let allCorrect = true;
  buttons.forEach((btn, idx) => {
    const opt = q.options[idx];
    const isSelected = selectedIndices.includes(idx);

    if (opt.correct && !isSelected) allCorrect = false;
    if (!opt.correct && isSelected) allCorrect = false;
  });

  // EXAM MODE: store and move on, no feedback
  if (examMode) {
    examAnswers.push({
      question: q.prompt,
      drug: q.drug.generic,
      options: q.options,
      selected: selectedIndices,
      correct: allCorrect
    });

    if (allCorrect) score++;

    document.getElementById("next-question").disabled = false;
    document.getElementById("check-answer").disabled = true;
    document.getElementById("feedback").innerText = "";
    updateScoreAndProgress();
    return;
  }

  // STUDY MODE: show feedback and confetti
  buttons.forEach((btn, idx) => {
    const opt = q.options[idx];
    const isSelected = selectedIndices.includes(idx);

    if (opt.correct && isSelected) {
      btn.classList.add("correct");
    } else if (!opt.correct && isSelected) {
      btn.classList.add("incorrect");
    } else if (opt.correct && !isSelected) {
      btn.classList.add("correct");
    }
  });

  if (allCorrect) {
    score++;
    shootConfetti();
    document.getElementById("feedback").innerText = "Correct!";
  } else {
    document.getElementById("feedback").innerText = "Not quite. Review the green answers.";
  }

  // Lock answers
  buttons.forEach(btn => {
    btn.onclick = null;
  });

  document.getElementById("check-answer").disabled = true;
  document.getElementById("next-question").disabled = false;
  updateScoreAndProgress();
}

function nextQuestion() {
  if (!quizActive) return;

  if (totalQuestions !== 0 && currentIndex >= totalQuestions) {
    endQuiz();
    return;
  }

  generateQuestion();
}


// =====================================
// END QUIZ AND SUMMARY
// =====================================
function endQuiz() {
  quizActive = false;

  const feedbackEl = document.getElementById("feedback");
  const finalScore = score;
  const total = totalQuestions === 0 ? currentIndex : totalQuestions;
  const percent = (finalScore / total) * 100;

  let phrase = "";
  if (percent === 100) phrase = "Perfect score. You are a pharmaceutical menace.";
  else if (percent >= 80) phrase = "You’re cooking. My mom would be impressed.";
  else if (percent >= 50) phrase = "Solid attempt. The mitochondria are proud of your effort.";
  else phrase = "…Well. At least you tried. Try again and ascend.";

  // Exam mode summary with green/red highlights
  if (examMode) {
    let summary = `
      <div style="font-size:18px; margin-bottom:8px;">Score: ${finalScore} / ${total}</div>
      <div style="color:#ff66a3; margin-bottom:10px;">${phrase}</div>
      <hr>
      <div><strong>Review:</strong></div>
    `;

    examAnswers.forEach(a => {
      summary += `
        <div style="margin-top:15px; text-align:left;">
          <strong>${a.question}</strong><br><br>
      `;

      a.options.forEach((opt, idx) => {
        const chosen = a.selected.includes(idx);

        // Decide coloring: green for correct, red for wrong selection, neutral otherwise
        let style = "";

        if (opt.correct) {
          style = "background:#b6ffb6; border:1px solid #4caf50;";
        } else if (chosen && !opt.correct) {
          style = "background:#ffbaba; border:1px solid #e57373;";
        } else {
          style = "background:#f7f7f7; border:1px solid #dddddd;";
        }

        const selectedTag = chosen ? "(selected)" : "";

        summary += `
          <div style="
            ${style}
            padding:8px;
            margin:4px 0;
            border-radius:6px;
          ">
            ${opt.text} ${selectedTag}
          </div>
        `;
      });

      summary += `</div>`;
    });

    feedbackEl.innerHTML = summary;
  } else {
    // Study mode summary
    feedbackEl.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 8px;">
        Quiz complete! You scored <strong>${finalScore}</strong> out of <strong>${total}</strong>.
      </div>
      <div style="color: #ff66a3;">${phrase}</div>
    `;
  }

  document.getElementById("check-answer").disabled = true;
  document.getElementById("next-question").disabled = true;
}


// =====================================
// UTILS
// =====================================
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}


// =====================================
// DOM READY: WIRE UP LISTENERS
// =====================================
window.addEventListener("DOMContentLoaded", () => {
  loadDrugs();

  // Question type buttons
  document.querySelectorAll(".qtype-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      chooseQuestionType(btn.dataset.qtype);
    });
  });

  // Quiz checkboxes
  document.querySelectorAll(".quiz-check").forEach(box => {
    box.addEventListener("change", () => {
      quizActive = false;
      document.getElementById("feedback").innerText = "Quiz settings changed.";
    });
  });

  // Select all / clear all
  document.getElementById("select-all-quizzes").addEventListener("click", () => {
    document.querySelectorAll(".quiz-check").forEach(b => (b.checked = true));
  });

  document.getElementById("clear-all-quizzes").addEventListener("click", () => {
    document.querySelectorAll(".quiz-check").forEach(b => (b.checked = false));
  });

  // Number of questions
  document.getElementById("num-questions").addEventListener("change", (e) => {
    totalQuestions = Number(e.target.value);
  });

  // Start or reset quiz
  document.getElementById("start-quiz").addEventListener("click", () => {
    totalQuestions = Number(document.getElementById("num-questions").value);
    startQuiz();
  });

  // Answer buttons
  document.getElementById("check-answer").addEventListener("click", checkAnswer);
  document.getElementById("next-question").addEventListener("click", nextQuestion);

  // Mode toggle (Study vs Exam)
  const modeBtn = document.getElementById("mode-toggle");
  modeBtn.addEventListener("click", () => {
    examMode = !examMode;
    updateCheckButtonLabel();

    if (examMode) {
      modeBtn.innerText = "Exam Mode";
      modeBtn.classList.add("exam");
    } else {
      modeBtn.innerText = "Study Mode";
      modeBtn.classList.remove("exam");
    }

    quizActive = false;
    document.getElementById("feedback").innerText = "Mode changed.";
  });

  // Dark mode toggle
  const darkBtn = document.getElementById("dark-toggle");
  darkBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
      darkBtn.innerText = "Light Mode";
    } else {
      darkBtn.innerText = "Dark Mode";
    }
  });

  // Initialize label for check button
  updateCheckButtonLabel();
});

// DISCO MODE TOGGLE
const discoBall = document.getElementById("disco-ball");

discoBall.addEventListener("click", () => {
  discoMode = !discoMode;

  if (discoMode) {
    document.body.classList.add("disco-bg");
    discoBall.classList.add("disco-spin");
    launchDiscoConfetti();
  } else {
    document.body.classList.remove("disco-bg");
    discoBall.classList.remove("disco-spin");
  }
});

