const $ = (selector) => document.querySelector(selector);
const timeEl = $('#time');
const scoreEl = $('#score');
const bestEl = $('#best');
const questionEl = $('#question');
const hintEl = $('#hint');
const answerButtons = [...document.querySelectorAll('.answer')];
const startButton = $('#start');

let score = 0;
let streak = 0;
let seconds = 60;
let solution = 0;
let playing = false;
let locked = false;
let timer = null;

chrome.storage.local.get({ gameBest: 0 }).then(({ gameBest }) => {
  bestEl.textContent = String(gameBest || 0);
});

startButton.addEventListener('click', startGame);
answerButtons.forEach((button) => button.addEventListener('click', () => answer(Number(button.dataset.index))));
document.addEventListener('keydown', (event) => {
  if (!playing || locked || !/^[1-4]$/.test(event.key)) return;
  answer(Number(event.key) - 1);
});

function startGame() {
  clearInterval(timer);
  score = 0;
  streak = 0;
  seconds = 60;
  playing = true;
  locked = false;
  scoreEl.textContent = '0';
  timeEl.textContent = '60';
  timeEl.classList.remove('urgent');
  hintEl.textContent = 'Выбирай правильный ответ';
  startButton.hidden = true;
  makeQuestion();
  timer = setInterval(() => {
    seconds -= 1;
    timeEl.textContent = String(seconds);
    if (seconds <= 10) timeEl.classList.add('urgent');
    if (seconds <= 0) endGame();
  }, 1000);
}

function makeQuestion() {
  const level = score < 8 ? 1 : score < 20 ? 2 : 3;
  const max = level === 1 ? 12 : level === 2 ? 25 : 50;
  const operations = level === 1 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let a = randomInt(2, max);
  let b = randomInt(2, level === 1 ? 10 : 15);

  if (operation === '-') [a, b] = [Math.max(a, b), Math.min(a, b)];
  if (operation === '÷') {
    const divisor = randomInt(2, 12);
    const quotient = randomInt(2, 12);
    a = divisor * quotient;
    b = divisor;
  }
  solution = operation === '+' ? a + b : operation === '-' ? a - b : operation === '×' ? a * b : a / b;
  questionEl.textContent = `${a} ${operation} ${b} = ?`;

  const choices = new Set([solution]);
  while (choices.size < 4) {
    const offset = randomInt(1, Math.max(5, Math.ceil(Math.abs(solution) * 0.25)));
    const distractor = Math.random() < 0.5 ? solution + offset : solution - offset;
    if (distractor >= 0 && distractor !== solution) choices.add(distractor);
  }
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  answerButtons.forEach((button, index) => {
    button.textContent = String(shuffled[index]);
    button.dataset.value = String(shuffled[index]);
    button.disabled = false;
    button.classList.remove('correct', 'wrong');
  });
}

function answer(index) {
  if (!playing || locked) return;
  locked = true;
  const button = answerButtons[index];
  const selected = Number(button.dataset.value);
  answerButtons.forEach((item) => { item.disabled = true; });

  if (selected === solution) {
    streak += 1;
    score += 1 + (streak % 5 === 0 ? 1 : 0);
    scoreEl.textContent = String(score);
    button.classList.add('correct');
    hintEl.textContent = streak % 5 === 0 ? 'Серия из 5! +2 очка' : 'Верно! Так держать';
  } else {
    streak = 0;
    button.classList.add('wrong');
    const correctButton = answerButtons.find((item) => Number(item.dataset.value) === solution);
    correctButton?.classList.add('correct');
    hintEl.textContent = `Ответ: ${solution}. Следующий пример!`;
  }

  setTimeout(() => {
    if (!playing) return;
    locked = false;
    makeQuestion();
  }, 420);
}

async function endGame() {
  playing = false;
  locked = true;
  clearInterval(timer);
  answerButtons.forEach((button) => { button.disabled = true; });
  timeEl.textContent = '0';
  hintEl.textContent = `Время! Твой счёт — ${score}. Попробуешь ещё?`;
  questionEl.textContent = 'Раунд завершён';
  startButton.textContent = 'Ещё раунд  →';
  startButton.hidden = false;
  const { gameBest = 0 } = await chrome.storage.local.get({ gameBest: 0 });
  if (score > gameBest) {
    await chrome.storage.local.set({ gameBest: score });
    bestEl.textContent = String(score);
    hintEl.textContent = `Новый рекорд — ${score}! Ещё раунд?`;
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
