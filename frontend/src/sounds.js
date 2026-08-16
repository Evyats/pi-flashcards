let audioContext

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
    'known-rise': () => [523, 659, 784].forEach((from, index) => tone(audioContext, { at: index * .055, from, duration: .15, gain: .045, type: 'triangle' })),
    'missed-fall-high': () => { tone(audioContext, { from: 660, to: 587, duration: .12, gain: .062 }); tone(audioContext, { at: .07, from: 523, to: 440, duration: .16, gain: .055 }) },
    'flip-pop': () => { tone(audioContext, { from: 460, to: 920, duration: .075, gain: .082 }); noise(audioContext, { duration: .035, gain: .014, frequency: 1400 }) },
  }
  sounds[id]?.()
}
