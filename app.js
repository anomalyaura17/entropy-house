const ROOMS = [
  {
    id: 'foyer',
    short: 'Foyer',
    name: 'The Inverted Foyer',
    subtitle: 'Heat runs uphill',
    concept: 'Fourier’s law of conduction',
    conceptText: 'Conductive heat flow scales with a material’s thermal conductivity, k. Lower k means a better insulator and a smaller heat current.',
    observation: 'Frost is crawling from the staircase toward a roaring fire. The house is amplifying a reverse heat current through its brass threshold.',
    objective: 'Choose a barrier that minimizes the magnitude of conductive heat flow.',
    hint: 'In Q̇ = kAΔT/L, every term but k is fixed. You want the smallest value of k.',
    archive: 'Recovered note: “The warm end never spontaneously cools the cold end—except here.”',
  },
  {
    id: 'engine',
    short: 'Engine',
    name: 'The Breathing Engine',
    subtitle: 'Pressure remembers',
    concept: 'Gay-Lussac’s law',
    conceptText: 'For a fixed amount of gas at constant volume, pressure is proportional to absolute temperature: P₁/T₁ = P₂/T₂.',
    observation: 'A sealed piston pulses like a lung, though its volume is mechanically locked. Its pressure dial is the only route to the next room.',
    objective: 'Calculate and set the pressure after the trapped gas warms from 250 K to 300 K.',
    hint: 'Rearrange the relation: P₂ = P₁ × (T₂/T₁). Use kelvin, not Celsius.',
    archive: 'Recovered note: “At fixed volume, warmer molecules strike the walls harder and more often.”',
  },
  {
    id: 'archive',
    short: 'Archive',
    name: 'The Tuesday Archive',
    subtitle: 'Order is suspicious',
    concept: 'Boltzmann entropy',
    conceptText: 'Entropy measures the number of compatible microscopic arrangements: S = kᴮ ln Ω. More accessible microstates means greater entropy.',
    observation: 'The archive resets itself every Tuesday. Ink jumps back into pens; scattered records stack themselves in perfect alphabetical order.',
    objective: 'Reconstruct the natural arrow of time by ordering the states from lowest to highest entropy.',
    hint: 'A rigid lattice has very few arrangements. A gas spread through a whole volume has enormously many.',
    archive: 'Recovered note: “Irreversible does not mean impossible in reverse—only fantastically unlikely.”',
  },
  {
    id: 'observatory',
    short: 'Core',
    name: 'The Blackbody Core',
    subtitle: 'Light unlocks matter',
    concept: 'Wien’s displacement law',
    conceptText: 'A thermal emitter’s peak wavelength is inversely proportional to temperature: λₘₐₓ = b/T, where b ≈ 2.898 × 10⁻³ m·K.',
    observation: 'At the center of the house, a 2,900 K filament feeds a spectral lock. The door wants the wavelength at which its thermal glow peaks.',
    objective: 'Use Wien’s law to identify the filament’s peak wavelength.',
    hint: '2.898 × 10⁻³ m·K ÷ 2,900 K ≈ 1 × 10⁻⁶ m. Convert meters to nanometers.',
    archive: 'Recovered note: “The filament looks orange, but most of its radiation is just beyond the visible red.”',
  },
];

const STORAGE_KEY = 'entropy-house-progress-v1';
const DEFAULT_STATE = { started: false, solved: [], current: 0, hints: [], startTime: null, elapsed: 0, completed: false };
let state = loadState();
let timerInterval;
let pressureValue = 100;
let entropyOrder = [];
let audioContext;
let audioNodes = [];
let toastTimeout;

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const elements = {
  landing: $('#landing'),
  game: $('#game'),
  roomList: $('#room-list'),
  roomStage: $('#room-stage'),
  progressLabel: $('#progress-label'),
  progressBar: $('#progress-bar'),
  stability: $('#stability-value'),
  stabilityBars: $('#stability-bars'),
  timer: $('#timer'),
  casePanel: $('#case-panel'),
  observation: $('#observation-text'),
  conceptTitle: $('#concept-title'),
  conceptText: $('#concept-text'),
  objective: $('#objective-text'),
  hint: $('#hint'),
  hintButton: $('#hint-button'),
  toast: $('#toast'),
};

