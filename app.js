/************************************************************
 * GLOBAL STATE
 ************************************************************/
let drugs = [];
let allIndications = [];
let questionType = "brand";  // "brand" or "indications"
let totalQuestions = 10;     // 0 = endless mode
let currentIndex = 0;
let score = 0;
let currentQuestion = null;
let quizActive = false;


/************************************************************
 * LOAD DRUG DATA ON STARTUP
 ************************************************************/
async function loadDrugs() {
  const res = await fetch("drugs.json");
  drugs = await res.json();

  // Build single set of all indications
  const set = new Set();
  drugs.forEach(d => (d.indications || []).forEach(ind => set.add(ind)));
  allIndications = Array.from(set);

  updateScoreAndProgress();
}


/************************************************************
 * FILTER DRUGS BY SELECTED QUIZ CHECKBOXES
 ************************************************************/
function getFilteredDrugs() {
  const checks = document.querySelectorAll(".quiz-check:checked");
  const selected = Array.from(checks).map(c => c.value);

  // If no quizzes selected → return all drugs
  if (selected.length === 0) {
  alert("Please select at least one quiz category.");
  return [];
}


  return drugs.filter(d => {
    const num = d.quiz.replace("Quiz ", "").trim();
    return selected.includes(num);
  });
}


/************************************************************
 * UPDATE SCORE AND PROGRESS BAR
 ************************************************************/
function updateScoreAndProgress() {
  const progressEl = document.getElementById("progress");
  const scoreEl = document.getElementById("score");

  if (!quizActive) {
    progressEl.innerText = "";
    scoreEl.innerText = "";
    return;
  }

  // Endless vs fixed question count
  if (totalQuestions === 0) {
    progressEl.innerText = `Question ${currentIndex}`;
  } else {
    progressEl.innerText = `Question ${currentIndex} of ${totalQuestions}`;
  }

  scoreEl.innerText = `Score: ${score}`;
}


/************************************************************
 * START / RESET QUIZ
 ************************************************************/
function startQuiz() {
  quizActive = true;
  currentIndex = 0;
  score = 0;
  currentQuestion = null;

  document.getElementById("feedback").innerText = "";
  document.getElementById("next-question").disabled = true;

  generateQuestion();
  updateScoreAndProgress();
}


/************************************************************
 * CHOOSE QUESTION TYPE: BRAND or INDICATIONS
 ************************************************************/
function chooseQuestionType(type) {
  questionType = type;

  document.querySelectorAll(".qtype-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.qtype === type);
  });
}


/************************************************************
 * GENERATE A QUESTION
 ************************************************************/
function generateQuestion() {
  // Stop if quiz reached limit
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

  currentQuestion = q;
  currentIndex++;

  renderQuestion(q);
  updateScoreAndProgress();
}


/************************************************************
 * BRAND QUESTION LOGIC
 ************************************************************/
