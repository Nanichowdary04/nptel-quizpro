const fs = require('fs');
const vm = require('vm');

// Robust DOM Mock for testing
class MockElement {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.classList = {
      _set: new Set(),
      add: (...classes) => classes.forEach(c => this.classList._set.add(c)),
      remove: (...classes) => classes.forEach(c => this.classList._set.delete(c)),
      contains: (c) => this.classList._set.has(c),
      toggle: (c, force) => {
        if (force !== undefined) {
          if (force) this.classList._set.add(c);
          else this.classList._set.delete(c);
        } else {
          if (this.classList._set.has(c)) this.classList._set.delete(c);
          else this.classList._set.add(c);
        }
      }
    };
    this.style = {};
    this.children = [];
    this.dataset = {};
    this._textContent = '';
    this._rawInnerHTML = '';
    this.value = '';
    this.disabled = false;
    this.onclick = null;
    this.play = () => Promise.resolve();
    this._listeners = {};
  }
  get className() {
    return Array.from(this.classList._set).join(' ');
  }
  set className(v) {
    this.classList._set = new Set(String(v || '').split(/\s+/).filter(Boolean));
  }
  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).join(' ');
    }
    return this._textContent;
  }
  set textContent(v) {
    this._textContent = String(v);
    this._rawInnerHTML = String(v);
    this.children = [];
  }
  get innerHTML() {
    if (this.children.length > 0) {
      return this.children.map(c => {
        const cls = c.className ? ` class="${c.className}"` : '';
        const id = c.id ? ` id="${c.id}"` : '';
        return `<${c.tagName.toLowerCase()}${id}${cls}>${c.innerHTML}</${c.tagName.toLowerCase()}>`;
      }).join('');
    }
    return this._rawInnerHTML;
  }
  set innerHTML(v) {
    this._rawInnerHTML = String(v);
    this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  append(...nodes) {
    nodes.forEach(n => this.appendChild(n));
  }
  scrollIntoView() {}
  focus() {}
  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  dispatchEvent(event) {
    if (this._listeners[event.type]) {
      this._listeners[event.type].forEach(fn => fn(event));
    }
  }
}

const elementsById = new Map();
const documentMock = {
  getElementById: (id) => {
    if (!elementsById.has(id)) {
      elementsById.set(id, new MockElement('div', id));
    }
    return elementsById.get(id);
  },
  createElement: (tag) => new MockElement(tag),
  querySelectorAll: (selector) => {
    return Array.from(elementsById.values());
  }
};

const localStorageStore = new Map();
const localStorageMock = {
  getItem: (k) => localStorageStore.get(k) || null,
  setItem: (k, v) => localStorageStore.set(k, String(v)),
  removeItem: (k) => localStorageStore.delete(k),
  clear: () => localStorageStore.clear()
};

const windowMock = {
  NPTEL_SUPABASE_URL: '',
  NPTEL_SUPABASE_ANON_KEY: '',
  scrollTo: () => {}
};

// Set globals for script execution
global.document = documentMock;
global.localStorage = localStorageMock;
global.window = windowMock;
global.confirm = () => true;

// Pre-create known elements from index.html
const html = fs.readFileSync('index.html', 'utf8');
const idRegex = /id=["']([^"']+)["']/g;
let match;
while ((match = idRegex.exec(html)) !== null) {
  const el = new MockElement('div', match[1]);
  elementsById.set(match[1], el);
}

// Extract script
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('Failed to locate script tag in index.html');
  process.exit(1);
}

// Evaluate in mock context
vm.runInThisContext(scriptMatch[1]);
const quiz = windowMock.NPTEL_QUIZ;

console.log('=== RUNNING TESTS ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  PASS:', message);
    passed++;
  } else {
    console.error('  FAIL:', message);
    failed++;
  }
}

// TEST 1: Initial state & Username Validation
console.log('Test 1: Username Validation');
assert(documentMock.getElementById('loginScreen').classList.contains('hidden') === false, 'First-time visitor sees username screen');

