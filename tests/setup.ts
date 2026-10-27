import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  window.location.hash = ''
  try {
    window.sessionStorage.clear()
    window.localStorage.clear()
  } catch {
    // storage may be unavailable in the test environment
  }
})
