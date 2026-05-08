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

  // Zoom out + fade out + move down old image
  cityImage.classList.add('zoom-out');

  setTimeout(() => {
    cityImage.src = newSrc;

    // Set starting position for zoom in (scaled down, above, invisible)
    cityImage.classList.remove('zoom-out');
    cityImage.classList.add('zoom-in-start');

    // Force reflow
    void cityImage.offsetWidth;

    // Remove zoom-in-start to trigger transition to normal state
    setTimeout(() => {
      cityImage.classList.remove('zoom-in-start');
      setTimeout(() => {
        isTransitioning = false;
      }, 300);
    }, 20);
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
    document.body.classList.add('page-exit');
    setTimeout(() => window.location.href = 'results.html', 400);
  }
});

document.getElementById('back-btn').addEventListener('click', (e) => {
  e.preventDefault();
  document.body.classList.add('page-exit');
  setTimeout(() => window.location.href = 'planner.html', 400);
});
