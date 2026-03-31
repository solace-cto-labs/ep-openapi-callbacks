
import L from './common/logger.js';
import { AsyncAPIDocumentInterface as AsyncAPIDocument, Parser as Parser } from '@asyncapi/parser';
import type { OpenAPIV3 as OpenAPI } from '@scalar/openapi-types';
import { createGenerator } from 'ts-json-schema-generator';
import _ from 'lodash';


class AsyncAPItoOASMapper {


    public convert(asyncAPIDocument: AsyncAPIDocument): OpenAPI.Document {
        const oasDocument: OpenAPI.Document = this.createDocument(asyncAPIDocument);
        this.addStandardSchemas(oasDocument);

        this.mapSchemas(asyncAPIDocument, oasDocument);

        // Convert channels to paths
        this.mapChannels(asyncAPIDocument, oasDocument);

        return oasDocument;
    }


    private mapSchemas(asyncAPIDocument: AsyncAPIDocument, oasDocument: OpenAPI.Document<{}>) {
        for (const s of asyncAPIDocument.components().schemas()) {
            const asyncAPISchema = s.json() as any;
            const asyncAPiSchemaId = s.id();
            //const schemaType: OpenAPI.NonArraySchemaObjectType = (Array.isArray(asyncAPISchema.type()) ? asyncAPISchema.type()[0] : asyncAPISchema.type()) as OpenAPI.NonArraySchemaObjectType;

            const schema: OpenAPI.SchemaObject = asyncAPISchema;
            oasDocument.components.schemas[asyncAPiSchemaId] = schema;
        }
        L.info(oasDocument.components.schemas);
    }

    private mapChannels(asyncAPIDocument: AsyncAPIDocument, oasDocument: OpenAPI.Document<{}>) {
        for (const channel of asyncAPIDocument.channels()) {
            const pathItem: OpenAPI.PathItemObject = {};
            const parameters: OpenAPI.ParameterObject[] = this.mapParameters(channel);
            pathItem.parameters = parameters;

            for (const receiveOperation of channel.operations().filterByReceive()) {
                pathItem.post = {
                    summary: receiveOperation.summary()?receiveOperation.summary():"not available",
                    description: receiveOperation.description(),
                    operationId: receiveOperation.operationId() || `${channel.address()}-Receive`,
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SubscribeRequest' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Success',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/SubscribeSuccessResponse' }
                                }
                            }
                        },
                        '400': {
                            description: 'Error',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        },
                        '500': {
                            description: 'Error',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    },
                    callbacks: {

                    }
                };
                for (const m of receiveOperation.messages()) {
                    const post = {
                        post: {
                            summary: receiveOperation.summary()?receiveOperation.summary():"not available",
                            description: receiveOperation.description(),
                            operationId: receiveOperation.operationId() ? receiveOperation.operationId() : channel.address(),
                            requestBody: {
                                required: true,
                                content: {
                                    'application/json': {
                                        schema: { $ref: `#/components/schemas/${m.payload().id()}` }
                                    }
                                }
                            },
                            responses: {
                                '200': {
                                    description: 'Success',
                                },
                                '400': {
                                    description: 'Error',
                                    content: {
                                        'application/json': {
                                            schema: { $ref: '#/components/schemas/ErrorResponse' }
                                        }
                                    }
                                },
                                '500': {
                                    description: 'Error',
                                    content: {
                                        'application/json': {
                                            schema: { $ref: '#/components/schemas/ErrorResponse' }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    for (const e of m.extensions()) {
                        post.post[e.id()] = e.value();
                    }

                    const callback: OpenAPI.CallbackObject = {
                        [`{$request.body#/callbackUrl}`]:
                            post
                    }

                    pathItem.post.callbacks![m.id()] = callback;
                }
                pathItem.delete = {
                    summary: receiveOperation.summary()?receiveOperation.summary():"not available",
                    description: receiveOperation.description(),
                    operationId: receiveOperation.operationId() ? receiveOperation.operationId() + "Delete" : `${channel.address()}-Delete`,
                    responses: {
                        '200': {
                            description: 'Success',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/UnSubscribeSuccessResponse' }
                                }
                            }
                        },
                        '400': {
                            description: 'Error',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        },
                        '500': {
                            description: 'Error',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    }
                };
            }
            pathItem.delete.parameters = [];
            pathItem.delete.parameters.push({
                in:'query',
                name: 'callbackId',
                required: true,
                description: 'The callbackId as contained in the response when the callback was created',
                schema: {
                    type: 'string'
                }
            })
            oasDocument.paths[`/${channel.address()}`] = pathItem;
        }
    }

    private createDocument(asyncAPIDocument: AsyncAPIDocument): OpenAPI.Document<{}> {
        const doc: OpenAPI.Document<{}> = {
            openapi: '3.0.0',
            info: {
                title: asyncAPIDocument.info().title() || 'Converted API',
                description: asyncAPIDocument.info().description() || asyncAPIDocument.info().title() || 'Converted API',
                version: asyncAPIDocument.info().version() || '1.0.0',
            },
            paths: {},
            components: {
                schemas: {}
            },
            servers: [],
            security: [

            ]
        };
        for (const e of asyncAPIDocument.info().extensions()) {
            doc.info[e.id()] = e.value();
        } 
        return doc;
    }

    private mapParameters(channel) {
        const parameters: OpenAPI.ParameterObject[] = [];
        for (const asyncApiParam of channel.parameters()) {
            if (asyncApiParam) {
                const asyncAPISchema = asyncApiParam.schema();
                const schemaType: OpenAPI.NonArraySchemaObjectType = (Array.isArray(asyncAPISchema.type()) ? asyncAPISchema.type()[0] : asyncAPISchema.type()) as OpenAPI.NonArraySchemaObjectType;
                const schema: OpenAPI.SchemaObject = {
                    type: schemaType,
                };
                const parameterObject: OpenAPI.ParameterObject = {
                    name: asyncApiParam.id(),
                    in: 'path',
                    required: true,
                    description: asyncApiParam.description() || '',
                    schema: {
                        type: 'string' // Simplified; real implementation would map the schema properly
                    }
                };
                parameters.push(parameterObject);
            }

        }
        return parameters;
    }

    private addStandardSchemas(oasDocument: OpenAPI.Document<{}>) {
        const generator = createGenerator({
            tsconfig: "./tsconfig.json",
            type: '*',
            path: './src/model/CallBackSubscription.ts',
        });
        const schema = generator.createSchema('*');

        oasDocument.components.schemas = (schema.definitions as any);

    }

}

export default new AsyncAPItoOASMapper();