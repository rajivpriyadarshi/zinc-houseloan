const cityButtons = document.querySelectorAll('.city-btn');
const proceedBtn = document.getElementById('proceed-btn');
const cityImage = document.getElementById('city-image');
const dropdownContainer = document.getElementById('dropdown-container');
const stateDropdown = document.getElementById('state-dropdown');

const cityImages = {
  'Bangalore': '/cities/Bangalore.png',
  'Mumbai': '/cities/Mumbai.png',
  'Delhi': '/cities/Delhi.png',
  'Hyderabad': '/cities/Hyderabad.png',
  'Chennai': '/cities/Chennai.png'
};

let selectedCity = 'Bangalore';
let isTransitioning = false;

function switchImage(newSrc, alt) {
  if (isTransitioning) return;

  if (!newSrc) {
    cityImage.style.transform = 'scale(0)';
    setTimeout(() => {
      cityImage.classList.remove('visible');
      cityImage.src = '';
    }, 300);
    return;
  }

  if (cityImage.classList.contains('visible') && cityImage.src) {
    isTransitioning = true;
    cityImage.style.transform = 'scale(0)';

    setTimeout(() => {
      cityImage.src = newSrc;
      cityImage.alt = alt;
      cityImage.style.transform = 'scale(1)';
      isTransitioning = false;
    }, 300);
  } else {
    cityImage.src = newSrc;
    cityImage.alt = alt;
    cityImage.classList.add('visible');
    cityImage.style.transform = 'scale(0)';

    requestAnimationFrame(() => {
      cityImage.style.transform = 'scale(1)';
    });
  }
}

cityButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const city = btn.dataset.city;

    cityButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    if (city === 'Others') {
      dropdownContainer.classList.add('visible');
      switchImage(null, '');
      selectedCity = null;
      proceedBtn.classList.remove('visible');
    } else {
      dropdownContainer.classList.remove('visible');
      stateDropdown.value = '';
      selectedCity = city;

      if (cityImages[city]) {
        switchImage(cityImages[city], city);
      }

      proceedBtn.classList.add('visible');
    }
  });
});

stateDropdown.addEventListener('change', () => {
  const state = stateDropdown.value;
  if (state) {
    selectedCity = state;
    proceedBtn.classList.add('visible');
    switchImage(null, '');
  } else {
    selectedCity = null;
    proceedBtn.classList.remove('visible');
  }
});

proceedBtn.addEventListener('click', () => {
  if (selectedCity) {
    localStorage.setItem('selectedCity', selectedCity);
    window.location.href = 'results.html';
  }
});
