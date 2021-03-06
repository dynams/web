import {DEFAULT_GAME_PARAMETERS, QuadraticGameController} from "./QuadraticGameController.js"

const LOW_LEARNING_RATE = {
    alpha: 0.003,
    beta: 0.003
}

const MED_LEARNING_RATE = {
    alpha: 0.03,
    beta: 0.03
}

const HIGH_LEARNING_RATE = {
    alpha: 0.3,
    beta: 0.3
}

let {randomize_fn} = QuadraticGameController;
const experiment1 = {
    ...LOW_LEARNING_RATE,
    playstacky: false
}

const experiment2 = {
    ...MED_LEARNING_RATE,
    playstacky: false
}

const experiment3 = {
    ...HIGH_LEARNING_RATE,
    playstacky: false
}

const experiment4 = {
    ...LOW_LEARNING_RATE,
    playstacky: true
}

const experiment5 = {
    ...MED_LEARNING_RATE,
    playstacky: false
}

const experiment6 = {
    ...HIGH_LEARNING_RATE,
    playstacky: false
}

export {
    experiment1,
    experiment2,
    experiment3,
    experiment4,
    experiment5,
    experiment6,
    LOW_LEARNING_RATE,
    MED_LEARNING_RATE,
    HIGH_LEARNING_RATE
}