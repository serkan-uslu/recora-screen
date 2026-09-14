// Stable entry point. Views use controller callbacks; transport lives in services.
export { command } from "@/src/services/commands";
export { desktop, pickPath } from "@/src/infrastructure/platform";
export { messageOf } from "@/src/lib/errors";
