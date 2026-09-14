// Compatibility entry point for existing tools and integrations.
export { ApplicationService, type NativeCall } from "@/server/services/ApplicationService.js";
export {
  commandRegistry,
  isReadOnly,
  mcpPermissionCategory,
  mcpPermissionsSchema,
  methodSchemas,
} from "@/server/contracts/commands.js";
