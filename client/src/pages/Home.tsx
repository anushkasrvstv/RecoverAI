import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Copy,
  Database,
  FileCheck2,
  Filter,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";

type PageKey = "overview" | "payments" | "queue" | "rules" | "messages" | "analytics" | "audit" | "settings";

type Payment = {
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
  status: string;
  retryCount: number;
  createdAt: string;
};

type Rule = {
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

type Audit = { id: string; paymentId: string; event: string; details: string; aiUsed: boolean; timestamp: string };
type RecoveryAttempt = { id: string; paymentId: string; attemptNumber: number; kind: string; outcome: string; details: string; timestamp: string };
type MessageTemplate = { id: string; name: string; failureCode: string; tone: string; language: string; body: string; enabled: boolean; createdAt: string; updatedAt: string };

const navItems: Array<{ key: PageKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "payments", label: "Failed Payments", icon: ClipboardList },
  { key: "queue", label: "Recovery Queue", icon: Zap },
  { key: "rules", label: "Decision Rules", icon: SlidersHorizontal },
  { key: "messages", label: "AI Messages", icon: Bot },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "audit", label: "Audit Log", icon: FileCheck2 },
];

const actionLabels: Record<string, string> = {
  RETRY_NOW: "Retry Now",
  RETRY_LATER: "Retry Later",
  UPDATE_PAYMENT_METHOD: "Update Payment Method",
  HUMAN_REVIEW: "Human Review",
};

const categoryStyles: Record<string, string> = {
  Recoverable: "success",
  "Recoverable Later": "warning",
  Unrecoverable: "danger",
  Uncertain: "warning",
  "High Risk": "danger",
};

const chartColors = ["#f59e0b", "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6", "#64748b"];

