module.exports.add = function add(arr) {
  return arr.reduce((acc, item) => {
    acc += item
    return acc;
  }, 0)
}
