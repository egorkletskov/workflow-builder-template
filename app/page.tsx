"use client";

import { useAtomValue, useSetAtom } from "jotai";
import {
  ArrowRight,
  Bot,
  Briefcase,
  CirclePlus,
  Loader2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  businessWorkflowTemplates,
  instantiateBusinessWorkflowTemplate,
  type BusinessWorkflowTemplate,
} from "@/lib/workflow-templates";
import {
  currentWorkflowNameAtom,
  edgesAtom,
  hasSidebarBeenShownAtom,
  isTransitioningFromHomepageAtom,
  nodesAtom,
  type WorkflowNode,
} from "@/lib/workflow-store";

// Helper function to create a default trigger node
function createDefaultTriggerNode() {
  return {
    id: nanoid(),
    type: "trigger" as const,
    position: { x: 0, y: 0 },
    data: {
      label: "",
      description: "",
      type: "trigger" as const,
      config: { triggerType: "Manual" },
      status: "idle" as const,
    },
  };
}

const Home = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const nodes = useAtomValue(nodesAtom);
  const edges = useAtomValue(edgesAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setCurrentWorkflowName = useSetAtom(currentWorkflowNameAtom);
  const setHasSidebarBeenShown = useSetAtom(hasSidebarBeenShownAtom);
  const setIsTransitioningFromHomepage = useSetAtom(
    isTransitioningFromHomepageAtom,
  );
  const hasCreatedWorkflowRef = useRef(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState<
    BusinessWorkflowTemplate["id"] | "blank" | null
  >(null);

  // Reset sidebar animation state when on homepage
  useEffect(() => {
    setHasSidebarBeenShown(false);
  }, [setHasSidebarBeenShown]);

  // Update page title for the template launcher.
  useEffect(() => {
    document.title = "Business Automation Templates - AI Workflow Builder";
  }, []);

  // Helper to create anonymous session if needed
  const ensureSession = useCallback(async () => {
    if (!session) {
      await authClient.signIn.anonymous();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, [session]);

  // Handler to add the first node (replaces the "add" node)
  const handleAddNode = useCallback(() => {
    const newNode: WorkflowNode = createDefaultTriggerNode();
    // Replace all nodes (removes the "add" node)
    setNodes([newNode]);
  }, [setNodes]);

  const handleCreateBlankWorkflow = useCallback(() => {
    setCreatingTemplateId("blank");
    handleAddNode();
  }, [handleAddNode]);

  const handleCreateTemplate = useCallback(
    async (template: BusinessWorkflowTemplate) => {
      hasCreatedWorkflowRef.current = true;
      setCreatingTemplateId(template.id);

      const workflow = instantiateBusinessWorkflowTemplate(template);
      setNodes(workflow.nodes);
      setEdges(workflow.edges);
      setCurrentWorkflowName(workflow.name || template.name);

      try {
        await ensureSession();

        const newWorkflow = await api.workflow.create(workflow);

        sessionStorage.setItem("animate-sidebar", "true");
        setIsTransitioningFromHomepage(true);
        router.replace(`/workflows/${newWorkflow.id}`);
      } catch (error) {
        console.error("Failed to create workflow from template:", error);
        hasCreatedWorkflowRef.current = false;
        setCreatingTemplateId(null);
        toast.error("Failed to create workflow template");
      }
    },
    [
      ensureSession,
      router,
      setCurrentWorkflowName,
      setEdges,
      setIsTransitioningFromHomepage,
      setNodes,
    ],
  );

  // Initialize with a temporary "add" node on mount
  useEffect(() => {
    const addNodePlaceholder: WorkflowNode = {
      id: "add-node-placeholder",
      type: "add",
      position: { x: 0, y: 0 },
      data: {
        label: "",
        type: "add",
        onClick: handleAddNode,
      },
      draggable: false,
      selectable: false,
    };
    setNodes([addNodePlaceholder]);
    setEdges([]);
    setCurrentWorkflowName("New Workflow");
    hasCreatedWorkflowRef.current = false;
  }, [setNodes, setEdges, setCurrentWorkflowName, handleAddNode]);

  // Create workflow when first real node is added
  useEffect(() => {
    const createWorkflowAndRedirect = async () => {
      // Filter out the placeholder "add" node
      const realNodes = nodes.filter((node) => node.type !== "add");

      // Only create when we have at least one real node and haven't created a workflow yet
      if (realNodes.length === 0 || hasCreatedWorkflowRef.current) {
        return;
      }
      hasCreatedWorkflowRef.current = true;

      try {
        await ensureSession();

        // Create workflow with all real nodes
        const newWorkflow = await api.workflow.create({
          name: "Untitled Workflow",
          description: "",
          nodes: realNodes,
          edges,
        });

        // Set flags to indicate we're coming from homepage (for sidebar animation)
        sessionStorage.setItem("animate-sidebar", "true");
        setIsTransitioningFromHomepage(true);

        // Redirect to the workflow page
        console.log("[Homepage] Navigating to workflow page");
        router.replace(`/workflows/${newWorkflow.id}`);
      } catch (error) {
        console.error("Failed to create workflow:", error);
        hasCreatedWorkflowRef.current = false;
        setCreatingTemplateId(null);
        toast.error("Failed to create workflow");
      }
    };

    createWorkflowAndRedirect();
  }, [nodes, edges, router, ensureSession, setIsTransitioningFromHomepage]);

  const isCreating = creatingTemplateId !== null;

  // Canvas and toolbar are rendered by PersistentCanvas in the layout
  return (
    <main className="pointer-events-none fixed inset-0 z-10 overflow-y-auto">
      <div className="relative min-h-dvh overflow-hidden bg-black/70 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(245,158,11,0.16),transparent_26%),linear-gradient(110deg,rgba(0,0,0,0.92),rgba(0,0,0,0.64)_42%,rgba(0,0,0,0.82))]" />
        <div className="absolute inset-0 backdrop-blur-[1px]" />

        <section className="pointer-events-auto relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <Sparkles className="size-4 text-cyan-200" />
              </div>
              <div>
                <p className="font-medium text-white/90 text-xs uppercase tracking-[0.28em]">
                  Business Automation Fork
                </p>
                <p className="text-sm text-white/45">
                  AI workflow templates for operators
                </p>
              </div>
            </div>
            <Button
              className="hidden rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20 sm:inline-flex"
              disabled={isCreating}
              onClick={handleCreateBlankWorkflow}
              variant="outline"
            >
              <CirclePlus className="size-4" />
              Start blank
            </Button>
          </div>

          <div className="grid flex-1 items-end gap-10 pb-8 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:pb-12 lg:pt-16">
            <div className="max-w-2xl">
              <p className="mb-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-medium text-cyan-100 text-xs uppercase tracking-[0.24em]">
                AI ops starter layer
              </p>
              <h1 className="text-balance font-semibold text-5xl tracking-[-0.06em] sm:text-7xl lg:text-8xl">
                Launch useful workflows, not empty canvases.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/62 leading-8">
                A business-oriented fork that adds ready-made automation
                templates for support, revenue and operations teams.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-white/50 text-xs uppercase tracking-[0.2em]">
                <span>Reusable nodes</span>
                <span className="text-white/25">/</span>
                <span>API client create flow</span>
                <span className="text-white/25">/</span>
                <span>Editable canvas</span>
              </div>
            </div>

            <div className="grid gap-3">
              {businessWorkflowTemplates.map((template, index) => {
                const visual = templateVisuals[template.id];
                const Icon = visual.icon;
                const isPending = creatingTemplateId === template.id;

                return (
                  <button
                    aria-label={`Create ${template.name}`}
                    className={cn(
                      "group relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.075] p-5 text-left shadow-2xl shadow-black/20 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/[0.11] disabled:pointer-events-none disabled:opacity-70",
                      visual.ring,
                    )}
                    disabled={isCreating}
                    key={template.id}
                    onClick={() => handleCreateTemplate(template)}
                    type="button"
                  >
                    <div
                      className={cn(
                        "absolute -right-12 -top-20 size-44 rounded-full blur-3xl transition duration-500 group-hover:scale-125",
                        visual.glow,
                      )}
                    />
                    <div className="relative grid gap-5 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-black/30">
                          <Icon className="size-5 text-white" />
                        </div>
                        <div className="sm:hidden">
                          <p className="font-medium text-white/45 text-xs uppercase tracking-[0.2em]">
                            {template.eyebrow}
                          </p>
                          <h2 className="font-semibold text-xl tracking-[-0.03em]">
                            {template.name}
                          </h2>
                        </div>
                      </div>

                      <div>
                        <p className="hidden font-medium text-white/45 text-xs uppercase tracking-[0.2em] sm:block">
                          0{index + 1} / {template.eyebrow}
                        </p>
                        <h2 className="hidden font-semibold text-2xl tracking-[-0.04em] sm:block">
                          {template.name}
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm text-white/58 leading-6">
                          {template.description}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {template.steps.map((step) => (
                            <span
                              className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/52 text-xs"
                              key={step}
                            >
                              {step}
                            </span>
                          ))}
                        </div>
                        <div className="mt-5 grid gap-2 border-white/10 border-t pt-4 text-sm sm:grid-cols-2">
                          <p>
                            <span className="block text-white/35">Outcome</span>
                            <span className="text-white/80">
                              {template.outcome}
                            </span>
                          </p>
                          <p>
                            <span className="block text-white/35">Signals</span>
                            <span className="text-white/80">
                              {template.metric}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/50 text-xs">
                          Template
                        </span>
                        <span className="flex size-10 items-center justify-center rounded-full bg-white text-black transition duration-300 group-hover:scale-110">
                          {isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ArrowRight className="size-4" />
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-white/10 border-t pt-5 text-white/45 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>
              Templates are regular workflow nodes and stay fully editable after
              creation.
            </p>
            <Button
              className="w-full rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20 sm:hidden"
              disabled={isCreating}
              onClick={handleCreateBlankWorkflow}
              variant="outline"
            >
              {creatingTemplateId === "blank" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CirclePlus className="size-4" />
              )}
              Start blank workflow
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
};

const templateVisuals: Record<
  BusinessWorkflowTemplate["id"],
  { glow: string; icon: LucideIcon; ring: string }
> = {
  "lead-enrichment": {
    glow: "bg-amber-300/25",
    icon: Briefcase,
    ring: "hover:border-amber-200/30",
  },
  "ops-weekly-report": {
    glow: "bg-emerald-300/20",
    icon: Sparkles,
    ring: "hover:border-emerald-200/30",
  },
  "support-triage": {
    glow: "bg-cyan-300/20",
    icon: Bot,
    ring: "hover:border-cyan-200/30",
  },
};

export default Home;
