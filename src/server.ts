/* ---------------------------------------------------------------------------
 * server.ts ― MCP Time Server with Streamable HTTP + legacy HTTP+SSE
 * ------------------------------------------------------------------------- */

import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DateTime, Settings, IANAZone } from 'luxon';

/* ---------------------------------------------------------------------------
 * Time Handling Logic and Types
 * ------------------------------------------------------------------------- */

interface TimeResult {
  timezone: string;
  datetime: string;
  // Note: date-fns-tz doesn't directly expose DST status easily like Python's .dst(),
  // determining precise DST requires more complex checks or potentially another library.
  // We'll omit is_dst for simplicity in this translation.
}

interface TimeConversionResult {
  source: TimeResult;
  target: TimeResult;
  time_difference: string;
}

function getLocalTimezone(): string {
  // Luxon gets the local system timezone
  return Settings.defaultZone.name;
}

// Helper to validate IANA timezone names (basic check)
function isValidTimezone(tz: string): boolean {
  // Use Luxon's built-in validator
  return IANAZone.isValidZone(tz);
}

function getCurrentTime(timezoneName: string): TimeResult {
  if (!isValidTimezone(timezoneName)) {
    throw new Error(`Invalid timezone: ${timezoneName}`);
  }
  const nowInZone = DateTime.now().setZone(timezoneName);
  return {
    timezone: timezoneName,
    // Format similar to Python's isoformat(timespec="seconds")
    datetime: nowInZone.toISO({ includeOffset: true, suppressMilliseconds: true }) ?? 'Invalid Date',
  };
}

function convertTime(
  sourceTz: string,
  timeStr: string,
  targetTz: string
): TimeConversionResult {
  if (!isValidTimezone(sourceTz)) {
    throw new Error(`Invalid source timezone: ${sourceTz}`);
  }
  if (!isValidTimezone(targetTz)) {
    throw new Error(`Invalid target timezone: ${targetTz}`);
  }

  // Parse time string (HH:mm) using Luxon
  const parsedTime = DateTime.fromFormat(timeStr, 'HH:mm');
  if (!parsedTime.isValid) {
      throw new Error("Invalid time format. Expected HH:MM [24-hour format]");
  }

  // Create DateTime object for source time today in the source timezone
  const sourceDt = DateTime.now()
    .setZone(sourceTz)
    .set({ hour: parsedTime.hour, minute: parsedTime.minute, second: 0, millisecond: 0 });

  // Convert to the target timezone
  const targetDt = sourceDt.setZone(targetTz);

  // Calculate time difference
  // Luxon handles offsets directly. Get difference in minutes and format.
  const offsetDiffMinutes = targetDt.offset - sourceDt.offset;
  const offsetDiffHours = offsetDiffMinutes / 60;
  let timeDiffStr: string;
  if (Number.isInteger(offsetDiffHours)) {
      timeDiffStr = `${offsetDiffHours >= 0 ? '+' : ''}${offsetDiffHours}h`;
  } else {
      // Format fractional hours (e.g., +5.75h for +5:45)
      timeDiffStr = `${offsetDiffHours >= 0 ? '+' : ''}${offsetDiffHours.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}h`;
  }

  return {
    source: {
      timezone: sourceTz,
      datetime: sourceDt.toISO({ includeOffset: true, suppressMilliseconds: true }) ?? 'Invalid Date',
    },
    target: {
      timezone: targetTz,
      datetime: targetDt.toISO({ includeOffset: true, suppressMilliseconds: true }) ?? 'Invalid Date',
    },
    time_difference: timeDiffStr,
  };
}


/* ---------------------------------------------------------------------------
 * 1.  Build the MCP server instance with Time tools
 * ------------------------------------------------------------------------- */
