
// ══════════════════════════════════════════════════
// CLOUD STORAGE ENGINE (replaces localStorage)
// ══════════════════════════════════════════════════
const STORAGE_KEY = 'sps_quiz_db_v1';

// Save to cloud (window.storage API - available in Claude artifacts hosting)
async function saveDB() {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(appDB), true);
  } catch(e) {
    // Fallback to localStorage if storage API not available
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appDB)); } catch(e2) {}
  }
}

async function loadDB() {
  try {
    const result = await window.storage.get(STORAGE_KEY, true);
    if (result && result.value) {
      return JSON.parse(result.value);
    }
  } catch(e) {
    // Fallback to localStorage
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return JSON.parse(local);
    } catch(e2) {}
  }
  return null;
}

// ══ SIMPLE SHA256 PASSWORD HASH (device-independent) ══
function hashPassword(plainPassword) {
  return CryptoJS.SHA256('sps_salt_2024_' + plainPassword).toString();
}

// ══ DEFAULT DATABASE ══
const defaultAppDB = {
  users: [
    { username: 'admin', password: hashPassword('123'), role: 'admin' },
    { username: 'teacher1', password: hashPassword('123'), role: 'teacher', createdBy: 'admin' },
    { username: 'sok', password: hashPassword('123'), role: 'student', createdBy: 'teacher1' }
  ],
  results: [],
  stages: [
    {
      name: "វិញ្ញាសាគណិតវិទ្យា ថ្នាក់ទី ៩",
      subject: "math",
      createdBy: 'admin',
      questions: [
        { type: "choice", text: "តើ $x^2 - 5x + 6 = 0$ មានដំណោះស្រាយជាអ្វី?", answers: ["$x=2$ ឬ $x=3$", "$x=1$ ឬ $x=6$", "$x=-2$ ឬ $x=-3$", "$x=0$ ឬ $x=5$"], correct: 0, points: 10 },
        { type: "blank", text: "គណនា $\\\\int_0^2 x^2\\\\,dx = $ __________", correct: "8/3", points: 15 },
        { type: "written", text: "ចូរបញ្ជាក់ពីទ្រឹស្តីបទ Pythagore ហើយអនុវត្តន៍ $a=3$, $b=4$", sampleAnswer: "$c^2 = a^2 + b^2 = 9+16=25$, $c=5$", points: 20 }
      ]
    },
    {
      name: "វិញ្ញាសាគីមីវិទ្យា ថ្នាក់ទី ១១",
      subject: "chem",
      createdBy: 'admin',
      questions: [
        { type: "choice", text: "ប្រតិកម្ម H₂ + O₂ → H₂O ត្រូវបានតុល្យភាព?", answers: ["2H₂ + O₂ → 2H₂O", "H₂ + O₂ → H₂O", "H₂ + 2O₂ → 2H₂O", "4H₂ + O₂ → 2H₂O"], correct: 0, points: 10 },
        { type: "blank", text: "Na + Cl₂ → __________ (ដំណោះស្រាយ)", correct: "2NaCl", points: 10 },
        { type: "written", text: "ពន្យល់ពីភាពខុសគ្នារវាង Exothermic និង Endothermic ។", sampleAnswer: "Exothermic: ចេញកម្តៅ (ΔH < 0). Endothermic: ស្រូបកម្តៅ (ΔH > 0)", points: 20 }
      ]
    },
    {
      name: "វិញ្ញាសាទូទៅ",
      subject: "gen",
      createdBy: 'admin',
      questions: [
        { type: "choice", text: "តើ ២ + ២ = ប៉ុន្មាន?", answers: ["៣", "៤", "៥", "៦"], correct: 1, points: 10 },
        { type: "blank", text: "រាជធានីកម្ពុជាបច្ចុប្បន្នគឺ __________", correct: "ភ្នំពេញ", points: 10 },
        { type: "written", text: "ចូរពន្យល់ពីអត្ថន័យពណ៌នៅលើទង់ជាតិកម្ពុជា។", sampleAnswer: "ពណ៌ខៀវ តំណាងព្រះមហាក្សត្រ...", points: 15 }
      ]
    }
  ]
};

let appDB = JSON.parse(JSON.stringify(defaultAppDB));
let currentUser = null;
let currentStageIndex = 0;
let currentQIndex = 0;
let currentScore = 0;
let answered = false;
let editingStage = -1;
let editorSubjectFilter = 'all';

// ══ Initialize: load from cloud on startup ══
async function initApp() {
  showOverlay('កំពុងផ្ទុកទិន្នន័យ...');
  const saved = await loadDB();
  if (saved) {
    appDB = saved;
  } else {
    // First time: save defaults
    await saveDB();
  }
  hideOverlay();
}

function showOverlay(msg) {
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.querySelector('#loading-overlay .loading-text').textContent = msg || 'កំពុងដំណើរការ...';
}
function hideOverlay() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ── Subject helpers ──
const SUBJECT_INFO = {
  math: { label: '📐 គណិតវិទ្យា', cls: 'badge-math' },
  chem: { label: '⚗️ គីមីវិទ្យា', cls: 'badge-chem' },
  gen:  { label: '📚 ទូទៅ',      cls: 'badge-gen'  }
};
function subjectBadge(sub) {
  const s = SUBJECT_INFO[sub] || SUBJECT_INFO.gen;
  return `<span class="subject-badge ${s.cls}">${s.label}</span>`;
}