function formatINR(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) { toast.info("There is no data to export yet"); return; }
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""').replaceAll("\n", " ")}"`;
  const csv = [headers.map(escape).join(","), ...rows.map(row => headers.map(header => escape(row[header])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} downloaded`);
}

function actionLabel(action: string) {
  return actionLabels[action] ?? action.replaceAll("_", " ");
}

function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function Priority({ score }: { score: number }) {
  const tone = score >= 75 ? "high" : score >= 30 ? "medium" : "low";
  return <div className="priority-wrap"><span className={`priority-score ${tone}`}>{score}/100</span><div className="priority-track"><span className={tone} style={{ width: `${score}%` }} /></div></div>;
}

function ActionBadge({ action }: { action: string }) {
  const tone = action === "RETRY_NOW" ? "success" : action === "RETRY_LATER" || action === "HUMAN_REVIEW" ? "warning" : "danger";
  return <StatusBadge tone={tone}>{actionLabel(action)}</StatusBadge>;
}

export default function Home() {
  const [activePage, setActivePage] = useState<PageKey>("overview");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [pageNumber, setPageNumber] = useState(1);

  const paymentsQuery = trpc.payments.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const analyticsQuery = trpc.analytics.useQuery(undefined, { refetchOnWindowFocus: false });
  const rulesQuery = trpc.rules.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const messagesQuery = trpc.messages.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const templatesQuery = trpc.messages.templates.useQuery(undefined, { refetchOnWindowFocus: false });
  const auditQuery = trpc.payments.audit.useQuery(selectedPayment ? { id: selectedPayment.id } : undefined, { enabled: Boolean(selectedPayment) });
  const auditAllQuery = trpc.payments.audit.useQuery(undefined, { refetchOnWindowFocus: false });
  const timelineQuery = trpc.payments.timeline.useQuery({ id: selectedPayment?.id ?? "" }, { enabled: Boolean(selectedPayment) });
  const utils = trpc.useUtils();
  const retryMutation = trpc.payments.retry.useMutation({ onSuccess: ({ payment, success }) => { setSelectedPayment(payment as Payment); void utils.payments.list.invalidate(); void utils.analytics.invalidate(); void utils.payments.timeline.invalidate({ id: payment.id }); void utils.payments.audit.invalidate({ id: payment.id }); toast.success(success ? `${formatINR(payment.amount)} recovered in demo simulation` : "Payment failed again — retry count increased"); }, onError: () => toast.error("Could not simulate retry") });
  const messageMutation = trpc.payments.generateMessage.useMutation({ onSuccess: () => { void utils.messages.list.invalidate(); void utils.payments.audit.invalidate(); toast.success("Recovery message generated — AI only handled communication"); }, onError: () => toast.error("AI message generation is temporarily unavailable") });
  const createMutation = trpc.payments.create.useMutation({ onSuccess: payment => { setShowSimulator(false); void utils.payments.list.invalidate(); void utils.analytics.invalidate(); setActivePage("payments"); setSelectedPayment(payment as Payment); messageMutation.mutate({ id: payment.id, tone: "Professional", language: "English" }); toast.success(`${payment.id} classified and recovery message queued`); }, onError: () => toast.error("Please complete all simulator fields") });
  const templateCreateMutation = trpc.messages.createTemplate.useMutation({ onSuccess: () => { void utils.messages.templates.invalidate(); setShowTemplateModal(false); toast.success("Message template saved"); }, onError: () => toast.error("Could not save template") });
  const templateUpdateMutation = trpc.messages.updateTemplate.useMutation({ onSuccess: () => { void utils.messages.templates.invalidate(); toast.success("Template status updated"); } });
  const resetMutation = trpc.demo.reset.useMutation({ onSuccess: () => { setSelectedPayment(null); setActivePage("overview"); void utils.payments.list.invalidate(); void utils.analytics.invalidate(); void utils.rules.list.invalidate(); void utils.messages.list.invalidate(); void utils.messages.templates.invalidate(); void utils.payments.audit.invalidate(); void utils.payments.timeline.invalidate(); toast.success("Demo data reset to the original seed"); }, onError: () => toast.error("Could not reset demo data") });
  const ruleUpdateMutation = trpc.rules.update.useMutation({ onSuccess: () => { void utils.rules.list.invalidate(); toast.success("Rule updated. AI cannot modify decision rules."); } });
  const ruleCreateMutation = trpc.rules.create.useMutation({ onSuccess: () => { void utils.rules.list.invalidate(); toast.success("Rule added to the deterministic engine"); } });

  const payments = (paymentsQuery.data ?? []) as Payment[];
  const analytics = analyticsQuery.data;
  const rules = (rulesQuery.data ?? []) as Rule[];
  const messages = messagesQuery.data ?? [];
  const templates = (templatesQuery.data ?? []) as MessageTemplate[];
  const allAudit = selectedPayment ? ((auditQuery.data ?? []) as Audit[]) : [];
  const allAuditRows = (auditAllQuery.data ?? []) as Audit[];
  const recoveryTimeline = selectedPayment ? ((timelineQuery.data ?? []) as RecoveryAttempt[]) : [];
  const filteredPayments = useMemo(() => payments.filter(payment => {
    const matchesQuery = `${payment.id} ${payment.customerName} ${payment.failureReason}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "ALL" || payment.recommendedAction === filter;
    return matchesQuery && matchesFilter;
  }), [payments, query, filter]);
  const visiblePayments = filteredPayments.slice((pageNumber - 1) * 8, pageNumber * 8);

  const navigate = (page: PageKey) => { setActivePage(page); setSelectedPayment(null); setMobileOpen(false); setShowLanding(false); };

  if (showLanding) return <LandingPage onOpen={() => { setShowLanding(false); setActivePage("overview"); }} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark"><Activity size={19} strokeWidth={2.5} /></div>
          <div><div className="brand-name">Recover<span>AI</span></div><div className="brand-sub">PAYMENT OPERATIONS</div></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-rule" />
        <div className="nav-label">WORKSPACE</div>
        <nav className="primary-nav">
          {navItems.map(item => { const Icon = item.icon; return <button key={item.key} className={`nav-item ${activePage === item.key && !selectedPayment ? "active" : ""}`} onClick={() => navigate(item.key)}><Icon size={17} /><span>{item.label}</span>{item.key === "payments" && <span className="nav-count">24</span>}</button>; })}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${activePage === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings size={17} /><span>Settings</span></button>
          <div className="demo-card"><div className="demo-dot" /><div><strong>Demo Mode</strong><small>No real payments</small></div><button aria-label="Demo mode info"><CircleHelp size={15} /></button></div>
          <div className="user-mini"><div className="avatar">AS</div><div><strong>Arjun Sethi</strong><small>Administrator</small></div><MoreHorizontal size={17} className="muted-icon" /></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{selectedPayment ? `Payment #${selectedPayment.id}` : navItems.find(item => item.key === activePage)?.label}</strong></div></div><div className="topbar-actions"><div className="demo-pill"><span /> Demo Simulation</div><button className="icon-button"><Bell size={18} /><i /></button><div className="topbar-avatar">AS</div></div></header>
        <div className="content-wrap">
          <div className="global-disclaimer"><ShieldCheck size={15} /><span><strong>Rules decide what happens.</strong> AI decides how to communicate it.</span><span className="disclaimer-divider" /> <span>All payment actions are simulated.</span></div>
          {selectedPayment ? <PaymentDetail payment={selectedPayment} audits={allAudit} timeline={recoveryTimeline} templates={templates} onBack={() => setSelectedPayment(null)} onRetry={() => retryMutation.mutate({ id: selectedPayment.id })} retrying={retryMutation.isPending} onGenerate={(tone, language, templateId) => messageMutation.mutate({ id: selectedPayment.id, tone, language, templateId })} generating={messageMutation.isPending} /> : <>
            {activePage === "overview" && <Overview analytics={analytics} payments={payments} onNavigate={navigate} onOpenPayment={payment => setSelectedPayment(payment)} onOpenSimulator={() => setShowSimulator(true)} />}
            {activePage === "payments" && <PaymentsPage payments={visiblePayments} total={filteredPayments.length} query={query} setQuery={value => { setQuery(value); setPageNumber(1); }} filter={filter} setFilter={value => { setFilter(value); setPageNumber(1); }} pageNumber={pageNumber} setPageNumber={setPageNumber} onOpen={payment => setSelectedPayment(payment)} onExport={() => downloadCsv("recoverai-failed-payments.csv", payments.map(payment => ({ payment_id: payment.id, customer: payment.customerName, amount_inr: payment.amount, failure_reason: payment.failureReason, failure_code: payment.failureCode, category: payment.category, recovery_priority: payment.priorityScore, recommended_action: actionLabel(payment.recommendedAction), status: payment.status, created_at: payment.createdAt })))} />}
            {activePage === "queue" && <QueuePage payments={payments} onOpen={payment => setSelectedPayment(payment)} />}
            {activePage === "rules" && <RulesPage rules={rules} onToggle={rule => ruleUpdateMutation.mutate({ id: rule.id, patch: { enabled: !rule.enabled } })} onEdit={rule => ruleUpdateMutation.mutate({ id: rule.id, patch: { priority: rule.priority === 0 ? 10 : rule.priority - 5 } })} onAdd={() => ruleCreateMutation.mutate({ failureCode: "NEW_FAILURE", condition: "failure_code == NEW_FAILURE", category: "Uncertain", action: "HUMAN_REVIEW", priority: 25, reason: "Custom demo rule routes unknown cases to human review.", enabled: true })} />}
            {activePage === "messages" && <MessagesPage messages={messages} templates={templates} onOpen={paymentId => { const payment = payments.find(item => item.id === paymentId); if (payment) setSelectedPayment(payment); }} onNewTemplate={() => setShowTemplateModal(true)} onToggleTemplate={template => templateUpdateMutation.mutate({ id: template.id, patch: { enabled: !template.enabled } })} />}
            {activePage === "analytics" && <AnalyticsPage analytics={analytics} />}
            {activePage === "audit" && <AuditPage payments={payments} onOpen={payment => setSelectedPayment(payment)} onExport={() => downloadCsv("recoverai-audit-log.csv", allAuditRows.map(item => ({ timestamp: item.timestamp, payment_id: item.paymentId, event: item.event, details: item.details, ai_used: item.aiUsed ? "Yes" : "No" })))} />}
            {activePage === "settings" && <SettingsPage onLanding={() => setShowLanding(true)} onReset={() => { if (window.confirm("Reset all demo payments, rules, messages, and audit history?")) resetMutation.mutate(); }} resetting={resetMutation.isPending} />}
          </>}
        </div>
      </main>
      {showSimulator && <SimulatorModal onClose={() => setShowSimulator(false)} onSubmit={input => createMutation.mutate(input)} submitting={createMutation.isPending} />}
      {showTemplateModal && <TemplateModal onClose={() => setShowTemplateModal(false)} onSubmit={input => templateCreateMutation.mutate(input)} submitting={templateCreateMutation.isPending} />}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow ?? "PAYMENT OPERATIONS"}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="header-action">{action}</div>}</div>;
}

