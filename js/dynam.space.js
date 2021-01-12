function DynamSpace(data, update_fn, draw_fn, input_fn, experiments) {
 var vue = new Vue({
	el: "#main",
  data: { 
    ...data,
    params: {
      ...experiments
    },
    info: {
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
  },
  filters: {
  	toSeconds(val) { return (val/1000).toFixed(2) },
    toFixed(val) { return Number.isInteger(val) || typeof val == 'boolean' ? val : val.toFixed(2) }
  },
  computed: {
  	csv() {
    	let c = "data:text/csv;charset=utf-8,"
      for (var o in this.H.O) c += 'O.' + o + ','
      for (var i in this.H.I) c += 'I.' + i + ','
      for (var s in this.H.S) c += 'S.' + s + ','
      c += "%0A"
      for (var t = 0; t < this.H.O.time.length; t++) {
        for (var o in this.H.O) c += this.H.O[o][t] + ','
        for (var i in this.H.I) c += this.H.I[i][t] + ','
        for (var s in this.H.S) c += this.H.S[s][t] + ','
        c += "%0A"
      }
      
    	return c
    },
    filename() {
    	return 'data.csv'
    }
  },
  methods: {
  	reset() {
      this.info.isDrawing = true
      this.info.hasStarted = false
      this.info.isRunning = false
      this.info.startTime = Date.now()

     	this.info.elapsed = 0
      this.info.prevT = 0
      this.info.fps = 1000/this.P.period
      this.info.period = this.P.period

      this.S.time = this.info.elapsed
      this.S.machine = 0

      for (var i in this.O) this.H.O[i] = []
      for (var i in this.I) this.H.I[i] = []
      for (var i in this.S) this.H.S[i] = []

      this.tick()
    },
    start() {
    	 this.info.hasStarted = true      
    	 this.info.isRunning = true
      this.info.startTime = Date.now()
    },
    load(params) {
    	for (var p in params) {
      	this.P[p] = params[p]
     }
    },
    stop() {
    	this.info.isRunning = false
     this.info.isDrawing = false
    },
    smooth(val1, val2) {
    	return this.P.smooth*val1 + (1-this.P.smooth)*val2
    },
    log() {
    	for (var i in this.I) this.H.I[i].push(this.I[i])
    	for (var o in this.O) this.H.O[o].push(this.O[o])
    	for (var s in this.S) this.H.S[s].push(this.S[s])
    },
    update() {
      // Output smoothed fps 
      const deltaT = this.O.time - this.info.prevT

      if(this.info.prevT && deltaT) {
        this.info.fps = this.smooth(this.info.fps, 1000/deltaT)
        this.info.period = this.smooth(this.info.period, deltaT)
      }

      // Update system
      update_fn(this.S, this.I, this.O, this.P)

      this.info.prevT = this.O.time
    },
  	tick() {
      if (this.info.hasStarted) {
    	   this.O.time = Date.now() - this.info.startTime
        this.S.time += this.P.period
        this.update()
        this.log()
      }
      if (this.info.isDrawing) {
        this.draw()
      }

      if(this.S.time >= this.P.duration*1000) {
        this.stop()
      }

      // Call tick
      this.correction = Date.now() - this.O.time
      if (this.info.isRunning || this.info.isDrawing) {
        if(this.P.period - this.correction > 0) {
          window.setTimeout(this.tick, this.P.period - this.correction)
        } else if (this.P.period > 0) {
          window.setTimeout(this.tick, this.P.period)
        } else {
          window.setTimeout(this.tick, 20)
        }
      }
    },
    draw() {
      ctx = this.canvas.getContext('2d')
      ctx.resetTransform()
      ctx.setLineDash([])
      ctx.lineWidth = 1;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      ctx.transform(1, 0, 0, 1, this.canvas.width / 2, this.canvas.height / 2)

      draw_fn(this.canvas, this.S, this.I, this.O, this.P);
    },
    input(e) {
        const rect = this.canvas.getBoundingClientRect();
        input_fn(this.canvas, this.S, this.I, this.O, this.P, e.clientX - rect.left, e.clientY - rect.top)
    },
  },
  mounted() {
   this.canvas = this.$refs.myCanvas
   this.canvas.addEventListener('mousemove', this.input)
    //this.canvas.addEventListener('touchmove', this.input)
    this.canvas.addEventListener('mousedown', (e) => {
    	if(!this.info.hasStarted && !this.info.isRunning) {
      	this.start()
      }    	
      else if(this.info.hasStarted && this.info.isRunning) {
      	this.stop()
      }
    })
    this.reset()
  }
})

}

