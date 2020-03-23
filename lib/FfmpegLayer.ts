import { LayerVersion, SingletonFunction, LayerVersionProps, ILayerVersion } from "@aws-cdk/aws-lambda"
import { Construct } from "@aws-cdk/core"

const arn = 'arn:aws:lambda:us-west-2:172685794015:layer:ffmpeg:1'
let layer: ILayerVersion
export const FfmpegLayer = (scope: Construct): ILayerVersion => {
    if (layer) {
        return layer
    }
    layer = LayerVersion.fromLayerVersionArn(scope, 'FfmpegLayer', arn)
    return layer
}
