let audioContext

const KNOWN_NOTES = [523, 659, 784]
const BATCH_COMPLETE_NOTES = [...KNOWN_NOTES, 1047, 1319]

function tone(context, { at = 0, duration = .1, from, to = from, gain = .07, type = 'sine' }) {
  const oscillator = context.createOscillator()
  const volume = context.createGain()
  const start = context.currentTime + at
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)
  volume.gain.setValueAtTime(.0001, start)
  volume.gain.exponentialRampToValueAtTime(gain, start + .008)
  volume.gain.exponentialRampToValueAtTime(.0001, start + duration)
  oscillator.connect(volume).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + .02)
}

function noise(context, { duration = .1, gain = .035, frequency = 900 }) {
  const length = Math.ceil(context.sampleRate * duration)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const volume = context.createGain()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  filter.Q.value = .8
  volume.gain.setValueAtTime(gain, context.currentTime)
  volume.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration)
  source.buffer = buffer
  source.connect(filter).connect(volume).connect(context.destination)
  source.start()
}

export function playSound(id) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  audioContext ??= new AudioContext()
  audioContext.resume()
  const sounds = {
    'deck-soft': () => tone(audioContext, { from: 360, to: 290, duration: .09, type: 'triangle' }),
    'deck-soft-low': () => tone(audioContext, { from: 290, to: 230, duration: .09, type: 'triangle' }),
    'deck-clean-click': () => { tone(audioContext, { from: 720, to: 610, duration: .045, gain: .05, type: 'square' }); noise(audioContext, { duration: .025, gain: .008, frequency: 1700 }) },
    'deck-wood-click': () => { tone(audioContext, { from: 260, to: 180, duration: .065, gain: .07, type: 'triangle' }); noise(audioContext, { duration: .035, gain: .012, frequency: 650 }) },
    'deck-glass-tap': () => { tone(audioContext, { from: 1050, to: 880, duration: .12, gain: .035 }); tone(audioContext, { at: .018, from: 1570, duration: .09, gain: .018 }) },
    'button-crisp-tick': () => { tone(audioContext, { from: 780, to: 680, duration: .035, gain: .035, type: 'square' }); noise(audioContext, { duration: .018, gain: .006, frequency: 2200 }) },
    'button-soft-click': () => { tone(audioContext, { from: 420, to: 340, duration: .055, gain: .042, type: 'triangle' }); noise(audioContext, { duration: .024, gain: .006, frequency: 1100 }) },
    'button-muted-tap': () => tone(audioContext, { from: 260, to: 210, duration: .06, gain: .05, type: 'triangle' }),
    'button-digital-blip': () => { tone(audioContext, { from: 620, to: 740, duration: .045, gain: .035, type: 'square' }); tone(audioContext, { at: .032, from: 880, duration: .035, gain: .018, type: 'square' }) },
    'button-tiny-pop': () => { tone(audioContext, { from: 340, to: 610, duration: .04, gain: .04 }); noise(audioContext, { duration: .018, gain: .005, frequency: 1500 }) },
    'known-rise': () => KNOWN_NOTES.forEach((from, index) => tone(audioContext, { at: index * .055, from, duration: .15, gain: .045, type: 'triangle' })),
    'known-soft-bell': () => { tone(audioContext, { from: 659, duration: .28, gain: .04 }); tone(audioContext, { at: .04, from: 988, duration: .23, gain: .025 }) },
    'known-coin': () => { tone(audioContext, { from: 988, to: 1175, duration: .08, gain: .045, type: 'square' }); tone(audioContext, { at: .06, from: 1568, duration: .15, gain: .026 }) },
    'known-sparkle': () => [784, 1175, 1568].forEach((from, index) => tone(audioContext, { at: index * .045, from, duration: .13, gain: .027 })),
    'batch-complete': () => BATCH_COMPLETE_NOTES.forEach((from, index) => tone(audioContext, { at: index * .055, from, duration: .15, gain: .045, type: 'triangle' })),
    'missed-fall-high': () => { tone(audioContext, { from: 660, to: 587, duration: .12, gain: .062 }); tone(audioContext, { at: .07, from: 523, to: 440, duration: .16, gain: .055 }) },
    'missed-gentle-fall': () => { tone(audioContext, { from: 440, to: 392, duration: .14, gain: .045 }); tone(audioContext, { at: .08, from: 349, to: 294, duration: .18, gain: .04 }) },
    'missed-soft-thud': () => { tone(audioContext, { from: 190, to: 115, duration: .13, gain: .075, type: 'triangle' }); noise(audioContext, { duration: .07, gain: .009, frequency: 330 }) },
    'missed-muted-drop': () => tone(audioContext, { from: 520, to: 245, duration: .2, gain: .052, type: 'triangle' }),
    'flip-pop': () => { tone(audioContext, { from: 460, to: 920, duration: .075, gain: .082 }); noise(audioContext, { duration: .035, gain: .014, frequency: 1400 }) },
    'flip-paper': () => noise(audioContext, { duration: .075, gain: .025, frequency: 2100 }),
    'flip-snap': () => { tone(audioContext, { from: 820, to: 1280, duration: .04, gain: .052, type: 'triangle' }); noise(audioContext, { duration: .022, gain: .012, frequency: 2300 }) },
    'flip-whoosh': () => { noise(audioContext, { duration: .11, gain: .026, frequency: 1100 }); tone(audioContext, { from: 350, to: 760, duration: .1, gain: .025 }) },
  }
  sounds[id]?.()
}
