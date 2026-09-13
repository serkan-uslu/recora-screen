import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AppClient } from './rpc.js';
import { errorOf } from './validation.js';
import { isReadOnly, methodSchemas } from './service.js';

export const toolMethods = Object.fromEntries(Object.keys(methodSchemas).map(method => [method.replace(/[./]/g, '_'), method]));
export async function callAppTool(call: (method: string, params: Record<string, unknown>) => Promise<unknown>, name: string, args: Record<string, unknown>) {
  const method = toolMethods[name];
  if (!method) throw new Error(`Unknown tool: ${name}`);
  return call(method, args);
}
export function createMcpServer(call: (method: string, params: Record<string, unknown>) => Promise<any>) {
  const server = new Server({ name: 'screen-recorder', version: '0.1.0' }, { capabilities: { tools: {} }, instructions: 'Control the running Screen Recorder desktop app. Read project_open before editing. Timed edits use CURRENT OUTPUT timeline milliseconds, except clip.trim sourceStartMs/sourceEndMs and source.restore startMs/endMs explicitly use SOURCE time. Persisted annotations use SOURCE time. timeline_apply batches are atomic and undoable; use expectedRevision from the latest project. For multiple cuts, work backwards. Start recording only at user request; operating-system capture permissions still require the user. Long AI/export operations return job IDs: poll jobs_get, cancel with jobs_cancel. Pass a unique requestId on mutations and reuse it for retries in the same app session. Never edit project files directly.' });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: Object.entries(toolMethods).map(([name, method]) => {
    const schema: any = z.toJSONSchema(methodSchemas[method]!, { unrepresentable: 'any' });
    delete schema.$schema;
    schema.properties = { ...schema.properties, requestId: { type: 'string', description: 'Optional unique retry ID. Reuse for the same mutation if its response was lost.' } };
    return { name, description: `${method}: ${descriptions[method] ?? 'Run the corresponding desktop application command. Returns current state or a background job.'}`, inputSchema: schema, annotations: { readOnlyHint: isReadOnly(method), destructiveHint: method === 'project.delete', idempotentHint: isReadOnly(method), openWorldHint: method.startsWith('ai.') || method.startsWith('keychain.') } };
  }) }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const result: any = await callAppTool(call, request.params.name, request.params.arguments ?? {});
      const content: any[] = [{ type: 'text', text: JSON.stringify(result) ?? 'null' }];
      if (toolMethods[request.params.name] === 'preview.frame' && result?.path) content.push({ type: 'image', mimeType: 'image/png', data: (await fs.readFile(result.path)).toString('base64') });
      return { content, structuredContent: { result: result ?? null } };
    } catch (error) { const value = errorOf(error); return { isError: true, content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: { error: value } }; }
  });
  return server;
}
const descriptions: Record<string, string> = {
  'preview.draft': 'Render validated edits transiently in the active project preview. Requires expectedRevision. Does not save, add history, or affect export. Commit with timeline_apply; reload preview_load to discard.',
  'project.open': 'Read a project, revision and source-time edit state. Source media remains immutable.',
  'timeline.apply': 'Apply sequential edits atomically. Times are OUTPUT milliseconds except clip.trim sourceStartMs/sourceEndMs and source.restore startMs/endMs explicitly use SOURCE time. Speed is 0.25–8; transcript.text corrects words by id without changing timing. canvas.update and autoZoom.update merge settings; zooms.auto regenerates from click/drag/typing activity. Normalized x/y/size are 0–1. Cut multiple ranges in reverse order to avoid shifting later ranges. Stale expectedRevision is rejected. One batch is one undo step.',
  'ai.cleanSilence': 'Analyze source microphone RMS audio and protect audible system audio. Default returns suggested OUTPUT cut ranges and operations; apply=true commits an undoable edit. Returns Job; poll jobs_get.',
  'ai.transcribe': 'Run offline Whisper transcription with an already downloaded model. Source timestamps are preserved. Automatically enables editable captions. Returns Job.',
  'ai.assistant': 'Send project metadata and transcript to the selected BYOK OpenAI/Anthropic provider and let it edit via validated project tools. This is the cloud-assisted feature; no video upload. Returns Job.',
  'ai.models/download': 'Download one pinned SHA-256 verified multilingual Whisper model. base is 148 MB, small is 488 MB. Returns Job.',
  'recording.camera': 'visible changes the live bubble, enabled toggles camera hardware capture (off gaps cannot be restored), shape changes circle/square. For reversible post-recording visibility use timeline_apply camera.hide.',
  'project.delete': 'Move an idle project to the operating-system Trash. Active recordings and jobs prevent deletion.',
  'export.start': 'Render a project snapshot to a new external MP4 path. Omit width and height to follow the canvas aspect ratio; quality selects 720, 1080 (default), or 4k. Custom dimensions must be supplied together, even, and at most 3840 on either axis. Never overwrite an existing file or source media. Returns Job.',
  'transcript.export': 'Return SRT/VTT text aligned to the edited timeline; optionally write to a new external file.',
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const client = new AppClient();
  const server = createMcpServer((method, params) => client.call(method, params));
  process.stdin.on('end', () => client.close());
  await server.connect(new StdioServerTransport());
}