function loadState() {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function elapsedSeconds() {
  if (!state.startTime || state.completed) return state.elapsed || 0;
  return state.elapsed + Math.floor((Date.now() - state.startTime) / 1000);
}

function formatTime(total) {
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startTimer() {
  clearInterval(timerInterval);
  elements.timer.textContent = formatTime(elapsedSeconds());
  if (!state.completed) {
    timerInterval = setInterval(() => {
      elements.timer.textContent = formatTime(elapsedSeconds());
    }, 1000);
  }
}

function beginGame() {
  if (!state.started) {
    state.started = true;
    state.startTime = Date.now();
    saveState();
  } else if (!state.completed && !state.startTime) {
    state.startTime = Date.now();
  }
  elements.landing.hidden = true;
  elements.game.hidden = false;
  document.body.classList.add('playing');
  renderGame();
  startTimer();
}

function returnHome() {
  if (!state.completed && state.startTime) {
    state.elapsed = elapsedSeconds();
    state.startTime = null;
    saveState();
  }
  clearInterval(timerInterval);
  elements.game.hidden = true;
  elements.landing.hidden = false;
  document.body.classList.remove('playing');
}

function renderGame() {
  renderNavigation();
  renderRoom();
  updateProgress();
}

function renderNavigation() {
  const highestUnlocked = Math.min(state.solved.length, ROOMS.length - 1);
  elements.roomList.innerHTML = ROOMS.map((room, index) => {
    const solved = state.solved.includes(room.id);
    const locked = index > highestUnlocked;
    return `
      <button class="room-tab ${index === state.current ? 'active' : ''} ${solved ? 'solved' : ''}"
        data-room="${index}" ${locked ? 'disabled' : ''} aria-label="${room.name}${locked ? ', locked' : ''}">
        <span class="room-tab__number">${solved ? '✓' : String(index + 1).padStart(2, '0')}</span>
        <span class="room-tab__copy"><strong>${room.short}</strong><small>${locked ? 'LOCKED' : room.subtitle}</small></span>
        <span class="room-tab__status">${solved ? '✓' : locked ? '⌁' : '›'}</span>
      </button>`;
  }).join('');

  $$('.room-tab', elements.roomList).forEach(button => {
    button.addEventListener('click', () => {
      state.current = Number(button.dataset.room);
      saveState();
      renderGame();
    });
  });
}

function updateProgress() {
  const count = state.solved.length;
  const percent = count * 22 + 12;
  elements.progressLabel.textContent = `${count} / 4`;
  elements.progressBar.style.width = `${count * 25}%`;
  elements.stability.textContent = `${percent}%`;
  elements.stabilityBars.innerHTML = Array.from({ length: 16 }, (_, index) =>
    `<i class="${index < Math.round(percent / 6.25) ? 'on' : ''}" style="height:${10 + ((index * 7) % 20)}px"></i>`
  ).join('');
}

function renderRoom() {
  const room = ROOMS[state.current];
  const solved = state.solved.includes(room.id);
  elements.roomStage.innerHTML = `
    <div class="room-inner">
      <header class="room-heading">
        <div>
          <div class="room-heading__index">Room ${String(state.current + 1).padStart(2, '0')} / 04</div>
          <h2>${titleMarkup(room.name)}</h2>
        </div>
        <div class="anomaly-badge"><i></i>${solved ? 'Stabilized' : 'Law violation detected'}</div>
      </header>
      <div class="puzzle-stage">${puzzleMarkup(state.current, solved)}</div>
      <footer class="room-footer"><span>ANOMALY CLASS <strong>THERMODYNAMIC</strong></span><span>${room.archive}</span></footer>
    </div>`;

  elements.observation.textContent = solved ? `Stabilized. ${room.archive}` : room.observation;
  elements.conceptTitle.textContent = room.concept;
  elements.conceptText.textContent = room.conceptText;
  elements.objective.textContent = solved ? 'Room restored. You may inspect the apparatus or continue onward.' : room.objective;
  const hinted = state.hints.includes(room.id);
  elements.hint.hidden = !hinted;
  elements.hint.textContent = room.hint;
  elements.hintButton.style.display = solved ? 'none' : '';

  bindPuzzleEvents(state.current, solved);
}

function titleMarkup(title) {
  const words = title.split(' ');
  const last = words.pop();
  return `${words.join(' ')} <em>${last}</em>`;
}

function dots() {
  return '<i></i>'.repeat(6);
}

function puzzleMarkup(index, solved) {
  const solvedBanner = solved ? '<div class="solved-banner"><b>✓</b><span>Principle restored. The anomaly is now contained.</span></div>' : '';
  if (index === 0) return `
    <article class="puzzle-card">
      <div class="puzzle-card__scene">
        <div class="thermal-scene"><div class="reservoir reservoir--cold"><small>STAIRS</small>−20°C</div><div class="heat-bridge"></div><div class="reservoir reservoir--hot"><small>HEARTH</small>80°C</div></div>
      </div>
      <div class="puzzle-card__body">
        <div class="puzzle-card__tag">Threshold seal</div><h3>Stop the reverse heat leak.</h3>
        <p class="puzzle-card__prompt">The barrier dimensions and temperature difference cannot change. Which insert transmits the least heat?</p>
        <div class="formula">Q̇ = <span>k</span>AΔT / L</div>
        <div class="options">
          ${option('A', 'Copper plate', 'k = 401 W/m·K', 'copper', solved)}
          ${option('B', 'Window glass', 'k = 0.80 W/m·K', 'glass', solved)}
          ${option('C', 'Compressed wool', 'k = 0.04 W/m·K', 'wool', solved, solved)}
        </div>${solvedBanner}
      </div>
    </article>`;

  if (index === 1) return `
    <article class="puzzle-card">
      <div class="puzzle-card__scene">
        <div class="pressure-scene" id="pressure-scene"><div class="molecule-field">${dots()}</div><div class="gauge" id="scene-pressure">${pressureValue}<small>kPa // SEALED</small></div></div>
      </div>
      <div class="puzzle-card__body">
        <div class="puzzle-card__tag">Piston regulator</div><h3>Equalize the sealed chamber.</h3>
        <p class="puzzle-card__prompt">At constant volume, the gas begins at P₁ = 100 kPa and T₁ = 250 K. It warms to T₂ = 300 K. Set P₂.</p>
        <div class="formula">P₁/T₁ = P₂/T₂ &nbsp; → &nbsp; <span>P₂ = ?</span></div>
        <div class="dial-control"><button data-pressure="-5" aria-label="Decrease pressure">−</button><div class="dial-readout"><span id="pressure-readout">${pressureValue}</span> <small>kPa</small></div><button data-pressure="5" aria-label="Increase pressure">+</button></div>
        <button class="button button--primary submit-answer" id="submit-pressure" ${solved ? 'disabled' : ''}>${solved ? 'Pressure locked at 120 kPa' : 'Lock pressure'}</button>${solvedBanner}
      </div>
    </article>`;

  if (index === 2) return `
    <article class="puzzle-card">
      <div class="puzzle-card__scene"><div class="entropy-scene"><div class="state-box state-box--ordered">${dots()}</div><div class="state-box state-box--cluster">${dots()}</div><div class="state-box state-box--spread">${dots()}</div></div></div>
      <div class="puzzle-card__body">
        <div class="puzzle-card__tag">Arrow-of-time sequencer</div><h3>Order the states by increasing entropy.</h3>
        <p class="puzzle-card__prompt">Select all three states, beginning with the fewest accessible microstates. Tap a selected state to undo it.</p>
        <div class="sequence">
          ${sequenceOption('lattice', 'Crystal lattice', 'Particles fixed in a regular structure')}
          ${sequenceOption('cluster', 'Gas cluster', 'Particles free within a small region')}
          ${sequenceOption('spread', 'Dispersed gas', 'Particles free throughout the vessel')}
        </div>
        <div class="sequence-status" id="sequence-status">${solved ? 'Sequence accepted: lattice → cluster → dispersed gas' : 'Awaiting sequence…'}</div>
        <button class="button button--primary submit-answer" id="submit-sequence" ${solved ? 'disabled' : ''}>${solved ? 'Arrow restored' : 'Test sequence'}</button>${solvedBanner}
      </div>
    </article>`;

  return `
    <article class="puzzle-card">
      <div class="puzzle-card__scene"><div class="spectrum"><i class="spectrum-marker"></i></div></div>
      <div class="puzzle-card__body">
        <div class="puzzle-card__tag">Spectral deadbolt</div><h3>Find the filament’s peak.</h3>
        <p class="puzzle-card__prompt">The core glows at 2,900 K. Which wavelength is closest to its peak thermal emission?</p>
        <div class="formula">λₘₐₓ = b/T &nbsp; where &nbsp; b = <span>2.898 × 10⁻³ m·K</span></div>
        <div class="options">
          ${option('A', '500 nm', 'Visible green', '500', solved)}
          ${option('B', '1,000 nm', 'Near infrared', '1000', solved, solved)}
          ${option('C', '10,000 nm', 'Thermal infrared', '10000', solved)}
        </div>${solvedBanner}
      </div>
    </article>`;
}

function option(key, label, detail, value, solved, isCorrect = false) {
  return `<button class="option ${solved && isCorrect ? 'correct' : ''}" data-answer="${value}" ${solved ? 'disabled' : ''}><span class="option__key">${key}</span><span class="option__copy"><span>${label}</span><small>${detail}</small></span></button>`;
}

function sequenceOption(value, label, detail) {
  return `<button class="sequence-option" data-sequence="${value}"><b>—</b><span><strong>${label}</strong><br>${detail}</span></button>`;
}

function bindPuzzleEvents(index, solved) {
  if (solved) return;
  if (index === 0) {
    $$('.option', elements.roomStage).forEach(button => button.addEventListener('click', () => {
      if (button.dataset.answer === 'wool') solveRoom(button);
      else markWrong(button, 'High conductivity feeds the anomaly. Look for the lowest k.');
    }));
  }
  if (index === 1) {
    $$('[data-pressure]', elements.roomStage).forEach(button => button.addEventListener('click', () => {
      pressureValue = Math.max(80, Math.min(160, pressureValue + Number(button.dataset.pressure)));
      $('#pressure-readout').textContent = pressureValue;
      $('#scene-pressure').childNodes[0].nodeValue = pressureValue;
      $('#pressure-scene').style.setProperty('--piston-y', `${45 - (pressureValue - 80) * .45}px`);
    }));
    $('#submit-pressure').addEventListener('click', event => {
      if (pressureValue === 120) solveRoom(event.currentTarget);
      else markWrong(event.currentTarget, `${pressureValue} kPa does not balance the ratio. Try P₂ = 100 × (300/250).`);
    });
  }
  if (index === 2) {
    entropyOrder = [];
    $$('.sequence-option', elements.roomStage).forEach(button => button.addEventListener('click', () => {
      const value = button.dataset.sequence;
      if (entropyOrder.includes(value)) entropyOrder = entropyOrder.filter(item => item !== value);
      else if (entropyOrder.length < 3) entropyOrder.push(value);
      updateSequenceUI();
    }));
    $('#submit-sequence').addEventListener('click', event => {
      if (entropyOrder.join(',') === 'lattice,cluster,spread') solveRoom(event.currentTarget);
      else markWrong(event.currentTarget, 'That ordering would make the arrow of time wobble. Compare how much space and freedom each state allows.');
    });
  }
  if (index === 3) {
    $$('.option', elements.roomStage).forEach(button => button.addEventListener('click', () => {
      if (button.dataset.answer === '1000') solveRoom(button);
      else markWrong(button, 'Check the exponent and convert 10⁻⁶ meters into nanometers.');
    }));
  }
}

function updateSequenceUI() {
  $$('.sequence-option', elements.roomStage).forEach(button => {
    const position = entropyOrder.indexOf(button.dataset.sequence);
    button.classList.toggle('selected', position >= 0);
    $('b', button).textContent = position >= 0 ? String(position + 1).padStart(2, '0') : '—';
  });
  $('#sequence-status').textContent = entropyOrder.length ? `${entropyOrder.length} of 3 states placed` : 'Awaiting sequence…';
}

function markWrong(element, message) {
  element.classList.remove('wrong');
  requestAnimationFrame(() => element.classList.add('wrong'));
  showToast(message);
  setTimeout(() => element.classList.remove('wrong'), 650);
}

function solveRoom(element) {
  const room = ROOMS[state.current];
  if (state.solved.includes(room.id)) return;
  $$('button', elements.roomStage).forEach(button => { button.disabled = true; });
  element.classList.add('correct');
  state.solved.push(room.id);
  state.solved = [...new Set(state.solved)];
  saveState();
  playChime();
  showToast(`Room stabilized — ${room.concept} restored.`);

  setTimeout(() => {
    if (state.solved.length === ROOMS.length) {
      completeGame();
    } else {
      state.current = Math.min(state.current + 1, ROOMS.length - 1);
      saveState();
      renderGame();
    }
  }, 1100);
}

function completeGame() {
  state.elapsed = elapsedSeconds();
  state.startTime = null;
  state.completed = true;
  saveState();
  clearInterval(timerInterval);
  renderGame();
  $('#final-time').textContent = formatTime(state.elapsed);
  $('#final-hints').textContent = state.hints.length;
  $('#victory-modal').showModal();
}

function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  toastTimeout = setTimeout(() => elements.toast.classList.remove('show'), 3500);
}

function revealHint() {
  const room = ROOMS[state.current];
  if (!state.hints.includes(room.id)) {
    state.hints.push(room.id);
    saveState();
  }
  elements.hint.textContent = room.hint;
  elements.hint.hidden = false;
}

function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  state = { ...DEFAULT_STATE, solved: [], hints: [] };
  pressureValue = 100;
  entropyOrder = [];
  $('#reset-modal').close();
  stopSound();
  returnHome();
  showToast('Timeline reset. The house has forgotten you.');
}

