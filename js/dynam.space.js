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

export function DynamSpace({update_fn, draw_fn, input_fn, reset_fn}, data, experimentModes) {
  var vm = new Vue({
    el: "#main",
    data: {
      ...data,
      experimentModes,
      experimentSequence: [],
      experimentLength: 2000,
      info: {
        acknowledgeSplash: false,
        isDrawing: true,
        hasStarted: false,
        isRunning: false,
        elapsed: 0,
        fps: 0,
        period: 0,
      },
      canvas: null,
      H: { //history
        I: {}, O: {}, S: {}
      },
      results: []
    },
    filters: {
      toSeconds(val) { return (val / 1000).toFixed(2) },
      toFixed(val) { return Number.isInteger(val) || typeof val == 'boolean' ? val : val.toFixed(2) }
    },
    computed: {
      filename() {
        return 'data.csv'
      }
    },
    methods: {
      loadGame() {
        this.info.acknowledgeSplash = true
        this.resizeCanvas();
        if(this.experimentSequence) {
          this.runExperiments(this.experimentSequence, this.experimentLength)
        }
      },
      resizeCanvas() {
        this.canvas = this.$refs.myCanvas;
        this.boundingBox = this.$refs.canvasBoundingBox

        this.canvas.style.height = "100%";
        this.canvas.style.width = "100%";

        //not a fan of this solution, but my CSS is awful...
        //let's find a workaround?
        this.canvas.height = 500
        this.canvas.width = 500
      },
      start() {
        // Start game
        this.info.hasStarted = true
        this.info.isRunning = true
        this.info.startTime = Date.now()
        if (this.P.inputmode == 'lock') {
          this.canvas.requestPointerLock()
        }
      },
      stop() {
        //Stop game
        this.info.isRunning = false
        this.info.isDrawing = false//true
        if (this.P.inputmode == 'lock') {
          document.exitPointerLock()
        }
        this.save()
      },
      load_query_parameters() {
        //loading query parameters into a dict
        var queryDict = {}
        location.search.substr(1).split("&").forEach(function (item) { queryDict[item.split("=")[0]] = item.split("=")[1] })

        //non-empty properties are set as player parameters
        for (var p in queryDict) {
          if (p != "") this.P[p] = queryDict[p]
        }
      },
      reset() {
        //reset game entirely
        this.info.isDrawing = true
        this.info.hasStarted = false
        this.info.isRunning = false
        this.info.startTime = Date.now()
        this.info.elapsed = 0
        this.info.prevT = 0
        this.info.fps = 1000 / this.P.period
        this.info.period = this.P.period

        this.S.time = this.info.elapsed

        this.load_query_parameters();

        for (var i in this.O) this.H.O[i] = []
        for (var i in this.I) this.H.I[i] = []
        for (var i in this.S) this.H.S[i] = []

        //also run game-supplied reset function
        reset_fn(this.S, this.I, this.O, this.P)
        this.tick()
      },
      csv() {
        //compile game history into csv format
        let c = "data:text/csv;charset=utf-8,"

        //format headers
        for (var o in this.H.O) c += 'O.' + o + ','
        for (var i in this.H.I) c += 'I.' + i + ','
        for (var s in this.H.S) c += 'S.' + s + ','
        c += "%0A"

        //write data per timestamp
        for (var t = 0; t < this.H.O.time.length; t++) {
          for (var o in this.H.O) c += this.H.O[o][t].toFixed(3) + ','
          for (var i in this.H.I) c += this.H.I[i][t].toFixed(3) + ','
          for (var s in this.H.S) c += this.H.S[s][t].toFixed(3) + ','
          c += "%0A"
        }

        return c
      },
      save() {
        //save game-associated csv file
        this.results.push({
          duration: this.O.time,
          P: JSON.stringify(this.P),
          csv: this.csv()
        })
      },
      load(params) {
        //load specific set of experimentModes (shouldn't there be additional logic?)
        for (var p in params) {
          this.P[p] = params[p]
        }
      },
      isActive(params) {
        for (var p in params) {
          if (this.P[p] != params[p]) {
            return false
          }
        }
        return true;
      },
      runExperiments(experimentParams, experimentLength) {
        if(this.info.acknowledgeSplash) {
          for(let idx in experimentParams) {
            setTimeout(() => {
              let experiment = experimentParams[idx];
              console.log(this)
              this.stop();
              this.load(experiment);
              this.reset();
            }, idx * experimentLength)
          }
        } else {
          this.experimentSequence = experimentParams;
        }
      },
      smooth(val1, val2) {
        return this.P.smooth * val1 + (1 - this.P.smooth) * val2
      },
      log() {
        for (var i in this.I) this.H.I[i].push(this.I[i])
        for (var o in this.O) this.H.O[o].push(this.O[o])
        for (var s in this.S) this.H.S[s].push(this.S[s])
      },
      update() {
        // Output smoothed fps 
        const deltaT = this.O.time - this.info.prevT

        if (this.info.prevT && deltaT) {
          this.info.fps = this.smooth(this.info.fps, 1000 / deltaT)
          this.info.period = this.smooth(this.info.period, deltaT)
        }

        // Update system
        update_fn(this.S, this.I, this.O, this.P)

        this.info.prevT = this.O.time
      },
      tick() {
        if (this.info.hasStarted && this.info.isRunning) {
          this.O.time = Date.now() - this.info.startTime
          this.S.time += this.P.period
          this.update()
          this.log()
        }
        if (this.info.isDrawing) {
          this.draw()
        }

        if (this.S.time >= this.P.duration * 1000 && this.info.isRunning) {
          this.stop()
        }

        // Call tick every period
        this.correction = Date.now() - this.O.time
        if (this.info.isRunning || this.info.isDrawing) {
          if (this.P.period - this.correction > 0) {
            window.setTimeout(this.tick, this.P.period - this.correction)
          } else if (this.P.period > 0) {
            window.setTimeout(this.tick, this.P.period)
          } else {
            window.setTimeout(this.tick, 20)
          }
        }
      },
      draw() {
        let ctx = this.canvas.getContext('2d')
        ctx.resetTransform()
        ctx.setLineDash([])
        ctx.lineWidth = 1;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        ctx.transform(1, 0, 0, -1, this.canvas.width / 2, this.canvas.height / 2)

        draw_fn(this.canvas, this.S, this.I, this.O, this.P, this.H, this.info);
      },
      input(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = 0
        let y = 0
        if (this.P.inputmode == 'absolute') {
          x = e.clientX - rect.left
          y = e.clientY - rect.top
        }
        else if (this.P.inputmode == 'lock') {
          x = e.movementX
          y = e.movementY
        }
        // eventually can update this to take in more than 2 input variables
        input_fn(this.canvas, this.S, this.I, this.O, this.P, x, y)
      },
    },
    mounted() {
      var self = this
      this.canvas = this.$refs.myCanvas

      document.exitPointerLocker = document.exitPointerLock ||
        document.mozExitPointerLock;
      this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
        this.canvas.mozRequestPointerLock;

      function lockChangeAlert() {
        if (document.pointerLockElement === self.canvas ||
          document.mozPointerLockElement === self.canvas) {
          console.log('The pointer lock status is now locked');
          document.addEventListener("mousemove", self.input, false);
        } else {
          console.log('The pointer lock status is now unlocked');
          document.removeEventListener("mousemove", self.input, false);
        }
      }
      // Hook pointer lock state change events for different browsers
      document.addEventListener('pointerlockchange', lockChangeAlert, false);
      document.addEventListener('mozpointerlockchange', lockChangeAlert, false);


      if (this.P.inputmode == 'absolute') {
        this.canvas.addEventListener('mousemove', this.input)
      }

      this.canvas.addEventListener('mousedown', (e) => {
        if (!this.info.hasStarted && !this.info.isRunning) {
          this.start()
        } else if (this.info.hasStarted && this.info.isRunning) {
          this.stop()
        } else if (this.info.hasStarted && !this.info.isRunning) {
          this.reset();
        }
      })

      this.canvas.addEventListener("touchstart", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        self.canvas.dispatchEvent(mouseEvent);
      }, false);

      this.canvas.addEventListener("touchend", function (e) {
        var mouseEvent = new MouseEvent("mouseup", {});
        self.canvas.dispatchEvent(mouseEvent);
      }, false);

      this.canvas.addEventListener("touchmove", function (e) {
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        self.canvas.dispatchEvent(mouseEvent);
      }, false);


      this.reset()
    }
  });

  return vm;
}

