import { Client } from "@modelcontextprotocol/sdk/client/index.js";
// Unused import: StreamableHTTPClientTransport
// import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"; 
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
let client: Client|undefined = undefined
const baseUrl = new URL("http://localhost:3000/sse");

async function main() {
  client = new Client({
    name: 'sse-client',
    version: '1.0.0'
  });
  const sseTransport = new SSEClientTransport(baseUrl);
  await client.connect(sseTransport);

  console.log("Connected using SSE transport");

  console.log("\n--- Listing Available Tools ---");

  // List tools
  const tools = await client.listTools();
  console.log("[Client] List Tools Result:", JSON.stringify(tools, null, 2));

  console.log("\n--- Testing Time Tools ---");

  // Get current time in a specific timezone
  const specificTz = "America/New_York";
  console.log(`\n[Client] Calling get_current_time with timezone: ${specificTz}`);
  let result = await client.callTool({ 
      name: "get_current_time", 
      arguments: { timezone: specificTz }
  });
  // Type check the result content before accessing
  const resultText1 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content); // Fallback to stringify if structure is unexpected
  console.log("[Client] Result:", resultText1);

  // Get current time using server default timezone
  console.log(`\n[Client] Calling get_current_time with default timezone`);
  result = await client.callTool({ 
      name: "get_current_time", 
      arguments: {} // Let server use default
  });
  const resultText2 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content);
  console.log("[Client] Result:", resultText2);

  // Convert time between specific timezones
  const conversionArgs1 = { 
      source_timezone: "Europe/London", 
      time: "14:30", 
      target_timezone: "Asia/Tokyo" 
  };
  console.log(`\n[Client] Calling convert_time with args:`, conversionArgs1);
  result = await client.callTool({ 
      name: "convert_time", 
      arguments: conversionArgs1 
  });
  const resultText3 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content);
  console.log("[Client] Result:", resultText3);

  // Convert time using default timezones
  const conversionArgs2 = { 
      time: "09:00", 
      // Omitting source_timezone and target_timezone to use server defaults
  };
  console.log(`\n[Client] Calling convert_time with args:`, conversionArgs2);
  result = await client.callTool({ 
      name: "convert_time", 
      arguments: conversionArgs2 
  });
  const resultText4 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content);
  console.log("[Client] Result:", resultText4);

  console.log("\n--- Finished Testing Time Tools ---");

  console.log("\n--- Testing Error Handling ---");

  // 1. Invalid timezone for get_current_time
  const invalidTz = "Mars/Gale_Crater";
  console.log(`\n[Client] Calling get_current_time with invalid timezone: ${invalidTz}`);
  result = await client.callTool({ name: "get_current_time", arguments: { timezone: invalidTz } });
  const errorText1 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content);
  console.log("[Client] Error Result:", errorText1);

  // 2. Invalid source timezone for convert_time
  const invalidConvArgs1 = { source_timezone: "Pluto/Sputnik_Planitia", time: "10:00", target_timezone: "Europe/Paris" };
  console.log(`\n[Client] Calling convert_time with invalid source timezone:`, invalidConvArgs1);
  result = await client.callTool({ name: "convert_time", arguments: invalidConvArgs1 });
  const errorText2 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content);
  console.log("[Client] Error Result:", errorText2);

  // 3. Invalid target timezone for convert_time
  const invalidConvArgs2 = { source_timezone: "America/Los_Angeles", time: "11:00", target_timezone: "Jupiter/Great_Red_Spot" };
  console.log(`\n[Client] Calling convert_time with invalid target timezone:`, invalidConvArgs2);
  result = await client.callTool({ name: "convert_time", arguments: invalidConvArgs2 });
  const errorText3 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content);
  console.log("[Client] Error Result:", errorText3);

  // 4. Invalid time format for convert_time
  const invalidConvArgs3 = { source_timezone: "UTC", time: " lunchtime ", target_timezone: "Asia/Kolkata" };
  console.log(`\n[Client] Calling convert_time with invalid time format:`, invalidConvArgs3);
  result = await client.callTool({ name: "convert_time", arguments: invalidConvArgs3 });
  const errorText4 = Array.isArray(result.content) && result.content[0]?.type === 'text' 
      ? result.content[0].text 
      : JSON.stringify(result.content);
  console.log("[Client] Error Result:", errorText4);

  console.log("\n--- Finished Error Testing ---");
}

main().catch(error => {
  console.error("Client error:", error);
  process.exit(1);
});