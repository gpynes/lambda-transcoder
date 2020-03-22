import { LayerVersion, SingletonFunction, LayerVersionProps } from "@aws-cdk/aws-lambda"
import { Construct } from "@aws-cdk/core"

const arn = 'arn:aws:lambda:us-west-2:172685794015:layer:ffmpeg:1'
export const FfmpegLayer = (scope: Construct) => LayerVersion.fromLayerVersionArn(scope, 'FfmpegLayer', arn)
