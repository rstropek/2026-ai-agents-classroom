import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useApp, useHostStyleVariables } from '@modelcontextprotocol/ext-apps/react';
import { useEffect, useRef, useState } from 'react';
import { parseTrainerOptions, type TrainerOptions } from '../../src/trainer.ts';
import { Trainer } from './Trainer.tsx';

/**
 * Connects to the host and waits for open_trainer's result, which carries the options (checked
 * and completed by the server). Follows the host's theme and style variables; host fonts are
 * left out on purpose, so the app never loads anything from outside.
 */
export function TrainerApp() {
  const [options, setOptions] = useState<TrainerOptions | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();
  // The trainer registers what to do before the host removes the app (stop and report)
  const beforeTeardown = useRef<() => Promise<void>>(async () => {});

  const { app, error } = useApp({
    appInfo: { name: 'Chord trainer', version: '0.1.0' },
    capabilities: {},
    onAppCreated: (created) => {
      created.ontoolresult = (result) => {
        const parsed = result.isError ? null : parseTrainerOptions(result.structuredContent);
        if (parsed) {
          setOptions(parsed);
          setProblem(null);
        } else {
          const text = result.content?.find((block) => block.type === 'text');
          setProblem(text && 'text' in text ? text.text : 'The trainer got no settings.');
        }
      };
      created.ontoolcancelled = () => setProblem('The trainer was cancelled.');
      created.onhostcontextchanged = (changed) => setHostContext((previous) => ({ ...previous, ...changed }));
      created.onteardown = async () => {
        await beforeTeardown.current();
        return {};
      };
    },
  });

  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext());
    }
  }, [app]);

  // Theme (color-scheme, data-theme) and the host's CSS variables, initially and on every change
  useHostStyleVariables(app, app?.getHostContext());

  const insets = hostContext?.safeAreaInsets;
  return (
    <main
      className="trainer"
      style={{
        paddingTop: insets?.top,
        paddingRight: insets?.right,
        paddingBottom: insets?.bottom,
        paddingLeft: insets?.left,
      }}
    >
      {error ? (
        <p className="message error" role="alert">
          Could not connect to the chat: {error.message}
        </p>
      ) : problem ? (
        <p className="message error" role="alert">
          {problem}
        </p>
      ) : app && options ? (
        <Trainer app={app} options={options} beforeTeardown={beforeTeardown} />
      ) : (
        <p className="message">Opening the chord trainer…</p>
      )}
    </main>
  );
}
