import registrar from '/js/ds/protocols/registrar.js'
import StandbyReadyGoFixedProtocol from '/js/ds/protocols/standby_ready_go_fixed.js'
import TaskController from '/js/ds/controller.js'
import SisoExperiment from '/js/ds/experiments/siso.js'

export default function DynamSpace({ update_fn, experiment } = {}) {
  
  let current, controller, study, task, space;

  return { loadStudy, getSpace, mount }

  function loadStudy(study_json) {
    study = study_json
    console.log(study)
  }

  function getSpace() {
    return controller.getSpace()
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

  function mount(study) {
    loadStudy(study)
    controller = TaskController({
      protocol: StandbyReadyGoFixedProtocol,
      experiment: SisoExperiment,
      registrar: registrar,
      done_fn: nextTask,
      update_fn: update_fn
    })
    nextTask();
    controller.load(task)
    controller.start()


  }

  function save() {
    controller.save()
  }

  function setDone() {

  }
}



export function CreateMachine(object) {
  let { id, initial, states } = object;

  let currentState = initial;

  setState(initial)

  function setState(to) {
    console.log('transition to '+to)
    setScreen(states[to].screen)
    if('onEntry' in states[to]) {
      states[to].onEntry()
    }
    const state = states[to]
    if(state.on) {
      Object.keys(state.on).forEach((on) => {
        const to_state = state.on[on] 
        if (on == 'CLICK') {
          // click anywhere to transition
          function onclick(e) {
            setState(to_state)
            document.body.removeEventListener('click', onclick)
          }
          document.body.addEventListener('click', onclick)
        } else if (on == 'FUNC'){
          // function
        }
      })
    }
    currentState = state;
  }
}


window.DynamSpace = DynamSpace
window.CreateMachine = CreateMachine
