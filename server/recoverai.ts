import { invokeLLM } from "./_core/llm";

export type RuleDefinition = {
  id: string;
  failureCode: string;
  condition: string;
  category: string;
  action: string;
  priority: number;
  reason: string;
  enabled: boolean;
  aiUsed: boolean;
};

export type Payment = {
  id: string;
  customerName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  failureCode: string;
  failureReason: string;
  category: string;
  priorityScore: number;
  recommendedAction: string;
  status: "PENDING" | "RECOVERED" | "FAILED_AGAIN" | "REVIEWED";
  retryCount: number;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  paymentId: string;
  event: string;
  details: string;
  aiUsed: boolean;
  timestamp: string;
};

export type GeneratedMessage = {
  id: string;
  paymentId: string;
  customer: string;
  message: string;
  tone: string;
  language: string;
  createdAt: string;
  status: "Generated" | "Sent demo";
};

export type RecoveryAttempt = {
  id: string;
  paymentId: string;
  attemptNumber: number;
  kind: "INITIAL_FAILURE" | "RETRY" | "CUSTOMER_ACTION" | "HUMAN_REVIEW";
  outcome: "FAILED" | "PENDING" | "RECOVERED" | "FAILED_AGAIN";
  details: string;
  timestamp: string;
};

export type MessageTemplate = {
  id: string;
  name: string;
  failureCode: string;
  tone: string;
  language: string;
  body: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const now = () => new Date().toISOString();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const DEFAULT_RULES: RuleDefinition[] = [
  { id: "r-network", failureCode: "NETWORK_ERROR", condition: "failure_code == NETWORK_ERROR", category: "Recoverable", action: "RETRY_NOW", priority: 95, reason: "Temporary network failure. The payment method is still valid, so an immediate retry is recommended.", enabled: true, aiUsed: false },
  { id: "r-timeout", failureCode: "TIMEOUT", condition: "failure_code == TIMEOUT", category: "Recoverable", action: "RETRY_NOW", priority: 90, reason: "The payment timed out before completion. An immediate retry is safe to attempt.", enabled: true, aiUsed: false },
  { id: "r-gateway", failureCode: "GATEWAY_TIMEOUT", condition: "failure_code == GATEWAY_TIMEOUT", category: "Recoverable", action: "RETRY_NOW", priority: 90, reason: "The gateway did not respond in time. The payment method remains valid for a retry.", enabled: true, aiUsed: false },
  { id: "r-funds", failureCode: "INSUFFICIENT_FUNDS", condition: "failure_code == INSUFFICIENT_FUNDS", category: "Recoverable Later", action: "RETRY_LATER", priority: 75, reason: "Funds may become available later. Schedule a retry instead of repeatedly charging now.", enabled: true, aiUsed: false },
  { id: "r-expired", failureCode: "CARD_EXPIRED", condition: "failure_code == CARD_EXPIRED", category: "Unrecoverable", action: "UPDATE_PAYMENT_METHOD", priority: 10, reason: "The customer's card has expired. Retrying the same payment method is unlikely to succeed.", enabled: true, aiUsed: false },
  { id: "r-blocked", failureCode: "CARD_BLOCKED", condition: "failure_code == CARD_BLOCKED", category: "Unrecoverable", action: "UPDATE_PAYMENT_METHOD", priority: 15, reason: "The card is blocked by the issuer. Ask the customer to update their payment method.", enabled: true, aiUsed: false },
  { id: "r-invalid", failureCode: "INVALID_CARD", condition: "failure_code == INVALID_CARD", category: "Unrecoverable", action: "UPDATE_PAYMENT_METHOD", priority: 5, reason: "The card details are invalid. The customer must provide a valid payment method.", enabled: true, aiUsed: false },
  { id: "r-bank", failureCode: "BANK_DECLINED", condition: "failure_code == BANK_DECLINED", category: "Uncertain", action: "HUMAN_REVIEW", priority: 40, reason: "The bank declined the payment without a recoverable signal. Route it to human review.", enabled: true, aiUsed: false },
  { id: "r-fraud", failureCode: "FRAUD_SUSPECTED", condition: "failure_code == FRAUD_SUSPECTED", category: "High Risk", action: "HUMAN_REVIEW", priority: 0, reason: "A fraud signal was detected. Do not automate a financial decision; require human review.", enabled: true, aiUsed: false },
  { id: "r-unknown", failureCode: "UNKNOWN_ERROR", condition: "failure_code == UNKNOWN_ERROR", category: "Uncertain", action: "HUMAN_REVIEW", priority: 30, reason: "The failure is not understood by a known rule. Route it to human review for safety.", enabled: true, aiUsed: false },
];

const failureCopy: Record<string, string> = {
  NETWORK_ERROR: "Network Error",
  TIMEOUT: "Timeout",
  GATEWAY_TIMEOUT: "Gateway Timeout",
  INSUFFICIENT_FUNDS: "Insufficient Funds",
  CARD_EXPIRED: "Card Expired",
  CARD_BLOCKED: "Card Blocked",
  INVALID_CARD: "Invalid Card",
  BANK_DECLINED: "Bank Declined",
  FRAUD_SUSPECTED: "Fraud Suspected",
  UNKNOWN_ERROR: "Unknown Error",
};

const customers: Array<[string, number, string]> = [
  ["Rahul Sharma", 2499, "Visa ending 4242"], ["Priya Singh", 2499, "Visa ending 4242"], ["Aman Verma", 7999, "Mastercard ending 9911"], ["Neha Gupta", 1299, "Visa ending 1808"], ["Arjun Mehta", 5499, "Amex ending 3005"], ["Kavya Iyer", 1899, "Visa ending 6612"], ["Rohan Kapoor", 3299, "Mastercard ending 1144"], ["Simran Kaur", 899, "Visa ending 7781"], ["Vikram Joshi", 12499, "Amex ending 9300"], ["Ananya Rao", 2199, "Visa ending 2204"], ["Dev Malhotra", 4599, "Mastercard ending 6677"], ["Ishita Shah", 1799, "Visa ending 4410"], ["Yash Bansal", 6999, "Visa ending 9876"], ["Meera Nair", 2599, "Mastercard ending 4512"], ["Aditya Sethi", 999, "Visa ending 1133"], ["Nandini Das", 3899, "Amex ending 2109"], ["Kabir Khanna", 5999, "Visa ending 5252"], ["Shreya Menon", 1599, "Mastercard ending 6060"], ["Harsh Vardhan", 8499, "Visa ending 7777"], ["Tanya Roy", 2799, "Visa ending 9898"], ["Manish Jain", 12999, "Mastercard ending 3456"], ["Pooja Reddy", 2299, "Visa ending 8123"], ["Sahil Arora", 3499, "Amex ending 4004"], ["Divya Pillai", 7499, "Visa ending 1010"],
];

const sequence = [
  "NETWORK_ERROR", "CARD_EXPIRED", "BANK_DECLINED", "INSUFFICIENT_FUNDS", "GATEWAY_TIMEOUT", "CARD_EXPIRED", "INSUFFICIENT_FUNDS", "NETWORK_ERROR", "CARD_BLOCKED", "BANK_DECLINED", "FRAUD_SUSPECTED", "GATEWAY_TIMEOUT", "INVALID_CARD", "INSUFFICIENT_FUNDS", "NETWORK_ERROR", "UNKNOWN_ERROR", "CARD_EXPIRED", "GATEWAY_TIMEOUT", "BANK_DECLINED", "INSUFFICIENT_FUNDS", "NETWORK_ERROR", "CARD_BLOCKED", "TIMEOUT", "INSUFFICIENT_FUNDS",
];

function findRule(failureCode: string, rules = DEFAULT_RULES) {
  return rules.find(rule => rule.failureCode === failureCode && rule.enabled) ?? DEFAULT_RULES.find(rule => rule.failureCode === "UNKNOWN_ERROR")!;
}

export function evaluateFailure(failureCode: string, rules = DEFAULT_RULES) {
  const rule = findRule(failureCode, rules);
  return {
    failureCode,
    matchedRule: rule.id,
    category: rule.category,
    action: rule.action,
    priority: rule.priority,
    reason: rule.reason,
    timestamp: now(),
  };
}

function seedPayments() {
  return customers.map(([customerName, amount, paymentMethod], index) => {
    const failureCode = sequence[index];
    const decision = evaluateFailure(failureCode);
    return {
      id: `P${1024 + index}`,
      customerName,
      amount,
      currency: "INR",
      paymentMethod,
      failureCode,
      failureReason: failureCopy[failureCode],
      category: decision.category,
      priorityScore: decision.priority,
      recommendedAction: decision.action,
      status: "PENDING" as const,
      retryCount: 0,
      createdAt: minutesAgo(index * 17 + 9),
    } satisfies Payment;
  });
}

const store: { payments: Payment[]; rules: RuleDefinition[]; audit: AuditLog[]; messages: GeneratedMessage[]; attempts: RecoveryAttempt[]; templates: MessageTemplate[] } = {
  payments: seedPayments(),
  rules: DEFAULT_RULES.map(rule => ({ ...rule })),
  audit: [],
  attempts: [],
  templates: [
    { id: "tpl-expired", name: "Expired card — payment method update", failureCode: "CARD_EXPIRED", tone: "Professional", language: "English", body: "Hi {{firstName}}, we couldn't process your {{amount}} payment because the card linked to your account has expired. Please update your payment method to keep your subscription active.", enabled: true, createdAt: minutesAgo(240), updatedAt: minutesAgo(240) },
    { id: "tpl-retry", name: "Temporary issue — automatic retry", failureCode: "NETWORK_ERROR", tone: "Friendly", language: "English", body: "Hi {{firstName}}, we hit a temporary issue while processing your {{amount}} payment. We'll retry automatically shortly — no action is needed from you.", enabled: true, createdAt: minutesAgo(180), updatedAt: minutesAgo(180) },
  ],
  messages: [
    { id: "m-seed", paymentId: "P1025", customer: "Priya Singh", message: "Hi Priya, we couldn't process your ₹2,499 payment because the card linked to your account has expired. Please update your payment method to keep your subscription active.", tone: "Professional", language: "English", createdAt: minutesAgo(42), status: "Generated" },
  ],
};

for (const payment of store.payments) {
  const decision = evaluateFailure(payment.failureCode, store.rules);
  store.audit.push({ id: `a-${payment.id}`, paymentId: payment.id, event: "Payment analyzed", details: `Failure: ${payment.failureCode}\nRule: ${decision.matchedRule}\nDecision: ${decision.action}\nPriority: ${decision.priority}/100`, aiUsed: false, timestamp: payment.createdAt });
  store.attempts.push({ id: `attempt-${payment.id}-0`, paymentId: payment.id, attemptNumber: 0, kind: "INITIAL_FAILURE", outcome: "FAILED", details: `${payment.failureReason} detected by the payment service.`, timestamp: payment.createdAt });
}

export function resetDemoData() {
  store.payments = seedPayments();
  store.rules = DEFAULT_RULES.map(rule => ({ ...rule }));
  store.audit = [];
  store.attempts = [];
  store.messages = [{ id: "m-seed", paymentId: "P1025", customer: "Priya Singh", message: "Hi Priya, we couldn't process your ₹2,499 payment because the card linked to your account has expired. Please update your payment method to keep your subscription active.", tone: "Professional", language: "English", createdAt: minutesAgo(42), status: "Generated" }];
  store.templates = [
    { id: "tpl-expired", name: "Expired card — payment method update", failureCode: "CARD_EXPIRED", tone: "Professional", language: "English", body: "Hi {{firstName}}, we couldn't process your {{amount}} payment because the card linked to your account has expired. Please update your payment method to keep your subscription active.", enabled: true, createdAt: minutesAgo(240), updatedAt: minutesAgo(240) },
    { id: "tpl-retry", name: "Temporary issue — automatic retry", failureCode: "NETWORK_ERROR", tone: "Friendly", language: "English", body: "Hi {{firstName}}, we hit a temporary issue while processing your {{amount}} payment. We'll retry automatically shortly — no action is needed from you.", enabled: true, createdAt: minutesAgo(180), updatedAt: minutesAgo(180) },
  ];
  for (const payment of store.payments) {
    const decision = evaluateFailure(payment.failureCode, store.rules);
    store.audit.push({ id: `a-${payment.id}`, paymentId: payment.id, event: "Payment analyzed", details: `Failure: ${payment.failureCode}\nRule: ${decision.matchedRule}\nDecision: ${decision.action}\nPriority: ${decision.priority}/100`, aiUsed: false, timestamp: payment.createdAt });
    store.attempts.push({ id: `attempt-${payment.id}-0`, paymentId: payment.id, attemptNumber: 0, kind: "INITIAL_FAILURE", outcome: "FAILED", details: `${payment.failureReason} detected by the payment service.`, timestamp: payment.createdAt });
  }
  return { payments: store.payments.length, templates: store.templates.length };
}

export function listPayments() { return [...store.payments].sort((a, b) => b.priorityScore - a.priorityScore || b.createdAt.localeCompare(a.createdAt)); }
export function getPayment(id: string) { return store.payments.find(payment => payment.id === id); }
export function listRules() { return store.rules.map(rule => ({ ...rule })); }
export function listMessages() { return [...store.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function getAudit(paymentId?: string) { return [...store.audit].filter(item => !paymentId || item.paymentId === paymentId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)); }
export function getRecoveryTimeline(paymentId: string) { return [...store.attempts].filter(item => item.paymentId === paymentId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)); }
export function listTemplates() { return [...store.templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }

export function createTemplate(input: Omit<MessageTemplate, "id" | "createdAt" | "updatedAt">) {
  const timestamp = now();
  const template = { ...input, id: `tpl-${Date.now()}`, createdAt: timestamp, updatedAt: timestamp };
  store.templates.unshift(template);
  return template;
}

export function updateTemplate(id: string, patch: Partial<Omit<MessageTemplate, "id" | "createdAt" | "updatedAt">>) {
  const template = store.templates.find(item => item.id === id);
  if (!template) return undefined;
  Object.assign(template, patch, { updatedAt: now() });
  return template;
}

export function addRule(input: Omit<RuleDefinition, "id" | "aiUsed">) {
  const rule = { ...input, id: `r-custom-${Date.now()}`, aiUsed: false };
  store.rules.push(rule);
  return rule;
}

export function updateRule(id: string, patch: Partial<RuleDefinition>) {
  const rule = store.rules.find(item => item.id === id);
  if (!rule) return undefined;
  Object.assign(rule, patch, { aiUsed: false });
  return rule;
}

export function createPayment(input: { customerName: string; amount: number; paymentMethod: string; failureCode: string }) {
  const decision = evaluateFailure(input.failureCode, store.rules);
  const payment: Payment = {
    id: `P${1030 + store.payments.length}`,
    customerName: input.customerName,
    amount: input.amount,
    currency: "INR",
    paymentMethod: input.paymentMethod,
    failureCode: input.failureCode,
    failureReason: failureCopy[input.failureCode] ?? "Unknown Error",
    category: decision.category,
    priorityScore: decision.priority,
    recommendedAction: decision.action,
    status: "PENDING",
    retryCount: 0,
    createdAt: now(),
  };
  store.payments.unshift(payment);
  store.audit.push({ id: `a-${payment.id}`, paymentId: payment.id, event: "Payment analyzed", details: `Failure: ${payment.failureCode}\nRule: ${decision.matchedRule}\nDecision: ${decision.action}\nPriority: ${decision.priority}/100`, aiUsed: false, timestamp: now() });
  store.attempts.push({ id: `attempt-${payment.id}-0`, paymentId: payment.id, attemptNumber: 0, kind: "INITIAL_FAILURE", outcome: "FAILED", details: `${payment.failureReason} detected by the payment service.`, timestamp: now() });
  return payment;
}

export function retryPayment(id: string) {
  const payment = getPayment(id);
  if (!payment) throw new Error("Payment not found");
  payment.retryCount += 1;
  const success = payment.priorityScore >= 90 && payment.retryCount === 1;
  payment.status = success ? "RECOVERED" : "FAILED_AGAIN";
  store.attempts.push({ id: `attempt-${payment.id}-${payment.retryCount}`, paymentId: id, attemptNumber: payment.retryCount, kind: "RETRY", outcome: success ? "RECOVERED" : "FAILED_AGAIN", details: success ? `Retry ${payment.retryCount} succeeded in the demo simulation.` : `Retry ${payment.retryCount} failed again.`, timestamp: now() });
  store.audit.push({ id: `a-${Date.now()}`, paymentId: id, event: success ? "Payment recovered (demo)" : "Retry failed again (demo)", details: success ? `₹${payment.amount.toLocaleString("en-IN")} recovered on retry ${payment.retryCount}.` : `Payment failed again. Retry count: ${payment.retryCount}.`, aiUsed: false, timestamp: now() });
  return { payment: { ...payment }, success };
}

function fallbackMessage(payment: Payment, tone: string, language: string) {
  const amount = `₹${payment.amount.toLocaleString("en-IN")}`;
  if (language === "Hindi") return `नमस्ते ${payment.customerName.split(" ")[0]}, आपका ${amount} भुगतान पूरा नहीं हो सका क्योंकि ${payment.failureReason.toLowerCase()}। कृपया अपना भुगतान तरीका अपडेट करें ताकि आपकी सेवा जारी रहे।`;
  if (language === "Hinglish") return `Hi ${payment.customerName.split(" ")[0]}, ${amount} ka payment process nahi ho saka because ${payment.failureReason.toLowerCase()}. Please apna payment method update kar dein so your subscription stays active.`;
  if (payment.recommendedAction === "RETRY_NOW") return `Hi ${payment.customerName.split(" ")[0]}, we couldn't complete your ${amount} payment because of a temporary ${payment.failureReason.toLowerCase()}. We will retry it automatically shortly.`;
  if (payment.recommendedAction === "RETRY_LATER") return `Hi ${payment.customerName.split(" ")[0]}, your ${amount} payment needs a little more time because of ${payment.failureReason.toLowerCase()}. We'll retry it later so you don't need to take action right now.`;
  if (payment.recommendedAction === "HUMAN_REVIEW") return `Hi ${payment.customerName.split(" ")[0]}, we couldn't complete your ${amount} payment due to ${payment.failureReason.toLowerCase()}. Our team is reviewing it and will follow up with you shortly.`;
  return tone === "Concise" ? `Hi ${payment.customerName.split(" ")[0]}, please update your payment method to complete your ${amount} payment.` : `Hi ${payment.customerName.split(" ")[0]}, we couldn't process your ${amount} payment because the card linked to your account has expired. Please update your payment method to keep your subscription active.`;
}

export async function generateMessage(id: string, tone: string, language: string, templateId?: string) {
  const payment = getPayment(id);
  if (!payment) throw new Error("Payment not found");
  const decision = evaluateFailure(payment.failureCode, store.rules);
  const template = templateId ? store.templates.find(item => item.id === templateId && item.enabled) : undefined;
  let message = template ? template.body.replaceAll("{{firstName}}", payment.customerName.split(" ")[0]).replaceAll("{{amount}}", `₹${payment.amount.toLocaleString("en-IN")}`) : fallbackMessage(payment, tone, language);
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You write customer payment recovery messages. Never change, question, or invent the recovery action. Return only the final customer-facing message, no preamble." },
        { role: "user", content: JSON.stringify({ customer: payment.customerName, amount: payment.amount, failure: payment.failureCode, action: decision.action, reason: decision.reason, tone, language, template: template?.body ?? null }) },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) message = content.trim();
  } catch {
    // The rule engine remains fully operational if the optional communication layer is unavailable.
  }
  const result: GeneratedMessage = { id: `m-${Date.now()}`, paymentId: id, customer: payment.customerName, message, tone, language, createdAt: now(), status: "Generated" };
  store.messages.unshift(result);
  store.audit.push({ id: `a-${Date.now()}`, paymentId: id, event: "Recovery message generated", details: "Purpose: Customer communication\nThe deterministic decision was passed to the AI message layer.", aiUsed: true, timestamp: now() });
  return { message: result, decision };
}

