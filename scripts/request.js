import fs from 'fs';
import moment from 'moment';
import momentTz from 'moment-timezone';
import path from 'path';
import url from 'url';
import mkdirp from 'mkdirp';
import os from 'os';
import request from 'request';
import stream from 'stream';

const GMT = 'Etc/GMT+0';
const HEADER_FORMAT = 'ddd, DD MMM YYYY HH:mm:ss z';

function getFile(config, client, requestOptions) {
  const requestUrl = (config.defaults.baseUrl ? config.defaults.baseUrl : '') + requestOptions.url;
  const parsedPath = url.parse(requestUrl);
  const auth = parsedPath.auth || 'noauth';
  const protocol = parsedPath.protocol.substring(0, parsedPath.protocol.length - 1);
  const path = parsedPath.path.substring(1);
  const requestFilePath = `${protocol}/${parsedPath.host}/${auth}${path}`;
  return `${config.cacheDir}/${requestFilePath}`;
}

function cachedOrResponse(config, requestOptions, client) {
  const file = getFile(config, client, requestOptions);
  // if file exists, send the modified date
  // if 304 response, pipe the file as the response
  // otherwise pipe the regular response and cache the result
  // TODO move this
//  console.log(`creating dir for tmp files if not exists ${responsePath}`);
//  mkdirp.sync(path.dirname(responsePath));

  let headers = {};
  if (requestOptions.headers) {
    headers = {
      ...requestOptions.headers
    };
  }

  let fileStat;
  try {
    fileStat = fs.statSync(file);
  } catch (e) {
    fileStat = null;
  }

  if (fileStat) {
    // Sun, 06 Nov 1994 08:49:37 GMT
    headers['If-Modified-Since'] = momentTz(fileStat.mtime).tz(GMT).format(HEADER_FORMAT);
  }
  const clientOptions = {
    ...requestOptions,
    headers
  };
  const responseStream = new stream.PassThrough();
  const response = client(clientOptions);
  response.pause();
  response
    .on('response', res => {
      if (res.statusCode === 304) {
        // Return file stream
        response.resume();
        fs.createReadStream(file).pipe(responseStream);
        return;
      }
      // Return response stream
      mkdirp(path.dirname(file), () => {
        response.resume();
        response.pipe(fs.createWriteStream(file));
      });
      response.pipe(responseStream)
    });
  return responseStream;
}

export default function buildRequester(options = {}) {
  const defaults = options.defaults;
  const client = defaults ? request.defaults(defaults) : request;
  const config = {
    cacheDir: os.tmpdir() + '/node/requests-cache',
    ...options
  };
  return function requestWrapper(requestOptions, callback) {
    // TODO check cache
    return cachedOrResponse(config, requestOptions, client, callback);
  };
}
