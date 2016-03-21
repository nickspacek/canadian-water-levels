var meterData = meter.levels.stats.past24Hours.map(function (reading) {
  return [ new Date(reading.ts), reading.v ];
});

google.charts.load('current', {'packages':['corechart']});
    google.charts.setOnLoadCallback(drawChart);

    function drawChart() {
      var formatter = new google.visualization.NumberFormat({
        fractionDigits: 4
      });
      var data = new google.visualization.DataTable();
      data.addColumn('datetime', 'Date');
      data.addColumn('number', 'Level');

      data.addRows(meterData);

      formatter.format(data, 1);

      var options = {
        title: 'Past 24 Hours',
        curveType: 'function',
        width: 900,
        height: 500,
        vAxis: { format: '#.000' }
      };

      var chart = new google.visualization.LineChart(document.getElementById('chart'));
      chart.draw(data, options);
    }
