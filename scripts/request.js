import fs from 'fs';
import url from 'url';
import mkdirp from 'mkdirp';
import os from 'os';
import request from 'request';

function ensureCacheDir(dir) {
  return new Promise((resolve, reject) => {
    mkdirp(dir, err => {
      if (err) {
        return reject(err);
      }
      return resolve();
    });
  });
}

function getFile(config, options) {
  const p = url.parse(options.url);
  const auth = p.auth || 'none';
  const requestDir = `${p.protocol}/${p.host}/${auth}${p.path}`;
  const responseDir = `${config.cacheDir}/${requestDir}`;
  console.log(`creating dir for tmp files if not exists ${responseDir}`);
  mkdirp(responseDir);
}

function cachedOrResponse(config, options, callback) {
  const file = getFile(config, options);
  const cachedFile = getFileDetails(file);
  // TODO if response is 304, return a stream of the cached file

  let headers = {};
  if (options && options.headers) {
    headers = {
      ...options.headers
    };
  }
  const ifModifiedSince = buildIfModifiedSince(cachedFile);
  if (ifModifiedSince) {
    headers['If-Modified-Since'] = ifModifiedSince;
  }
  const stream = {};
  const response = request({
    ...options,
    headers
  }, (error, response, body) => {
    if (response.statusCode === 304) {
      // TODO return cached file stream
      // TODO support pipe
      return cachedFile;
    }
    callback(error, response, body);
  });
  // TODO support returning stream
  return stream;
}

export default function buildRequester(options) {
  const config = {
    cacheDir: os.tmpdir() + '/node/requests-cache',
    ...options
  };
  const promise = ensureCacheDir(config.cacheDir);
  return function requestWrapper(options, callback) {
    // TODO check cache
    return cachedOrResponse(config, options, callback);
  };
}
