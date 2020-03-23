import { NodejsFunction, NodejsFunctionProps } from '@aws-cdk/aws-lambda-nodejs'
import { Construct } from '@aws-cdk/core';
import { resolve } from 'path';
import { FfmpegLayer } from './FfmpegLayer';

export interface TranscodeLambdaProps extends NodejsFunctionProps {}

export class TranscodeLambda extends NodejsFunction {
    constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
        const layers = [FfmpegLayer(scope), ...(props.layers || [])]
        super(scope, id, {
            entry: resolve(__dirname, '..', 'lambdas', 'index.ts'),
            ...props,
            layers
        })
    }
}