function Overview({ analytics, payments, onNavigate, onOpenPayment, onOpenSimulator }: { analytics: any; payments: Payment[]; onNavigate: (page: PageKey) => void; onOpenPayment: (payment: Payment) => void; onOpenSimulator: () => void }) {
  const topPayments = payments.slice(0, 5);
  return <div>
    <PageHeader eyebrow="OVERVIEW" title="Good afternoon, Arjun" description="Here's what is happening across your failed payment recovery operations today." action={<button className="primary-button" onClick={onOpenSimulator}><Plus size={16} /> Simulate Failure</button>} />
    <div className="hero-principle"><div className="principle-icon"><ShieldCheck size={22} /></div><div><strong>Explainable recovery, by design.</strong><p>Every recovery decision is deterministic, traceable, and separate from the AI communication layer.</p></div><div className="principle-chain"><span>FAILED PAYMENT</span><ChevronRight size={14} /><span className="blue">RULE ENGINE</span><ChevronRight size={14} /><span className="green">ACTION</span><ChevronRight size={14} /><span className="purple">AI MESSAGE</span></div></div>
    <div className="kpi-grid">
      <KpiCard label="Failed Payments" value={24} trend="+8.2%" trendUp icon={<ClipboardList size={18} />} tone="blue" />
      <KpiCard label="Recoverable" value={13} trend="+12.4%" trendUp icon={<RefreshCw size={18} />} tone="green" />
      <KpiCard label="Human Review" value={5} trend="2 new today" icon={<Users size={18} />} tone="amber" />
      <KpiCard label="Do Not Retry" value={6} trend="-3.1%" icon={<PauseCircle size={18} />} tone="red" />
      <KpiCard label="Revenue at Risk" value={formatINR(72500)} trend="across 24 payments" icon={<ArrowDownRight size={18} />} tone="amber" />
      <KpiCard label="Revenue Recovered" value={formatINR(31200)} trend="+18.6% this week" trendUp icon={<CheckCircle2 size={18} />} tone="green" />
    </div>
    <div className="section-heading"><div><h2>Recovery performance</h2><p>Live signals from your deterministic recovery engine.</p></div><button className="text-button" onClick={() => onNavigate("analytics")}>View analytics <ArrowRight size={15} /></button></div>
    <div className="dashboard-grid">
      <div className="panel chart-panel wide"><div className="panel-head"><div><h3>Revenue recovered</h3><p>Recovered vs. revenue at risk over the last 7 days</p></div><div className="legend"><span><i className="legend-dot green" /> Recovered</span><span><i className="legend-dot gray" /> At risk</span></div></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics?.revenueTrend ?? []} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.23} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#edf1f5" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `₹${Math.round(v / 1000)}k`} /><Tooltip formatter={(value: number) => formatINR(value)} contentStyle={{ border: "1px solid #e6ebf0", borderRadius: 10, fontSize: 12 }} /><Area type="monotone" dataKey="atRisk" stroke="#cbd5e1" fill="transparent" strokeWidth={2} strokeDasharray="4 4" /><Area type="monotone" dataKey="recovered" stroke="#22c55e" fill="url(#greenFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div></div>
      <div className="panel chart-panel"><div className="panel-head"><div><h3>Action distribution</h3><p>Current queue mix</p></div><button className="icon-button subtle"><MoreHorizontal size={17} /></button></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={analytics?.actionDistribution ?? []} dataKey="value" nameKey="name" innerRadius={54} outerRadius={76} paddingAngle={3} stroke="none">{(analytics?.actionDistribution ?? []).map((_: unknown, index: number) => <Cell key={index} fill={chartColors[index]} />)}</Pie><Tooltip contentStyle={{ border: "1px solid #e6ebf0", borderRadius: 10, fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{analytics?.total ?? 24}</strong><span>payments</span></div></div><div className="mini-legend">{(analytics?.actionDistribution ?? []).map((item: any, index: number) => <div key={item.name}><span><i style={{ background: chartColors[index] }} /> {item.name}</span><strong>{item.value}</strong></div>)}</div></div>
    </div>
    <div className="section-heading compact"><div><h2>Priority queue</h2><p>Highest-impact payments waiting for action.</p></div><button className="text-button" onClick={() => onNavigate("queue")}>Open recovery queue <ArrowRight size={15} /></button></div>
    <div className="panel table-panel"><table><thead><tr><th>Payment</th><th>Customer</th><th>Failure</th><th>Priority</th><th>Action</th><th>Status</th><th /></tr></thead><tbody>{topPayments.map(payment => <tr key={payment.id} onClick={() => onOpenPayment(payment)}><td><strong className="mono">{payment.id}</strong><small>{formatDate(payment.createdAt)}</small></td><td><div className="customer-cell"><div className="table-avatar">{payment.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</div><span>{payment.customerName}</span></div></td><td>{payment.failureReason}</td><td><Priority score={payment.priorityScore} /></td><td><ActionBadge action={payment.recommendedAction} /></td><td><StatusBadge tone={payment.status === "RECOVERED" ? "success" : "neutral"}>{payment.status === "PENDING" ? "Pending" : payment.status === "RECOVERED" ? "Recovered" : "Failed again"}</StatusBadge></td><td><ChevronRight size={16} className="muted-icon" /></td></tr>)}</tbody></table></div>
    <div className="micro-note"><ShieldCheck size={14} /> AI decision authority: <strong>0%</strong> <span>·</span> AI generates communication only.</div>
  </div>;
}

function KpiCard({ label, value, trend, trendUp, icon, tone }: { label: string; value: string | number; trend: string; trendUp?: boolean; icon: React.ReactNode; tone: string }) {
  return <div className="kpi-card"><div className={`kpi-icon ${tone}`}>{icon}</div><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className={`kpi-trend ${trendUp ? "up" : ""}`}>{trendUp && <ArrowDownRight size={13} />} {trend}</div></div>;
}

function PaymentsPage({ payments, total, query, setQuery, filter, setFilter, pageNumber, setPageNumber, onOpen, onExport }: { payments: Payment[]; total: number; query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; pageNumber: number; setPageNumber: (value: number) => void; onOpen: (payment: Payment) => void; onExport: () => void }) {
  return <div><PageHeader eyebrow="OPERATIONS / FAILED PAYMENTS" title="Failed payments" description="Review every failed payment through the deterministic recovery lens." action={<button className="secondary-button" onClick={onExport}><DownloadIcon /> Export CSV</button>} /><div className="toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search payments, customers..." /></div><div className="filter-row"><Filter size={15} className="muted-icon" />{[["ALL", "All"], ["RETRY_NOW", "Retry Now"], ["RETRY_LATER", "Retry Later"], ["UPDATE_PAYMENT_METHOD", "Update Payment Method"], ["HUMAN_REVIEW", "Human Review"]].map(([value, label]) => <button key={value} className={`filter-chip ${filter === value ? "selected" : ""}`} onClick={() => setFilter(value)}>{label}</button>)}</div></div><div className="table-meta"><span>Showing <strong>{payments.length}</strong> of <strong>{total}</strong> failed payments</span><button className="sort-button">Priority <ChevronDown size={14} /></button></div><div className="panel table-panel full-table"><table><thead><tr><th>Payment</th><th>Customer</th><th>Amount</th><th>Failure reason</th><th>Category</th><th>Recovery priority</th><th>Recommended action</th><th>Status</th><th /></tr></thead><tbody>{payments.map(payment => <tr key={payment.id} onClick={() => onOpen(payment)}><td><strong className="mono">{payment.id}</strong><small>{formatDate(payment.createdAt)}</small></td><td><div className="customer-cell"><div className="table-avatar">{payment.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</div><span>{payment.customerName}</span></div></td><td><strong>{formatINR(payment.amount)}</strong></td><td><div>{payment.failureReason}</div><small className="mono">{payment.failureCode}</small></td><td><StatusBadge tone={categoryStyles[payment.category] ?? "neutral"}>{payment.category}</StatusBadge></td><td><Priority score={payment.priorityScore} /></td><td><ActionBadge action={payment.recommendedAction} /></td><td><StatusBadge tone={payment.status === "RECOVERED" ? "success" : payment.status === "FAILED_AGAIN" ? "danger" : "neutral"}>{payment.status === "PENDING" ? "Pending" : payment.status === "RECOVERED" ? "Recovered" : "Failed again"}</StatusBadge></td><td><ChevronRight size={16} className="muted-icon" /></td></tr>)}</tbody></table>{payments.length === 0 && <EmptyState title="No payments match" description="Try a different search or filter." />}</div><div className="pagination"><span>Page {pageNumber} of {Math.max(1, Math.ceil(total / 8))}</span><div><button disabled={pageNumber === 1} onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}><ArrowLeft size={15} /></button><button disabled={pageNumber >= Math.ceil(total / 8)} onClick={() => setPageNumber(pageNumber + 1)}><ArrowRight size={15} /></button></div></div></div>;
}

function QueuePage({ payments, onOpen }: { payments: Payment[]; onOpen: (payment: Payment) => void }) {
  const groups = [
    { action: "RETRY_NOW", title: "Retry now", subtitle: "Temporary failures with a valid payment method", icon: <Zap size={17} />, tone: "green" },
    { action: "RETRY_LATER", title: "Retry later", subtitle: "Wait for a better chance of successful collection", icon: <Clock3 size={17} />, tone: "amber" },
    { action: "UPDATE_PAYMENT_METHOD", title: "Customer action required", subtitle: "The payment method must be updated first", icon: <CreditCardIcon />, tone: "blue" },
    { action: "HUMAN_REVIEW", title: "Human review", subtitle: "A person should make the next call", icon: <Users size={17} />, tone: "purple" },
  ];
  return <div><PageHeader eyebrow="OPERATIONS / RECOVERY QUEUE" title="Recovery queue" description="A prioritized worklist built by rules — never by an AI guess." /><div className="queue-intro"><div><ShieldCheck size={18} /><strong>Every section is sorted by Recovery Priority Score.</strong></div><span>AI authority over this queue: <strong>0%</strong></span></div><div className="queue-grid">{groups.map(group => { const items = payments.filter(payment => payment.recommendedAction === group.action).sort((a, b) => b.priorityScore - a.priorityScore); return <div className={`queue-column ${group.tone}`} key={group.action}><div className="queue-head"><div className="queue-title"><span className={`queue-icon ${group.tone}`}>{group.icon}</span><div><h3>{group.title}</h3><p>{group.subtitle}</p></div></div><span className="queue-count">{items.length}</span></div><div className="queue-items">{items.map(payment => <button className="queue-card" key={payment.id} onClick={() => onOpen(payment)}><div className="queue-card-top"><strong className="mono">{payment.id}</strong><Priority score={payment.priorityScore} /></div><div className="queue-customer"><div className="table-avatar">{payment.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</div><div><strong>{payment.customerName}</strong><span>{formatINR(payment.amount)} · {payment.failureReason}</span></div></div><p>{findReason(payment)}</p><div className="queue-card-foot"><ActionBadge action={payment.recommendedAction} /><ChevronRight size={15} /></div></button>)}{items.length === 0 && <div className="queue-empty">No payments in this lane.</div>}</div></div>; })}</div></div>;
}

function findReason(payment: Payment) {
  if (payment.failureCode === "NETWORK_ERROR") return "Temporary network failure; payment method remains valid.";
  if (payment.failureCode === "CARD_EXPIRED") return "Card has expired; same payment method is unlikely to succeed.";
  if (payment.failureCode === "INSUFFICIENT_FUNDS") return "Funds may become available later; schedule a retry.";
  if (payment.recommendedAction === "HUMAN_REVIEW") return "The rule engine could not safely automate the next action.";
  return "Classified by the deterministic rule engine.";
}

function RulesPage({ rules, onToggle, onEdit, onAdd }: { rules: Rule[]; onToggle: (rule: Rule) => void; onEdit: (rule: Rule) => void; onAdd: () => void }) {
  return <div><PageHeader eyebrow="CONTROL PLANE / RULES" title="Decision rules" description="The financial decision layer. AI can never create, edit, or override these rules." action={<button className="primary-button" onClick={onAdd}><Plus size={16} /> Add rule</button>} /><div className="rules-banner"><div className="rules-banner-icon"><SlidersHorizontal size={20} /></div><div><strong>Deterministic engine active</strong><p>Every payment is classified before customer communication is generated. Rule changes are visible in the audit trail.</p></div><div className="rules-stat"><span>Active rules</span><strong>{rules.filter(r => r.enabled).length}/{rules.length}</strong></div></div><div className="panel table-panel rules-table"><table><thead><tr><th>Rule</th><th>Condition</th><th>Category</th><th>Action</th><th>Priority</th><th>AI used</th><th>Status</th><th /></tr></thead><tbody>{rules.map(rule => <tr key={rule.id}><td><strong className="mono">{rule.failureCode}</strong><small>{rule.id}</small></td><td><code>{rule.condition}</code></td><td><StatusBadge tone={categoryStyles[rule.category] ?? "neutral"}>{rule.category}</StatusBadge></td><td><ActionBadge action={rule.action} /></td><td><strong className="rule-priority">{rule.priority}</strong></td><td><span className="no-ai"><Check size={13} /> No</span></td><td><button className={`toggle ${rule.enabled ? "on" : ""}`} onClick={() => onToggle(rule)}><span /></button></td><td><button className="icon-button subtle" onClick={() => onEdit(rule)}><Pencil size={15} /></button></td></tr>)}</tbody></table></div><div className="micro-note"><ShieldCheck size={14} /> Rule management is deterministic and auditable. AI is explicitly excluded from this control plane.</div></div>;
}

function MessagesPage({ messages, templates, onOpen, onNewTemplate, onToggleTemplate }: { messages: any[]; templates: MessageTemplate[]; onOpen: (paymentId: string) => void; onNewTemplate: () => void; onToggleTemplate: (template: MessageTemplate) => void }) {
  return <div><PageHeader eyebrow="COMMUNICATION / AI MESSAGES" title="AI messages" description="Personalized communication generated after a recovery decision is already locked." action={<div className="header-action"><div className="ai-authority-badge"><Sparkles size={15} /> Communication only</div><button className="primary-button" onClick={onNewTemplate}><Plus size={15} /> New template</button></div>} /><div className="ai-guardrail"><div className="ai-guardrail-icon"><Bot size={20} /></div><div><strong>AI Decision Authority: 0%</strong><p>The message layer receives the action, reason, tone, and language. It cannot change the decision, priority, retry count, or payment status.</p></div><div className="ai-guardrail-list"><span><Check size={13} /> Generate</span><span><Check size={13} /> Personalize</span><span><X size={13} /> Decide</span></div></div><div className="panel table-panel"><table><thead><tr><th>Payment</th><th>Customer</th><th>Generated message</th><th>Tone</th><th>Language</th><th>Generated at</th><th>Status</th></tr></thead><tbody>{messages.map(message => <tr key={message.id} onClick={() => onOpen(message.paymentId)}><td><strong className="mono">{message.paymentId}</strong></td><td>{message.customer}</td><td><div className="message-preview">{message.message}</div></td><td>{message.tone}</td><td>{message.language}</td><td>{formatDate(message.createdAt)}</td><td><StatusBadge tone={message.status === "Sent demo" ? "success" : "blue"}>{message.status}</StatusBadge></td></tr>)}</tbody></table>{messages.length === 0 && <EmptyState title="No messages yet" description="Open a payment to generate your first recovery message." />}</div><div className="section-heading compact"><div><h2>Custom templates</h2><p>Save reusable message patterns by failure reason, tone, and language.</p></div><span className="micro-note"><ShieldCheck size={14} /> Templates shape communication only.</span></div><div className="template-grid">{templates.map(template => <div className="panel template-card" key={template.id}><div className="template-card-head"><div><strong>{template.name}</strong><small className="mono">{template.failureCode} · {template.tone} · {template.language}</small></div><button className={`toggle ${template.enabled ? "on" : ""}`} onClick={() => onToggleTemplate(template)}><span /></button></div><p>{template.body}</p><div className="template-card-foot"><span>{template.enabled ? "Available in generator" : "Disabled"}</span><span>Updated {formatDate(template.updatedAt)}</span></div></div>)}</div></div>;
}

function AnalyticsPage({ analytics }: { analytics: any }) {
  return <div><PageHeader eyebrow="INSIGHTS / ANALYTICS" title="Recovery analytics" description="Measure the system end-to-end — from failure classification to recovered revenue." /><div className="analytics-kpis"><Metric label="Recovery rate" value={`${analytics?.recoveryRate ?? 0}%`} detail="of all classified payments" good /><Metric label="Retry success rate" value={`${analytics?.retrySuccessRate ?? 0}%`} detail="of attempted retries" good /><Metric label="Revenue at risk" value={formatINR(analytics?.atRisk ?? 0)} detail="across current queue" /><Metric label="Customer action" value={`${analytics?.doNotRetry ?? 0}`} detail="payments need updates" /></div><div className="dashboard-grid analytics-grid"><div className="panel chart-panel wide"><div className="panel-head"><div><h3>Revenue recovered over time</h3><p>Track recovered value against open exposure.</p></div></div><div className="chart-area tall"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics?.revenueTrend ?? []} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.17} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#edf1f5" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `₹${Math.round(v / 1000)}k`} /><Tooltip formatter={(value: number) => formatINR(value)} contentStyle={{ border: "1px solid #e6ebf0", borderRadius: 10, fontSize: 12 }} /><Area type="monotone" dataKey="atRisk" stroke="#cbd5e1" fill="transparent" strokeDasharray="4 4" /><Area type="monotone" dataKey="recovered" stroke="#2563eb" fill="url(#analyticsFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div></div><div className="panel chart-panel"><div className="panel-head"><div><h3>Recovery outcomes</h3><p>Current payment states</p></div></div><div className="bar-chart"><ResponsiveContainer width="100%" height={230}><BarChart data={analytics?.outcomeDistribution ?? []} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke="#edf1f5" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><Tooltip contentStyle={{ border: "1px solid #e6ebf0", borderRadius: 10, fontSize: 12 }} /><Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div></div><div className="dashboard-grid"><div className="panel chart-panel"><div className="panel-head"><div><h3>Failure distribution</h3><p>Where payments are breaking</p></div></div><div className="failure-list">{(analytics?.failureDistribution ?? []).map((item: any, index: number) => <div key={item.name}><div><span><i style={{ background: chartColors[index % chartColors.length] }} />{item.name}</span><strong>{item.value}</strong></div><div className="failure-track"><span style={{ width: `${Math.max(8, item.value / Math.max(analytics?.total ?? 1, 1) * 100)}%`, background: chartColors[index % chartColors.length] }} /></div></div>)}</div></div><div className="panel chart-panel"><div className="panel-head"><div><h3>Operating model</h3><p>The RecoverAI separation of duties</p></div></div><div className="operating-model"><div className="operating-step blue"><span>01</span><div><strong>Rule engine</strong><small>Classifies failure and picks action</small></div></div><ChevronDown size={16} className="muted-icon" /><div className="operating-step purple"><span>02</span><div><strong>AI message layer</strong><small>Personalizes customer communication</small></div></div><ChevronDown size={16} className="muted-icon" /><div className="operating-step green"><span>03</span><div><strong>Audit log</strong><small>Proves what happened and why</small></div></div></div></div></div></div>;
}

function Metric({ label, value, detail, good }: { label: string; value: string; detail: string; good?: boolean }) { return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small className={good ? "good" : ""}>{detail}</small></div>; }

function AuditPage({ payments, onOpen, onExport }: { payments: Payment[]; onOpen: (payment: Payment) => void; onExport: () => void }) {
  const rows = payments.slice(0, 10);
  return <div><PageHeader eyebrow="GOVERNANCE / AUDIT" title="Audit log" description="A chronological record of every rule decision and communication event." action={<button className="secondary-button" onClick={onExport}><FileCheck2 size={16} /> Export CSV</button>} /><div className="audit-callout"><ShieldCheck size={20} /><div><strong>Auditable by default</strong><p>Financial recovery decisions are recorded with the matched rule. AI use is separately labeled for communication events.</p></div><div className="audit-stat"><strong>{rows.length * 2 + 1}</strong><span>events today</span></div></div><div className="audit-list">{rows.map((payment, index) => <div className="audit-day" key={payment.id}><div className="audit-time"><span>{index === 0 ? "Today" : "Sep 05"}</span><small>{formatDate(payment.createdAt)}</small></div><div className="audit-line"><div className="audit-node rule"><ShieldCheck size={14} /></div><div className="audit-event"><div className="audit-event-head"><strong>Payment {payment.id} analyzed</strong><StatusBadge tone="blue">AI used: No</StatusBadge></div><p>Failure <code>{payment.failureCode}</code> matched the deterministic rule and produced <strong>{actionLabel(payment.recommendedAction)}</strong>.</p><button className="inline-link" onClick={() => onOpen(payment)}>View payment <ChevronRight size={14} /></button></div></div>{index < 3 && <div className="audit-line"><div className="audit-node message"><Sparkles size={14} /></div><div className="audit-event"><div className="audit-event-head"><strong>Recovery message generated</strong><StatusBadge tone="purple">AI used: Yes</StatusBadge></div><p>Purpose: customer communication. Decision authority remained with the rule engine.</p><button className="inline-link" onClick={() => onOpen(payment)}>Open message <ChevronRight size={14} /></button></div></div>}</div>)}</div></div>;
}

function SettingsPage({ onLanding, onReset, resetting }: { onLanding: () => void; onReset: () => void; resetting: boolean }) { return <div><PageHeader eyebrow="WORKSPACE / SETTINGS" title="Settings" description="Configure the demo workspace and review the safety boundaries." /><div className="settings-grid"><div className="panel settings-card"><div className="settings-card-head"><div className="setting-icon blue"><Gauge size={18} /></div><div><h3>Demo workspace</h3><p>All payments are simulated with seeded INR data.</p></div></div><div className="setting-row"><div><strong>Demo mode</strong><small>Prevents real payment processing</small></div><div className="toggle on"><span /></div></div><div className="setting-row"><div><strong>Seed data</strong><small>24 failed payments across 10 failure types</small></div><StatusBadge tone="success">Loaded</StatusBadge></div><div className="setting-row"><div><strong>Reset demo data</strong><small>Restore seeded payments, rules, messages, and audit history</small></div><button className="secondary-button" onClick={onReset} disabled={resetting}>{resetting ? <RefreshCw className="spin" size={14} /> : <RefreshCw size={14} />} {resetting ? "Resetting..." : "Reset demo"}</button></div><div className="setting-row"><div><strong>Product landing page</strong><small>Review the positioning and core USP</small></div><button className="text-button" onClick={onLanding}>Open landing page <ArrowRight size={14} /></button></div></div><div className="panel settings-card"><div className="settings-card-head"><div className="setting-icon purple"><ShieldCheck size={18} /></div><div><h3>Safety architecture</h3><p>The guardrails that keep decisions explainable.</p></div></div><div className="safety-list"><div><CheckCircle2 size={17} /><span>Rule engine determines the action</span></div><div><CheckCircle2 size={17} /><span>AI receives the already-determined decision</span></div><div><CheckCircle2 size={17} /><span>Audit log records every step</span></div><div><X size={17} /><span>AI cannot approve financial decisions</span></div></div></div></div></div>; }

function PaymentDetail({ payment, audits, timeline, templates, onBack, onRetry, retrying, onGenerate, generating }: { payment: Payment; audits: Audit[]; timeline: RecoveryAttempt[]; templates: MessageTemplate[]; onBack: () => void; onRetry: () => void; retrying: boolean; onGenerate: (tone: string, language: string, templateId?: string) => void; generating: boolean }) {
  const [tone, setTone] = useState("Professional");
  const [language, setLanguage] = useState("English");
  const [templateId, setTemplateId] = useState("");
  const [editedMessage, setEditedMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const decisionTone = payment.recommendedAction === "RETRY_NOW" ? "green" : payment.recommendedAction === "HUMAN_REVIEW" ? "amber" : "red";
  const isRecovered = payment.status === "RECOVERED";
  const message = editedMessage || (payment.failureCode === "CARD_EXPIRED" ? `Hi ${payment.customerName.split(" ")[0]}, we couldn't process your ${formatINR(payment.amount)} payment because the card linked to your account has expired. Please update your payment method to keep your subscription active.` : `Hi ${payment.customerName.split(" ")[0]}, we couldn't complete your ${formatINR(payment.amount)} payment because of a temporary ${payment.failureReason.toLowerCase()}. Our team will help you complete it soon.`);
  const copyMessage = async () => { await navigator.clipboard?.writeText(message); setCopied(true); toast.success("Message copied to clipboard"); setTimeout(() => setCopied(false), 1600); };
  return <div><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to payments</button><div className="detail-header"><div><div className="eyebrow">PAYMENT DETAIL / {payment.id}</div><h1>Payment <span className="mono">#{payment.id}</span></h1><p>Created {formatDate(payment.createdAt)} · Demo simulation only</p></div><div className="detail-header-actions"><StatusBadge tone={isRecovered ? "success" : "neutral"}>{isRecovered ? "Recovered" : "Pending review"}</StatusBadge>{payment.recommendedAction === "RETRY_NOW" && !isRecovered && <button className="primary-button" onClick={onRetry} disabled={retrying}>{retrying ? <RefreshCw className="spin" size={15} /> : <RefreshCw size={15} />} {retrying ? "Retrying..." : "Retry payment"}</button>}</div></div><div className="detail-summary"><div><span>Customer</span><strong>{payment.customerName}</strong></div><div><span>Amount</span><strong>{formatINR(payment.amount)}</strong></div><div><span>Payment method</span><strong>{payment.paymentMethod}</strong></div><div><span>Failure</span><strong>{payment.failureReason}</strong><small className="mono">{payment.failureCode}</small></div></div><div className={`decision-card ${decisionTone}`}><div className="decision-card-top"><div className="decision-icon">{payment.recommendedAction === "RETRY_NOW" ? <RefreshCw size={24} /> : payment.recommendedAction === "HUMAN_REVIEW" ? <Users size={24} /> : <AlertTriangle size={24} />}</div><div><div className="decision-label">DETERMINISTIC DECISION</div><h2>{actionLabel(payment.recommendedAction).toUpperCase()}</h2></div><div className="decision-score"><span>Recovery Priority Score</span><strong>{payment.priorityScore}<small>/100</small></strong></div></div><div className="decision-reason"><strong>Why this action?</strong><p>{findReason(payment)}</p></div><div className="decision-rule"><span>Rule matched</span><code>{payment.failureCode} <ArrowRight size={13} /> {payment.recommendedAction}</code></div><div className="decision-foot"><span>Decision type: <strong>Deterministic Rule</strong></span><span>AI used for decision: <strong className="red-text">NO</strong></span></div></div><RecoveryTimeline timeline={timeline} /><div className="detail-grid"><div className="panel trace-panel"><div className="panel-head"><div><h3>Decision trace</h3><p>Step-by-step path from failure to action.</p></div><StatusBadge tone="blue">AI authority: 0%</StatusBadge></div><div className="trace-list"><TraceStep label="Payment failed" sub={`Payment ${payment.id} was not completed`} state="done" /><TraceStep label="Failure detected" sub={payment.failureReason} state="done" /><TraceStep label={`Failure code: ${payment.failureCode}`} sub="Normalized by payment service" state="done" mono /><TraceStep label="Rule engine" sub="Evaluating enabled deterministic rules" state="done" accent="blue" /><TraceStep label={`Matched rule: ${payment.failureCode}`} sub={`Classification: ${payment.category}`} state="done" mono /><TraceStep label={`Action: ${actionLabel(payment.recommendedAction)}`} sub={`Priority ${payment.priorityScore}/100`} state="current" accent={decisionTone} /><TraceStep label="AI message generator" sub="Optional communication layer" state="next" accent="purple" last /></div><div className="ai-boundary"><div><strong>AI CAN</strong><span><Check size={13} /> Generate customer messages</span><span><Check size={13} /> Personalize tone and language</span></div><div><strong>AI CANNOT</strong><span><X size={13} /> Decide whether to retry</span><span><X size={13} /> Override rules or change status</span></div></div></div><div className="detail-side"><div className="panel message-panel"><div className="panel-head"><div><h3><Sparkles size={16} className="purple-icon" /> Generate recovery message</h3><p>AI communicates the decision — it does not make it.</p></div></div><div className="select-grid"><label>Tone<select value={tone} onChange={event => setTone(event.target.value)}><option>Professional</option><option>Friendly</option><option>Concise</option><option>Empathetic</option></select></label><label>Language<select value={language} onChange={event => setLanguage(event.target.value)}><option>English</option><option>Hindi</option><option>Hinglish</option></select></label><label className="template-select">Template<select value={templateId} onChange={event => setTemplateId(event.target.value)}><option value="">Default generated message</option>{templates.filter(template => template.enabled).map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><button className="generate-button" onClick={() => onGenerate(tone, language, templateId || undefined)} disabled={generating}>{generating ? <RefreshCw className="spin" size={15} /> : <Sparkles size={15} />} {generating ? "Generating..." : "Generate message"}</button><div className="message-output"><div className="message-output-head"><span>Preview</span><button className="icon-button subtle" onClick={copyMessage}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div><textarea value={editedMessage || message} onChange={event => setEditedMessage(event.target.value)} /><div className="message-actions"><button className="secondary-button" onClick={copyMessage}><Copy size={14} /> Copy</button><button className="secondary-button" onClick={() => toast.success("Demo message queued — no customer was contacted")}>Send demo message</button></div></div></div><div className="panel audit-mini"><div className="panel-head"><div><h3>Payment audit</h3><p>Latest rule and message events</p></div><FileCheck2 size={16} className="muted-icon" /></div>{audits.length === 0 ? <div className="audit-mini-empty">Audit events are created as the demo runs.</div> : audits.slice(0, 4).map(audit => <div className="audit-mini-row" key={audit.id}><div className={`audit-mini-dot ${audit.aiUsed ? "purple" : "green"}`} /><div><strong>{audit.event}</strong><small>{formatDate(audit.timestamp)} · AI used: {audit.aiUsed ? "Yes" : "No"}</small></div></div>)}</div></div></div><div className="micro-note"><ShieldCheck size={14} /> Demo Simulation — No real payment is processed. Never use real card information.</div></div>;
}

function RecoveryTimeline({ timeline }: { timeline: RecoveryAttempt[] }) {
  const labelFor = (kind: string) => kind === "INITIAL_FAILURE" ? "Initial payment attempt" : kind === "RETRY" ? "Retry attempt" : kind === "CUSTOMER_ACTION" ? "Customer action" : "Human review";
  return <div className="panel recovery-timeline"><div className="panel-head"><div><h3><Activity size={16} className="blue-icon" /> Recovery attempts</h3><p>Every outcome is recorded in order, including demo retries.</p></div><StatusBadge tone={timeline.some(item => item.outcome === "RECOVERED") ? "success" : "neutral"}>{timeline.length} event{timeline.length === 1 ? "" : "s"}</StatusBadge></div><div className="timeline-track">{timeline.map((item, index) => { const recovered = item.outcome === "RECOVERED"; const failed = item.outcome === "FAILED" || item.outcome === "FAILED_AGAIN"; return <div className="timeline-item" key={item.id}><div className={`timeline-marker ${recovered ? "recovered" : failed ? "failed" : "pending"}`}>{recovered ? <CheckCircle2 size={14} /> : failed ? <AlertTriangle size={14} /> : <Clock3 size={14} />}</div><div className="timeline-content"><div className="timeline-content-head"><div><strong>{labelFor(item.kind)}</strong><span>{formatDate(item.timestamp)}</span></div><StatusBadge tone={recovered ? "success" : failed ? "danger" : "warning"}>{item.outcome.replaceAll("_", " ")}</StatusBadge></div><p>{item.details}</p>{item.kind === "RETRY" && <small className="mono">Attempt #{item.attemptNumber}</small>}</div>{index < timeline.length - 1 && <div className="timeline-connector" />}</div>; })}</div></div>;
}

function TraceStep({ label, sub, state, accent, mono, last }: { label: string; sub: string; state: string; accent?: string; mono?: boolean; last?: boolean }) { return <div className={`trace-step ${state} ${last ? "last" : ""}`}><div className={`trace-node ${accent ?? ""}`}>{state === "done" ? <Check size={13} /> : state === "current" ? <Zap size={13} /> : <span />}</div><div><strong className={mono ? "mono" : ""}>{label}</strong><small>{sub}</small></div></div>; }

function TemplateModal({ onClose, onSubmit, submitting }: { onClose: () => void; onSubmit: (input: { name: string; failureCode: string; tone: string; language: string; body: string; enabled: boolean }) => void; submitting: boolean }) {
  const [name, setName] = useState("New recovery template");
  const [failureCode, setFailureCode] = useState("CARD_EXPIRED");
  const [tone, setTone] = useState("Professional");
  const [language, setLanguage] = useState("English");
  const [body, setBody] = useState("Hi {{firstName}}, we couldn't process your {{amount}} payment. Please review your payment method so your service can continue.");
  return <div className="modal-backdrop"><div className="modal-card template-modal"><div className="modal-head"><div><div className="eyebrow">COMMUNICATION LIBRARY</div><h2>Create message template</h2><p>Templates guide customer wording after the deterministic decision is complete.</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="form-grid"><label>Template name<input value={name} onChange={event => setName(event.target.value)} /></label><label>Failure reason<select value={failureCode} onChange={event => setFailureCode(event.target.value)}><option value="NETWORK_ERROR">Network Error</option><option value="TIMEOUT">Timeout</option><option value="GATEWAY_TIMEOUT">Gateway Timeout</option><option value="INSUFFICIENT_FUNDS">Insufficient Funds</option><option value="CARD_EXPIRED">Card Expired</option><option value="CARD_BLOCKED">Card Blocked</option><option value="INVALID_CARD">Invalid Card</option><option value="BANK_DECLINED">Bank Declined</option><option value="FRAUD_SUSPECTED">Fraud Suspected</option><option value="UNKNOWN_ERROR">Unknown Error</option></select></label><label>Tone<select value={tone} onChange={event => setTone(event.target.value)}><option>Professional</option><option>Friendly</option><option>Concise</option><option>Empathetic</option></select></label><label>Language<select value={language} onChange={event => setLanguage(event.target.value)}><option>English</option><option>Hindi</option><option>Hinglish</option></select></label><label className="template-body-field">Message body<textarea value={body} onChange={event => setBody(event.target.value)} /></label></div><div className="template-helper"><code>{`{{firstName}}`}</code> customer first name <span>·</span> <code>{`{{amount}}`}</code> formatted INR amount</div><div className="modal-note"><ShieldCheck size={15} /><span>AI can use this template for wording, but cannot change the recovery action or payment status.</span></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={submitting} onClick={() => onSubmit({ name, failureCode, tone, language, body, enabled: true })}>{submitting ? <RefreshCw className="spin" size={15} /> : <Plus size={15} />} {submitting ? "Saving..." : "Save template"}</button></div></div></div>;
}

function SimulatorModal({ onClose, onSubmit, submitting }: { onClose: () => void; onSubmit: (input: { customerName: string; amount: number; paymentMethod: string; failureCode: string }) => void; submitting: boolean }) {
  const [customerName, setCustomerName] = useState("Ananya Kapoor"); const [amount, setAmount] = useState("2499"); const [paymentMethod, setPaymentMethod] = useState("Visa ending 4242"); const [failureCode, setFailureCode] = useState("NETWORK_ERROR");
  return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><div className="eyebrow">DEMO TOOL</div><h2>Simulate payment failure</h2><p>Create a payment, run the rule engine, and watch it enter the recovery queue.</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="simulator-flow"><span>CREATE</span><ChevronRight size={14} /><span className="blue">CLASSIFY</span><ChevronRight size={14} /><span className="green">ACTION</span><ChevronRight size={14} /><span className="purple">AUDIT</span></div><div className="form-grid"><label>Customer name<input value={customerName} onChange={event => setCustomerName(event.target.value)} /></label><label>Amount (INR)<input type="number" value={amount} onChange={event => setAmount(event.target.value)} /></label><label>Payment method<input value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} /></label><label>Failure type<select value={failureCode} onChange={event => setFailureCode(event.target.value)}><option value="NETWORK_ERROR">Network Error</option><option value="TIMEOUT">Timeout</option><option value="GATEWAY_TIMEOUT">Gateway Timeout</option><option value="INSUFFICIENT_FUNDS">Insufficient Funds</option><option value="CARD_EXPIRED">Card Expired</option><option value="CARD_BLOCKED">Card Blocked</option><option value="INVALID_CARD">Invalid Card</option><option value="BANK_DECLINED">Bank Declined</option><option value="FRAUD_SUSPECTED">Fraud Suspected</option><option value="UNKNOWN_ERROR">Unknown Error</option></select></label></div><div className="modal-note"><ShieldCheck size={15} /><span>Demo Simulation — No real payment is processed. Use demo payment information only.</span></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={submitting} onClick={() => onSubmit({ customerName, amount: Number(amount), paymentMethod, failureCode })}>{submitting ? <RefreshCw className="spin" size={15} /> : <Zap size={15} />} {submitting ? "Running rule engine..." : "Simulate failure"}</button></div></div></div>;
}

function LandingPage({ onOpen }: { onOpen: () => void }) { return <div className="landing"><div className="landing-grid" /><header className="landing-nav"><div className="brand-block"><div className="brand-mark"><Activity size={19} /></div><div><div className="brand-name">Recover<span>AI</span></div><div className="brand-sub">PAYMENT OPERATIONS</div></div></div><div className="landing-nav-right"><span>Explainable architecture for AI-assisted payment recovery</span><button className="secondary-button" onClick={onOpen}>Open dashboard <ArrowRight size={15} /></button></div></header><main className="landing-main"><div className="landing-copy"><div className="eyebrow">FAILED PAYMENT RECOVERY, RECONSIDERED</div><h1>Failed payments shouldn't all be treated the same.</h1><p>RecoverAI triages failed payments using transparent rules and uses AI only where it adds value — creating better customer communication without outsourcing financial decisions to a model.</p><button className="primary-button landing-cta" onClick={onOpen}>Open dashboard <ArrowRight size={16} /></button><div className="landing-proof"><span><ShieldCheck size={15} /> Rule-led</span><span><FileCheck2 size={15} /> Auditable</span><span><Bot size={15} /> AI-assisted</span></div></div><div className="landing-visual"><div className="landing-window"><div className="window-top"><span /><span /><span /><small>RecoverAI / decision trace</small></div><div className="window-content"><div className="window-kicker">AI DECISION AUTHORITY</div><div className="window-score">0<span>%</span></div><div className="window-rule"><div className="window-node blue">RULES<div>Failure detected</div></div><ArrowRight size={18} /><div className="window-node green">ACTION<div>Retry now</div></div><ArrowRight size={18} /><div className="window-node purple">AI<div>Message only</div></div></div><div className="window-message"><Sparkles size={15} /><span>“Hi Rahul, we'll retry your payment shortly...”</span></div></div></div></div></main><section className="landing-features"><Feature icon={<SlidersHorizontal size={19} />} title="Deterministic Recovery" text="Reliable rules decide what happens next." /><Feature icon={<Sparkles size={19} />} title="AI-Powered Communication" text="AI creates personalized customer messages." /><Feature icon={<FileCheck2 size={19} />} title="Explainable Decisions" text="Every decision has a visible reason and audit trail." /></section><footer className="landing-footer">RecoverAI is a hackathon prototype. It does not process real payments.</footer></div>; }

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="feature-card"><div className="feature-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div></div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><Database size={22} /><strong>{title}</strong><p>{description}</p></div>; }
function DownloadIcon() { return <ArrowDownRight size={15} />; }
function CreditCardIcon() { return <span className="credit-card-icon">▭</span>; }
