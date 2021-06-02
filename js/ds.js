import registrar from '/js/ds/protocols/registrar.js'
import StandbyReadyGoFixedProtocol from '/js/ds/protocols/standby_ready_go_fixed.js'
import TaskController from '/js/ds/controller.js'
import SisoExperiment from '/js/ds/experiments/siso.js'
import ReftrackExperiment from '/js/ds/experiments/reftrack.js'

export default function DynamSpace({ update_fn, experiment } = {}) {
  
  let current, controller, study, task, space, upload_api;

  return { loadStudy, getSpace, mount, save }

  function loadStudy(study_json) {
    study = study_json
  }

  function getSpace() {
    return controller.getSpace()
  }

  function save() {
    controller.save()
  }

  function nextTask() {
    if(!current) current = 0
    else current += 1

    let okay = false;
    while(okay == false) {
      task = study.tasks[current]
      okay = controller.reset(task)
      current += 1
    }
    current -= 1

  }

  function mount(study, api) {
    upload_api = api
    loadStudy(study)
    let Experiment;
    if (experiment == 'siso') {
      Experiment = SisoExperiment
    }
    else if (experiment == 'reftrack') {
      Experiment = ReftrackExperiment
    } else {
      console.log('Experiment ' + experiment + ' not supported')
    }

    controller = TaskController({
      protocol: StandbyReadyGoFixedProtocol,
      experiment: Experiment,
      registrar: registrar,
      done_fn: done,
      update_fn: update_fn,
      upload_fn: upload
    })
    nextTask();
    controller.load(task)
    controller.start()

  }

  function upload(object) {
    const payload = {
      sid: study.sid,
      ...object
    }
    const body = JSON.stringify(payload)
    console.log("uploading")
    fetch(upload_api, {
      method: 'post',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'mode': 'cors'
      },
      body 
    })
    .then( (res) => {
    });
  }

  function save() {
    controller.save()
  }

  function done() {

    nextTask()
  }
}



export function CreateMachine(object) {
  let { id, initial, states } = object;

  let currentState = initial;

  setState(initial)

  function setState(to) {
    console.log('transition to '+to)
    if('onEntry' in states[to]) {
      states[to].onEntry()
    }
    setScreen(states[to].screen)
    const state = states[to]
    if(state.on) {
      Object.keys(state.on).forEach((on) => {
        const to_state = state.on[on] 
        if (on == 'CLICK') {
          // click anywhere to transition
          const el = document.getElementById(states[to].screen);
          function onclick(e) {
            setState(to_state)
            el.removeEventListener('click', onclick)
          }
          el.addEventListener('click', onclick)
        } else if (on == 'FUNC'){
          // function
        }
      })
    }
    currentState = state;
  }
}


function setScreen(screen) {
  console.log('setScreen('+screen+')')
  const screens = document.querySelectorAll(".screen");
  screens.forEach( (v) => {
    if(screen.split(" ").includes(v.getAttribute("id"))) {
      v.classList.remove("hidden")
    } else {
      v.classList.add("hidden")
    }
  })
}
window.DynamSpace = DynamSpace
window.CreateMachine = CreateMachine
window.setScreen = setScreen
