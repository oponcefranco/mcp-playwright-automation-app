<!-- lib/MCPStatusMonitor.svelte -->
<script>
    export let status = "disconnected";

    $: statusConfig = getStatusConfig(status);

    function getStatusConfig(status) {
        switch (status) {
            case "connected":
                return {
                    color: "green",
                    icon: "🟢",
                    text: "MCP Server Online",
                    description: "Ready for AI-powered test execution",
                };
            case "connecting":
                return {
                    color: "yellow",
                    icon: "🟡",
                    text: "Connecting...",
                    description: "Establishing connection to MCP server",
                };
            case "error":
                return {
                    color: "red",
                    icon: "🔴",
                    text: "Connection Error",
                    description: "Failed to connect to MCP server",
                };
            default:
                return {
                    color: "gray",
                    icon: "⚫",
                    text: "Server Offline",
                    description: "MCP server not available",
                };
        }
    }
</script>

<div
    class="flex items-center space-x-3 bg-white border border-gray-200 rounded-lg px-4 py-2"
>
    <div class="flex items-center space-x-2">
        <span class="text-lg">{statusConfig.icon}</span>
        <div>
            <div class="text-sm font-medium text-gray-900">
                {statusConfig.text}
            </div>
            <div class="text-xs text-gray-500">
                {statusConfig.description}
            </div>
        </div>
    </div>

    {#if status === "connecting"}
        <div
            class="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"
        ></div>
    {/if}
</div>
