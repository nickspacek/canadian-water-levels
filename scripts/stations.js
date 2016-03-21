import stream from 'stream';

export class ColumnStationListTransformer extends stream.Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, encoding, done) {
    const station = this.processColumns(chunk);
    if (station) {
      this.push(station);
    }
    done();
  }

  processColumns(columns) {
    if (columns[0] == ' ID') {
      return null;
    }
    const [ id, name, latitude, longitude, provinceCode, timezone ] = columns;
    return { id, name, provinceCode, timezone, coordinates: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    } };
  }
}
