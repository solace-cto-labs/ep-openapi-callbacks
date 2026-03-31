import { SubscribeRequest, SubscribeSuccessResponse, UnSubscribeSuccessResponse } from 'converter';
import type { OpenAPIV3_1 as OpenAPI } from '@scalar/openapi-types';
import { isJson, isYaml } from '@scalar/openapi-parser';
import epclient from './epclient.js';
import fs from 'fs'
import path from 'path';
import yaml from 'js-yaml'
import { Md5 } from 'ts-md5';
import _ from 'lodash'

// todo clean this up
const apiSpec = path.join(import.meta.dirname, '../common/api.yml');

class SubscriptionManager {
    private api: OpenAPI.Document<{}>;
    private paths: Record<string, OpenAPI.PathItemObject> = {};

    constructor() {
        let jsonApiSpec = fs.readFileSync(apiSpec, 'utf8');
        if (isYaml(jsonApiSpec)) {
            this.api = yaml.load(jsonApiSpec);
        } else if (isJson(jsonApiSpec)) {
            this.api = JSON.parse(jsonApiSpec) as OpenAPI.Document<{}>;
        }
        for (const path in this.api.paths) {
            let regexpath = path.replace('/', '\/');
            regexpath = regexpath.replace(/\{[^\/]*\}(?!$)/gi, ".*");
            this.paths[regexpath] = this.api.paths[path];
        }
    }

    public async subscribe(request: SubscribeRequest, path: string): Promise<SubscribeSuccessResponse> {
        const oasPath = this.getOASPathObject(path);
        const oasPathKey = this.getOASPathKey(path);
        const topic = this.pathToTopic(path);
        // Handle subscription logic here
        const callbacks = Object.values(oasPath.post?.callbacks) as OpenAPI.CallbackObject[];
        const theCallback = callbacks.find(callback => {
            return Object.entries(callback).find(([key, value]) => {
                const regex = new RegExp(this.pathToTopic(oasPathKey));
                return regex.test(value.post.operationId);
            })
        });
        if (theCallback){
            const apiProductId = this.api.info['x-ep-event-api-product-id'];
            const post = Object.values(theCallback)[0].post;
            console.log(post['x-ep-event-version-id']);
            console.log(post['x-ep-application-domain-id']);
            const app = await epclient.upsertApplicationVersion(post['x-ep-application-domain-id'], post['x-ep-event-version-id'], topic, apiProductId, request);
            // apply configuration
            const deployResponse = await epclient.deploy(app, apiProductId);
        }

        return {
            subscriptionTopic: topic,
            callbackId: Md5.hashStr(request.callbackUrl)
        };
    }
    getOASPathObject(path: string): OpenAPI.PathItemObject {
        return Object.entries(this.paths).find(([key, value]) => {
            const regex = new RegExp(key);
            return regex.test(path);
        })[1];
    }
    getOASPathKey(path: string): string {
        return Object.keys(this.paths).find(key => {
            const regex = new RegExp(key);
            return regex.test(path);
        });
    }

    public async unsubscribe( path: string, callbackId: string): Promise<UnSubscribeSuccessResponse> {
        const oasPath = this.getOASPathObject(path);
        const oasPathKey = this.getOASPathKey(path);
        const topic = this.pathToTopic(path);
        // Handle subscription logic here
        const callbacks = Object.values(oasPath.post?.callbacks) as OpenAPI.CallbackObject[];
        const theCallback = callbacks.find(callback => {
            return Object.entries(callback).find(([key, value]) => {
                const regex = new RegExp(this.pathToTopic(oasPathKey));
                return regex.test(value.post.operationId);
            })
        });
        if (theCallback){
            const post = Object.values(theCallback)[0].post;
            console.log(post['x-ep-event-version-id']);
            console.log(post['x-ep-application-domain-id']);
            const apiProductId = this.api.info['x-ep-event-api-product-id'];
            const app = await epclient.updateApplicationVersionRemoveSubscription(post['x-ep-event-version-id'], topic, apiProductId, callbackId);
            // apply configuration
            const deployResponse = await epclient.deploy(app, apiProductId);
        }
        return {
            subscriptionTopic: topic,
        };
    }


    private pathToTopic(path: string) {
        let topic = path.startsWith('/') ? path.substring(1) : path;
        const qsIndex = topic.indexOf('?');
        if (qsIndex != -1) {
            topic = topic.substring(0, qsIndex);
        }
        return topic;
    }

}

export default new SubscriptionManager();