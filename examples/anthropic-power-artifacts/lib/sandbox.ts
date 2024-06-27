'use server'

import { CodeInterpreter } from '@e2b/code-interpreter'
import { Sandbox } from 'e2b'
export const sandboxTimeout = 10 * 60 * 1000 // 10 minutes in ms

export async function createOrConnect(userID: string) {
  console.log('create or connect', userID)
  const allSandboxes = await CodeInterpreter.list()
  console.log('all sandboxes', allSandboxes)
  //const sandboxInfo = allSandboxes.find(userId === userID)
  console.log('sandbox lenth', allSandboxes.length)
  if (allSandboxes.length === 0) {
    return await CodeInterpreter.create({
      template: 'new_sandbox8'
    })
  //console.log('create new sandbox')
  //const sandbox = await Sandbox.create({ template: 'yo1am0swg3xj3ejxdwp1',metadata: { userID: userId }  })
  //const sandbox =  await CodeInterpreter.create({ template: 'yo1am0swg3xj3ejxdwp1'  })
  console.log('created success')
  //return sandbox
  //return await CodeInterpreter.create({ template: 'new_sandbox2' })
  }
  return CodeInterpreter.reconnect(allSandboxes[0].sandboxID)
}

export async function runPython(userID: string, code: string) {
  const sbx = await createOrConnect(userID)
  console.log('Running code', code)
  const result = await sbx.notebook.execCell(code)
  console.log('Command result', result)
  return result
}

export async function createOrConnectJsKernel(userID: string) {
  console.log('create or connect', userID)
  const allSandboxes = await CodeInterpreter.list()
  console.log('all sandboxes', allSandboxes)
  const sandboxInfo = allSandboxes.find(sbx => sbx.alias === ALIAS)
  console.log('sandbox info', sandboxInfo)
  if (!sandboxInfo) {
    console.log('create js sandbox....')
    const sandbox = await CodeInterpreter.create()
    console.log('js sandbox id', sandbox.id)
    const jsID = await sandbox.notebook.createKernel({ kernelName: 'javascript' })
    console.log('js sandbox jsID', jsID)
    console.log('test execution ', jsID)
    const execution = await sandbox.notebook.execCell("console.log('Hello World!')", { kernelID: jsID })
    console.log('execution:',execution);
    return {'sandbox':sandbox,'jsID':jsID}
  }{
    const sandbox = await CodeInterpreter.reconnect(sandboxInfo.sandboxID)
    console.log('reconnected js sandbox id', sandbox.id)
    const jsID = await sandbox.notebook.createKernel({ kernelName: 'javascript' })
    console.log('reconnected js sandbox jsID', jsID)
    return {'sandbox':sandbox,'jsID':jsID}
  }
}

export async function runJs(userID: string, code: string) {
  const result ={
    logs:{stdout:[],stderr:[]},
    error:undefined,
    results:[{html:code}]
  }
  return result
}

export async function getFileUploadURL(userID: string) {
  const sbx = await createOrConnect(userID)
  return sbx.fileURL
}
