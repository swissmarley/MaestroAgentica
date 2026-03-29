#!/usr/bin/env node

/**
 * MaestroAgentica CLI — Interactive Agent Terminal Interface
 *
 * Usage:
 *   node cli/maestro.mjs [options]
 *
 * Options:
 *   --url <url>        Base URL of MaestroAgentica instance (default: http://localhost:3000)
 *   --agent <name>     Connect directly to a named agent
 *   --env <env>        Environment: development, staging, production (default: development)
 *   --key <key>        API key for authentication
 *   --help             Show this help message
 */

import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bgBlue: "\x1b[44m",
  white: "\x1b[37m",
};

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), ".maestro");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error(`${C.red}Failed to save config:${C.reset}`, err.message);
  }
}

// ── Parse args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--help" || args[i] === "-h") {
    flags.help = true;
  } else if (args[i] === "--url" && args[i + 1]) {
    flags.url = args[++i];
  } else if (args[i] === "--agent" && args[i + 1]) {
    flags.agent = args[++i];
  } else if (args[i] === "--env" && args[i + 1]) {
    flags.env = args[++i];
  } else if (args[i] === "--key" && args[i + 1]) {
    flags.key = args[++i];
  }
}

if (flags.help) {
  console.log(`
${C.bold}${C.cyan}MaestroAgentica CLI${C.reset} — Interactive Agent Terminal Interface

${C.bold}Usage:${C.reset}
  node cli/maestro.mjs [options]

${C.bold}Options:${C.reset}
  --url <url>        Base URL (default: http://localhost:3000)
  --agent <name>     Connect directly to a named agent
  --env <env>        Environment: development, staging, production
  --key <key>        API key for authentication
  --help             Show this help

${C.bold}Commands (in chat):${C.reset}
  /agents            List all available agents
  /select <name>     Switch to a different agent
  /new               Start a new conversation
  /history           Show current conversation history
  /conversations     List past conversations
  /load <id>         Load a past conversation
  /clear             Clear the terminal
  /exit              Exit the CLI
`);
  process.exit(0);
}

// ── State ─────────────────────────────────────────────────────────────────────

const config = loadConfig();
const baseUrl = flags.url || config.url || "http://localhost:3000";
const apiKey = flags.key || config.apiKey || "";
const environment = flags.env || config.env || "development";

let agents = [];
let currentAgent = null;
let currentVersionId = "";
let conversationHistory = [];
let rl = null;

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res;
  } catch (err) {
    if (err.cause?.code === "ECONNREFUSED") {
      throw new Error(`Cannot connect to ${baseUrl}. Is the server running?`);
    }
    throw err;
  }
}

async function fetchAgents() {
  const res = await apiFetch("/api/agents");
  const data = await res.json();
  // API returns a plain array, but handle both formats for safety
  return Array.isArray(data) ? data : data.agents || [];
}

async function fetchAgentDetails(agentId) {
  const res = await apiFetch(`/api/agents/${agentId}`);
  return res.json();
}

// ── Print helpers ─────────────────────────────────────────────────────────────

function print(msg = "") { process.stdout.write(msg + "\n"); }
function printError(msg) { print(`${C.red}Error: ${msg}${C.reset}`); }
function printSuccess(msg) { print(`${C.green}${msg}${C.reset}`); }
function printInfo(msg) { print(`${C.cyan}${msg}${C.reset}`); }
function printDim(msg) { print(`${C.dim}${msg}${C.reset}`); }

function printBanner() {
  print();
  print(`${C.bold}${C.cyan}  ╔══════════════════════════════════════╗${C.reset}`);
  print(`${C.bold}${C.cyan}  ║       MaestroAgentica CLI v0.1       ║${C.reset}`);
  print(`${C.bold}${C.cyan}  ╚══════════════════════════════════════╝${C.reset}`);
  print();
  printDim(`  Server: ${baseUrl}`);
  printDim(`  Environment: ${environment}`);
  print();
}

