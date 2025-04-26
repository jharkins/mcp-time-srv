# MCP Time Server (`mcp-time-srv`)

A simple Model Context Protocol (MCP) server implemented in TypeScript that provides tools for time-related queries, including getting the current time in various timezones and converting times between timezones.

This server supports both modern Streamable HTTP and legacy HTTP+SSE MCP transport protocols.

## Features

Provides the following MCP tools:

*   **`get_current_time`**: Returns the current time in a specified IANA timezone.
*   **`convert_time`**: Converts a given time from a source IANA timezone to a target IANA timezone.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later recommended)
*   [npm](https://www.npmjs.com/) (usually comes with Node.js)
*   [Docker](https://www.docker.com/) (Optional, for running in a container)

## Setup

1.  **Clone the repository (if you haven't already):**
    ```bash
    # git clone <your-repo-url>
    # cd mcp-time-srv
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running Locally

1.  **Build the TypeScript code:**
    ```bash
    npm run build
    ```
    This compiles the TypeScript source in `src/` to JavaScript in `dist/`.

2.  **Run the server:**
    You can run the server using `ts-node` (for development) or directly with `node` after building.

    *   **Using `ts-node`:**
        ```bash
        npx ts-node src/server.ts
        ```
    *   **Using `node` (after building):**
        ```bash
        node dist/server.js
        ```

The server will start, typically listening on port 3000.
```
MCP Time server listening on http://localhost:3000
```

## Running with Docker (Optional)

A `Dockerfile` is provided for building and running the server in a container.

1.  **Build the Docker image:**
    ```bash
    docker build -t mcp-time-srv .
    ```

2.  **Run the container:**
    ```bash
    docker run -d -p 3000:3000 --name my-mcp-server mcp-time-srv
    ```
    *   `-d`: Run in detached mode (in the background).
    *   `-p 3000:3000`: Map port 3000 on your host to port 3000 in the container.
    *   `--name my-mcp-server`: Assign a name to the container for easier management.

The server will be running inside the container, accessible at `http://localhost:3000`.

To stop the container:
```bash
docker stop my-mcp-server
```
To view logs:
```bash
docker logs my-mcp-server
```

## Testing with the Client

A simple test client script (`src/client.ts`) is included to demonstrate interacting with the server's tools.

1.  **Ensure the server is running** (either locally or in Docker).
2.  **Run the client:**
    ```bash
    npx ts-node src/client.ts
    ```
The client will connect to the server (using SSE transport by default), list the available tools, call each tool with example arguments (including some designed to test error handling), and print the results.

## Tool Details

### `get_current_time`

Returns the current time in the specified timezone.

*   **Input Argument:**
    *   `timezone` (string, optional): An IANA timezone name (e.g., `America/New_York`, `Europe/London`). If omitted, defaults to the server's local timezone.
*   **Output:** A JSON object containing:
    *   `timezone` (string): The effective timezone used.
    *   `datetime` (string): The current time in ISO 8601 format with offset (e.g., `2025-04-26T01:39:15Z`).

### `convert_time`

Converts a time from a source timezone to a target timezone.

*   **Input Arguments:**
    *   `source_timezone` (string, optional): Source IANA timezone name. Defaults to server's local timezone if omitted.
    *   `time` (string, required): The time to convert in 24-hour HH:MM format (e.g., `14:30`).
    *   `target_timezone` (string, optional): Target IANA timezone name. Defaults to server's local timezone if omitted.
*   **Output:** A JSON object containing:
    *   `source` (object): Details of the time in the source timezone (`timezone`, `datetime`).
    *   `target` (object): Details of the converted time in the target timezone (`timezone`, `datetime`).
    *   `time_difference` (string): The difference between the target and source timezone offsets (e.g., `+8h`, `-5h`, `+5.75h`). 

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 