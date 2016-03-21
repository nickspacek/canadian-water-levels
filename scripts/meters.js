const Promise = require('bluebird');
const stream = require('stream');
const swig = require('swig');
const fs = require('fs');
const moment = require('moment');
const csv = require('fast-csv');
const Duplex = require('duplex');
const toTitleCase = require('titlecase').toLaxTitleCase;

function parseReadingDate(dateString) {
  const date = moment(dateString, moment.ISO_8601).toDate();
  if (!date.getTime()) {
    console.error(dateString);
  }
  return date;
}

function processReading(reading) {
  return {
    ...reading,
    ts: reading.ts.toISOString()
  };
}

export class ColumnMeterDataTransformer extends stream.Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, encoding, done) {
    this.processColumns(chunk);
    done();
  }

  _flush(done) {
    this.push(this.currentMeter);
    this.currentMeter = null;
    done();
  }

  processColumns(columns) {
    const [ id, date, reading, rest ] = columns;
    // Skip first row
    if (!date || date === 'Date') {
      return;
    }

    const entry = {
      ts: parseReadingDate(date),
      v: parseFloat(reading)
    };
    if (!this.currentMeter || this.currentMeter.id !== id) {
      if (this.currentMeter && this.currentMeter.id !== id) {
        this.push(this.currentMeter);
      }
      this.currentMeter = {
        id,
        provinceCode: 'NB',
        readings: []
      };
    }

    if (!isNaN(entry.v)) {
      this.currentMeter.readings.push(entry);
    }
  }
}

export class MeterConverter extends stream.Transform {
  constructor(stations) {
    super({ objectMode: true });
    this.stations = stations;
  }

  _transform(chunk, encoding, done) {
    const meter = chunk;
    const processedMeter = this.processRawMeter(meter);
    if (processedMeter) {
      this.push(processedMeter);
    }
    done();
  }

  processRawMeter(rawMeter) {
    const meter = this.stations[rawMeter.id];
    if (!meter) {
      console.error(`Could not find meter ${rawMeter.id}`);
      return null;
    }
    const cutoff24Hours = moment().subtract(24, 'hours');
    const past24Hours = rawMeter.readings
      .filter(r => cutoff24Hours.isBefore(r.ts))
      .map(processReading);
    return {
      id: rawMeter.id,
      title: toTitleCase(meter.name.toLowerCase()),
      province: 'New Brunswick',
      provinceCode: meter.provinceCode,
      coordinates: meter.coordinates,
      levels: {
        stats: {
          past24Hours
        }
      }
    };
  }
}

export class MeterWriter extends stream.Writable {
  constructor(path) {
    super({ objectMode: true });
    this.path = path;
  }

  _write(chunk, encoding, done) {
    this.writeMeter(chunk)
      .then(() => { done(); })
      .catch((e) => {
        console.error('problem writing meter', e);
        done(e);
      });
  }

  writeMeter(meter) {
    return new Promise((resolve, reject) => {
      swig.renderFile('meter.template', { meter }, (err, output) => {
        if (err) {
          reject(err);
        }
        const path = `${this.path}/${meter.id}.html`;
        fs.writeFile(path, output, err => {
          if (err) {
            reject(err);
          }
          resolve();
        });
      });
    });
  }
}

