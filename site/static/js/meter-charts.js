var meterData = meter.levels.stats.past24Hours.map(function (reading) {
  return [ new Date(reading.ts), reading.v ];
});

google.charts.load('current', {'packages':['line']});
      google.charts.setOnLoadCallback(drawChart);

    function drawChart() {

      var data = new google.visualization.DataTable();
      data.addColumn('datetime', 'Date');
      data.addColumn('number', 'Level');

      data.addRows(meterData);

      var options = {
        chart: {
          title: 'Past 24 Hours',
        },
        width: 900,
        height: 500
      };

      var chart = new google.charts.Line(document.getElementById('chart'));

      chart.draw(data, options);
    }
