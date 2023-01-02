const {Worker, parentPort} = require('node:worker_threads');

/**
 * @typedef {Object} WorkerProperties
 * @property {any[]} argv List of arguments which would be stringify and appended to process.argv in the worker. This is mostly similar to the workerData but the values are available on the global process.argv as if they were passed as CLI options to the script.
 * @property {Object} env If set, specifies the initial value of process.env inside the Worker thread. As a special value, worker.SHARE_ENV may be used to specify that the parent thread and the child thread should share their environment variables; in that case, changes to one thread's process.env object affect the other thread as well. Default: process.env.
 * @property {string[]} execArgv List of node CLI options passed to the worker. V8 options (such as --max-old-space-size) and options that affect the process (such as --title) are not supported. If set, this is provided as process.execArgv inside the worker. By default, options are inherited from the parent thread.
 * @property {boolean} stdin If this is set to true, then worker.stdin provides a writable stream whose contents appear as process.stdin inside the Worker. By default, no data is provided.
 * @property {boolean} stdout If this is set to true, then worker.stdout is not automatically piped through to process.stdout in the parent.
 * @property {boolean} stderr If this is set to true, then worker.stderr is not automatically piped through to process.stderr in the parent.
 * @property {boolean} trackUnmanagedFds If this is set to true, then the Worker tracks raw file descriptors managed through fs.open() and fs.close(), and closes them when the Worker exits, similar to other resources like network sockets or file descriptors managed through the FileHandle API. This option is automatically inherited by all nested Workers. Default: true.
 * @property {Object[]} transferList If one or more MessagePort-like objects are passed in workerData, a transferList is required for those items or ERR_MISSING_MESSAGE_PORT_IN_TRANSFER_LIST is thrown. See port.postMessage() for more information.
 * @property {Object} resourceLimits An optional set of resource limits for the new JS engine instance. Reaching these limits leads to termination of the Worker instance. These limits only affect the JS engine, and no external data, including no ArrayBuffers. Even if these limits are set, the process may still abort if it encounters a global out-of-memory situation.
 * @property {number} resourceLimits.maxOldGenerationSizeMb The maximum size of the main heap in MB. If the command-line argument --max-old-space-size is set, it overrides this setting.
 * @property {number} resourceLimits.maxYoungGenerationSizeMb The maximum size of a heap space for recently created objects. If the command-line argument --max-semi-space-size is set, it overrides this setting.
 * @property {number} resourceLimits.codeRangeSizeMb The size of a pre-allocated memory range used for generated code.
 * @property {number} resourceLimits.stackSizeMb The default maximum stack size for the thread. Small values may lead to unusable Worker instances. Default: 4.
 */

/**
 * @typedef {Object} Dependency The dependencies to inject to the worker thread
 * @property {string} from - the package path
 * @property {string[] | undefined} exports - The list of variables to export from the package
 * @property {string | undefined} default - The name of the default variable
 */

/**
 * Functions that creates and runs a worker with the given function, and returns the results as a promise
 * @param {(payload: Object<any>) => unknown} func - Function to run in a new thread (function must have one parameter)
 * @param {any} payload - the parameter of the function (should be able to json stringify)
 * @param {Dependency[]} dependencies - the dependency libraries that are used by the function
 * @param {WorkerProperties} workerProps - the Worker properties
 * @return {Promise<unknown>}
 */
module.exports.workerToPromise = function (func, payload, dependencies = [], workerProps = {}) {
  const script = buildWorkerScript(func, dependencies)

  try {
    return new Promise((resolve, reject) => {
      const worker = new Worker(script, { ...workerProps, eval: true, workerData: payload });

      // If internal error occurs
      worker.on('error', (e) => {
        reject(new WorkerError(e.message, e.stack, script))
      })

      // When response from thread arrives
      worker.once('message', (message) => {
        const type = message.substring(0, 3)
        const response = message.substring(4)
        const result = JSON.parse(response)
        if (type === 'res') return resolve(result)
        if (type === 'err') return reject(new WorkerError(result.message, result.stack, script))
      })
    })

    // If expected error occurs
  } catch (e) {
    throw new WorkerError(e.message, e.stack, script)
  }
}

function buildWorkerScript(workerFunc, dependencies) {
  return `
        ${createDependencyStrings(dependencies)}
        const { parentPort, workerData } = require('node:worker_threads');
        ${__workerScript.toString()}
        ;
        __workerScript();
        `
    .replace('__placeholderFor__(\'WORKER_FUNCTION\')', `${getFunctionString(workerFunc)}`)
    .replace('__placeholderFor__(\'WORKER_FUNCTION_NAME\')', `${workerFunc.name}`)


}

function createDependencyStrings(dependencies) {
  const depStrings = []

  for (const dependency of dependencies) {
    if (dependency.exports && dependency.exports.length) depStrings.push(`const {${dependency.exports.join(',')}} = require('${dependency.from}');`)
    if (dependency.default && dependency.default.length) depStrings.push(`const ${dependency.default} = require('${dependency.from}');`)
  }

  return depStrings.join('\n')
}

function getFunctionString(workerFunc) {
  return `const ${workerFunc.name} = ${workerFunc.toString()}`
}

function __workerScript() {
  __placeholderFor__('WORKER_FUNCTION')
  const unknownResult = __placeholderFor__('WORKER_FUNCTION_NAME')(workerData)
  Promise.resolve(unknownResult)
    .then((data) => {
      parentPort.postMessage(`res:${JSON.stringify(data)}`)
    })
    .catch((err) => {
      parentPort.postMessage(`err:${JSON.stringify({message: err.message, stack: err.stack})}`)
    })
}

function __placeholderFor__(...args) {
  return () => {
  }
}

class WorkerError extends Error {
  constructor(message, stack, generatedCode) {
    super(message);

    this.generatedCode = generatedCode.split('\n')
      .map((line, index) => `${index + 1}: ${line}`). join('\n');

    this.stack = `${stack}
    
    
    ========== GENERATED CODE ===============

    ${this.generatedCode.trim()}
    `;
  }

}


module.exports.WorkerError = WorkerError
