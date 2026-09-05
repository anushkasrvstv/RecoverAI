import { describe, expect, it } from "vitest";
import { createPayment, createTemplate, evaluateFailure, getAnalytics, getPayment, getRecoveryTimeline, listPayments, listTemplates, resetDemoData, retryPayment } from "./recoverai";

describe("RecoverAI deterministic rule engine", () => {
  it("maps network failures to immediate retry with priority 95", () => {
    expect(evaluateFailure("NETWORK_ERROR")).toMatchObject({
      failureCode: "NETWORK_ERROR",
      category: "Recoverable",
      action: "RETRY_NOW",
      priority: 95,
    });
  });

  it("maps card expiry to customer action without using AI", () => {
    const decision = evaluateFailure("CARD_EXPIRED");
    expect(decision).toMatchObject({
      category: "Unrecoverable",
      action: "UPDATE_PAYMENT_METHOD",
      priority: 10,
    });
    expect(decision.reason).toContain("expired");
  });

  it("routes fraud to human review with zero priority", () => {
    expect(evaluateFailure("FRAUD_SUSPECTED")).toMatchObject({
      category: "High Risk",
      action: "HUMAN_REVIEW",
      priority: 0,
    });
  });

  it("creates a payment and applies the rule before it enters the queue", () => {
    const payment = createPayment({ customerName: "Test Customer", amount: 1000, paymentMethod: "Visa ending 0000", failureCode: "GATEWAY_TIMEOUT" });
    expect(payment).toMatchObject({ recommendedAction: "RETRY_NOW", priorityScore: 90, status: "PENDING" });
    expect(getPayment(payment.id)?.recommendedAction).toBe("RETRY_NOW");
  });

  it("simulates a successful retry without processing a real payment", () => {
    const payment = createPayment({ customerName: "Retry Customer", amount: 2499, paymentMethod: "Demo Visa ending 4242", failureCode: "NETWORK_ERROR" });
    const result = retryPayment(payment.id);
    expect(result.success).toBe(true);
    expect(result.payment.status).toBe("RECOVERED");
    expect(result.payment.retryCount).toBe(1);
  });

  it("records the initial failure and retry outcome in a recovery timeline", () => {
    const payment = createPayment({ customerName: "Timeline Customer", amount: 2499, paymentMethod: "Demo Visa ending 4242", failureCode: "NETWORK_ERROR" });
    retryPayment(payment.id);
    expect(getRecoveryTimeline(payment.id).map(item => item.outcome)).toEqual(["FAILED", "RECOVERED"]);
  });

  it("saves reusable message templates with failure-reason metadata", () => {
    const template = createTemplate({ name: "Funds reminder", failureCode: "INSUFFICIENT_FUNDS", tone: "Friendly", language: "English", body: "Hi {{firstName}}, please try {{amount}} again later.", enabled: true });
    expect(listTemplates().some(item => item.id === template.id && item.failureCode === "INSUFFICIENT_FUNDS")).toBe(true);
  });

  it("generates the final analytics trend label from today", () => {
    const expectedToday = new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const trend = getAnalytics().revenueTrend;
    expect(trend).toHaveLength(7);
    expect(trend.at(-1)?.day).toBe(expectedToday);
  });

  it("resets the in-memory demo store to the original seed", () => {
    createPayment({ customerName: "Temporary Demo Customer", amount: 500, paymentMethod: "Demo card", failureCode: "UNKNOWN_ERROR" });
    const result = resetDemoData();
    expect(result).toEqual({ payments: 24, templates: 2 });
    expect(listPayments()).toHaveLength(24);
    expect(listTemplates()).toHaveLength(2);
  });
});
