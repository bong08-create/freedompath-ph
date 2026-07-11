import { describe, expect, it } from "vitest";
import { calculateSSSPension } from "../lib/sss";

describe("calculateSSSPension", () => {
  it("computes the salary-credit formula as the highest variant for a long-tenured, higher-salary member", () => {
    // AMSC = 20,000, CYS = 30
    // salaryCreditFormula = 300 + 0.2(20000) + 0.02(20000)(30-10) = 300 + 4000 + 8000 = 12300
    // salaryReplacementFormula = 0.4(20000) = 8000
    // minimumPensionFloor (CYS >= 20) = 2400
    // basePension = max(12300, 8000, 2400) = 12300; + 1000 supplement = 13300
    const result = calculateSSSPension({ monthlySalary: 20000, creditedYearsOfService: 30 });

    expect(result.eligibleForMonthlyPension).toBe(true);
    expect(result.averageMonthlySalaryCredit).toBe(20000);
    expect(result.formulaBreakdown.salaryCreditFormula).toBe(12300);
    expect(result.formulaBreakdown.salaryReplacementFormula).toBe(8000);
    expect(result.formulaBreakdown.minimumPensionFloor).toBe(2400);
    expect(result.basePension).toBe(12300);
    expect(result.estimatedMonthlyPension).toBe(13300);
  });

  it("computes the salary-replacement formula as the highest variant for a mid-tenure member", () => {
    // AMSC = 10,000, CYS = 15
    // salaryCreditFormula = 300 + 0.2(10000) + 0.02(10000)(15-10) = 300 + 2000 + 1000 = 3300
    // salaryReplacementFormula = 0.4(10000) = 4000
    // minimumPensionFloor (10 <= CYS < 20) = 1200
    // basePension = max(3300, 4000, 1200) = 4000; + 1000 supplement = 5000
    const result = calculateSSSPension({ monthlySalary: 10000, creditedYearsOfService: 15 });

    expect(result.basePension).toBe(4000);
    expect(result.estimatedMonthlyPension).toBe(5000);
  });

  it("applies the ₱1,200 minimum pension floor for a low-salary member at exactly 10 credited years", () => {
    // AMSC clamped to the 4,000 floor, CYS = 10
    // salaryCreditFormula = 300 + 0.2(4000) + 0.02(4000)(0) = 300 + 800 = 1100
    // salaryReplacementFormula = 0.4(4000) = 1600
    // minimumPensionFloor (CYS >= 10, < 20) = 1200
    // basePension = max(1100, 1600, 1200) = 1600; + 1000 supplement = 2600
    const result = calculateSSSPension({ monthlySalary: 3000, creditedYearsOfService: 10 });

    expect(result.averageMonthlySalaryCredit).toBe(4000); // clamped to MSC floor
    expect(result.formulaBreakdown.minimumPensionFloor).toBe(1200);
    expect(result.basePension).toBe(1600);
    expect(result.estimatedMonthlyPension).toBe(2600);
  });

  it("returns not-eligible with zero pension for fewer than 10 credited years of service", () => {
    const result = calculateSSSPension({ monthlySalary: 25000, creditedYearsOfService: 5 });

    expect(result.eligibleForMonthlyPension).toBe(false);
    expect(result.basePension).toBe(0);
    expect(result.supplementalAmount).toBe(0);
    expect(result.estimatedMonthlyPension).toBe(0);
    expect(result.thirteenthMonthPensionNote).toMatch(/lump-sum/i);
  });

  it("clamps salary to the ₱30,000 MSC ceiling for high earners", () => {
    const result = calculateSSSPension({ monthlySalary: 100000, creditedYearsOfService: 25 });
    expect(result.averageMonthlySalaryCredit).toBe(30000);
  });

  it("rejects negative inputs", () => {
    expect(() => calculateSSSPension({ monthlySalary: -1000, creditedYearsOfService: 10 })).toThrow();
    expect(() => calculateSSSPension({ monthlySalary: 10000, creditedYearsOfService: -1 })).toThrow();
  });
});