function toggleSound() {
  const button = $('#sound-button');
  if (audioContext) {
    stopSound();
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Turn ambient sound on');
    return;
  }
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const master = audioContext.createGain();
  master.gain.value = 0.025;
  master.connect(audioContext.destination);
  [54, 81, 108].forEach((frequency, i) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = i === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.value = [0.7, 0.12, 0.05][i];
    oscillator.connect(gain).connect(master);
    oscillator.start();
    audioNodes.push(oscillator, gain);
  });
  button.setAttribute('aria-pressed', 'true');
  button.setAttribute('aria-label', 'Turn ambient sound off');
}

function stopSound() {
  audioNodes.forEach(node => { try { node.stop?.(); } catch {} });
  audioNodes = [];
  audioContext?.close();
  audioContext = null;
}

function playChime() {
  if (!audioContext) return;
  [392, 523.25, 659.25].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, audioContext.currentTime + index * .1);
    gain.gain.linearRampToValueAtTime(.09, audioContext.currentTime + index * .1 + .02);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + index * .1 + .7);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(audioContext.currentTime + index * .1);
    oscillator.stop(audioContext.currentTime + index * .1 + .75);
  });
}

$('#begin-game').addEventListener('click', beginGame);
$('#home-button').addEventListener('click', returnHome);
$('#how-to-play').addEventListener('click', () => $('#intro-modal').showModal());
$('#sound-button').addEventListener('click', toggleSound);
$('#notes-button').addEventListener('click', () => elements.casePanel.classList.toggle('open'));
$('#notes-close').addEventListener('click', () => elements.casePanel.classList.remove('open'));
elements.hintButton.addEventListener('click', revealHint);
$('#reset-game').addEventListener('click', () => $('#reset-modal').showModal());
$('#confirm-reset').addEventListener('click', resetGame);
$('#revisit-house').addEventListener('click', () => $('#victory-modal').close());

$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
}));

document.addEventListener('mousemove', event => {
  const glow = $('.cursor-glow');
  glow.style.left = `${event.clientX}px`;
  glow.style.top = `${event.clientY}px`;
});

document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'n' && !elements.game.hidden) elements.casePanel.classList.toggle('open');
  if (event.key.toLowerCase() === 'h' && !elements.game.hidden) revealHint();
});

window.addEventListener('beforeunload', () => {
  if (state.started && !state.completed && state.startTime) {
    state.elapsed = elapsedSeconds();
    state.startTime = null;
    saveState();
  }
});

if (state.started) {
  const resume = $('#begin-game span');
  if (resume) resume.textContent = state.completed ? 'Re-enter the house' : 'Resume investigation';
}