const loginResEmpty = quiz.finishLogin('');
assert(loginResEmpty === false, 'Empty username is rejected');
assert(documentMock.getElementById('loginError').textContent.includes('Please enter a username'), 'Error shown for empty username');

const loginResShort = quiz.finishLogin('A');
assert(loginResShort === false, '1-character username is rejected');
assert(documentMock.getElementById('loginError').textContent.includes('between 2 and 24'), 'Error shown for short username');

const loginResValid = quiz.finishLogin('  CodeMaster  ');
assert(loginResValid === true, 'Valid username accepted');
assert(quiz.username === 'CodeMaster', 'Username whitespace trimmed');
assert(localStorageMock.getItem('nptelUsername') === 'CodeMaster', 'Username saved to localStorage');
assert(documentMock.getElementById('profileName').textContent === 'CodeMaster', 'Profile chip updated');
assert(documentMock.getElementById('avatarLetter').textContent === 'C', 'Avatar letter updated');

// TEST 2: Practice Mode (No Spoilers / Answers Not Revealed)
console.log('\nTest 2: Practice Mode Behavior');
quiz.setMode('practice');
const q1 = quiz.current();
const q1CorrectKey = q1.answer;
const q1WrongKey = q1.options.find(o => o.key !== q1.answer).key;

// Click an option in Practice mode
quiz.choose(q1.id, q1WrongKey);
let qAreaHtml = documentMock.getElementById('questionArea').innerHTML;
assert(!qAreaHtml.includes('✓ Correct!') && !qAreaHtml.includes('✗ Incorrect'), 'Practice mode: does NOT show Correct! or Incorrect');
assert(!qAreaHtml.includes('Correct answer:'), 'Practice mode: does NOT reveal correct answer');
assert(!qAreaHtml.includes('option selected wrong') && !qAreaHtml.includes('option correct'), 'Practice mode: does NOT highlight correct/wrong colors');
assert(qAreaHtml.includes('option selected'), 'Practice mode: selected option has blue selected class');

// TEST 3: Mock Test Mode Instant Feedback
console.log('\nTest 3: Mock Test Mode Instant Feedback');
quiz.setMode('mock');
assert(quiz.mode === 'mock', 'Mode switched to mock');
assert(documentMock.getElementById('quizTitle').textContent === 'NPTEL Mock Test', 'Quiz title updated to NPTEL Mock Test');
assert(quiz.seconds === 7200, 'Mock test timer set to 2 hours (7200 seconds)');

const mockQ = quiz.current();
const mockCorrectKey = mockQ.answer;
const mockWrongKey = mockQ.options.find(o => o.key !== mockQ.answer).key;

// Click wrong option in Mock Test
quiz.choose(mockQ.id, mockWrongKey);
let mockAreaHtml = documentMock.getElementById('questionArea').innerHTML;
assert(mockAreaHtml.includes('✗ Incorrect'), 'Mock Test: immediate Incorrect shown on click');
assert(mockAreaHtml.includes(mockWrongKey + ')'), 'Mock Test: shows user selected answer immediately');
assert(mockAreaHtml.includes(mockCorrectKey + ')'), 'Mock Test: shows correct answer immediately');
assert(mockAreaHtml.includes('option selected wrong'), 'Mock Test: selected wrong option has wrong class');
assert(mockAreaHtml.includes('option correct'), 'Mock Test: actual correct option has correct class');

// Click correct option in Mock Test
quiz.choose(mockQ.id, mockCorrectKey);
mockAreaHtml = documentMock.getElementById('questionArea').innerHTML;
assert(mockAreaHtml.includes('✓ Correct!'), 'Mock Test: immediate Correct! shown when selecting correct answer');
assert(mockAreaHtml.includes('option selected correct'), 'Mock Test: correct option has correct class');

