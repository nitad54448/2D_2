/* Offline Blob worker: source is composed from functions already loaded by classic scripts. */
(function (TE) {
  'use strict';

  TE.workerMain = function workerMain() {
    function send(message) {
      if (!message.result) {
        self.postMessage(message);
        return;
      }
      const result = {
          ...message.result
        },
        transfer = [];
      function pack(values) {
        const matrix = Array.isArray(values[0]);
        const rows = matrix ? values.length : 1;
        const columns = matrix ? values[0].length : values.length;
        const data = new Float64Array(rows * columns);
        if (matrix) values.forEach((row, i) => data.set(row, i * columns));else data.set(values);
        transfer.push(data.buffer);
        return {
          encoding: 'float64',
          matrix,
          rows,
          columns,
          buffer: data.buffer
        };
      }
      // Copy only the wire representation. Never detach a solver-owned history/checkpoint.
      for (const key of ['temperature', 'voltage', 'Jx', 'Jy', 'qx', 'qy', 'current', 'terminalVoltage', 'time', 'finalTemperature']) {
        if (Array.isArray(result[key])) result[key] = pack(result[key]);
      }
      if (result.harmonics) {
        result.harmonics = Object.fromEntries(Object.entries(result.harmonics).map(([key, orders]) => {
          const scalar = !Array.isArray(orders[0]);
          const width = scalar ? 1 : orders[0].length;
          const data = new Float64Array(orders.length * width * 2);
          orders.forEach((row, n) => (scalar ? [row] : row).forEach((z, i) => {
            const offset = 2 * (n * width + i);
            data[offset] = z.re;
            data[offset + 1] = z.im;
          }));
          transfer.push(data.buffer);
          return [key, {
            encoding: 'complex64',
            scalar,
            orders: orders.length,
            width,
            buffer: data.buffer
          }];
        }));
      }
      self.postMessage({
        ...message,
        result
      }, transfer);
    }
    self.onmessage = event => {
      try {
        if (event.data.sweep?.enabled) {
          TE.runSweep(event.data, send);
          return;
        }
        const result = TE.run2D(event.data, progress => send({
          type: 'progress',
          progress
        }), result => send({
          type: 'checkpoint',
          result
        }));
        send({
          type: 'result',
          result
        });
      } catch (error) {
        send({
          type: 'error',
          message: error.message
        });
      }
    };
  };
  TE.workerSource = () => `'use strict';\nconst TE=(${TE.createCore.toString()})();\n(${TE.workerMain.toString()})();`;
  TE.decodeWorkerMessage = message => {
    if (!message.result) return message;
    const result = message.result;
    for (const key of ['temperature', 'voltage', 'Jx', 'Jy', 'qx', 'qy', 'current', 'terminalVoltage', 'time', 'finalTemperature']) {
      const value = result[key];
      if (value?.encoding !== 'float64') continue;
      const data = new Float64Array(value.buffer);
      result[key] = value.matrix ? Array.from({
        length: value.rows
      }, (_, i) => Array.from(data.subarray(i * value.columns, (i + 1) * value.columns))) : Array.from(data);
    }
    if (result.harmonics) for (const [key, value] of Object.entries(result.harmonics)) {
      if (value.encoding !== 'complex64') continue;
      const data = new Float64Array(value.buffer);
      result.harmonics[key] = Array.from({
        length: value.orders
      }, (_, n) => {
        const row = Array.from({
          length: value.width
        }, (_, i) => {
          const offset = 2 * (n * value.width + i);
          return {
            re: data[offset],
            im: data[offset + 1]
          };
        });
        return value.scalar ? row[0] : row;
      });
    }
    return message;
  };
})(globalThis.TE);
