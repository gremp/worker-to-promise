# Worker to Promise

A simple lib that given a function creates a new worker, runs the given function and the result is returned as a promise

### Example
```js
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
    // res = 2~1

```

For more examples visit the test file
