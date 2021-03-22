/**
 * Creates an experiment that operates according to the passed in functions and parameters, and returns
 * the collected data.
 *
 *
 * @param {*} update_fn
 * @param {*} draw_fn
 * @param {*} input_fn
 * @param {*} reset_fn
 * @param {*} data
 * @param {*} experiments
 */
export function ExperimentController({ gameController }) {
    let { updateGame, drawGame, inputGame, resetGame, data } = gameController

    console.log(data);

    let controllerState = {
        meta_info: {
            acknowledgeSplash: false,
            isDrawing: true,
            hasStarted: false,
            isRunning: false,
            elapsed: 0,
            fps: 0,
            period: 0,
        },
        canvas: undefined,
        history: {
            I: {},
            O: {},
            S: {},
        },
        results: [],
    }

    return {
        setup,
        start,
        stop,
        save,
        reset,
        load,
        mount_listeners,
        is_active,
        controllerState
    }

    function setup(canvas_ref) {
        controllerState.canvas = canvas_ref
        let { meta_info, canvas } = controllerState;
        meta_info.acknowledgeSplash = true

        canvas.style.height = '100%'
        canvas.style.width = '100%'

        //not a fan of this solution, but my CSS is awful...
        //let's find a workaround?
        canvas.height = 500
        canvas.width = 500
    }

    function start() {
        let { meta_info, canvas } = controllerState

        meta_info.hasStarted = true
        meta_info.isRunning = true
        meta_info.startTime = Date.now()

        if (data.P.inputmode == 'lock') {
            canvas.requestPointerLock()
        }
    }

    function stop() {
        let { meta_info } = controllerState

        //Stop game
        meta_info.isRunning = false
        meta_info.isDrawing = false //true

        if (data.P.inputmode == 'lock') {
            document.exitPointerLock()
        }

        this.save()
    }

    function save() {
        let { results } = controllerState

        results.push({
            duration: data.O.time,
            P: JSON.stringify(this.P),
            csv: csv(),
        })
    }

    function csv() {
        let { history } = controllerState

        let c = 'data:text/csv;charset=utf-8,'

        //format headers
        for (var o in history.O) c += 'O.' + o + ','
        for (var i in history.I) c += 'I.' + i + ','
        for (var s in history.S) c += 'S.' + s + ','
        c += '%0A'

        //write data per timestamp
        for (var t = 0; t < history.O.time.length; t++) {
            for (let o in history.O) {
                c += history.O[o][t].toFixed(3) + ','
            }
            for (let i in history.I) {
                c += history.I[i][t].toFixed(3) + ','
            }
            for (let s in history.S) {
                c += history.S[s][t].toFixed(3) + ','
            }
            c += '%0A'
        }

        return c
    }

    function update() {
        let { meta_info } = controllerState

        // Output smoothed fps
        const deltaT = data.O.time - data.info.prevT

        if (meta_info.prevT && deltaT) {
            meta_info.fps = smooth(meta_info.fps, 1000 / deltaT)
            meta_info.period = smooth(meta_info.period, deltaT)
        }

        // Update system
        updateGame(data)

        meta_info.prevT = meta_info.O.time
    }

    function tick() {
        let { meta_info } = controllerState

        if (meta_info.hasStarted && meta_info.isRunning) {
            data.O.time = Date.now() - meta_info.startTime
            data.S.time += data.P.period
            update()
            log()
        }

        if (meta_info.isDrawing) {
            draw()
        }

        if (data.S.time >= data.P.duration * 1000 && meta_info.isRunning) {
            stop()
        }

        // Call tick every period
        let correction = Date.now() - data.O.time
        if (meta_info.isRunning || meta_info.isDrawing) {
            if (data.P.period - correction > 0) {
                window.setTimeout(tick, data.P.period - correction)
            } else if (data.P.period > 0) {
                window.setTimeout(tick, data.P.period)
            } else {
                window.setTimeout(tick, 20)
            }
        }
    }

    function draw() {
        let { canvas, meta_info } = controllerState

        let ctx = canvas.getContext('2d')
        ctx.resetTransform()
        ctx.setLineDash([])
        ctx.lineWidth = 1
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.transform(1, 0, 0, -1, canvas.width / 2, canvas.height / 2)

        drawGame(canvas, data.H, meta_info)
    }

    function input(e) {
        let { canvas } = controllerState

        const rect = canvas.getBoundingClientRect()
        let x = 0
        let y = 0
        if (data.P.inputmode == 'absolute') {
            x = e.clientX - rect.left
            y = e.clientY - rect.top
        } else if (data.P.inputmode == 'lock') {
            x = e.movementX
            y = e.movementY
        }
        // eventually can update this to take in more than 2 input variables
        inputGame(canvas, x, y)
    }

    function reset() {
        let { meta_info, history } = controllerState

        meta_info = {
            isDrawing: true,
            hasStarted: false,
            isRunning: false,
            startTime: Date.now(),
            elapsed: 0,
            prevT: 0,
            period: data.P.period,
            fps: 1000 / data.P.period,
        }

        data.S.time = meta_info.elapsed

        load_from_query()

        for (let i in data.O) history.O[i] = []
        for (let i in data.I) history.I[i] = []
        for (let i in data.S) history.S[i] = []

        resetGame(data)

        tick()
    }

    function load(params) {
        for (var p in params) {
            this.P[p] = params[p]
        }
    }

    function load_from_query() {
        var queryDict = {}
        location.search
            .substr(1)
            .split('&')
            .forEach(function (item) {
                queryDict[item.split('=')[0]] = item.split('=')[1]
            })

        for (var p in queryDict) {
            if (p != '') this.P[p] = queryDict[p]
        }
    }

    function is_active(params) {
        for (var p in params) {
            if (this.P[p] != params[p]) {
                return false
            }
        }
        return true
    }

    function smooth(val1, val2) {
        return data.P.smooth * val1 + (1 - data.P.smooth) * val2
    }

    function log() {
        for (var i in data.I) data.H.I[i].push(data.I[i])
        for (var o in data.O) data.H.O[o].push(data.O[o])
        for (var s in data.S) data.H.S[s].push(data.S[s])
    }

    function mount_listeners() {
        let { meta_info, canvas } = controllerState

        if (data.P.inputmode == 'absolute') {
            canvas.addEventListener('mousemove', function (e) {
                if (!data.P.edit) {
                    //in game
                    input(e)
                } else {
                    //modifying equilibria
                    if (meta_info.dragok) {
                        e.preventDefault()
                        e.stopPropagation()
                        const rect = canvas.getBoundingClientRect()
                        let mx = e.clientX - rect.left
                        let my = e.clientY - rect.top
                        mx = mx - canvas.width / 2
                        my = -my + canvas.height / 2

                        var dx = mx - meta_info.startX
                        var dy = my - meta_info.startY

                        for (var i = 0; i < data.P.draggables.length; i++) {
                            var r = data.P.draggables[i]
                            if (r.isDragging) {
                                console.log(dx)
                                console.log(dy)
                                r.x += dx
                                r.y += dy
                            }

                            meta_info.startX = mx
                            meta_info.startY = my
                        }
                    }
                }
            })
        }

        //toggling game
        canvas.addEventListener('mousedown', (e) => {
            if (!data.P.edit) {
                if (!meta_info.hasStarted && !meta_info.isRunning) {
                    start()
                } else if (meta_info.hasStarted && meta_info.isRunning) {
                    stop()
                } else if (meta_info.hasStarted && !meta_info.isRunning) {
                    reset()
                }
            } else {
                e.preventDefault()
                e.stopPropagation()

                const rect = canvas.getBoundingClientRect()
                let mx = e.clientX - rect.left
                let my = e.clientY - rect.top
                mx = mx - canvas.width / 2
                my = -my + canvas.height / 2

                for (var i = 0; i < data.P.draggables.length; i++) {
                    var r = data.P.draggables[i]
                    var dist = (mx - r.x) ** 2 + (my - r.y) ** 2

                    if (dist <= data.P.pointradius ** 2) {
                        meta_info.dragok = true
                        r.isDragging = true
                    }
                    meta_info.startX = mx
                    meta_info.startY = my
                }
            }
        })

        canvas.addEventListener('mouseup', function (e) {
            if (data.P.edit) {
                e.preventDefault()
                e.stopPropagation()

                meta_info.dragok = false
                for (var i = 0; i < data.P.draggables.length; i++) {
                    data.P.draggables[i].isDragging = false
                }
            }
        })

        canvas.addEventListener(
            'touchstart',
            function (e) {
                e.preventDefault()
                e.stopPropagation()
                var touch = e.touches[0]
                var mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                })
                canvas.dispatchEvent(mouseEvent)
            },
            false
        )

        canvas.addEventListener(
            'touchmove',
            function (e) {
                var touch = e.touches[0]
                var mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                })
                canvas.dispatchEvent(mouseEvent)
            },
            false
        )

        // Hook pointer lock state change events for different browsers
        document.addEventListener('pointerlockchange', lockChangeAlert, false)
        document.addEventListener(
            'mozpointerlockchange',
            lockChangeAlert,
            false
        )

        document.exitPointerLocker =
            document.exitPointerLock || document.mozExitPointerLock
        canvas.requestPointerLock =
            canvas.requestPointerLock || canvas.mozRequestPointerLock

        function lockChangeAlert() {
            if (
                document.pointerLockElement === self.canvas ||
                document.mozPointerLockElement === self.canvas
            ) {
                document.addEventListener('mousemove', self.input, false)
            } else {
                document.removeEventListener('mousemove', self.input, false)
            }
        }
    }
}
