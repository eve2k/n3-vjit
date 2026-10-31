import { test } from 'node:test'
import assert from 'node:assert/strict'
import { speakJapanese, stopSpeaking } from './tts.js'

test('phát âm báo dừng khi đổi câu, dừng tay hoặc trình duyệt kết thúc', () => {
  const originalWindow = globalThis.window
  const OriginalUtterance = globalThis.SpeechSynthesisUtterance
  const spoken = []
  const ended = []
  globalThis.window = { speechSynthesis: { getVoices: () => [], cancel: () => {}, speak: utterance => spoken.push(utterance) } }
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  try {
    speakJapanese('大学', 0.85, () => ended.push('first'))
    assert.equal(spoken[0].text, '大学')
    speakJapanese('学長', 0.9, () => ended.push('second'))
    assert.deepEqual(ended, ['first'])
    spoken[0].onend()
    assert.deepEqual(ended, ['first'])
    stopSpeaking()
    assert.deepEqual(ended, ['first', 'second'])
    speakJapanese('授業', 0.9, () => ended.push('third'))
    spoken[2].onerror()
    assert.deepEqual(ended, ['first', 'second', 'third'])
  } finally {
    stopSpeaking()
    globalThis.window = originalWindow
    globalThis.SpeechSynthesisUtterance = OriginalUtterance
  }
})
