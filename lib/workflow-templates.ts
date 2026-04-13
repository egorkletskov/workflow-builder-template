import type { WorkflowData } from "@/lib/api-client";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

export type BusinessWorkflowTemplate = {
  id: "support-triage" | "lead-enrichment" | "ops-weekly-report";
  name: string;
  eyebrow: string;
  description: string;
  outcome: string;
  metric: string;
  steps: string[];
  workflow: Omit<WorkflowData, "id">;
};

const createEdge = (
  id: string,
  source: string,
  target: string,
): WorkflowEdge => ({
  id,
  source,
  target,
  type: "animated",
});

const createTriggerNode = (
  id: string,
  label: string,
  description: string,
  triggerType: "Manual" | "Schedule" | "Webhook",
  position: { x: number; y: number },
): WorkflowNode => ({
  id,
  type: "trigger",
  position,
  data: {
    label,
    description,
    type: "trigger",
    config: { triggerType },
    status: "idle",
  },
});

const createActionNode = (
  id: string,
  label: string,
  description: string,
  actionType: string,
  position: { x: number; y: number },
  config: Record<string, unknown> = {},
): WorkflowNode => ({
  id,
  type: "action",
  position,
  data: {
    label,
    description,
    type: "action",
    config: { actionType, ...config },
    status: "idle",
  },
});

const supportTriageNodes: WorkflowNode[] = [
  createTriggerNode(
    "support-trigger",
    "New Support Ticket",
    "Manual intake for a fresh customer issue",
    "Manual",
    { x: -520, y: 0 },
  ),
  createActionNode(
    "support-classify",
    "Classify Intent & SLA",
    "Returns priority, sentiment, owner and reply angle",
    "Generate Text",
    { x: -220, y: 0 },
    {
      aiModel: "openai/gpt-5.1-instant",
      aiFormat: "object",
      aiSchema: JSON.stringify([
        { name: "priority", type: "string" },
        { name: "sentiment", type: "string" },
        { name: "owner", type: "string" },
        { name: "slaRisk", type: "boolean" },
      ]),
      aiPrompt:
        "Classify the inbound support ticket by intent, customer sentiment, account tier and SLA risk. Return a concise routing payload.",
    },
  ),
  createActionNode(
    "support-gate",
    "High Priority Gate",
    "Routes only urgent issues into escalation flow",
    "Condition",
    { x: 100, y: 0 },
    {
      condition:
        "{{@nodeId:support-classify.priority}} === 'high' || {{@nodeId:support-classify.slaRisk}} === true",
    },
  ),
  createActionNode(
    "support-linear",
    "Create Escalation Ticket",
    "Opens an owner-ready Linear issue",
    "Create Ticket",
    { x: 420, y: -120 },
    {
      ticketTitle: "Priority support escalation",
      ticketDescription:
        "AI triage summary: {{@nodeId:support-classify.object}}",
    },
  ),
  createActionNode(
    "support-slack",
    "Notify Support Lead",
    "Posts escalation context to Slack",
    "Send Slack Message",
    { x: 420, y: 130 },
    {
      slackChannel: "#support-escalations",
      slackMessage:
        "High-risk ticket routed for review: {{@nodeId:support-classify.object}}",
    },
  ),
];

const leadEnrichmentNodes: WorkflowNode[] = [
  createTriggerNode(
    "lead-trigger",
    "New Lead Webhook",
    "Receives a CRM or landing page lead",
    "Webhook",
    { x: -520, y: 0 },
  ),
  createActionNode(
    "lead-lookup",
    "Fetch Account Signals",
    "Pulls public and CRM context",
    "HTTP Request",
    { x: -220, y: 0 },
    {
      endpoint: "https://api.example.com/accounts/enrich",
      httpMethod: "POST",
      httpHeaders: JSON.stringify({ "Content-Type": "application/json" }),
      httpBody: JSON.stringify({
        domain: "{{input.companyDomain}}",
        email: "{{input.email}}",
      }),
    },
  ),
  createActionNode(
    "lead-score",
    "Score Fit & Intent",
    "Produces ICP fit score and next best action",
    "Generate Text",
    { x: 100, y: 0 },
    {
      aiModel: "openai/gpt-5.1-instant",
      aiFormat: "object",
      aiSchema: JSON.stringify([
        { name: "fitScore", type: "number" },
        { name: "segment", type: "string" },
        { name: "recommendedAction", type: "string" },
      ]),
      aiPrompt:
        "Score this enriched lead for B2B sales fit. Use firmographic signals, company size, region, urgency and product relevance.",
    },
  ),
  createActionNode(
    "lead-gate",
    "Sales Qualified?",
    "Separates hot leads from nurture traffic",
    "Condition",
    { x: 420, y: 0 },
    {
      condition: "{{@nodeId:lead-score.fitScore}} >= 75",
    },
  ),
  createActionNode(
    "lead-notify",
    "Send Sales Brief",
    "Drops a concise deal brief into Slack",
    "Send Slack Message",
    { x: 740, y: 0 },
    {
      slackChannel: "#sales-qualified-leads",
      slackMessage:
        "New qualified lead: {{@nodeId:lead-score.object}}. Source: {{input.source}}",
    },
  ),
];

