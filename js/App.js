import { QuadraticGame } from './QuadraticGame.js'
import { ExperimentController } from './ExperimentController.js'

const trial1 = {
    beta: 0.03,
    flip_x: false,
    flip_y: false,
    flip_x0: false,
}

const trial2 = {
    beta: 0.03,
    flip_x: true,
    flip_y: false,
    flip_x0: false,
}

const trial3 = {
    beta: 0.03,
    flip_x: true,
    flip_y: true,
    flip_x0: false,
}

const trial4 = {
    beta: 0.03,
    flip_x: true,
    flip_y: true,
    flip_x0: true,
}

const trialSet = [trial1, trial2, trial3, trial4]

const GameController = QuadraticGame({
    trialSet,
})

const trialController = ExperimentController({
    gameController: GameController,
})

const controllerState = trialController.controllerState
console.log(controllerState)

const vm = new Vue({
    el: '#main',
    data: {
        controllerState,
        trialController,
    },
    filters: {
        toSeconds(val) {
            return (val / 1000).toFixed(2)
        },
        toFixed(val) {
            return Number.isInteger(val) || typeof val == 'boolean'
                ? val
                : val.toFixed(2)
        },
    },
    methods: {
        loadGame() {
            trialController.setup(document.getElementById("game-canvas"))
            console.log(document.getElementById("game-canvas"))
            trialController.mount_listeners()
            trialController.reset()
        },
    },
    computed: {
        filename() {
            return 'data.csv'
        },
    },
    mounted() {
        console.log(controllerState)
    },
})

console.log(vm)
