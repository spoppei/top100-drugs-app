let drugs = [];
let shuffled = [];
let index = 0;
let mode = "brand"; 
let showingBack = false;
let appState = "flashcard";

// Load JSON
async function loadDrugs() {
  const res = await fetch("drugs.json");
  drugs = await res.json();
  shuffleCards();
  nextCard();
}

// Fisher-Yates shuffle
function shuffleCards() {
  shuffled = [...drugs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  index = 0;
}

// Show next flashcard
function nextCard() {
  resetCardHTML();

  if (index >= shuffled.length) {
    shuffleCards();
  }

  const current = shuffled[index];
  index++;

  showingBack = false;

  document.getElementById("front").innerText =
    "Generic: " + current.generic;

  let backText = "";
  if (mode === "brand") backText = "Brand: " + current.brand.join(", ");
  if (mode === "class") backText = "Class: " + current.class;
  if (mode === "indications") backText = "Indications: " + current.indications.join(", ");

  document.getElementById("back").innerText = backText;
}

// Flip (show/hide answer)
function flipCard() {
  showingBack = !showingBack;
  document.getElementById("back").style.display = showingBack ? "block" : "none";

  document.getElementById("flip").innerText =
    showingBack ? "Hide Answer" : "Show Answer";
}

// MULTIPLE CHOICE MODE
function generateMCQ() {
  resetCardHTML();

  const correct = drugs[Math.floor(Math.random() * drugs.length)];
  const choices = [correct];

  while (choices.length < 4) {
    const rand = drugs[Math.floor(Math.random() * drugs.length)];
    if (!choices.includes(rand)) choices.push(rand);
  }

  choices.sort(() => Math.random() - 0.5);

  // Question text
  document.getElementById("front").innerHTML =
    `<strong>Which brand goes with:</strong><br>${correct.generic}`;

  // Clear back since MCQ doesn't use it
  document.getElementById("back").style.display = "none";

  // Add options
  const card = document.getElementById("card");

  choices.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "mcq-option";
    btn.innerText = c.brand.join(", ");
    btn.onclick = () => {
      if (c === correct) {
        btn.style.backgroundColor = "lightgreen";
      } else {
        btn.style.backgroundColor = "lightpink";
      }
    };
    card.appendChild(document.createElement("br"));
    card.appendChild(btn);
  });
}

function resetCardHTML() {
  document.getElementById("card").innerHTML =
    `<p id="front"></p><p id="back" style="display:none;"></p>`;
}

document.getElementById("flip").onclick = flipCard;
document.getElementById("next").onclick = () => {
  if (appState === "mcq") {
    generateMCQ();
  } else {
    nextCard();
  }
};

document.querySelectorAll("#mode-select button[data-mode]").forEach(btn => {
  btn.onclick = () => {
    mode = btn.dataset.mode;
    nextCard();
  };
});

document.getElementById("mcq").onclick = () => {
  appState = "mcq";
  generateMCQ();
};

loadDrugs();