function buildMcpServer(): McpServer {
  console.log("[Server] Building new McpServer instance for a connection");
  const server = new McpServer({
    name: "mcp-time-srv",
    version: "1.0.0"
  });

  const localTz = getLocalTimezone();

  // ── Tool: get_current_time ───────────────────────────────────────────────
  server.tool(
    "get_current_time",
    {
        timezone: z.string().optional().describe(`IANA timezone name (e.g., 'America/New_York', 'Europe/London'). Defaults to server local: ${localTz}`)
    },
    async ({ timezone }) => {
      const effectiveTimezone = timezone || localTz;
      console.log(`[Server] Handling tool call: get_current_time for timezone='${effectiveTimezone}'`); // Log effective TZ
      try {
        const result = getCurrentTime(effectiveTimezone);
        // Return result as JSON string in text content
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error: any) {
          console.error("[Server] Error in get_current_time:", error);
          let helpfulMessage = `Error processing get_current_time: ${error.message}`;
          if (error.message?.includes("Invalid timezone")) {
              helpfulMessage = `Error: Invalid timezone specified ('${effectiveTimezone}'). Please provide a valid IANA timezone name (e.g., 'America/New_York', 'Europe/London').`;
          }
          // Return helpful error as text content
          return { content: [{ type: "text", text: helpfulMessage }] };
      }
    }
  );

  // ── Tool: convert_time ───────────────────────────────────────────────────
  server.tool(
    "convert_time",
    {
        source_timezone: z.string().optional().describe(`Source IANA timezone name. Defaults to server local: ${localTz}`),
        time: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM [24-hour format]").describe("Time to convert (HH:MM)"),
        target_timezone: z.string().optional().describe(`Target IANA timezone name. Defaults to server local: ${localTz}`),
    },
    async ({ source_timezone, time, target_timezone }) => {
        const effectiveSourceTz = source_timezone || localTz;
        const effectiveTargetTz = target_timezone || localTz;
        console.log(`[Server] Handling tool call: convert_time from ${effectiveSourceTz} '${time}' to ${effectiveTargetTz}`);
        try {
            const result = convertTime(
                effectiveSourceTz,
                time,
                effectiveTargetTz
            );
            // Return result as JSON string in text content
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
            console.error("[Server] Error in convert_time:", error);
            let helpfulMessage = `Error processing convert_time: ${error.message}`;
            if (error.message?.includes("Invalid source timezone")) {
                helpfulMessage = `Error: Invalid source timezone specified ('${effectiveSourceTz}'). Please provide a valid IANA timezone name.`;
            } else if (error.message?.includes("Invalid target timezone")) {
                helpfulMessage = `Error: Invalid target timezone specified ('${effectiveTargetTz}'). Please provide a valid IANA timezone name.`;
            } else if (error.message?.includes("Invalid time format")) {
                helpfulMessage = `Error: Invalid time format specified ('${time}'). Please use 24-hour HH:MM format (e.g., '14:30').`;
            }
            return { content: [{ type: "text", text: helpfulMessage }] };
        }
    }
  );

  // Note: Removed previous example resource and prompt.

  return server;
}

/* ---------------------------------------------------------------------------
 * 2.  Transport registries – keep track of active sessions
 * ------------------------------------------------------------------------- */
const streamableTransports: Record<string, StreamableHTTPServerTransport> = {};
const sseTransports: Record<string, SSEServerTransport> = {};

/* ---------------------------------------------------------------------------
 * 3.  Express wiring
 * ------------------------------------------------------------------------- */
const app = express();
app.use(express.json());

/* ---------- 3-A: modern Streamable HTTP endpoint -------------------------- */
app.all("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && streamableTransports[sessionId]) {
    console.log(`[Server] Reusing Streamable HTTP transport for session: ${sessionId}`);
    transport = streamableTransports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    console.log("[Server] Creating new Streamable HTTP transport");
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: id => { streamableTransports[id] = transport; console.log(`[Server] Streamable HTTP session initialized: ${id}`); }
    });

    transport.onclose = () => {
      if (transport.sessionId) {
          console.log(`[Server] Streamable HTTP transport closed for session: ${transport.sessionId}`);
          delete streamableTransports[transport.sessionId];
      }
    };

    const server = buildMcpServer();
    await server.connect(transport);
  } else {
    console.warn("[Server] Invalid Streamable HTTP handshake request");
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: invalid MCP handshake" },
      id: null
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

/* ---------- 3-B: legacy SSE compatibility -------------------------------- */
app.get("/sse", async (req: Request, res: Response) => {
  console.log("[Server] Received request for SSE connection");
  const transport = new SSEServerTransport("/messages", res);
  sseTransports[transport.sessionId] = transport;
  console.log(`[Server] SSE transport created with sessionId: ${transport.sessionId}`);

  res.on("close", () => {
    console.log(`[Server] SSE connection closed for sessionId: ${transport.sessionId}`);
    delete sseTransports[transport.sessionId];
  });

  const server = buildMcpServer();
  await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseTransports[sessionId];
  console.log(`[Server] Received POST /messages for SSE sessionId: ${sessionId}`);

  if (!transport) {
    console.warn(`[Server] Unknown or expired SSE sessionId: ${sessionId}`);
    res.status(400).send("Unknown or expired sessionId");
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

/* ---------------------------------------------------------------------------
 * 4.  Startup
 * ------------------------------------------------------------------------- */
const PORT = Number(process.env.PORT ?? 3000);
const serverInstance = app.listen(PORT, () => {
  console.log(`MCP Time server listening on http://localhost:${PORT}`);
});

serverInstance.on('error', (error) => {
  console.error("Server listening error:", error);
  process.exit(1); // Exit if listening fails critically
});