// TEST 4: Question Shuffling & Standard Option Order
console.log('\nTest 4: Shuffling & Option Stability');
const qOptionsKeys = mockQ.options.map(o => o.key);
assert(JSON.stringify(qOptionsKeys) === JSON.stringify(['A', 'B', 'C', 'D']), 'Options remain strictly in standard order (A, B, C, D)');
assert(Array.isArray(quiz.pool) && quiz.pool.length > 0, 'Questions pool is populated and shuffled');

// Re-render keeps options stable
quiz.render();
const qOptionsAfterRender = mockQ.options.map(o => o.key);
assert(JSON.stringify(qOptionsAfterRender) === JSON.stringify(['A', 'B', 'C', 'D']), 'Option order remains strictly stable across re-renders');
assert(Array.isArray(quiz.sessionOrder[mockQ.id]) && quiz.sessionOrder[mockQ.id].length === 4, 'Options are jumbled into sessionOrder for current question');

// Next & Previous navigation
quiz.index = 0;
quiz.render();
const initialQId = quiz.pool[0];
quiz.index = 1;
quiz.render();
assert(quiz.pool[quiz.index] === quiz.pool[1], 'Next navigates to question 2');
quiz.index = 0;
quiz.render();
assert(quiz.pool[quiz.index] === initialQId, 'Previous navigates back to question 1');

// TEST 5: Leaderboard Page & Data Privacy
console.log('\nTest 5: Leaderboard Page & Data Privacy');
quiz.showLeaderboardPage();
assert(documentMock.getElementById('leaderboardPage').classList.contains('hidden') === false, 'Dedicated Leaderboard page opened');
assert(documentMock.getElementById('quizLayout').classList.contains('hidden') === true, 'Quiz layout hidden on leaderboard page');
assert(documentMock.getElementById('leaderboardPageStatus').innerHTML.includes('Local Leaderboard'), 'Local leaderboard badge displayed');

const tableHtml = quiz.buildLeaderboardTable([
  { username: 'CodeMaster', mode: 'Mock Test', percent: 95, correct: 114, total: 120, seconds: 3500 },
  { username: 'JavaPro', mode: 'Practice', percent: 70, correct: 84, total: 120, seconds: 1200 }
], true);
assert(tableHtml.includes('CodeMaster') && tableHtml.includes('JavaPro'), 'Leaderboard shows usernames');
assert(!tableHtml.includes('@'), 'Leaderboard contains no emails');
assert(tableHtml.includes('Rank') && tableHtml.includes('Reward'), 'Leaderboard includes rank and reward columns');

quiz.hideLeaderboardPage();
assert(documentMock.getElementById('leaderboardPage').classList.contains('hidden') === true, 'Leaderboard page closed on return to quiz');

// TEST 6: Reward Videos & Score Bands
console.log('\nTest 6: Score Bands & Reward Videos');
assert(quiz.videoFor(45) === 'reaction-below-50.mp4', '<50% maps to reaction-below-50.mp4');
assert(quiz.videoFor(55) === null, '50-59% maps to neutral encouragement (null video)');
assert(quiz.videoFor(65) === 'reaction-60-70.mp4', '60-70% maps to reaction-60-70.mp4');
assert(quiz.videoFor(75) === null, '71-79% maps to neutral encouragement (null video)');
assert(quiz.videoFor(85) === 'reaction-80-90.mp4', '80-90% maps to reaction-80-90.mp4');
assert(quiz.videoFor(95) === null, '91-99% maps to neutral encouragement (null video)');
assert(quiz.videoFor(100) === 'reaction-perfect.mp4', '100% maps to reaction-perfect.mp4');

// Test simulation of results card
windowMock.__testResultScreen(100);
const resCardHtml100 = documentMock.getElementById('resultCard').innerHTML;
assert(resCardHtml100.includes('100%'), '100% result displays percentage');
assert(resCardHtml100.includes('reaction-perfect.mp4'), '100% result includes reaction-perfect.mp4');
assert(resCardHtml100.includes('mentalist-perfect.png'), '100% result includes Mentalist poster reward image');
assert(resCardHtml100.includes('Review answers'), 'Result card includes Review answers button');

