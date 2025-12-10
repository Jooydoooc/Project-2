/* ============================================================
   GLOBAL VARIABLES
============================================================ */
let currentUser = null;
let currentBook = null;
let currentUnit = null;

let speechSynthesisEngine = window.speechSynthesis;
let utterance = null;
let isReading = false;

let isSkimming = false;
let skimmingInterval = null;

let foundWords = new Set();

/* ============================================================
   PAGE INITIALIZATION
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    loadTheme();

    const page = window.location.pathname;

    if (page.includes("index.html") || page === "/") {
        initLoginPage();
    } 
    else if (page.includes("books")) {
        checkUser();
        initBooksPage();
    } 
    else if (page.includes("unit")) {
        checkUser();
        initUnitPage();
    }
});

/* ============================================================
   USER & AUTH HELPERS
============================================================ */
function checkUser() {
    const saved = localStorage.getItem("readingUser");
    if (!saved) window.location.href = "/index.html";
    currentUser = JSON.parse(saved);
}

function saveUser(user) {
    localStorage.setItem("readingUser", JSON.stringify(user));
}

/* ============================================================
   THEME SYSTEM
============================================================ */
function loadTheme() {
    const theme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
}

function setTheme(theme) {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
}

/* Show/Hide Settings Menu */
document.addEventListener("click", (e) => {
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsMenu = document.getElementById("settingsMenu");

    if (settingsBtn && settingsBtn.contains(e.target)) {
        settingsMenu.classList.toggle("show");
    } 
    else if (settingsMenu && !settingsMenu.contains(e.target)) {
        settingsMenu.classList.remove("show");
    }
});

/* Handle Theme Buttons */
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("theme-btn")) {
        const theme = e.target.dataset.theme;
        setTheme(theme);
    }
});

/* ============================================================
   LOGIN PAGE
============================================================ */
function initLoginPage() {
    const form = document.getElementById("loginForm");

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const surname = document.getElementById("surname").value.trim();
        const group = document.getElementById("group").value;

        const user = {
            name,
            surname,
            group,
            loginTime: new Date().toISOString()
        };

        saveUser(user);

        /* Redirect to books page */
        window.location.href = "/books";
    });
}

/* ============================================================
   BOOKS PAGE
============================================================ */
function initBooksPage() {
    displayUserInfo();
    loadBooks();
}

function displayUserInfo() {
    const el = document.getElementById("userInfo");
    if (!el || !currentUser) return;

    el.innerHTML = `
        <div>
            <div><strong>${currentUser.name} ${currentUser.surname}</strong></div>
            <div style="font-size: 0.9rem; color: var(--text-light);">Group ${currentUser.group}</div>
        </div>
    `;
}

async function loadBooks() {
    const grid = document.getElementById("booksGrid");

    try {
        const res = await fetch("/books.json");
        const data = await res.json();

        grid.innerHTML = "";

        data.books.forEach(book => {
            const card = document.createElement("div");
            card.className = "book-card";

            if (book.status === "available") {
                card.addEventListener("click", () => {
                    window.location.href = `/unit?book=${book.id}&unit=1.1`;
                });
            } else {
                card.style.opacity = "0.6";
            }

            card.innerHTML = `
                <h3>${book.title}</h3>
                <p>${book.description}</p>
                <div style="margin-top: 10px; font-weight: 600;">
                    ${book.status === "available" ? "Available ✔" : "Coming Soon…"}
                </div>
            `;

            grid.appendChild(card);
        });

    } catch (err) {
        console.error("Error loading books:", err);
        grid.innerHTML = `<p style="color:red;">Failed to load books.json</p>`;
    }
}

/* ============================================================
   UNIT PAGE
============================================================ */
function initUnitPage() {
    displayUserInfo();
    loadUnit();
    initReadingControls();
}

async function loadUnit() {
    const header = document.getElementById("unitHeader");

    try {
        const res = await fetch("/books.json");
        const data = await res.json();

        const url = new URL(window.location.href);
        const bookID = parseInt(url.searchParams.get("book"));
        const unitID = url.searchParams.get("unit");

        currentBook = data.books.find(b => b.id === bookID);
        currentUnit = currentBook.units.find(u => u.id === unitID);

        header.innerHTML = `
            <h1>${currentBook.title}</h1>
            <h2>Unit ${currentUnit.id}: ${currentUnit.title}</h2>
        `;

        loadText();
        loadVocabulary();
        loadGrammar();
        loadExercises();

    } catch (err) {
        console.error("Error loading unit:", err);
        header.innerHTML = `<p style="color:red;">Failed to load unit</p>`;
    }
}

/* ------------------------------------------------------------
   TEXT + VOCABULARY HIGHLIGHT
------------------------------------------------------------ */
function loadText() {
    const textBox = document.getElementById("textContent");

    const paragraphs = currentUnit.text.split("\n\n")
        .map(p => `<p>${p}</p>`)
        .join("");

    textBox.innerHTML = paragraphs;

    highlightWords();
}

function highlightWords() {
    const vocabWords = currentUnit.vocabulary.map(v => v.word.toLowerCase());
    let html = document.getElementById("textContent").innerHTML;

    vocabWords.forEach(word => {
        const re = new RegExp(`\\b${word}\\b`, "gi");
        html = html.replace(re, `<span class="vocab-word" data-word="${word}">${word}</span>`);
    });

    document.getElementById("textContent").innerHTML = html;

    document.querySelectorAll(".vocab-word").forEach(span => {
        span.addEventListener("click", () => openVocabPopup(span.dataset.word));
    });
}

