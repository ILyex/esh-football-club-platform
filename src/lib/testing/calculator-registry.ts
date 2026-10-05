import type { TestCalculator } from "./types";
import { YoYoIR1Calculator } from "./protocols/yoyo-ir1";
import { YoYoIR2Calculator } from "./protocols/yoyo-ir2";
import { SprintCalculator } from "./protocols/sprint";
import { JumpCalculator } from "./protocols/jump";
import {
  FifaRSACalculator,
  IFT3015Calculator,
  IllinoisAgilityCalculator,
  CooperTestCalculator,
} from "./protocols/fifa-uefa-protocols";

/**
 * Calculator Registry
 * Maps calculationStrategy strings from TestDefinition to pure deterministic calculators.
 */
class CalculatorRegistry {
  private calculators = new Map<string, TestCalculator>();

  constructor() {
    this.register(YoYoIR1Calculator);
    this.register(SprintCalculator);
    this.register(JumpCalculator);
    this.register(FifaRSACalculator);
    this.register(YoYoIR2Calculator);
    this.register(IFT3015Calculator);
    this.register(IllinoisAgilityCalculator);
    this.register(CooperTestCalculator);
  }

  public register(calculator: TestCalculator): void {
    this.calculators.set(calculator.strategyKey.toUpperCase(), calculator);
  }

  public get(strategyKey: string): TestCalculator {
    const calc = this.calculators.get(strategyKey.toUpperCase());
    if (!calc) {
      throw new Error(`Unregistered calculation strategy: "${strategyKey}". Available: ${Array.from(this.calculators.keys()).join(", ")}`);
    }
    return calc;
  }

  public has(strategyKey: string): boolean {
    return this.calculators.has(strategyKey.toUpperCase());
  }

  public getAvailableStrategies(): string[] {
    return Array.from(this.calculators.keys());
  }
}

export const calculatorRegistry = new CalculatorRegistry();
