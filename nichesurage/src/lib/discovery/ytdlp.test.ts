/**
 * @jest-environment node
 *
 * Pure-function tests for the VTT post-processing helper. We do NOT exercise
 * the spawn / network code paths here — those are integration concerns
 * verified on Vercel preview.
 */

import { __test__ } from './ytdlp'

const { vttToPlainText } = __test__

describe('vttToPlainText', () => {
  it('strips WEBVTT header, cue timings, and numeric line numbers', () => {
    const vtt = [
      'WEBVTT',
      'Kind: captions',
      'Language: en',
      '',
      '1',
      '00:00:01.000 --> 00:00:05.000',
      'Hello world',
      '',
      '2',
      '00:00:05.000 --> 00:00:10.000',
      'This is a transcript',
    ].join('\n')
    expect(vttToPlainText(vtt)).toBe('Hello world This is a transcript')
  })

  it('strips bracket markers like [Music] and [Applause]', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:05.000',
      '[Music]',
      '',
      '00:00:05.000 --> 00:00:10.000',
      '[Applause] Hello everyone',
      '',
      '00:00:10.000 --> 00:00:15.000',
      'welcome to the show [Laughter]',
    ].join('\n')
    expect(vttToPlainText(vtt)).toBe('Hello everyone welcome to the show')
  })

  it('strips inline VTT tags like <c> and <00:00:01.000>', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:05.000',
      'Hello <c.colorE5E5E5>world</c><00:00:02.000><c> friends</c>',
    ].join('\n')
    expect(vttToPlainText(vtt)).toBe('Hello world friends')
  })

  it('dedupes overlapping cues from rolling auto-subs', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'Hello there',
      '',
      '00:00:02.500 --> 00:00:05.000',
      'Hello there',
      '',
      '00:00:05.000 --> 00:00:08.000',
      'how are you',
    ].join('\n')
    expect(vttToPlainText(vtt)).toBe('Hello there how are you')
  })

  it('returns empty string when VTT has only headers and timings', () => {
    const vtt = ['WEBVTT', 'Kind: captions', 'Language: en'].join('\n')
    expect(vttToPlainText(vtt)).toBe('')
  })

  it('skips NOTE blocks', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE this is a comment',
      '',
      '00:00:01.000 --> 00:00:05.000',
      'real content',
    ].join('\n')
    expect(vttToPlainText(vtt)).toBe('real content')
  })
})
