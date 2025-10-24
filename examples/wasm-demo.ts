#!/usr/bin/env ts-node

/**
 * WASM Module Demo
 * Demonstrates loading and using the WASM module in Node.js
 */

import {
  loadWasmModule,
  WasmFunctionBinder,
  WasmPerformanceMonitor,
} from "../src/wasm/loader";

async function runWasmDemo() {
  console.log("🚀 Starting WASM Module Demo...\n");

  try {
    // Load the WASM module
    console.log("📦 Loading WASM module...");
    const wasmModule = await loadWasmModule();
    console.log("✅ WASM module loaded successfully!\n");

    // Create function binder for safer function calls
    const binder = new WasmFunctionBinder(wasmModule);
    const functions = binder.bindAll();

    // Create performance monitor
    const monitor = new WasmPerformanceMonitor();

    // Test arithmetic functions
    console.log("🔢 Testing Arithmetic Functions:");
    console.log(`  add(5, 3) = ${functions.arithmetic.add(5, 3)}`);
    console.log(`  subtract(10, 4) = ${functions.arithmetic.subtract(10, 4)}`);
    console.log(`  multiply(6, 7) = ${functions.arithmetic.multiply(6, 7)}`);
    console.log(`  divide(15, 3) = ${functions.arithmetic.divide(15, 3)}`);
    console.log();

    // Test string functions
    console.log("📝 Testing String Functions:");
    const testString = "Hello WASM World";
    console.log(`  Original: "${testString}"`);
    console.log(`  Reversed: "${functions.strings.reverse(testString)}"`);
    console.log(`  Uppercase: "${functions.strings.toUppercase(testString)}"`);
    console.log(`  Word count: ${functions.strings.countWords(testString)}`);
    console.log(`  Processed: "${functions.strings.process(testString)}"`);
    console.log();

    // Test array functions
    console.log("📊 Testing Array Functions:");
    const arraySize = 10;
    const testArray = functions.arrays.createArray(arraySize);
    console.log(
      `  Created array of size ${arraySize}: [${Array.from(testArray)
        .slice(0, 5)
        .join(", ")}...]`
    );
    console.log(`  Sum of array: ${functions.arrays.sumArray(testArray)}`);
    console.log();

    // Test utility functions
    console.log("🔧 Testing Utility Functions:");
    try {
      console.log(
        `  parseIntSafe("123") = ${functions.utilities.parseIntSafe("123")}`
      );
      console.log(
        `  parseIntSafe("-456") = ${functions.utilities.parseIntSafe("-456")}`
      );
    } catch (error) {
      console.log(
        `  Error parsing invalid input: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    try {
      console.log(
        `  parseIntSafe("invalid") = ${functions.utilities.parseIntSafe(
          "invalid"
        )}`
      );
    } catch (error) {
      console.log(
        `  Expected error for invalid input: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    console.log();

    // Performance testing
    console.log("⚡ Performance Testing:");

    // Test arithmetic performance
    await monitor.measureFunction("arithmetic_batch", async () => {
      for (let i = 0; i < 1000; i++) {
        functions.arithmetic.add(i, i + 1);
        functions.arithmetic.multiply(i, 2);
      }
    });

    // Test string processing performance
    await monitor.measureFunction("string_processing", async () => {
      for (let i = 0; i < 100; i++) {
        const str = `Test string ${i}`;
        functions.strings.reverse(str);
        functions.strings.toUppercase(str);
        functions.strings.countWords(str);
      }
    });

    // Display performance metrics
    const metrics = monitor.getAllMetrics();
    for (const [name, stats] of Object.entries(metrics)) {
      console.log(
        `  ${name}: ${stats.count} calls, avg: ${stats.average.toFixed(
          2
        )}ms, min: ${stats.min.toFixed(2)}ms, max: ${stats.max.toFixed(2)}ms`
      );
    }
    console.log();

    // Test error handling
    console.log("❌ Testing Error Handling:");
    try {
      functions.arithmetic.divide(10, 0);
    } catch (error) {
      console.log(
        `  Division by zero caught: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    try {
      // @ts-ignore - Testing runtime validation
      functions.arithmetic.add("not a number", 5);
    } catch (error) {
      console.log(
        `  Invalid parameter caught: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    console.log("\n🎉 WASM Demo completed successfully!");
  } catch (error) {
    console.error(
      "❌ Demo failed:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runWasmDemo().catch(console.error);
}

export { runWasmDemo };
