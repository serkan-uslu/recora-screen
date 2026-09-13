// Stable entry point. Views use controller callbacks; transport lives in services.
export { command } from "./services/commands";
export { desktop, pickPath } from "./infrastructure/platform";
export { messageOf } from "./lib/errors";
