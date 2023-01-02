const {workerToPromise, WorkerError} = require('../lib/worker-to-promise')
const {assert} = require("chai");
const _ = require('lodash')
const {join} = require('lodash')
const {add} = require('./add')
const path = require('path')

describe('Worker to promise test', () => {

  it('should be able to get result from a simple function', async () => {
    const workerFunc = (payload) => {
      return payload.a * payload.b
    }

    const res = await workerToPromise(workerFunc, {a: 2, b: 4}, [], {})
    assert.equal(res, 8)
  })

  it('should be able to get result from an async simple function', async () => {
    const workerFunc = (payload) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(payload.a * payload.b)
        }, 1500)

      })
    }

    const res = await workerToPromise(workerFunc, {a: 2, b: 4}, [], {})
    assert.equal(res, 8)
  })

  it('should be able to return the correct error (WorkerError) if an error is thrown', async () => {
    const workerFunc = (payload) => {
      return new Promise((resolve, reject) => {
        throw new Error('Test Error')
      })
    }

    try {
      const res = await workerToPromise(workerFunc, {a: 2, b: 4}, [], {})
    } catch (e) {
      assert.isTrue(e instanceof WorkerError)
      assert.equal(e.message, 'Test Error')
    }
  })

  it('should be able to include module dependencies', async () => {
    const workerFunc = (payload) => {
      return join(_.uniq(payload), '~')
    }

    const dependencies = [
      {
        from: 'lodash',
        exports: ['join'],
        default: '_',
      }
    ]
    const res = await workerToPromise(workerFunc, [2, 1, 2], dependencies, {})

    assert.equal(res, '2~1')
  })


  it('should be able to include local dependencies', async () => {
    const workerFunc = (payload) => {
      return add(payload)
    }

    const dependencies = [
      {
        from: path.join(__dirname, './add'),
        exports: ['add'],
      }
    ]

    const res = await workerToPromise(workerFunc, [2, 1, 2], dependencies, {})
    assert.equal(res, 5)
  })


})