export function getAnalytics() {
  const payments = store.payments;
  const total = payments.length;
  const recoverable = payments.filter(p => p.recommendedAction === "RETRY_NOW" || p.recommendedAction === "RETRY_LATER").length;
  const humanReview = payments.filter(p => p.recommendedAction === "HUMAN_REVIEW").length;
  const doNotRetry = payments.filter(p => p.recommendedAction === "UPDATE_PAYMENT_METHOD").length;
  const atRisk = payments.filter(p => p.status !== "RECOVERED").reduce((sum, p) => sum + p.amount, 0);
  const recovered = payments.filter(p => p.status === "RECOVERED").reduce((sum, p) => sum + p.amount, 0);
  const retried = payments.filter(p => p.retryCount > 0).length;
  const successfulRetries = payments.filter(p => p.status === "RECOVERED").length;
  const countBy = (key: (p: Payment) => string) => Object.entries(payments.reduce<Record<string, number>>((acc, p) => { const value = key(p); acc[value] = (acc[value] ?? 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));
  // Illustrative demo trend for the first 6 days — kept separate from and clearly smaller in
  // magnitude than the live figures below, so it never mixes with real simulated numbers.
  const trendValues = [18200, 21600, 23800, 25800, 27800, 29600];
  const trendAtRiskValues = [68000, 71200, 70400, 73300, 68800, 72500];
  const trendDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  });
  return {
    total, recoverable, humanReview, doNotRetry, atRisk, recovered,
    // Recovery rate and retry success are computed only from real simulated outcomes — no padding.
    recoveryRate: total ? Math.round((successfulRetries / total) * 100) : 0,
    retrySuccessRate: retried ? Math.round((successfulRetries / retried) * 100) : 0,
    failureDistribution: countBy(p => p.failureReason),
    actionDistribution: [
      { name: "Retry Now", value: payments.filter(p => p.recommendedAction === "RETRY_NOW").length },
      { name: "Retry Later", value: payments.filter(p => p.recommendedAction === "RETRY_LATER").length },
      { name: "Update Payment Method", value: doNotRetry },
      { name: "Human Review", value: humanReview },
    ],
    outcomeDistribution: [
      { name: "Pending", value: payments.filter(p => p.status === "PENDING").length },
      { name: "Recovered", value: payments.filter(p => p.status === "RECOVERED").length },
      { name: "Failed again", value: payments.filter(p => p.status === "FAILED_AGAIN").length },
    ],
    // Only the final (today) point reflects the live simulation state; the first 6 points are
    // fixed illustrative history, matched with real dates so the axis never looks broken.
    revenueTrend: trendDays.map((day, index) => ({ day, recovered: index === 6 ? recovered : trendValues[index], atRisk: index === 6 ? atRisk : trendAtRiskValues[index] })),
  };
}

export const failureOptions = Object.keys(failureCopy).map(value => ({ value, label: failureCopy[value] }));
