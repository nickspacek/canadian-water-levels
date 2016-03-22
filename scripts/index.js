import Promise from 'bluebird';
import csv from 'fast-csv';

import request from 'request';

import { ColumnMeterDataTransformer, MeterConverter, MeterWriter } from './meters';
import { ColumnStationListTransformer } from './stations';

const client = request.defaults({
  baseUrl: 'http://dd.weather.gc.ca/',
  proxy: 'http://localhost:8111'
});

const stationListUrl = '/hydrometric/doc/hydrometric_StationList.csv';
function getStationList() {
  const csvStream = csv();
  const stationListStream = new ColumnStationListTransformer();
  console.log('getting station list');
  return new Promise((resolve, reject) => {
    const stations = [];
    try {
      client({ url: stationListUrl })
        .pipe(csvStream)
        .pipe(stationListStream)
        .on('data', station => { stations.push(station); })
        .on('end', () => {
          resolve(stations);
        });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

const url = '/hydrometric/csv/';
function processProvinces(stations, provinces) {
  const stationsById = stations.reduce((map, station) => {
    map[station.id] = station;
    return map;
  }, {});
  const promises = provinces.map(provinceEntry => {
    const province = provinceEntry.short;
    // TODO if-modified-since
    const dataUrl = url + province + '/hourly/' + province + '_hourly_hydrometric.csv';
    const provinceFolder = provinceEntry.name.toLowerCase().replace(/ /g, '-');

    const csvStream = csv();
    const rawDataTransformer = new ColumnMeterDataTransformer();
    const meterConverter = new MeterConverter(stationsById);
    const meterWriter = new MeterWriter(`./meters/${provinceFolder}`);
    const stream = client({ url: dataUrl })
      .pipe(csvStream)
      .pipe(rawDataTransformer)
      .pipe(meterConverter)
      .pipe(meterWriter);
    return new Promise((resolve, reject) => {
      stream.on('end', () => {
        resolve();
      });
    });
  });
  return Promise.all(promises);
}

const provinces = [{ short: 'NB', name: 'New Brunswick' }];
getStationList().then(stations => {
  console.log(`${stations.length} stations retrieved, syncing provinces`);
  process.exit(1);
  processProvinces(stations, provinces).then(() => {
    console.log('Completed sync');
  });
}).catch(e => {
  console.error('Problem retrieving stations', e);
});
