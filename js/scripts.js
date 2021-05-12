function setDarkMode() {
  var checkbox = document.querySelector("#darkmode");
  console.log('hello')
  _setDarkMode(checkbox.checked)
}

function _setDarkMode(mode) {
  if (mode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

//_setDarkMode(0)

