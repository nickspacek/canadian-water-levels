import Promise from 'bluebird';
import csv from 'fast-csv';

import buildRequester from './request';
const request = buildRequester();

import { ColumnMeterDataTransformer, MeterConverter, MeterWriter } from './meters';
import { ColumnStationListTransformer } from './stations';
import { provinces, territories } from './geo-data';

const client = buildRequester({
  defaults: {
    baseUrl: 'http://dd.weather.gc.ca/',
  }
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

function toPtObjs(map) {
  return Object.keys(map)
    .map(abbr => ({ short: abbr, name: map[abbr] }));
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
    const meterConverter = new MeterConverter(stationsById, provinceEntry);
    const meterWriter = new MeterWriter(`./meters/${provinceFolder}`);
    const stream = client({ url: dataUrl })
      .pipe(csvStream)
      .pipe(rawDataTransformer)
      .pipe(meterConverter)
      .pipe(meterWriter);
    return new Promise((resolve, reject) => {
      stream.on('end', () => {
        console.log(`Completed province ${province}`);
        resolve();
      }).on('error', e => {
        console.error('Problem in stream', e);
      });
    });
  });
  return Promise.all(promises);
}

console.log('Starting processing', new Date());
getStationList().then(stations => {
  console.log(`${stations.length} stations retrieved, syncing provinces`);
  const pt = [ ...toPtObjs(provinces), ...toPtObjs(territories) ];
  processProvinces(stations, pt).then(() => {
    console.log('Completed processing', new Date());
  }).catch(e => {
    console.error('Problem processing provinces', e);
  });
}).catch(e => {
  console.error('Problem retrieving stations', e);
});
