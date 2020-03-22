#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ElasticTranscode } from '../lib/app-stack';

const app = new cdk.App();
new ElasticTranscode(app, 'Split-N-StitchStack');
