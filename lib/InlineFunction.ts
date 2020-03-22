import { Construct } from "@aws-cdk/core";
import { Function as CDKFunction, FunctionProps, Code, Runtime } from "@aws-cdk/aws-lambda";

export interface InlineFunctionProps extends Partial<FunctionProps> {
    function: Function
}

export class InlineFunction extends CDKFunction {
    constructor(scope: Construct, id: string, props: InlineFunctionProps) {
        super(scope, id, {
            ...createInlineFunction(props),
            ...props
        })
    }
}

function createInlineFunction(props: InlineFunctionProps): FunctionProps {
    const handler = props.handler || 'handler'
    return {
        code: Code.fromInline(`exports.${handler} = ${props.function.toString()}`),
        handler: props.handler || `index.${handler}`,
        runtime: props.runtime || Runtime.NODEJS_12_X
    }
}