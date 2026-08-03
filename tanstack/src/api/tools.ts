import { TOOL_REGISTRY, type ToolDef } from '@/lib/tools-data'

const NETWORK_DELAY_MS = 120

export async function fetchTools(): Promise<ToolDef[]> {
  await new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS))
  return TOOL_REGISTRY
}