function buildBrandQuestion() {
  const pool = getFilteredDrugs();
  const candidates = pool.filter(d => d.brand && d.brand.length > 0);

  if (candidates.length === 0) {
    alert("No drugs available for these quiz selections.");
    return;
  }

  const drug = candidates[Math.floor(Math.random() * candidates.length)];
  const correctBrand = drug.brand[Math.floor(Math.random() * drug.brand.length)];

  // Build distractors from the filtered pool
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


/************************************************************
 * CONFETTI CELEBRATION
 ************************************************************/
function shootConfetti() {
  confetti({
    particleCount: 300,
    spread: 120,
    startVelocity: 45,
    origin: { y: 0.6 }
  });

  confetti({
    particleCount: 300,
    angle: 60,
    spread: 70,
    origin: { x: 0 }
  });

  confetti({
    particleCount: 300,
    angle: 120,
    spread: 70,
    origin: { x: 1 }
  });

  confetti({
    particleCount: 300,
    spread: 120,
    scalar: 0.8,
    origin: { y: 0.3 }
  });
}


/************************************************************
 * INDICATIONS QUESTION LOGIC
 ************************************************************/
function buildIndicationsQuestion() {
  const pool = getFilteredDrugs();
  const candidates = pool.filter(d => d.indications && d.indications.length > 0);

  if (candidates.length === 0) {
    alert("No drugs available for these quiz selections.");
    return;
  }

  const drug = candidates[Math.floor(Math.random() * candidates.length)];
  const correctInds = drug.indications;

  // Decoy indications only from filtered drugs
  const filteredInds = new Set();
  pool.forEach(d => (d.indications || []).forEach(i => filteredInds.add(i)));

  const allFilteredInds = Array.from(filteredInds);
  const decoyPool = allFilteredInds.filter(ind => !correctInds.includes(ind));

  shuffleArray(decoyPool);

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


/************************************************************
 * RENDER THE QUESTION + OPTIONS
 ************************************************************/
function renderQuestion(q) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-container");
  const feedbackEl = document.getElementById("feedback");

  questionEl.innerText = q.prompt;
  optionsEl.innerHTML = "";
  feedbackEl.innerText = "";

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


/************************************************************
 * CHECK ANSWER
 ************************************************************/
function checkAnswer() {
  if (!currentQuestion) return;

  const q = currentQuestion;
  const buttons = Array.from(document.querySelectorAll(".option-btn"));
  const selectedIndices = buttons
    .map((btn, idx) => btn.classList.contains("selected") ? idx : null)
    .filter(idx => idx !== null);

  if (selectedIndices.length === 0) {
    document.getElementById("feedback").innerText = "Select at least one answer.";
    return;
  }

  // ---- Evaluate ----
  let allCorrect = true;

  buttons.forEach((btn, idx) => {
    const opt = q.options[idx];
    const isSelected = selectedIndices.includes(idx);

    if (opt.correct && isSelected) {
      btn.classList.add("correct");
    } else if (!opt.correct && isSelected) {
      btn.classList.add("incorrect");
      allCorrect = false;
    } else if (opt.correct && !isSelected) {
      btn.classList.add("correct");
      allCorrect = false;
    }
  });

  if (allCorrect) {
    score++;
    shootConfetti();
    document.getElementById("feedback").innerText = "Correct!";
  } else {
    document.getElementById("feedback").innerText = "Not quite. Review the green answers.";
  }

  // Lock buttons
  buttons.forEach(btn => btn.onclick = null);

  document.getElementById("check-answer").disabled = true;
  document.getElementById("next-question").disabled = false;

  updateScoreAndProgress();
}


/************************************************************
 * NEXT QUESTION
 ************************************************************/
function nextQuestion() {
  if (!quizActive) return;

  if (totalQuestions !== 0 && currentIndex >= totalQuestions) {
    endQuiz();
    return;
  }

  generateQuestion();
}


/************************************************************
 * END QUIZ
 ************************************************************/
function endQuiz() {
  quizActive = false;

  const feedbackEl = document.getElementById("feedback");
  const finalScore = score;
  const total = totalQuestions === 0 ? currentIndex : totalQuestions;

  const percent = (finalScore / total) * 100;
  let phrase = "";

  if (percent === 100) {
    phrase = "Perfect score. You are a pharmaceutical menace.";
  } else if (percent >= 80) {
    phrase = "You’re cooking. My mom would be impressed.";
  } else if (percent >= 50) {
    phrase = "Solid attempt. The mitochondria are proud of your effort.";
  } else {
    phrase = "…Well. At least you tried. Try again and ascend.";
  }

  feedbackEl.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 8px;">
        Quiz complete! You scored <strong>${finalScore}</strong> out of <strong>${total}</strong>.
      </div>
      <div style="color: #ff66a3;">${phrase}</div>
    `;

  document.getElementById("check-answer").disabled = true;
  document.getElementById("next-question").disabled = true;
}


/************************************************************
 * SHUFFLE ARRAY (Fisher-Yates)
 ************************************************************/
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}


/************************************************************
 * INITIALIZE EVENT LISTENERS
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  loadDrugs();

  // Question type buttons
  document.querySelectorAll(".qtype-btn").forEach(btn => {
    btn.addEventListener("click", () => chooseQuestionType(btn.dataset.qtype));
  });

  // Checkbox quiz selectors
  document.querySelectorAll(".quiz-check").forEach(box => {
    box.addEventListener("change", () => {
      quizActive = false;
      document.getElementById("feedback").innerText = "Quiz settings changed.";
    });
  });

  // Select all
  document.getElementById("select-all-quizzes").addEventListener("click", () => {
    document.querySelectorAll(".quiz-check").forEach(b => b.checked = true);
  });

  // Clear all
  document.getElementById("clear-all-quizzes").addEventListener("click", () => {
    document.querySelectorAll(".quiz-check").forEach(b => b.checked = false);
  });

  // Number of questions
  document.getElementById("num-questions").addEventListener("change", e => {
    totalQuestions = Number(e.target.value);
  });

  // Start Quiz
  document.getElementById("start-quiz").addEventListener("click", () => {
    totalQuestions = Number(document.getElementById("num-questions").value);
    startQuiz();
  });

  // Check + Next
  document.getElementById("check-answer").addEventListener("click", checkAnswer);
  document.getElementById("next-question").addEventListener("click", nextQuestion);
});