/* ------------------------------------------------------------
   VOCABULARY SECTION
------------------------------------------------------------ */
function loadVocabulary() {
    const grid = document.getElementById("vocabularyGrid");

    let html = "";
    currentUnit.vocabulary.forEach(v => {
        html += `
            <div class="vocab-card" data-word="${v.word.toLowerCase()}">
                <div class="word">${v.word}</div>
                <div class="translation">${v.translation}</div>
            </div>
        `;
    });

    grid.innerHTML = html;

    document.querySelectorAll(".vocab-card").forEach(card => {
        card.addEventListener("click", () => openVocabPopup(card.dataset.word));
    });

    updateVocabStats();
}

function updateVocabStats() {
    document.getElementById("foundCount").textContent = foundWords.size;
    document.getElementById("notFoundCount").textContent =
        currentUnit.vocabulary.length - foundWords.size;
}

/* ------------------------------------------------------------
   VOCAB POPUP
------------------------------------------------------------ */
function openVocabPopup(word) {
    const vocab = currentUnit.vocabulary.find(v => v.word.toLowerCase() === word);

    foundWords.add(word);
    updateVocabStats();

    const popup = document.getElementById("vocabPopup");
    const body = document.getElementById("popupBody");

    body.innerHTML = `
        <h2>${vocab.word}</h2>
        <p><strong>Meaning:</strong> ${vocab.translation}</p>
        <p><strong>Definition:</strong> ${vocab.definition}</p>
        <p><em>${vocab.example}</em></p>
    `;

    popup.classList.add("show");
}

function closeVocabPopup() {
    document.getElementById("vocabPopup").classList.remove("show");
}

/* ============================================================
   GRAMMAR
============================================================ */
function loadGrammar() {
    const box = document.getElementById("grammarContent");
    const g = currentUnit.grammar;

    box.innerHTML = `
        <h3>${g.theme}</h3>
        <p>${g.description}</p>
        <div class="grammar-examples">
            ${g.examples.map(e => `<div>• ${e}</div>`).join("")}
        </div>
    `;
}

/* ============================================================
   EXERCISES
============================================================ */
function loadExercises() {
    const grid = document.getElementById("exercisesGrid");

    grid.innerHTML = currentUnit.exercises
        .map((ex, idx) => `
            <div class="exercise-card" data-index="${idx}">
                <h4>${ex.question}</h4>

                ${ex.options.map((opt, i) => `
                    <div class="option" data-opt="${i}">
                        ${String.fromCharCode(65 + i)}. ${opt}
                    </div>
                `).join("")}

            </div>
        `)
        .join("");

    document.querySelectorAll(".option").forEach(opt => {
        opt.addEventListener("click", () => checkExercise(opt));
    });
}

function checkExercise(option) {
    const card = option.closest(".exercise-card");
    const exIndex = parseInt(card.dataset.index);

    const selected = parseInt(option.dataset.opt);
    const correct = currentUnit.exercises[exIndex].correct;

    /* Mark colors */
    if (selected === correct) {
        option.classList.add("correct");
    } else {
        option.classList.add("incorrect");
        card.querySelector(`[data-opt="${correct}"]`).classList.add("correct");
    }

    /* Lock options */
    card.querySelectorAll(".option").forEach(o => {
        o.style.pointerEvents = "none";
    });
}

/* ============================================================
   READ ALOUD
============================================================ */
function initReadingControls() {
    const readBtn = document.getElementById("readAloudBtn");
    const speed = document.getElementById("readingSpeed");
    const speedValue = document.getElementById("speedValue");

    readBtn.addEventListener("click", toggleReadAloud);

    speed.addEventListener("input", () => {
        speedValue.textContent = (speed.value / 100).toFixed(1) + "x";
        if (utterance) utterance.rate = speed.value / 100;
    });

    document.getElementById("skimmingBtn").addEventListener("click", toggleSkimming);
}

function toggleReadAloud() {
    const btn = document.getElementById("readAloudBtn");
    const text = document.getElementById("textContent").innerText;

    if (!isReading) {
        utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = document.getElementById("readingSpeed").value / 100;

        utterance.onend = () => {
            isReading = false;
            btn.classList.remove("active");
        };

        speechSynthesisEngine.speak(utterance);

        isReading = true;
        btn.classList.add("active");
    } else {
        speechSynthesisEngine.cancel();
        isReading = false;
        btn.classList.remove("active");
    }
}

/* ============================================================
   SKIMMING
============================================================ */
function toggleSkimming() {
    const btn = document.getElementById("skimmingBtn");
    const textBox = document.getElementById("textContent");

    if (!isSkimming) {
        isSkimming = true;
        btn.classList.add("active");

        const fullText = currentUnit.text;
        let i = 0;

        skimmingInterval = setInterval(() => {
            if (i >= fullText.length) {
                clearInterval(skimmingInterval);
                isSkimming = false;
                btn.classList.remove("active");
                return;
            }

            textBox.innerHTML = `
                <span>${fullText.substring(0, i)}</span>
                <span style="color: transparent;">${fullText.substring(i)}</span>
            `;

            i++;
        }, 20);

    } else {
        clearInterval(skimmingInterval);
        isSkimming = false;
        btn.classList.remove("active");
        loadText();
    }
}
