import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  addRule,
  createPayment,
  createTemplate,
  evaluateFailure,
  generateMessage,
  getAnalytics,
  getAudit,
  getPayment,
  getRecoveryTimeline,
  listMessages,
  listPayments,
  listRules,
  listTemplates,
  retryPayment,
  resetDemoData,
  updateTemplate,
  updateRule,
} from "./recoverai";

const paymentInput = z.object({
  customerName: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  failureCode: z.string().min(1),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  payments: router({
    list: publicProcedure.query(() => listPayments()),
    get: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => getPayment(input.id)),
    analyze: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => {
      const payment = getPayment(input.id);
      if (!payment) throw new Error("Payment not found");
      return { payment, decision: evaluateFailure(payment.failureCode) };
    }),
    create: publicProcedure.input(paymentInput).mutation(({ input }) => createPayment(input)),
    retry: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => retryPayment(input.id)),
    audit: publicProcedure.input(z.object({ id: z.string() }).optional()).query(({ input }) => getAudit(input?.id)),
    timeline: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => getRecoveryTimeline(input.id)),
    generateMessage: publicProcedure.input(z.object({ id: z.string(), tone: z.string(), language: z.string(), templateId: z.string().optional() })).mutation(({ input }) => generateMessage(input.id, input.tone, input.language, input.templateId)),
  }),
  analytics: publicProcedure.query(() => getAnalytics()),
  demo: router({
    reset: publicProcedure.mutation(() => resetDemoData()),
  }),
  rules: router({
    list: publicProcedure.query(() => listRules()),
    create: publicProcedure.input(z.object({ failureCode: z.string(), condition: z.string(), category: z.string(), action: z.string(), priority: z.number().min(0).max(100), reason: z.string(), enabled: z.boolean() })).mutation(({ input }) => addRule(input)),
    update: publicProcedure.input(z.object({ id: z.string(), patch: z.object({ category: z.string().optional(), action: z.string().optional(), priority: z.number().min(0).max(100).optional(), reason: z.string().optional(), enabled: z.boolean().optional() }) })).mutation(({ input }) => updateRule(input.id, input.patch)),
  }),
  messages: router({
    list: publicProcedure.query(() => listMessages()),
    templates: publicProcedure.query(() => listTemplates()),
    createTemplate: publicProcedure.input(z.object({ name: z.string().min(1), failureCode: z.string().min(1), tone: z.string().min(1), language: z.string().min(1), body: z.string().min(1), enabled: z.boolean() })).mutation(({ input }) => createTemplate(input)),
    updateTemplate: publicProcedure.input(z.object({ id: z.string(), patch: z.object({ name: z.string().optional(), failureCode: z.string().optional(), tone: z.string().optional(), language: z.string().optional(), body: z.string().optional(), enabled: z.boolean().optional() }) })).mutation(({ input }) => updateTemplate(input.id, input.patch)),
  }),
  failureOptions: publicProcedure.query(() => [
    { value: "NETWORK_ERROR", label: "Network Error" }, { value: "TIMEOUT", label: "Timeout" }, { value: "GATEWAY_TIMEOUT", label: "Gateway Timeout" }, { value: "INSUFFICIENT_FUNDS", label: "Insufficient Funds" }, { value: "CARD_EXPIRED", label: "Card Expired" }, { value: "CARD_BLOCKED", label: "Card Blocked" }, { value: "INVALID_CARD", label: "Invalid Card" }, { value: "BANK_DECLINED", label: "Bank Declined" }, { value: "FRAUD_SUSPECTED", label: "Fraud Suspected" }, { value: "UNKNOWN_ERROR", label: "Unknown Error" },
  ]),
});

export type AppRouter = typeof appRouter;
