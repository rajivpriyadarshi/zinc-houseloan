const cityButtons = document.querySelectorAll('.city-btn');
const proceedBtn = document.getElementById('proceed-btn');
const cityImage = document.getElementById('city-image');
const dropdownContainer = document.getElementById('dropdown-container');
const stateDropdown = document.getElementById('state-dropdown');

const cityImages = {
  'Bangalore': '/new-cities/Bangalore.png',
  'Mumbai': '/new-cities/Mumbai.png',
  'Delhi': '/new-cities/Delhi.png',
  'Hyderabad': '/new-cities/Hyderabad.png',
  'Chennai': '/new-cities/Chennai.png'
};

let selectedCity = 'Bangalore';
let isTransitioning = false;

function switchImage(city) {
  if (isTransitioning) return;

  const newSrc = cityImages[city];
  if (!newSrc) {
    cityImage.classList.add('zoom-out');
    return;
  }

  if (cityImage.src.includes(city)) return;

  isTransitioning = true;
  cityImage.classList.add('zoom-out');

  setTimeout(() => {
    cityImage.src = newSrc;

    setTimeout(() => {
      cityImage.classList.remove('zoom-out');
      isTransitioning = false;
    }, 50);
  }, 300);
}

cityButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const city = btn.dataset.city;

    cityButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    if (city === 'Others') {
      dropdownContainer.classList.add('visible');
      cityImage.classList.add('zoom-out');
      selectedCity = null;
      proceedBtn.classList.remove('visible');
    } else {
      dropdownContainer.classList.remove('visible');
      stateDropdown.value = '';
      selectedCity = city;
      switchImage(city);
      proceedBtn.classList.add('visible');
    }
  });
});

stateDropdown.addEventListener('change', () => {
  const state = stateDropdown.value;
  if (state) {
    selectedCity = state;
    proceedBtn.classList.add('visible');
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
