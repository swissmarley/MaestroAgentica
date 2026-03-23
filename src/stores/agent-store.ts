import { create } from "zustand";
import type {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
} from "@/types/agent";

interface AgentState {
  agents: Agent[];
  activeAgent: Agent | null;
  isLoading: boolean;
  error: string | null;
}

interface AgentActions {
  fetchAgents: () => Promise<void>;
  fetchAgent: (id: string) => Promise<void>;
  createAgent: (input: CreateAgentInput) => Promise<Agent>;
  updateAgent: (id: string, input: UpdateAgentInput) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
  setActiveAgent: (agent: Agent | null) => void;
}

type AgentStore = AgentState & AgentActions;

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  activeAgent: null,
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch agents (${res.status})`);
      }
      const agents: Agent[] = await res.json();
      set({ agents, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch agents";
      set({ error: message, isLoading: false });
    }
  },

  fetchAgent: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/agents/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch agent (${res.status})`);
      }
      const agent: Agent = await res.json();
      set({ activeAgent: agent, isLoading: false });

      // Also update the agent in the agents list if present
      const { agents } = get();
      const idx = agents.findIndex((a) => a.id === id);
      if (idx !== -1) {
        const updated = [...agents];
        updated[idx] = agent;
        set({ agents: updated });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch agent";
      set({ error: message, isLoading: false });
    }
  },

  createAgent: async (input: CreateAgentInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to create agent (${res.status})`);
      }
      const agent: Agent = await res.json();
      set((state) => ({
        agents: [agent, ...state.agents],
        activeAgent: agent,
        isLoading: false,
      }));
      return agent;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create agent";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  updateAgent: async (id: string, input: UpdateAgentInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to update agent (${res.status})`);
      }
      const agent: Agent = await res.json();
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? agent : a)),
        activeAgent: state.activeAgent?.id === id ? agent : state.activeAgent,
        isLoading: false,
      }));
      return agent;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update agent";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  deleteAgent: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to delete agent (${res.status})`);
      }
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
        activeAgent: state.activeAgent?.id === id ? null : state.activeAgent,
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete agent";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  setActiveAgent: (agent: Agent | null) => {
    set({ activeAgent: agent });
  },
}));
