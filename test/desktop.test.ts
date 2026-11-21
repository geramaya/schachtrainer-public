import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDesktopApp } from '../src/ui/desktop.ts'

test('isDesktopApp: recognises the Tauri origins on Linux (tauri://) and Windows (http://tauri.localhost)', () => {
  assert.equal(isDesktopApp({ protocol: 'tauri:', hostname: 'localhost' }), true)
  assert.equal(isDesktopApp({ protocol: 'http:', hostname: 'tauri.localhost' }), true)
})

test('isDesktopApp: recognises the injected __TAURI_INTERNALS__ object', () => {
  assert.equal(isDesktopApp({ protocol: 'https:', hostname: 'example.org' }, { __TAURI_INTERNALS__: {} }), true)
})

test('isDesktopApp: plain browser origins are not the desktop app', () => {
  assert.equal(isDesktopApp({ protocol: 'http:', hostname: 'localhost' }), false)
  assert.equal(isDesktopApp({ protocol: 'https:', hostname: 'tauri.localhost.evil.test' }), false)
})