function printAgentList(agentsList) {
  if (agentsList.length === 0) {
    printInfo("No agents found.");
    return;
  }
  print();
  print(`${C.bold}Available Agents:${C.reset}`);
  print(`${"─".repeat(50)}`);
  agentsList.forEach((agent, i) => {
    const status = agent.status === "active"
      ? `${C.green}active${C.reset}`
      : `${C.yellow}${agent.status}${C.reset}`;
    const marker = currentAgent?.id === agent.id ? `${C.cyan}►${C.reset} ` : "  ";
    print(`${marker}${C.bold}${i + 1}.${C.reset} ${agent.name} ${C.dim}(${agent.id.slice(0, 8)}...)${C.reset} [${status}]`);
    if (agent.description) {
      printDim(`     ${agent.description.slice(0, 60)}${agent.description.length > 60 ? "..." : ""}`);
    }
  });
  print();
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function createSpinner(text = "Thinking") {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${C.cyan}${frames[i++ % frames.length]}${C.reset} ${C.dim}${text}...${C.reset}`);
  }, 80);
  return {
    stop(clearLine = true) {
      clearInterval(interval);
      if (clearLine) process.stdout.write("\r" + " ".repeat(text.length + 10) + "\r");
    },
  };
}

// ── Chat with agent via SSE streaming ─────────────────────────────────────────

async function sendMessage(prompt) {
  if (!currentAgent) {
    printError("No agent selected. Use /agents and /select <name>.");
    return;
  }

  // Build history from prior turns
  const history = conversationHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  conversationHistory.push({ role: "user", content: prompt });

  const spinner = createSpinner(`${currentAgent.name} is thinking`);

  try {
    const res = await apiFetch(`/api/agents/${currentAgent.id}/test`, {
      method: "POST",
      body: JSON.stringify({
        prompt,
        versionId: currentVersionId,
        history,
      }),
    });

    spinner.stop();

    if (!res.body) {
      printError("No response body received.");
      return;
    }

    // Print agent name prefix
    process.stdout.write(`\n${C.bold}${C.magenta}${currentAgent.name}:${C.reset} `);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let hasToolUse = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") continue;

        let event;
        try { event = JSON.parse(dataStr); } catch { continue; }

        switch (event.event) {
          case "content_block_delta": {
            const delta = event.data?.delta;
            if (delta) {
              process.stdout.write(delta);
              fullContent += delta;
            }
            break;
          }
          case "tool_use_start": {
            const name = event.data?.name || "unknown";
            if (!hasToolUse) print();
            hasToolUse = true;
            process.stdout.write(`\n  ${C.cyan}⚡ Using tool:${C.reset} ${C.bold}${name}${C.reset} `);
            break;
          }
          case "tool_result": {
            const isError = event.data?.is_error;
            if (isError) {
              process.stdout.write(`${C.red}[error]${C.reset}`);
            } else {
              process.stdout.write(`${C.green}[done]${C.reset}`);
            }
            break;
          }
          case "message_stop": {
            const usage = event.data?.usage;
            if (usage) {
              print();
              printDim(`  [${usage.input_tokens || 0} input / ${usage.output_tokens || 0} output tokens]`);
            }
            break;
          }
          case "error": {
            const errorMsg = event.data?.message || "Unknown error";
            print();
            printError(errorMsg);
            break;
          }
        }
      }
    }

    print();
    if (fullContent) {
      conversationHistory.push({ role: "assistant", content: fullContent });
    }
  } catch (err) {
    spinner.stop();
    printError(err.message);
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function handleCommand(input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ");

  switch (cmd) {
    case "/agents": {
      const spinner = createSpinner("Loading agents");
      try {
        agents = await fetchAgents();
        spinner.stop();
        printAgentList(agents);
      } catch (err) {
        spinner.stop();
        printError(err.message);
      }
      break;
    }

    case "/select": {
      if (!arg) {
        printError("Usage: /select <agent-name>");
        break;
      }
      const match = agents.find(
        (a) => a.name.toLowerCase() === arg.toLowerCase() || a.id === arg
      );
      if (!match) {
        // Try a fuzzy match
        const fuzzy = agents.find((a) => a.name.toLowerCase().includes(arg.toLowerCase()));
        if (fuzzy) {
          await selectAgent(fuzzy);
        } else {
          printError(`Agent "${arg}" not found. Use /agents to list available agents.`);
        }
      } else {
        await selectAgent(match);
      }
      break;
    }

    case "/new": {
      conversationHistory = [];
      printSuccess("Started a new conversation.");
      break;
    }

    case "/history": {
      if (conversationHistory.length === 0) {
        printInfo("No messages in current conversation.");
      } else {
        print();
        print(`${C.bold}Conversation History:${C.reset}`);
        print(`${"─".repeat(50)}`);
        for (const msg of conversationHistory) {
          const prefix = msg.role === "user"
            ? `${C.blue}You:${C.reset}`
            : `${C.magenta}${currentAgent?.name || "Agent"}:${C.reset}`;
          const content = msg.content.length > 100
            ? msg.content.slice(0, 100) + "..."
            : msg.content;
          print(`${prefix} ${content}`);
        }
        print();
      }
      break;
    }

    case "/conversations": {
      printInfo("Past conversations are stored in the web app. Use the Playground at /playground to browse them.");
      break;
    }

    case "/load": {
      printInfo("Loading past conversations is available through the web app Playground.");
      break;
    }

    case "/clear": {
      process.stdout.write("\x1Bc");
      printBanner();
      if (currentAgent) {
        printInfo(`Connected to: ${currentAgent.name}`);
      }
      break;
    }

    case "/exit":
    case "/quit": {
      print();
      printDim("Goodbye! 👋");
      process.exit(0);
    }

    case "/help": {
      print();
      print(`${C.bold}Commands:${C.reset}`);
      print(`  ${C.cyan}/agents${C.reset}            List all available agents`);
      print(`  ${C.cyan}/select <name>${C.reset}     Switch to a different agent`);
      print(`  ${C.cyan}/new${C.reset}               Start a new conversation`);
      print(`  ${C.cyan}/history${C.reset}           Show current conversation history`);
      print(`  ${C.cyan}/conversations${C.reset}     List past conversations`);
      print(`  ${C.cyan}/load <id>${C.reset}         Load a past conversation`);
      print(`  ${C.cyan}/clear${C.reset}             Clear the terminal`);
      print(`  ${C.cyan}/exit${C.reset}              Exit the CLI`);
      print();
      printDim("Tip: Use \\ at the end of a line for multi-line input.");
      print();
      break;
    }

    default: {
      printError(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }
}

async function selectAgent(agent) {
  const spinner = createSpinner(`Connecting to ${agent.name}`);
  try {
    const details = await fetchAgentDetails(agent.id);
    spinner.stop();

    currentAgent = agent;
    conversationHistory = [];

    if (details.versions?.length > 0) {
      currentVersionId = details.versions[0].id;
    }

    printSuccess(`Connected to ${C.bold}${agent.name}${C.reset}${C.green}`);
    if (agent.description) {
      printDim(`  ${agent.description}`);
    }
    print();
  } catch (err) {
    spinner.stop();
    printError(err.message);
  }
}

// ── Interactive agent selection ───────────────────────────────────────────────

async function interactiveAgentSelect() {
  const spinner = createSpinner("Loading agents");
  try {
    agents = await fetchAgents();
    spinner.stop();
  } catch (err) {
    spinner.stop();
    printError(err.message);
    printDim("Make sure the MaestroAgentica server is running at " + baseUrl);
    process.exit(1);
  }

  if (agents.length === 0) {
    printInfo("No agents found. Create one in the web app first.");
    process.exit(0);
  }

  printAgentList(agents);

  return new Promise((resolve) => {
    const tempRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    tempRl.question(`${C.cyan}Select an agent (number or name): ${C.reset}`, async (answer) => {
      tempRl.close();

      const trimmed = answer.trim();
      const num = parseInt(trimmed, 10);

      let selected = null;
      if (!isNaN(num) && num >= 1 && num <= agents.length) {
        selected = agents[num - 1];
      } else {
        selected = agents.find(
          (a) => a.name.toLowerCase() === trimmed.toLowerCase() || a.id === trimmed
        );
        if (!selected) {
          selected = agents.find((a) => a.name.toLowerCase().includes(trimmed.toLowerCase()));
        }
      }

      if (selected) {
        await selectAgent(selected);
      } else {
        printError("Invalid selection.");
        process.exit(1);
      }
      resolve();
    });
  });
}

// ── Main REPL ─────────────────────────────────────────────────────────────────

async function main() {
  printBanner();

  // Save config for future use
  if (flags.url || flags.key || flags.env) {
    const newConfig = { ...config };
    if (flags.url) newConfig.url = flags.url;
    if (flags.key) newConfig.apiKey = flags.key;
    if (flags.env) newConfig.env = flags.env;
    saveConfig(newConfig);
  }

  // Direct agent selection via --agent flag
  if (flags.agent) {
    const spinner = createSpinner("Loading agents");
    try {
      agents = await fetchAgents();
      spinner.stop();
    } catch (err) {
      spinner.stop();
      printError(err.message);
      process.exit(1);
    }

    const match = agents.find(
      (a) => a.name.toLowerCase() === flags.agent.toLowerCase()
    ) || agents.find(
      (a) => a.name.toLowerCase().includes(flags.agent.toLowerCase())
    );

    if (match) {
      await selectAgent(match);
    } else {
      printError(`Agent "${flags.agent}" not found.`);
      printAgentList(agents);
      process.exit(1);
    }
  } else {
    await interactiveAgentSelect();
  }

  // Start REPL
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "",
  });

  const getPrompt = () => {
    const agentName = currentAgent ? currentAgent.name : "maestro";
    return `${C.bold}${C.blue}You${C.reset} ${C.dim}(${agentName})${C.reset}${C.bold}: ${C.reset}`;
  };

  let multiLineBuffer = "";

  const askQuestion = () => {
    rl.question(getPrompt(), async (line) => {
      // Handle multi-line input (line continuation with \)
      if (line.endsWith("\\")) {
        multiLineBuffer += line.slice(0, -1) + "\n";
        rl.question(`${C.dim}... ${C.reset}`, handleLine);
        return;
      }

      const fullInput = multiLineBuffer + line;
      multiLineBuffer = "";

      await handleLine(fullInput);
    });
  };

  const handleLine = async (fullInput) => {
    const trimmed = fullInput.trim();

    if (!trimmed) {
      askQuestion();
      return;
    }

    if (trimmed.startsWith("/")) {
      await handleCommand(trimmed);
    } else {
      await sendMessage(trimmed);
    }

    askQuestion();
  };

  askQuestion();

  rl.on("close", () => {
    print();
    printDim("Goodbye! 👋");
    process.exit(0);
  });
}

main().catch((err) => {
  printError(err.message);
  process.exit(1);
});
