const
  os = require('os'),
  net = require('net')

module.exports.getExternalNetworkInterface = function () {
  const
    networkInterfaces = os.networkInterfaces(),
    devices = []

  for (let deviceName of Object.keys(networkInterfaces)) {
    const networkInterface = networkInterfaces[deviceName]

    for (let networkAddress of networkInterface) {
      if (!networkAddress.internal && networkAddress.family === 'IPv4') {
        devices.push({ deviceName, ...networkAddress })
      }
    }
  }

  return devices
}

module.exports.findClosestOpenPort = async function (port, host) {
  let portProposal = port

  do {
    if (await module.exports.isPortAvailable(portProposal, host)) {
      return portProposal
    }
    portProposal++
  }
  while (portProposal < 65535)
}

module.exports.isPortAvailable = async function (port, host) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer()
      .once('error', err => {
        if (err.code === 'EADDRNOTAVAIL') {
          reject(ERROR_NETWORK_ADDRESS_NOT_AVAIL)
        }
        else if (err.code === 'EADDRINUSE') {
          resolve(false) // host/port in use
        }
        else {
          reject(err)
        }
      })
      .once('listening', () => {
        tester.once('close', () => {
          resolve(true) // found available host/port
        })
        .close()
      })
      .on('error', err => {
        reject(err)
      })
      .listen(port, host)
  })
}
