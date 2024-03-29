var ip = require('ip');
var fs = require("fs");
var os = require("os");
var path = require("path");
var fetch = require("node-fetch");
var five = require("johnny-five");

if (os.platform() !== 'darwin') {
  var Raspi = require("raspi-io");
}
//

const board = new five.Board({ io: Raspi && new Raspi() || null });

const initState = {
  pressCount: 0,
  resetTimer: null,
  coffeeCount: 0
}

let coffeeTimeout = null

let state = Object.assign({}, initState)

const animate = ({matrix, frames, interval=300, index=0, loop=Number.MAX_VALUE, cb}) => {
  const frame = frames[index]
  matrix.draw(frame);
  if ((index + 1 < frames.length)) {
    setTimeout(() => animate({matrix, frames, interval, index: index+1, loop: loop, cb}), interval);
  } else if (loop > 1) {
    setTimeout(() => animate({matrix, frames, interval, index: 0, loop: loop-1, cb}), interval);
  } else {
    setTimeout(() => {
      matrix.clear();
      if (cb) {
        cb();
      }
    }, 1000)
  }
}

const SLACK_TOKEN = process.env.SLACK_TOKEN

const sendSlackMessage = msg => fetch(`https://slack.com/api/chat.postMessage?channel=coffee&text=${encodeURIComponent(msg)}&username=coffeebot&link_names=true&token=${SLACK_TOKEN}`)

const sendCoffeeStartedSlackMessage = () => {
  board.info("sendCoffeeStartedSlackMessage", "");
  sendSlackMessage("Somebody started making coffee!")
}

const sendCoffeeDoneSlackMessage = () => {
  board.info("sendCoffeeDoneSlackMessage", "");
  coffeeTimeout = null
  sendSlackMessage("@channel coffee is ready")
}

const reset = (ledMatrix) => () => {
  board.info("reset", "");
  if (state.pressCount < 3 && !coffeeTimeout) {
    sendCoffeeStartedSlackMessage()
    coffeeTimeout = setTimeout(sendCoffeeDoneSlackMessage, 360 * 1000)
  }
  state = Object.assign({}, initState, { coffeeCount: state.coffeeCount })
  animate({
    matrix: ledMatrix,
    frames: require('./heart-fill'),
    loop: 3
  });
}

board.on("ready", function() {

  board.info("IP", ip.address());
  sendSlackMessage(`:wave: My IP is : ${ip.address()}`)

  var bigRedButton = new five.Button({
    pin: 25,
    isPullup: true,
    invert: false,
    holdtime: 10
  });

  var bigRedButtonLed = new five.Pin(1);

  var ledMatrix = new five.Led.Matrix({
    pins: {
      data: 12,
      clock: 14,
      cs: 10
    }
  });

  const resetAction = reset(ledMatrix)

  bigRedButton.on("down", function() {
    state.pressCount++;
    board.info("BigRedButton", `CLICK ; ${state.pressCount}`);

    if (state.pressCount === 1) {
      ledMatrix.draw(require('./exclamation')[0]);
      state.resetTimer = setTimeout(resetAction, 3000)
    }

    if (state.pressCount === 2) {
      ledMatrix.draw(require('./exclamation')[1]);
    }

    if (state.pressCount > 2) {
      state.coffeeCount = state.pressCount - 3
      ledMatrix.draw(require('./numbers')[state.coffeeCount % 10]);
      if (state.resetTimer) {
        clearTimeout(state.resetTimer)
      }
      state.resetTimer = setTimeout(resetAction, 3000)
    }

    // animate({
    //   matrix: ledMatrix,
    //   frames: require('./heart-fill'),
    //   loop: 3
    // });


    // animate({
    //   matrix: ledMatrix,
    //   frames: require('./exclamation'),
    //   loop: 3
    // });

  });

  // debug
  this.repl.inject({
    ledMatrix: ledMatrix
  });

});
