import { Application } from "@hotwired/stimulus"
import ConsoleCaptureController from "../../app/javascript/controllers/console_capture_controller"

describe("ConsoleCaptureController", () => {
  let application
  let controller
  
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-controller="console-capture"></div>
    `
    
    application = Application.start()
    application.register("console-capture", ConsoleCaptureController)
    controller = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="console-capture"]'),
      "console-capture"
    )
  })
  
  afterEach(() => {
    application.stop()
    document.body.innerHTML = ""
  })
  
  test("captures console.log entries", () => {
    console.log("Test log message", { data: "test" })
    
    const consoleData = controller.getConsoleData()
    expect(consoleData.entries.length).toBeGreaterThan(0)
    
    const lastEntry = consoleData.entries[consoleData.entries.length - 1]
    expect(lastEntry.type).toBe("log")
    expect(lastEntry.message).toContain("Test log message")
    expect(lastEntry.message).toContain('"data": "test"')
  })
  
  test("captures console.error entries with stack trace", () => {
    console.error("Test error message")
    
    const consoleData = controller.getConsoleData()
    const errorEntry = consoleData.entries.find(e => e.type === "error" && e.message.includes("Test error message"))
    
    expect(errorEntry).toBeDefined()
    expect(errorEntry.stack).toBeTruthy()
  })
  
  test("captures console.warn entries", () => {
    console.warn("Test warning")
    
    const consoleData = controller.getConsoleData()
    const warnEntry = consoleData.entries.find(e => e.type === "warn" && e.message.includes("Test warning"))
    
    expect(warnEntry).toBeDefined()
  })
  
  test("limits entries to maxEntries", () => {
    // Generate more than 50 entries
    for (let i = 0; i < 60; i++) {
      console.log(`Entry ${i}`)
    }
    
    const consoleData = controller.getConsoleData()
    expect(consoleData.entries.length).toBe(50)
    
    // Should keep the most recent entries
    const lastEntry = consoleData.entries[consoleData.entries.length - 1]
    expect(lastEntry.message).toContain("Entry 59")
  })
  
  test("formats complex objects properly", () => {
    console.log("Object test", { nested: { value: "test" }, array: [1, 2, 3] })
    
    const consoleData = controller.getConsoleData()
    const lastEntry = consoleData.entries[consoleData.entries.length - 1]
    
    expect(lastEntry.message).toContain("Object test")
    expect(lastEntry.message).toContain('"nested"')
    expect(lastEntry.message).toContain('"array"')
  })
  
  test("handles null and undefined values", () => {
    console.log("Values:", null, undefined, "string")
    
    const consoleData = controller.getConsoleData()
    const lastEntry = consoleData.entries[consoleData.entries.length - 1]
    
    expect(lastEntry.message).toBe("Values: null undefined string")
  })
  
  test("includes browser metadata in console data", () => {
    const consoleData = controller.getConsoleData()
    
    expect(consoleData.userAgent).toBeTruthy()
    expect(consoleData.url).toBeTruthy()
    expect(consoleData.viewport).toEqual({
      width: expect.any(Number),
      height: expect.any(Number)
    })
    expect(consoleData.capturedAt).toBeTruthy()
  })
  
  test("clear method removes all entries", () => {
    console.log("Entry to clear")
    
    let consoleData = controller.getConsoleData()
    expect(consoleData.entries.length).toBeGreaterThan(0)
    
    controller.clear()
    
    consoleData = controller.getConsoleData()
    expect(consoleData.entries.length).toBe(0)
  })
  
  test("restores original console methods on disconnect", () => {
    const originalLog = console.log
    
    // Verify console.log has been overridden
    expect(console.log).not.toBe(originalLog)
    
    // Disconnect the controller
    controller.disconnect()
    
    // Verify console.log has been restored
    expect(console.log).toBe(originalLog)
  })
})