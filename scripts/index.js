var amqp = require('amqp');

var connection = amqp.createConnection({ host: 'dd.weather.gc.ca', login: 'anonymous', password: 'anonymous' });

// Wait for connection to become established.
connection.on('ready', function () {
  console.log('ready');
  // Use the default 'amq.topic' exchange
  connection.queue('alerts.cap.#', function (q) {
      // Catch all messages
      q.bind('#');

      // Receive messages
      q.subscribe(function (message) {
        // Print messages to stdout
        console.log(message);
      });
  });
});