// ── KaTeX render helper ──
function renderMath(el) {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
        { left: '\\\\(', right: '\\\\)', display: false },
        { left: '\\\\[', right: '\\\\]', display: true }
      ],
      throwOnError: false
    });
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  setTimeout(() => renderMath(document.getElementById(id)), 80);
}

// ── Symbol toolbar definition ──
const MATH_SYMBOLS = [
  { g: 'ប្រមាណ', syms: ['+','−','×','÷','=','≠','≈','±','∓'] },
  { g: 'ប្រៀប', syms: ['<','>','≤','≥','≪','≫'] },
  { g: 'អាំង', syms: ['∫','∬','∑','∏','√','∛','∂','∞'] },
  { g: 'មូលន', syms: ['π','θ','α','β','γ','δ','λ','μ','σ','φ','ω','Δ','Σ','Ω'] },
  { g: 'Vector', syms: ['→','←','↑','↓','⟶','⟵','∇','⊕','⊗'] },
  { g: 'ហ្គីម', syms: ['∠','∟','⊥','∥','△','□','⬡','⊙','○'] },
  { g: 'Exp', syms: ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹','⁺','⁻','ⁿ'] },
  { g: 'Sub', syms: ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉','₊','₋','₍','₎'] },
];
const CHEM_SYMBOLS = [
  { g: 'ធាតុ', syms: ['H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca','Fe','Cu','Zn','Ag','Au','Hg','Pb','I','Br'] },
  { g: 'ប្រតិ', syms: ['→','⇌','↑','↓','⇒','⟶','⟷'] },
  { g: 'ទូទៅ', syms: ['°C','°F','K','mol','atm','pH','Δ','ΔH','ΔG','ΔS','Ka','Kb','Kc','Kp','Kw'] },
  { g: 'Sub', syms: ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'] },
  { g: 'Sup', syms: ['⁰','¹','²','³','⁴','⁺','⁻'] },
  { g: 'LaTeX', syms: ['$  $','\\\\frac{a}{b}','\\\\sqrt{x}','\\\\sum_{i=1}^{n}','\\\\int_a^b','\\\\vec{F}','\\\\Delta H','\\\\rightarrow','\\\\rightleftharpoons','\\\\approx'] },
];

function buildSymToolbar(inputId, subject) {
  if (subject === 'gen' || !subject) return '';
  const set = (subject === 'chem') ? CHEM_SYMBOLS : MATH_SYMBOLS;
  let html = `<div class="sym-toolbar">`;
  html += `<span class="sym-toolbar-label">${subject === 'chem' ? '⚗️' : '📐'} និមិត្តសញ្ញា៖</span>`;
  set.forEach(grp => {
    html += `<div class="sym-section"><span class="sym-toolbar-label" style="font-size:9px;color:#6b63a8;">${grp.g}</span>`;
    grp.syms.forEach(sym => {
      const escaped = sym.replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
      html += `<button type="button" class="sym-btn" title="${escaped}" onclick="insertSymbol('${inputId}','${escaped}')">${sym}</button>`;
    });
    html += `</div><div class="sym-sep"></div>`;
  });
  html += `</div>`;
  return html;
}

function insertSymbol(inputId, sym) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const s = el.selectionStart, e = el.selectionEnd;
  const v = el.value;
  el.value = v.slice(0, s) + sym + v.slice(e);
  el.selectionStart = el.selectionEnd = s + sym.length;
  el.dispatchEvent(new Event('input'));
  el.focus();
}

// ══ AUTHENTICATION ══
async function login() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  if (!u || !p) return alert("សូមបញ្ចូលឈ្មោះ និងលេខសម្ងាត់!");

  showOverlay('កំពុងផ្ទៀងផ្ទាត់...');

  // Reload fresh data from cloud first
  const fresh = await loadDB();
  if (fresh) appDB = fresh;

  const hashedInput = hashPassword(p);

  // Support both plain and hashed passwords (migration)
  const user = appDB.users.find(x =>
    x.username === u &&
    (x.password === p || x.password === hashedInput)
  );

  hideOverlay();

  if (user) {
    currentUser = user;
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';

    if (user.role === 'admin' || user.role === 'teacher') {
      document.getElementById('admin-dash-title').textContent = user.role === 'admin' ? 'គណនីអ្នកគ្រប់គ្រង (Admin)' : 'គណនីគ្រូបង្រៀន (Teacher)';
      if (user.role === 'admin') {
        document.getElementById('manage-users-title').textContent = '👥 គ្រប់គ្រងគណនីសរុប';
        document.getElementById('manage-users-desc').textContent = 'សិស្ស និងគ្រូបង្រៀនទូទាំងប្រព័ន្ធ';
        document.getElementById('table-users-label').textContent = 'បញ្ជីគណនីសរុបទូទាំងប្រព័ន្ធ';
        document.getElementById('btn-clear-results').textContent = 'លុបប្រវត្តិពិន្ទុទាំងអស់';
      } else {
        document.getElementById('manage-users-title').textContent = '👥 គ្រប់គ្រងគណនីសិស្ស';
        document.getElementById('manage-users-desc').textContent = 'សិស្សនៅក្នុងថ្នាក់រៀនរបស់អ្នក';
        document.getElementById('table-users-label').textContent = 'បញ្ជីគណនីសិស្សក្នុងបន្ទុករបស់អ្នក';
        document.getElementById('btn-clear-results').textContent = 'លុបប្រវត្តិពិន្ទុសិស្សរបស់អ្នក';
      }
      showScreen('screen-admin-dash');
    } else {
      document.getElementById('student-name-display').textContent = user.username;
      renderStudentDash();
      showScreen('screen-student-dash');
    }
  } else {
    alert("ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ!");
  }
}

function logout() { currentUser = null; showScreen('screen-login'); }

// ══ CHANGE PASSWORD ══
async function confirmChangePassword() {
  const oldP = document.getElementById('cp-old').value;
  const newP = document.getElementById('cp-new').value;
  const confP = document.getElementById('cp-confirm').value;

  if (!oldP || !newP || !confP) return alert("សូមបំពេញចន្លោះទាំងអស់!");

  const hashedOld = hashPassword(oldP);
  if (hashedOld !== currentUser.password && oldP !== currentUser.password) {
    return alert("លេខសម្ងាត់ចាស់របស់អ្នកមិនត្រឹមត្រូវទេ!");
  }
  if (newP !== confP) return alert("ការបញ្ជាក់លេខសម្ងាត់ថ្មីមិនត្រូវគ្នាទេ!");

  const userIndex = appDB.users.findIndex(u => u.username === currentUser.username);
  if (userIndex !== -1) {
    const hashedNewP = hashPassword(newP);
    appDB.users[userIndex].password = hashedNewP;
    currentUser.password = hashedNewP;
    showOverlay('កំពុងរក្សាទុក...');
    await saveDB();
    hideOverlay();
    alert("លេខសម្ងាត់ត្រូវបានផ្លាស់ប្តូរដោយជោគជ័យ!");
    document.getElementById('cp-old').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
    showScreen('screen-admin-dash');
  }
}

// ══ USER MANAGEMENT ══
async function createUser() {
  const u = document.getElementById('new-user-name').value.trim();
  const p = document.getElementById('new-user-pass').value.trim();
  const r = document.getElementById('new-user-role').value;

  if (!u || !p) return alert("សូមបញ្ចូលឈ្មោះ និងលេខសម្ងាត់!");
  if (appDB.users.find(x => x.username === u)) return alert("ឈ្មោះនេះមានរួចហើយ!");
  if (r === 'teacher' && currentUser.role !== 'admin') return alert("អ្នកមិនមានសិទ្ធិបង្កើតគណនីគ្រូបង្រៀនទេ!");

  const hashedPass = hashPassword(p);
  appDB.users.push({ username: u, password: hashedPass, role: r, createdBy: currentUser.username });

  showOverlay('កំពុងរក្សាទុក...');
  await saveDB();
  hideOverlay();

  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-pass').value = '';
  renderUsersTable();
  alert("បង្កើតគណនីបានជោគជ័យ!");
}

async function deleteUser(username) {
  if (confirm("តើប្រាកដជាចង់លុបគណនីនេះទេ?")) {
    appDB.users = appDB.users.filter(u => u.username !== username);
    showOverlay('កំពុងរក្សាទុក...');
    await saveDB();
    hideOverlay();
    renderUsersTable();
  }
}

function renderUsersTable() {
  const table = document.getElementById('users-table');
  table.innerHTML = `<tr><th>ឈ្មោះគណនី</th><th>តួនាទី</th><th>បង្កើតដោយ</th><th>សកម្មភាព</th></tr>`;

  const roleSelect = document.getElementById('new-user-role');
  if (currentUser.role === 'admin') roleSelect.innerHTML = `<option value="student">សិស្ស</option><option value="teacher">គ្រូបង្រៀន</option>`;
  else roleSelect.innerHTML = `<option value="student">សិស្ស</option>`;

  appDB.users.forEach(u => {
    if (u.role === 'admin') return;
    if (currentUser.role === 'teacher') {
      if (u.role === 'teacher') return;
      if (u.createdBy !== currentUser.username) return;
    }
    let roleDisplay = u.role === 'teacher' ? '<span style="color:var(--accent1);font-weight:bold;">គ្រូបង្រៀន</span>' : 'សិស្ស';
    table.innerHTML += `<tr><td>${u.username}</td><td>${roleDisplay}</td><td>${u.createdBy || '-'}</td><td><button class="btn btn-danger" style="padding:4px 10px;font-size:12px;" onclick="deleteUser('${u.username}')">លុប</button></td></tr>`;
  });
}

// ══ RESULTS & EXPORTS ══
function renderResultsTable() {
  const table = document.getElementById('results-table');
  table.innerHTML = `<tr><th>កាលបរិច្ឆេទ</th><th>ឈ្មោះសិស្ស</th><th>វិញ្ញាសា</th><th>ពិន្ទុ</th><th>សកម្មភាព</th></tr>`;

  const sorted = [...appDB.results].reverse();
  let count = 0;
  let myStudents = [];
  if (currentUser.role === 'teacher') {
    myStudents = appDB.users.filter(u => u.createdBy === currentUser.username).map(u => u.username);
  }

  sorted.forEach(r => {
    if (currentUser.role === 'teacher' && !myStudents.includes(r.student)) return;
    count++;
    let displayScore = `<span style="color:var(--accent3);font-weight:bold;font-size:16px;">${r.score}</span> <span style="font-size:12px;color:#aaa;">/ ${r.totalPoints || '?'}</span>`;
    table.innerHTML += `<tr><td>${r.date}</td><td><b>${r.student}</b></td><td>${r.stage}</td><td>${displayScore}</td><td><button class="btn btn-danger" style="padding:4px 10px;font-size:12px;" onclick="deleteSingleResult('${r.id}')">លុប</button></td></tr>`;
  });

  if (count === 0) table.innerHTML += `<tr><td colspan="5" style="text-align:center;">មិនទាន់មានទិន្នន័យប្រឡងទេ</td></tr>`;
}

async function deleteSingleResult(resultId) {
  if (confirm("តើអ្នកពិតជាចង់លុបកំណត់ត្រាពិន្ទុនេះមែនទេ?")) {
    appDB.results = appDB.results.filter(r => String(r.id) !== String(resultId));
    showOverlay('កំពុងរក្សាទុក...');
    await saveDB();
    hideOverlay();
    renderResultsTable();
  }
}

async function clearResults() {
  if (confirm("លុបប្រវត្តិពិន្ទុរបស់អ្នកទាំងអស់មែនទេ? សកម្មភាពនេះមិនអាចទាញយកវិញបានទេ។")) {
    if (currentUser.role === 'admin') {
      appDB.results = [];
    } else {
      let myStudents = appDB.users.filter(u => u.createdBy === currentUser.username).map(u => u.username);
      appDB.results = appDB.results.filter(r => !myStudents.includes(r.student));
    }
    showOverlay('កំពុងរក្សាទុក...');
    await saveDB();
    hideOverlay();
    renderResultsTable();
  }
}

function exportResultsPDF() {
  const element = document.getElementById('results-table-container');
  const clone = element.cloneNode(true);
  clone.style.cssText = "font-family:'Kantumruy Pro', sans-serif; color:#000; background:#fff; padding:20px;";
  clone.querySelectorAll('th, td').forEach(cell => { cell.style.borderBottom = '1px solid #ccc'; cell.style.color = '#000'; });
  clone.querySelectorAll('th').forEach(th => th.style.background = '#f0f0f0');
  clone.querySelectorAll('tr').forEach(row => { if (row.cells.length > 4) row.deleteCell(4); });
  html2pdf().set({ margin: 10, filename: 'របាយការណ៍ពិន្ទុ.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(clone).save();
}

function exportResultsExcel() {
  let table = document.getElementById("results-table").cloneNode(true);
  table.querySelectorAll('tr').forEach(row => { if (row.cells.length > 4) row.deleteCell(4); });
  let html = table.outerHTML;
  let url = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent('<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">' + html);
  let link = document.createElement("a");
  link.href = url;
  link.download = "របាយការណ៍ពិន្ទុ.xls";
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

const originalShowScreen = showScreen;
window.showScreen = function(id) {
  originalShowScreen(id);
  if (id === 'screen-manage-users') renderUsersTable();
  if (id === 'screen-results') renderResultsTable();
};

// ══ STUDENT DASHBOARD & GAMEPLAY ══
function renderStudentDash() {
  const grid = document.getElementById('student-stages-grid');
  grid.innerHTML = '';
  const me = appDB.users.find(u => u.username === currentUser.username);

  appDB.stages.forEach((stage, i) => {
    if (stage.createdBy !== me.createdBy && stage.createdBy !== 'admin') return;
    const hasTaken = appDB.results.find(r => r.student === currentUser.username && r.stage === stage.name);
    let totalStagePoints = stage.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    const sub = stage.subject || 'gen';
    grid.innerHTML += `
      <div class="card" style="${hasTaken ? 'opacity:0.6; border-color:var(--correct);' : ''}" onclick="startStudentStage(${i}, ${!!hasTaken})">
        <h3>${stage.name} ${subjectBadge(sub)}</h3>
        <p style="font-size:13px; color:var(--text-muted);">${stage.questions.length} សំណួរ (សរុប ${totalStagePoints} ពិន្ទុ)</p>
        <div style="margin-top:10px; font-size:12px; font-weight:bold; color:${hasTaken ? 'var(--correct)' : 'var(--accent4)'}">
          ${hasTaken ? 'ប្រឡងរួចរាល់' : 'ចុចដើម្បីប្រឡង'}
        </div>
      </div>
    `;
  });

  if (grid.innerHTML === '') grid.innerHTML = '<p style="color:var(--text-muted);">លោកគ្រូ/អ្នកគ្រូរបស់អ្នកមិនទាន់បានរៀបចំវិញ្ញាសាទេ!</p>';
  setTimeout(() => renderMath(grid), 60);
}

function startStudentStage(idx, hasTaken) {
  if (hasTaken) return alert("ប្អូនបានប្រឡងវិញ្ញាសានេះរួចហើយ!");
  currentStageIndex = idx; currentQIndex = 0; currentScore = 0; answered = false;
  document.getElementById('game-stage-label').textContent = appDB.stages[idx].name;
  showScreen('screen-game');
  loadQuestion();
}

function loadQuestion() {
  const stage = appDB.stages[currentStageIndex];
  const q = stage.questions[currentQIndex];
  answered = false;
  document.getElementById('game-q-progress').textContent = `សំណួរទី ${currentQIndex + 1} / ${stage.questions.length}`;

  const pct = ((currentQIndex) / stage.questions.length) * 100;
  const fill = document.getElementById('game-progress-fill');
  if (fill) fill.style.width = pct + '%';

  document.getElementById('question-text').innerHTML = `${q.text} <span style="font-size:14px;color:var(--accent4);font-weight:normal;margin-left:10px;">(${q.points || 0} ពិន្ទុ)</span>`;
  document.getElementById('next-btn').style.display = 'none';
  const area = document.getElementById('game-input-area');
  area.innerHTML = '';
  const qType = q.type || 'choice';

  if (qType === 'choice') {
    const grid = document.createElement('div');
    grid.className = 'answers-grid';
    const letters = ['A', 'B', 'C', 'D'];
    q.answers.forEach((ans, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.innerHTML = `<b>${letters[i]}.</b> <span>${ans}</span>`;
      btn.onclick = () => {
        if (answered) return;
        answered = true;
        document.querySelectorAll('.answer-btn').forEach(b => b.style.pointerEvents = 'none');
        if (i === q.correct) currentScore += (q.points || 0);
        btn.classList.add('selected-hidden');
        document.getElementById('next-btn').style.display = 'block';
      };
      grid.appendChild(btn);
    });
    area.appendChild(grid);
  } else if (qType === 'blank' || qType === 'written') {
    const txt = document.createElement('textarea');
    txt.className = 'editor-input';
    txt.style.height = qType === 'blank' ? '50px' : '120px';
    txt.placeholder = 'វាយបញ្ចូលចម្លើយទីនេះ...';
    area.appendChild(txt);
    const vBtn = document.createElement('button');
    vBtn.className = 'btn btn-primary';
    vBtn.style.marginTop = '10px';
    vBtn.textContent = 'កត់ត្រាចម្លើយ';
    vBtn.onclick = () => {
      if (answered) return;
      answered = true;
      vBtn.style.display = 'none';
      document.getElementById('next-btn').style.display = 'block';
    };
    area.appendChild(vBtn);
  }

  setTimeout(() => {
    renderMath(document.getElementById('question-text'));
    renderMath(area);
  }, 60);
}

async function nextQuestion() {
  currentQIndex++;
  const stage = appDB.stages[currentStageIndex];
  if (currentQIndex >= stage.questions.length) {
    let totalPts = stage.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    appDB.results.push({
      id: Date.now() + Math.random(),
      student: currentUser.username,
      stage: stage.name,
      score: currentScore,
      totalPoints: totalPts,
      date: new Date().toLocaleDateString('km-KH')
    });
    showOverlay('កំពុងបញ្ជូនពិន្ទុ...');
    await saveDB();
    hideOverlay();
    showScreen('screen-stage-complete');
  } else {
    loadQuestion();
  }
}

// ══ EDITOR & EXPORT ══
function filterEditorBySubject(sub) {
  editorSubjectFilter = sub;
  ['all', 'math', 'chem', 'gen'].forEach(s => {
    const btn = document.getElementById('filter-' + s);
    if (btn) btn.classList.toggle('btn-primary', s === sub);
    if (btn) btn.classList.toggle('btn-secondary', s !== sub);
  });
  editingStage = -1;
  renderEditorTabs();
  renderEditorPanel();
}

function showEditor() {
  editorSubjectFilter = 'all';
  editingStage = -1;
  ['all', 'math', 'chem', 'gen'].forEach(s => {
    const btn = document.getElementById('filter-' + s);
    if (btn) { btn.classList.toggle('btn-primary', s === 'all'); btn.classList.toggle('btn-secondary', s !== 'all'); }
  });
  renderEditorTabs();
  renderEditorPanel();
  showScreen('screen-editor');
}

function renderEditorTabs() {
  const tabs = document.getElementById('editor-tabs'); tabs.innerHTML = '';
  let firstValidStageFound = false;

  appDB.stages.forEach((s, i) => {
    if (currentUser.role === 'teacher' && s.createdBy !== currentUser.username) return;
    if (editorSubjectFilter !== 'all' && (s.subject || 'gen') !== editorSubjectFilter) return;
    if (editingStage === -1 && !firstValidStageFound) { editingStage = i; firstValidStageFound = true; }

    const sub = s.subject || 'gen';
    const si = SUBJECT_INFO[sub] || SUBJECT_INFO.gen;
    const btn = document.createElement('button');
    btn.className = 'btn ' + (i === editingStage ? 'btn-primary' : 'btn-secondary');
    btn.innerHTML = `${si.label.split(' ')[0]} ${s.name}`;
    btn.onclick = () => { editingStage = i; renderEditorTabs(); renderEditorPanel(); };
    tabs.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-secondary';
  addBtn.textContent = '+ បន្ថែមវិញ្ញាសា';
  addBtn.onclick = async () => {
    const sub = editorSubjectFilter === 'all' ? 'gen' : editorSubjectFilter;
    appDB.stages.push({ name: 'វិញ្ញាសាថ្មី', subject: sub, createdBy: currentUser.username, questions: [{ type: 'choice', text: '', answers: ['', '', '', ''], correct: 0, points: 10 }] });
    editingStage = appDB.stages.length - 1;
    showOverlay('កំពុងរក្សាទុក...');
    await saveDB();
    hideOverlay();
    renderEditorTabs(); renderEditorPanel();
  };
  tabs.appendChild(addBtn);
}

function renderEditorPanel() {
  const stage = appDB.stages[editingStage];
  if (!stage) { document.getElementById('editor-stage-panel').innerHTML = "<p style='color:var(--text-muted);'>មិនទាន់មានវិញ្ញាសាទេ សូមចុចប៊ូតុង '+ បន្ថែមវិញ្ញាសា' ខាងលើ</p>"; return; }

  const sub = stage.subject || 'gen';
  const subOpts = ['math', 'chem', 'gen'].map(s => {
    const si = SUBJECT_INFO[s];
    return `<button type="button" class="subject-opt ${sub === s ? 'active-' + s : ''}" onclick="changeStageSubject(${editingStage},'${s}')">${si.label}</button>`;
  }).join('');

  let html = `
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
    <label style="color:#aaa;font-size:12px;">ឈ្មោះវិញ្ញាសា:</label>
    <button class="btn btn-danger" style="padding:4px 12px; font-size:12px;" onclick="deleteStage(${editingStage})">🗑️ លុបវិញ្ញាសានេះទាំងមូល</button>
  </div>
  <input class="editor-input" id="stage-name-input" value="${stage.name}" oninput="appDB.stages[editingStage].name=this.value;saveDB();">
  <label style="color:#aaa;font-size:12px; display:block; margin-bottom:6px;">មុខវិជ្ជា (Subject):</label>
  <div class="subject-selector">${subOpts}</div>
  `;

  stage.questions.forEach((q, qi) => {
    const qType = q.type || 'choice';
    const inputId = `q-text-${qi}`;
    const symBar = buildSymToolbar(inputId, sub);
    html += `
    <div style="background:var(--surface2); padding:15px; margin-bottom:12px; border-radius:8px; position:relative; border-left:4px solid ${sub === 'math' ? 'var(--accent3)' : sub === 'chem' ? 'var(--accent4)' : 'var(--accent1)'};">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <b>សំណួរទី ${qi + 1}: <span style="font-size:13px; color:var(--accent4);">ពិន្ទុ: <input type="number" class="editor-input" style="width:65px;display:inline-block;padding:4px 8px;" value="${q.points || 0}" oninput="appDB.stages[editingStage].questions[${qi}].points=parseInt(this.value)||0;saveDB();"></span></b>
        <button onclick="deleteQ(${qi})" style="background:rgba(255,107,107,0.15);border:1px solid #ff6b6b;color:#ff6b6b;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;">✕ លុប</button>
      </div>
      <select class="editor-select" onchange="changeQType(${qi}, this.value)">
        <option value="choice" ${qType === 'choice' ? 'selected' : ''}>ជ្រើសរើសចម្លើយ (A,B,C,D)</option>
        <option value="blank"  ${qType === 'blank' ? 'selected' : ''}>បំពេញចន្លោះ</option>
        <option value="written"${qType === 'written' ? 'selected' : ''}>សរសេរ/ឆ្លើយខ្លី</option>
      </select>
      ${symBar}
      <input class="editor-input" id="${inputId}" value="${q.text.replace(/"/g, '&quot;')}" placeholder="ខ្លឹមសារសំណួរ (អាចប្រើ $...$ សម្រាប់គណិតភ្នំ)" oninput="appDB.stages[editingStage].questions[${qi}].text=this.value;saveDB();">
    `;

    if (qType === 'choice') {
      const letters = ['A', 'B', 'C', 'D'];
      html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">`;
      q.answers.forEach((ans, ai) => {
        const aId = `q-ans-${qi}-${ai}`;
        html += `<div style="display:flex;align-items:center;gap:5px;">
          <span style="color:var(--accent1);font-weight:bold;width:18px;">${letters[ai]}.</span>
          <input class="editor-input" id="${aId}" style="margin:0;" value="${ans.replace(/"/g, '&quot;')}" placeholder="ចម្លើយ ${letters[ai]}" oninput="appDB.stages[editingStage].questions[${qi}].answers[${ai}]=this.value;saveDB();">
        </div>`;
      });
      html += `</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <label style="font-size:13px;color:#aaa;">ចម្លើយត្រូវ:</label>
        ${['A', 'B', 'C', 'D'].map((l, ai) => `<label style="cursor:pointer;font-weight:bold;"><input type="radio" name="correct-${qi}" value="${ai}" ${q.correct === ai ? 'checked' : ''} onchange="appDB.stages[editingStage].questions[${qi}].correct=${ai};saveDB();" style="margin-right:3px;">${l}</label>`).join('')}
      </div>`;
    } else if (qType === 'blank') {
      const aId2 = `q-blank-${qi}`;
      html += `${buildSymToolbar(aId2, sub)}<label style="font-size:12px;color:#aaa;">ចម្លើយត្រឹមត្រូវ:</label>
      <input class="editor-input" id="${aId2}" value="${(q.correct || '').replace(/"/g, '&quot;')}" placeholder="ចម្លើយ" oninput="appDB.stages[editingStage].questions[${qi}].correct=this.value;saveDB();">`;
    } else if (qType === 'written') {
      html += `<label style="font-size:12px;color:#aaa;">គំរូចម្លើយ (សម្រាប់គ្រូ):</label>
      <textarea class="editor-input" style="height:70px;" placeholder="ចម្លើយគំរូ" oninput="appDB.stages[editingStage].questions[${qi}].sampleAnswer=this.value;saveDB();">${q.sampleAnswer || ''}</textarea>`;
    }
    html += `</div>`;
  });

  html += `<button class="btn btn-secondary" style="margin-top:8px;" onclick="addQ()">+ បន្ថែមសំណួរ</button>`;
  const panel = document.getElementById('editor-stage-panel');
  panel.innerHTML = html;
  setTimeout(() => renderMath(panel), 80);
}

async function changeStageSubject(idx, sub) {
  appDB.stages[idx].subject = sub;
  showOverlay('កំពុងរក្សាទុក...');
  await saveDB();
  hideOverlay();
  renderEditorTabs(); renderEditorPanel();
}

async function deleteStage(idx) {
  if (confirm("លុបវិញ្ញាសានេះទាំងមូលមែនទេ?")) {
    appDB.stages.splice(idx, 1);
    editingStage = -1;
    showOverlay('កំពុងរក្សាទុក...');
    await saveDB();
    hideOverlay();
    renderEditorTabs(); renderEditorPanel();
  }
}

async function changeQType(qi, type) {
  const q = appDB.stages[editingStage].questions[qi];
  q.type = type;
  if (type === 'choice' && !q.answers) q.answers = ['', '', '', ''];
  if (type === 'choice' && typeof q.correct !== 'number') q.correct = 0;
  if (type === 'blank' && typeof q.correct !== 'string') q.correct = '';
  if (type === 'written' && !q.sampleAnswer) q.sampleAnswer = '';
  await saveDB(); renderEditorPanel();
}

async function addQ() {
  appDB.stages[editingStage].questions.push({ type: 'choice', text: '', answers: ['', '', '', ''], correct: 0, points: 10 });
  await saveDB(); renderEditorPanel();
}

async function deleteQ(qi) {
  if (confirm("លុបសំណួរនេះទេ?")) {
    appDB.stages[editingStage].questions.splice(qi, 1);
    await saveDB(); renderEditorPanel();
  }
}

// ══ PDF & WORD EXPORT ══
function exportPDF(showAnswers) {
  if (editingStage === -1 || !appDB.stages[editingStage]) return alert("សូមជ្រើសរើសវិញ្ញាសាជាមុនសិន!");
  const stage = appDB.stages[editingStage];
  const sub = stage.subject || 'gen';
  const subNames = { math: 'គណិតវិទ្យា', chem: 'គីមីវិទ្យា', gen: 'ទូទៅ' };
  const subColors = { math: '#4ecdc4', chem: '#a78bfa', gen: '#f7c948' };
  const element = document.createElement('div');
  element.style.cssText = "font-family:'Kantumruy Pro','Khmer OS Battambang',sans-serif; color:#111; padding:35px; background:#fff;";
  let headerTitle = showAnswers ? "🔑 គន្លឹះចម្លើយ (សម្រាប់គ្រូ)" : "📝 វិញ្ញាសាប្រឡង (សម្រាប់សិស្ស)";
  let html = `
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px double #2d1b69;padding-bottom:12px;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div><h3 style="margin:0;font-size:16px;color:#2d1b69;font-weight:bold;">សាលារៀនសុវណ្ណភូមិ</h3>
      <p style="margin:2px 0 0 0;font-size:12px;color:#e8a900;font-weight:bold;">ទីតាំងទួលពង្រ</p></div>
    </div>
    <div style="text-align:right;">
      <h2 style="margin:0;color:#333;font-size:15px;font-weight:bold;">${headerTitle}</h2>
      <span style="background:${subColors[sub]};color:#111;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold;">${subNames[sub]}</span>
    </div>
  </div>
  <div style="margin-bottom:16px;font-size:13px;">
    <strong>ឈ្មោះសិស្ស:</strong>....................................
    <strong style="margin-left:20px;">ថ្នាក់ទី:</strong>....................
    <strong style="margin-left:20px;">កាលបរិច្ឆេទ:</strong>............................
  </div>
  <h2 style="background:#2d1b69;color:#fff;padding:6px 14px;border-radius:4px;font-size:14px;margin-bottom:14px;">${stage.name}</h2>`;

  stage.questions.forEach((q, qi) => {
    const qType = q.type || 'choice';
    html += `<div style="margin-bottom:14px;padding:10px;border-left:4px solid ${subColors[sub]};background:#f9f9fb;page-break-inside:avoid;">
      <p style="font-weight:bold;font-size:13px;color:#000;margin-bottom:6px;">
        សំណួរទី ${qi + 1} <span style="font-size:11px;color:#888;">(${q.points || 0} ពិន្ទុ)</span> : ${q.text}
      </p>`;
    if (qType === 'choice') {
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-left:10px;">`;
      const letters = ['A', 'B', 'C', 'D'];
      q.answers.forEach((ans, ai) => {
        const isCorrect = ai === q.correct;
        let style = "color:#333;padding:2px 6px;";
        if (showAnswers && isCorrect) style = "color:#1e7e78;font-weight:bold;background:#e6f7f6;padding:2px 6px;border-radius:3px;";
        html += `<div style="${style}"><strong>${letters[ai]}.</strong> ${ans}${showAnswers && isCorrect ? ' ✓' : ''}</div>`;
      });
      html += `</div>`;
    } else if (qType === 'blank') {
      if (showAnswers) html += `<div style="margin-left:10px;font-size:12px;color:#555;">✍️ ចម្លើយ: <span style="color:#1e7e78;font-weight:bold;">${q.correct}</span></div>`;
      else html += `<div style="margin-left:10px;font-size:12px;">✍️ ចម្លើយ: ..........................................................................</div>`;
    } else if (qType === 'written') {
      if (showAnswers) html += `<div style="margin-left:10px;font-size:12px;"><div style="background:#f0f0f5;padding:8px;border-radius:4px;"><strong>🔑 គំរូ:</strong> ${q.sampleAnswer}</div></div>`;
      else html += `<div style="margin-left:10px;font-size:12px;"><div style="margin-bottom:18px;">ចម្លើយ: ........................................................................................................................................................</div><div>........................................................................................................................................................</div></div>`;
    }
    html += `</div>`;
  });

  element.innerHTML = html;
  const pdfName = showAnswers ? 'គន្លឹះចម្លើយ_គ្រូ.pdf' : 'វិញ្ញាសាសិស្ស.pdf';
  html2pdf().set({ margin: 12, filename: pdfName, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save();
}

function exportWord() {
  if (editingStage === -1 || !appDB.stages[editingStage]) return alert("សូមជ្រើសរើសវិញ្ញាសាជាមុនសិន!");
  const stage = appDB.stages[editingStage];
  const sub = stage.subject || 'gen';
  const subNames = { math: 'គណិតវិទ្យា', chem: 'គីមីវិទ្យា', gen: 'ទូទៅ' };
  let wordHTML = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>វិញ្ញាសាសិស្ស</title><style>body{font-family:'Khmer OS Battambang','Kantumruy Pro',sans-serif;font-size:12pt;color:#000;}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:10px;}.header h2{font-size:16pt;margin:0;color:#2d1b69;}.stage-title{font-size:14pt;font-weight:bold;background:#e0e0e0;padding:5px;}.question-box{margin-bottom:15px;margin-top:10px;}.question-text{font-weight:bold;font-size:12pt;}.options{margin-left:20px;}.lines{color:#666;margin-top:10px;}</style></head><body>
  <div class="header"><h2>សាលារៀនសុវណ្ណភូមិ (ទីតាំងទួលពង្រ)</h2><p>📝 វិញ្ញាសាប្រឡង — ${subNames[sub]}</p></div>
  <div style="margin-bottom:16px;font-size:12pt;">ឈ្មោះ:.................................... ថ្នាក់:................ កាលបរិច្ឆេទ:................................</div>
  <div class="stage-title">${stage.name}</div>`;
  stage.questions.forEach((q, qi) => {
    const qType = q.type || 'choice';
    wordHTML += `<div class="question-box"><div class="question-text">សំណួរទី ${qi + 1} (${q.points || 0} ពិន្ទុ): ${q.text}</div>`;
    if (qType === 'choice') {
      wordHTML += `<div class="options">`; const letters = ['A', 'B', 'C', 'D'];
      q.answers.forEach((ans, ai) => { wordHTML += `<div><strong>${letters[ai]}.</strong> ${ans}</div>`; });
      wordHTML += `</div>`;
    } else if (qType === 'blank') {
      wordHTML += `<div class="lines">✍️ ចម្លើយ: ....................................................................................................................</div>`;
    } else if (qType === 'written') {
      wordHTML += `<div class="lines"><br>ចម្លើយ: ..............................................................................................................................................................<br><br>................................................................................................................................................................................</div>`;
    }
    wordHTML += `</div>`;
  });
  wordHTML += `</body></html>`;
  const blob = new Blob(['\\ufeff', wordHTML], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `វិញ្ញាសាសិស្ស_${stage.name}.doc`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ── Auto-init on page load ──
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  if (typeof renderMathInElement === 'function') {
    setTimeout(() => renderMath(document.body), 200);
  }
});
