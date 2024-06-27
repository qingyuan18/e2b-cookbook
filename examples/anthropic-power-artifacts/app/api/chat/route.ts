import { z } from 'zod'
import {
  type CoreMessage,
  StreamingTextResponse,
  StreamData,
  streamText,
  tool,
} from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { bedrock } from '@ai-sdk/amazon-bedrock';

import {
  runPython,
  runJs
} from '@/lib/sandbox'

export interface ServerMessage {
  role: 'user' | 'assistant' | 'function';
  content: string;
}

export async function POST(req: Request) {
  const { messages, userID }: { messages: CoreMessage[], userID: string } = await req.json()
  console.log('userID', userID)

  let data: StreamData = new StreamData()

  const result = await streamText({
    // model: anthropic('claude-3-5-sonnet-20240620'),
     model: bedrock('anthropic.claude-3-5-sonnet-20240620-v1:0', {
      additionalModelRequestFields: { top_k: 250 },
    }),
    tools: {
      runPython: tool({
        description: 'Runs Python code.',
        parameters: z.object({
          title: z.string().describe('Short title (5 words max) of the artifact.'),
          description: z.string().describe('Short description (10 words max) of the artifact.'),
          code: z.string().describe('The code to run.'),
        }),
        async execute({ code }) {
          data.append({
            tool: 'runPython',
            state: 'running',
          })

          const execOutput = await runPython(userID, code)
          const stdout = execOutput.logs.stdout
          const stderr = execOutput.logs.stderr
          const runtimeError = execOutput.error
          const results = execOutput.results

          data.append({
            tool: 'runPython',
            state: 'complete',
          })

          return {
            stdout,
            stderr,
            runtimeError,
            cellResults: results,
          }
        },
      }),
      runJs: tool({
        description: 'Runs HTML or Javascript code.',
        parameters: z.object({
          title: z.string().describe('Short title (5 words max) of the artifact.'),
          description: z.string().describe('Short description (10 words max) of the artifact.'),
          code: z.string().describe('The code to run. can be a html and js code'),
        }),
        async execute({ code }) {
          // console.log(code)
          data.append({
            tool: 'runJs',
            state: 'running',
          })

          const execOutput = await runJs(userID, code)
          const stdout = execOutput.logs.stdout
          const stderr = execOutput.logs.stderr
          const runtimeError = execOutput.error
          const results = execOutput.results
          // const stdout :string [] = []
          // const stderr :string [] = []
          // const runtimeError = undefined
          // const results = [{'html':code}]

          data.append({
            tool: 'runJs',
            state: 'complete',
          })
          console.log(data)
          return {
            stdout,
            stderr,
            runtimeError,
            cellResults: results,
          }
        },
      }),
    },
    toolChoice: 'auto',
    system: `
    You are a skilled Python and Javascript developer.
    One of your expertise is also data science.
    You can run Python, Javascript and bash code. Code for each programming language runs in its own context and reference previous definitions and variables.
    The code runs inside a Jupyter notebook so we can easily get visualizations.
    Use seaborn for data visualization.

    Messages inside [] means that it's a UI element or a user event. For example:
    - "[Chart was generated]" means a chart in a Jupyter notebook was generated and displayed to user.
    `,
    messages,
  })

  const stream = result.toAIStream({
    async onFinal() {
      await data.close()
    }
  })

  return new StreamingTextResponse(stream, {}, data);
}
