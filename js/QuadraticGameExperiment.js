import {DynamSpace} from "./dynam.space.js"
import {QuadraticGameController, DEFAULT_GAME_PARAMETERS} from "./QuadraticGameController.js"
import {experiment1, experiment2, experiment3, experiment4, experiment5, experiment6} from "./QuadraticGameExperimentParameters.js"


const mode = {
    'play': {
        mode: 'mouse'
    }
}

const GAME_PERIOD = 20000 // ms
let experimentParams = [
    experiment1,
    experiment2,
    experiment3,
    experiment4,
    experiment5,
    experiment6
]

console.log(experiment1)

let gameController = DynamSpace(QuadraticGameController, DEFAULT_GAME_PARAMETERS, mode);

gameController.runExperiments(experimentParams, GAME_PERIOD)