const opsReportNodes: WorkflowNode[] = [
  createTriggerNode(
    "ops-trigger",
    "Monday Metrics Pull",
    "Runs before the weekly operations review",
    "Schedule",
    { x: -520, y: 0 },
  ),
  createActionNode(
    "ops-query",
    "Pull KPI Deltas",
    "Reads weekly operational movement",
    "Database Query",
    { x: -220, y: 0 },
    {
      dbQuery:
        "select metric, current_value, previous_value, owner from weekly_ops_metrics order by abs(current_value - previous_value) desc limit 20;",
    },
  ),
  createActionNode(
    "ops-draft",
    "Draft Executive Brief",
    "Summarizes deltas, risks and owner actions",
    "Generate Text",
    { x: 100, y: 0 },
    {
      aiModel: "openai/gpt-5.1-instant",
      aiPrompt:
        "Turn the weekly KPI delta table into a concise operations brief with wins, risks, owner actions and decisions needed.",
    },
  ),
  createActionNode(
    "ops-email",
    "Send Weekly Report",
    "Emails the final brief to operators",
    "Send Email",
    { x: 420, y: 0 },
    {
      emailTo: "ops@example.com",
      emailSubject: "Weekly operations brief",
      emailBody: "{{@nodeId:ops-draft.text}}",
    },
  ),
];

export const businessWorkflowTemplates: BusinessWorkflowTemplate[] = [
  {
    id: "support-triage",
    name: "Support Triage Control Room",
    eyebrow: "Support Ops",
    description:
      "Classify inbound tickets, detect SLA risk and route urgent issues into Slack and Linear.",
    outcome: "Priority queue with owner-ready escalation context",
    metric: "SLA risk, sentiment, owner",
    steps: [
      "Ticket intake",
      "LLM triage",
      "SLA gate",
      "Linear + Slack escalation",
    ],
    workflow: {
      name: "Support Triage Control Room",
      description:
        "Business automation template for classifying support tickets and routing urgent cases.",
      nodes: supportTriageNodes,
      edges: [
        createEdge("support-edge-1", "support-trigger", "support-classify"),
        createEdge("support-edge-2", "support-classify", "support-gate"),
        createEdge("support-edge-3", "support-gate", "support-linear"),
        createEdge("support-edge-4", "support-gate", "support-slack"),
      ],
    },
  },
  {
    id: "lead-enrichment",
    name: "Lead Enrichment Router",
    eyebrow: "Revenue Ops",
    description:
      "Enrich a new lead, score ICP fit and push qualified accounts to the sales team.",
    outcome: "Sales-ready lead brief with next best action",
    metric: "Fit score, segment, intent",
    steps: [
      "Webhook intake",
      "Account lookup",
      "AI fit scoring",
      "Sales notification",
    ],
    workflow: {
      name: "Lead Enrichment Router",
      description:
        "Business automation template for qualifying B2B leads and routing sales-ready accounts.",
      nodes: leadEnrichmentNodes,
      edges: [
        createEdge("lead-edge-1", "lead-trigger", "lead-lookup"),
        createEdge("lead-edge-2", "lead-lookup", "lead-score"),
        createEdge("lead-edge-3", "lead-score", "lead-gate"),
        createEdge("lead-edge-4", "lead-gate", "lead-notify"),
      ],
    },
  },
  {
    id: "ops-weekly-report",
    name: "Weekly Ops Report Agent",
    eyebrow: "Operations",
    description:
      "Pull KPI movement, summarize risks and send a concise weekly operating brief.",
    outcome: "Readable operating memo from raw metrics",
    metric: "KPI deltas, owner actions",
    steps: ["Scheduled run", "SQL metrics", "AI brief", "Email dispatch"],
    workflow: {
      name: "Weekly Ops Report Agent",
      description:
        "Business automation template for turning operational metrics into a weekly report.",
      nodes: opsReportNodes,
      edges: [
        createEdge("ops-edge-1", "ops-trigger", "ops-query"),
        createEdge("ops-edge-2", "ops-query", "ops-draft"),
        createEdge("ops-edge-3", "ops-draft", "ops-email"),
      ],
    },
  },
];

export function instantiateBusinessWorkflowTemplate(
  template: BusinessWorkflowTemplate,
): Omit<WorkflowData, "id"> {
  return {
    ...template.workflow,
    nodes: template.workflow.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: {
        ...node.data,
        config: node.data.config ? { ...node.data.config } : undefined,
      },
    })),
    edges: template.workflow.edges.map((edge) => ({ ...edge })),
  };
}
