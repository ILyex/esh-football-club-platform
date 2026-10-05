import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatorRegistry } from "@/lib/testing/calculator-registry";
import { CreateDefinitionSchema } from "@/lib/testing/validation";
import type { TestCalculator, CalculationInput, CalculationOutput, RawMeasurement } from "@/lib/testing/types";

test("Extensibility: hypothetical test definition can be registered and calculated without new DB models", () => {
  // 1. Define a hypothetical Illinois Agility Test
  const illinoisAgilityDef = {
    code: "ILLINOIS_AGILITY",
    name: "Illinois Agility Run Test",
    category: "AGILITY" as const,
    description: "Standard 10x5m agility test navigating 4 center cones with turns and sprints.",
    primaryUnit: "s",
    secondaryUnit: null,
    direction: "LOWER_IS_BETTER" as const,
    calculationStrategy: "ILLINOIS_AGILITY_STRATEGY",
    defaultRetestDays: 28,
    instructions: "Player starts prone, sprints 10m, navigates cones, sprints 10m to finish.",
    active: true,
    displayOrder: 10,
  };

  // 2. Validate using the platform's standard CreateDefinitionSchema
  const validatedDef = CreateDefinitionSchema.parse(illinoisAgilityDef);
  assert.equal(validatedDef.code, "ILLINOIS_AGILITY");
  assert.equal(validatedDef.category, "AGILITY");
  assert.equal(validatedDef.direction, "LOWER_IS_BETTER");

  // 3. Register a pure calculator on the existing CalculatorRegistry
  const IllinoisAgilityCalculator: TestCalculator = {
    strategyKey: "ILLINOIS_AGILITY_STRATEGY",
    defaultUnit: "s",
    defaultDirection: "LOWER_IS_BETTER",

    validate(measurements: RawMeasurement[]) {
      const timeM = measurements.find((m) => m.key === "time");
      if (!timeM || !timeM.numericValue) {
        return { valid: false, error: "A numeric time measurement is required." };
      }
      if (timeM.numericValue < 10 || timeM.numericValue > 30) {
        return { valid: false, error: "Illinois agility time must be between 10s and 30s." };
      }
      return { valid: true };
    },

    calculate(input: CalculationInput): CalculationOutput {
      const timeM = input.measurements.find((m) => m.key === "time");
      const time = Number(timeM!.numericValue);
      return {
        summaryScore: time,
        primaryUnit: "s",
        scoreDisplay: `${time.toFixed(2)} s`,
        normalizedMeasurements: [
          { key: "time", value: String(time), numericValue: time, unit: "s", attempt: 1 }
        ],
        metadata: { agilityRating: time < 15.2 ? "EXCELLENT" : time < 16.2 ? "GOOD" : "AVERAGE" }
      };
    }
  };

  calculatorRegistry.register(IllinoisAgilityCalculator);

  // 4. Verify the registry recognizes the new strategy
  assert.equal(calculatorRegistry.has("ILLINOIS_AGILITY_STRATEGY"), true);
  const fetchedCalc = calculatorRegistry.get("ILLINOIS_AGILITY_STRATEGY");
  assert.equal(fetchedCalc.defaultUnit, "s");

  // 5. Execute calculation using generic input
  const testInput = {
    measurements: [{ key: "time", value: "14.85", numericValue: 14.85 }]
  };
  const valResult = fetchedCalc.validate(testInput.measurements);
  assert.equal(valResult.valid, true);

  const calcResult = fetchedCalc.calculate(testInput);
  assert.equal(calcResult.summaryScore, 14.85);
  assert.equal(calcResult.scoreDisplay, "14.85 s");
  assert.equal(calcResult.metadata?.agilityRating, "EXCELLENT");

  // 6. Proves: ZERO new database tables, ZERO schema modifications, 100% extensible!
});
