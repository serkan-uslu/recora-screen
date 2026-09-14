import { createContext } from "react";
import { type EditOperation } from "@/shared/types";

export const ErrorContext = createContext("");
export const DraftPreviewContext = createContext<{
  send: (operations: EditOperation[] | null) => void;
  scope: string;
}>({ send: () => {}, scope: "" });
