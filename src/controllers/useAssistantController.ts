import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { command, pickPath } from "@/src/api";
import type { RunAction } from "@/src/controllers/controllerTypes";
import type { Model, Settings } from "@/src/controllers/studioTypes";
import type { Project } from "@/shared/types";

type Chat = { role: "user" | "assistant"; text: string };

export function useAssistantController({
  project,
  run,
  setNotice,
}: {
  project: Project | null;
  run: RunAction;
  setNotice: Dispatch<SetStateAction<string>>;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [chats, setChats] = useState<Record<string, Chat[]>>({});

  const refreshSettings = useCallback(async () => {
    const [nextSettings, nextModels] = await Promise.all([
      command<Settings>("settings.get"),
      command<Model[]>("ai.models/list"),
    ]);
    setSettings(nextSettings);
    setModels(nextModels);
  }, []);

  function saveSettings(params: Record<string, unknown>) {
    return void run(async () => {
      await command("settings.update", params);
      await refreshSettings();
      setNotice("Settings saved");
    });
  }

  async function saveKey(provider: string, key: string) {
    await run(async () => {
      await command(key ? "keychain.set" : "keychain.delete", {
        provider,
        ...(key ? { key } : {}),
      });
      await refreshSettings();
      setNotice(key ? "API key saved in Keychain" : "API key removed");
    });
  }

  function exportTranscript(format: "srt" | "vtt") {
    if (!project) return;
    void run(async () => {
      const path = await pickPath(format, project.name);
      if (path)
        await command("transcript.export", {
          projectId: project.id,
          format,
          path,
        });
    });
  }

  return {
    settings,
    models,
    chats,
    setChats,
    refreshSettings,
    saveSettings,
    saveKey,
    exportTranscript,
  };
}
