const nodeNotifier = require('node-notifier')

class NotifierPlugin {
  apply(compiler) {
    compiler.plugin('done', stats => {
      const time = ((stats.endTime - stats.startTime) / 1000).toFixed(2)

      nodeNotifier.notify({
        title: 'Pradagroup',
        message: `Webpack is done!\n${stats.compilation.errors.length} errors in ${time}s`,
        // contentImage: "url.png",
      })
    })
  }
}

module.exports = NotifierPlugin
