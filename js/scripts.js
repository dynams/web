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

function getQuery() {
  let queryDict = {}
  location.search.substr(1).split("&").forEach(function(item) {
    queryDict[item.split("=")[0]] = item.split("=")[1]
  })
  return queryDict
}

var shortcut = {
  // (A) SET SHORTCUT KEYS TO LISTEN TO
  listen : null,
  set : function (listen) {
    // (A1) KEY SEQUENCE + FUNCTION TO RUN
    shortcut.listen = listen;

    // (A2) KEY PRESS LISTENERS
    window.addEventListener("keydown", evt => {
      shortcut.track(evt.key.toLowerCase(), true);
    });
    window.addEventListener("keyup", evt => {
      shortcut.track(evt.key.toLowerCase(), false);
    });
  },

  // (B) KEY PRESS SEQUENCE TRACKER
  sequence : [],
  track : function (key, direction) {
    // (B1) PREVENT AUTO CLEANING
    if (shortcut.junk != null) {
      clearTimeout(shortcut.junk);
    }

    // (B2) KEY DOWN
    if (direction) {
      if (!shortcut.sequence.includes(key)) {
        shortcut.sequence.push(key);
      }
    }

    // (B3) KEY UP
    else {
      let idx = shortcut.sequence.indexOf(key);
      if (idx != -1) {
        shortcut.sequence.splice(idx, 1);
      }
    }

    // (B4) HIT SHORTCUT?
    if (shortcut.sequence.length != 0) {
      let seq = shortcut.sequence.join("-");
      if (shortcut.listen[seq]) {
        shortcut.sequence = [];
        shortcut.listen[seq]();
      }

      // (B5) PREVENT "STUCK SEQUENCE" WHEN USER LEAVES PAGE
      // E.G. OPEN NEW TAB WHILE IN MIDDLE OF KEY PRESS SEQUENCE
      else {
        shortcut.junk = setTimeout(shortcut.clean, 600)
      }
    }
  },

  // (C) AUTO CLEANUP
  junk : null,
  clean : function () {
    shortcut.junk = null;
    shortcut.sequence = [];
  }
};
//_setDarkMode(0)

