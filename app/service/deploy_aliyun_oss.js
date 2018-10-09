'use strict';

const path = require('path');
const OSS = require('ali-oss');
const Service = require('egg').Service;
const debug = require('debug')('marmot:service:deploy_aliyun_oss');
const marmotRelease = require('marmot-release');

module.exports = class deployAliyunOssService extends Service {

  async deploy({
    build,
    source,
    credential,
    accessKeySecretSaved = true,
    inputCredentialSecret,
    prefix,
    acl,
  }) {
    const ctx = this.ctx;
    const {
      region,
      bucket,
      accessKeyId,
    } = credential;

    let accessKeySecret = credential.accessKeySecret;
    if (!accessKeySecretSaved) {
      accessKeySecret = inputCredentialSecret;
    }

    const timeout = 120 * 1000;

    ctx.logger.info(`[deploy to oss start] ${source}`);
    let success = true;
    let message = '';
    let uploadResult = {};
    let ossClient;
    const useDefaultAcl = ctx.app.config.marmotRelease.ALIYUN_OSS.useDefaultAcl;
    try {
      debug('deploy %o', {
        source,
        accessKeySecretSaved,
        inputCredentialSecret,
        region,
        accessKeyId,
        accessKeySecret,
        bucket,
        timeout,
        prefix,
        acl,
        useDefaultAcl,
      });
      if (useDefaultAcl) acl = 'default';
      ossClient = new OSS({
        region,
        accessKeyId,
        accessKeySecret,
        bucket,
        timeout,
        urllib: this.app.httpclient,
      });
    } catch (e) {
      ctx.logger.error(`[deploy to oss fail] ${e}`);
      return {
        success: false,
        message: e.message,
      };
    }
    if (path.extname(source) === '.tgz') {
      try {
        const [ html, other ] = await marmotRelease.uploadPackage({
          source,
          prefix: '',
          acl,
          client: ossClient,
        });
        uploadResult = {
          html,
          other,
        };
      } catch (e) {
        ctx.logger.error(e);
        message = e.message;
        success = false;
      }
    } else {
      const fileStorageKey = path.join(prefix, build.jobName, `${path.basename(source)}`);
      try {
        const res = await marmotRelease.uploadFile({
          client: ossClient,
          targetPath: fileStorageKey,
          source,
          acl,
          retryTimes: ctx.app.config.deployConfig.deployRetryTimes,
        });
        uploadResult = {
          other: [ res ],
        };
      } catch (e) {
        ctx.logger.error(e);
        message = e.message;
        success = false;
      }
    }

    if (success) {
      ctx.logger.info(`[deploy to oss end] ${source} ${JSON.stringify(uploadResult)}`);
    } else {
      ctx.logger.info(`[deploy to oss fail] ${message}`);
    }

    return {
      success,
      message,
      uploadResult,
    };
  }
};

