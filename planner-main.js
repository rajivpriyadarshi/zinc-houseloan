const slider = document.getElementById('amount-slider');
const amountInput = document.getElementById('amount-input');
const amountDisplay = document.getElementById('amount-display');
const houseImage = document.getElementById('house-image');
const houseShadow = document.getElementById('house-shadow');

const MIN_VALUE = 100000;
const MAX_VALUE = 100000000;

function getHouseLevel(value) {
  const range = MAX_VALUE - MIN_VALUE;
  const step = range / 6;

  if (value < MIN_VALUE + step) return 1;
  if (value < MIN_VALUE + step * 2) return 2;
  if (value < MIN_VALUE + step * 3) return 3;
  if (value < MIN_VALUE + step * 4) return 4;
  if (value < MIN_VALUE + step * 5) return 5;
  return 6;
}

function formatCrores(value) {
  const crores = value / 10000000;
  if (crores >= 1) {
    return '₹' + crores.toFixed(2) + ' Cr';
  } else {
    const lacs = value / 100000;
    return '₹' + lacs.toFixed(2) + ' Lac';
  }
}

function formatIndianNumber(num) {
  const str = num.toString();
  let result = '';
  let count = 0;

  for (let i = str.length - 1; i >= 0; i--) {
    count++;
    result = str[i] + result;

    if (count === 3 && i > 0) {
      result = ',' + result;
    } else if (count > 3 && (count - 3) % 2 === 0 && i > 0) {
      result = ',' + result;
    }
  }

  return result;
}

function parseIndianNumber(str) {
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

function updateDisplay(value) {
  amountDisplay.textContent = formatCrores(value);
}

let isTransitioning = false;

function updateHouseImage(level) {
  const newSrc = `/houses/level${level}.png`;
  if (houseImage.src.includes(`level${level}.png`) || isTransitioning) return;

  isTransitioning = true;

  houseImage.classList.add('zoom-out');
  houseShadow.classList.add('zoom-out');

  setTimeout(() => {
    houseImage.src = newSrc;
    houseShadow.src = newSrc;

    setTimeout(() => {
      houseImage.classList.remove('zoom-out');
      houseShadow.classList.remove('zoom-out');
      isTransitioning = false;
    }, 50);
  }, 300);
}

let currentLevel = 4;
updateDisplay(10000000);
updateHouseImage(currentLevel);

let lastHapticValue = 10000000;
const HAPTIC_STEP = 1000000;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 1200;
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
}

slider.addEventListener('input', () => {
  const value = parseInt(slider.value, 10);
  amountInput.value = formatIndianNumber(value);
  updateDisplay(value);

  const newLevel = getHouseLevel(value);
  if (newLevel !== currentLevel) {
    currentLevel = newLevel;
    updateHouseImage(currentLevel);
  }

  const crossedStep = Math.floor(value / HAPTIC_STEP) !== Math.floor(lastHapticValue / HAPTIC_STEP);
  if (crossedStep) {
    triggerHaptic();
  }
  lastHapticValue = value;
});

amountDisplay.addEventListener('click', () => {
  amountInput.style.display = 'block';
  amountInput.focus();
  amountDisplay.style.display = 'none';
});

amountInput.addEventListener('input', (e) => {
  const rawValue = e.target.value.replace(/[^0-9]/g, '');
  let numValue = parseInt(rawValue, 10) || 0;

  if (numValue > MAX_VALUE) numValue = MAX_VALUE;

  amountInput.value = formatIndianNumber(numValue);

  if (numValue >= MIN_VALUE && numValue <= MAX_VALUE) {
    slider.value = numValue;
    const newLevel = getHouseLevel(numValue);
    if (newLevel !== currentLevel) {
      currentLevel = newLevel;
      updateHouseImage(currentLevel);
    }
  }
});

amountInput.addEventListener('blur', () => {
  let value = parseIndianNumber(amountInput.value);
  if (value < MIN_VALUE) value = MIN_VALUE;
  if (value > MAX_VALUE) value = MAX_VALUE;
  amountInput.value = formatIndianNumber(value);
  slider.value = value;
  updateDisplay(value);
  amountInput.style.display = 'none';
  amountDisplay.style.display = 'inline';

  const newLevel = getHouseLevel(value);
  if (newLevel !== currentLevel) {
    currentLevel = newLevel;
    updateHouseImage(currentLevel);
  }
});

document.getElementById('proceed-btn').addEventListener('click', () => {
  const value = parseInt(slider.value, 10);
  localStorage.setItem('houseValue', value);
  document.body.classList.add('page-exit');
  setTimeout(() => window.location.href = 'location.html', 400);
});

document.getElementById('back-btn').addEventListener('click', (e) => {
  e.preventDefault();
  document.body.classList.add('page-exit');
  setTimeout(() => window.location.href = 'index.html', 400);
});