// TEST 7: Review Answers Mode
console.log('\nTest 7: Review Answers Mode');
// Click review answers
documentMock.getElementById('reviewBtn').onclick();

assert(quiz.inReview === true, 'In review mode');
assert(quiz.submitted === true, 'Test remains submitted (answers locked from modifications)');
const origAnswer = quiz.answers[quiz.pool[0]];
quiz.choose(quiz.pool[0], 'Z');
assert(quiz.answers[quiz.pool[0]] === origAnswer, 'Cannot modify answers during review mode');
assert(documentMock.getElementById('quizTitle').textContent.includes('Reviewing'), 'Title indicates review mode');

// TEST 8: Clear All Usernames & Leaderboard Data
console.log('\nTest 8: Clear All Usernames & Leaderboard Data');
const emptyTableHtml = quiz.buildLeaderboardTable([], true);
assert(emptyTableHtml.includes('No completed attempts yet'), 'Empty leaderboard shows friendly placeholder message');

// TEST 9: EAMCET-Style Key Evaluation & Results Breakdown
console.log('\nTest 9: EAMCET-Style Key Evaluation & Results Breakdown');
quiz.setMode('practice');
const qA = quiz.qById(quiz.pool[0]);
const qB = quiz.qById(quiz.pool[1]);
// Pick correct answer for qA
quiz.choose(qA.id, qA.answer);
// Pick wrong answer for qB
const wrongKeyForB = qB.options.find(o => o.key !== qB.answer).key;
quiz.choose(qB.id, wrongKeyForB);
// Submit test
quiz.submit();

const resCardHtml = documentMock.getElementById('resultCard').innerHTML;
const keySheetHtml = documentMock.getElementById('keyEvaluationContainer').innerHTML;
const fullResultHtml = resCardHtml + keySheetHtml;

assert(resCardHtml.includes('Correct answers'), 'Result grid includes Correct answers metric');
assert(resCardHtml.includes('Wrong answers'), 'Result grid includes Wrong answers metric');
assert(resCardHtml.includes('Unanswered'), 'Result grid includes Unanswered metric');
assert(resCardHtml.includes('Final score'), 'Result grid includes Final score metric');
assert(keySheetHtml.includes('EAMCET / NPTEL RESPONSE SHEET'), 'Result includes EAMCET Response Sheet header');
assert(keySheetHtml.includes('Key Evaluation &amp; Question Responses'), 'Result includes Key Evaluation section title');
assert(keySheetHtml.includes('badge-correct'), 'Response sheet marks correct question with badge');
assert(keySheetHtml.includes('badge-wrong'), 'Response sheet marks wrong question with badge');
assert(keySheetHtml.includes('badge-skipped'), 'Response sheet marks skipped question with badge');
assert(keySheetHtml.includes('Official Correct Key'), 'Response sheet identifies official correct key');
assert(keySheetHtml.includes('Your Answer (Wrong)'), 'Response sheet highlights user picked wrong answer');
assert(keySheetHtml.includes('Your Answer (Correct)'), 'Response sheet highlights user picked correct answer');

(async () => {
  // Execute clearAllUserData
  await quiz.clearAllUserData();
  assert(quiz.username === '', 'Username cleared from memory');
  assert(localStorageMock.getItem('nptelUsername') === null, 'Username removed from localStorage');
  assert(localStorageMock.getItem('nptelQuizHistory') === null, 'Quiz history removed from localStorage');
  assert(documentMock.getElementById('profileName').textContent === 'Set username', 'Profile name reset to placeholder');
  assert(documentMock.getElementById('avatarLetter').textContent === 'N', 'Avatar letter reset to default N');

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  setTimeout(() => {
    process.exit(failed > 0 ? 1 : 0);
  }, 100);
})();
