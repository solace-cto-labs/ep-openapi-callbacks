import _ from 'lodash';
import { Md5 } from 'ts-md5';
import { SubscribeRequest } from 'converter';


type EPApplicationResponse = {
    id: string;
    numberofVersions: number;
    name: string;
}

type ApplicationDetails = {
    id: string;
    versionId: string;
}

type EPApiProduct = {
    id: string;
    plans: {
        id: string;
        solaceClassOfServicePolicy: {
            messageDeliveryMode: string,
            accessType: string,
            maximumTimeToLive: number,
            maxMsgSpoolUsage: number
        }
    }[];
    solaceMessagingServices: string[];
}

class EPClient {
    private token: string = process.env.EP_API_TOKEN;

    private TPL_APP_CREATE = {
        applicationType: "restDeliveryPoint",
        name: "myrdp",
        applicationDomainId: "ld40740pkjj",
        customAttributes: [],
        brokerType: "solace",
        customColour: "",
        customIcon: "webhook",
        customLogo: null
    }

    private TPL_APP_VERSION_CREATE = {
        applicationId: "111",
        version: "1.0.0",
        description: "Initial version",
        declaredConsumedEventVersionIds: []
    }

    private TPL_APP_VERSION_MESSAGINGSERVICES_PUT = {
        messagingServiceIds: []
    }

    private TPL_APP_VERSION_CONSUMERS_POST = {
        subscriptions: [
            {
                subscriptionType: "topic",
                value: "retail/v1/orders/123123/CUSTOMER_REVIEW_REQUIRED"
            }
        ],
        name: "q/04a66f958699668968598d27a857044d",
        applicationVersionId: "1o6yj2oaftm",
        consumerType: "eventQueue",
        brokerType: "solace",
    }

    private TPL_APP_VERSION_CONFIG_PUT = {
        configurations:
            [
                {
                    configurationTypeId: "solaceRestDeliveryPoint",
                    value:
                    {
                        restConsumers: [{
                            restConsumerConfiguration: {
                                authenticationScheme: "none", remoteHost: "myserver", remotePort: 8080,
                                tlsEnabled: true, httpMethod: "post"
                            }
                        }],
                        restDeliveryPointConfiguration: { restDeliveryPointName: "04a66f958699668968598d27a857044d" }
                    }, entityType: "applicationVersion",
                    refreshResolvedValue: false, workInProgress: false, contextId: "28esvpzef90"
                },
                {
                    configurationTypeId: "solaceClientProfileName", value: { clientProfileName: "default" }, entityType: "applicationVersion", refreshResolvedValue: false,
                    workInProgress: false, contextId: "28esvpzef90"
                }],
        declaredProducedEventVersionIds: [],
        declaredConsumedEventVersionIds: ["zdyjmog11gf"],
        inboundApplicationVersionAssociations: [],
        outboundApplicationVersionAssociations: [],
        id: "1o6yj2oaftm",
        stateId: "1",
        version: "",
        consumers: [{
            name: "q/04a66f958699668968598d27a857044d", consumerType: "eventQueue", subscriptions:
                [{ subscriptionType: "topic", value: "retail/v1/orders/*/CUSTOMER_ACCEPTANCE_REQUIRED" }],
            brokerType: "solace",
            configurations: [{
                configurationTypeId: "solaceQueue", value: {
                    accessType: "exclusive", maxMsgSpoolUsage: 500,
                    queueName: "q/04a66f958699668968598d27a857044d"
                }, entityType: "consumer", refreshResolvedValue: false,
                workInProgress: false, contextId: "28esvpzef90"
            },
            {
                configurationTypeId: "solaceRestDeliveryPointQueueBinding", value: {
                    queueBindingConfiguration:
                        { postRequestTarget: "/my/callback", requestTargetEvaluation: "none" }, requestHeaders: [],
                    protectedRequestHeaders: []
                }, entityType: "consumer", refreshResolvedValue: false, workInProgress: false,
                contextId: "28esvpzef90"
            }],
            id: "qkxfyfcyara"
        }]
    }

    private TPL_APP_DEPLOY = {
        action: "deploy",
        applicationVersionId: "2",
        eventBrokerId: "1"
    };


    constructor() {
        this.token = process.env.EP_API_TOKEN || '';
    }

    private getToken(): string {
        return (this.token && this.token != '') ? this.token : process.env.EP_API_TOKEN;
    }

    public async upsertApplicationVersion(applicationDomainId: string, eventVersionId: string, topic: string, apiProductId: string, request: SubscribeRequest): Promise<ApplicationDetails> {
        const sanitisedAppName = Md5.hashStr(request.callbackUrl);
        const appResponse = await this.upsertApplication(applicationDomainId, sanitisedAppName);
        const appVersionId = await this.createApplicationVersionInternal(appResponse, eventVersionId, topic, apiProductId, request);
        const apiProduct = await this.getEventAPIProduct(apiProductId);

        const retVal: ApplicationDetails = {
            id: appResponse.id,
            versionId: appVersionId,
        };
        return retVal
    }

    public async updateApplicationVersionRemoveSubscription(eventVersionId: string, topic: string, apiProductId: string, callbackId: string): Promise<ApplicationDetails> {
        const apiPath = `api/v2/architecture/applications?name=${callbackId}`;

        const response = await this.sendAPICall('GET', apiPath);

        if (response.status == 200) {
            const appResponse = {
                id: response.data[0].id,
                numberofVersions: response.data[0].numberOfVersions,
                name: response.data[0].name
            }

            const versionId = await this.createApplicationVersionInternal(appResponse, eventVersionId, topic, apiProductId, null);
            return {
                id: appResponse.id,
                versionId: versionId
            }
        } else return null;
    }

    public async deploy(appIds: ApplicationDetails, apiProductId: string): Promise<void> {
        const apiPath = `api/v2/architecture/runtimeManagement/applicationDeployments`;
        const apiProduct = await this.getEventAPIProduct(apiProductId);
        const requestBody = _.cloneDeep(this.TPL_APP_DEPLOY);
        requestBody.applicationVersionId = appIds.versionId;
        for (const brokerId of apiProduct.solaceMessagingServices) {
            requestBody.eventBrokerId = brokerId;
            await this.sendAPICallWithBody('POST', apiPath, requestBody);
        }
    }

    private async createApplicationVersionInternal(appResponse: EPApplicationResponse, eventVersionId: string, topic: string, apiProductId: string, request: SubscribeRequest): Promise<string> {
        const apiProduct = await this.getEventAPIProduct(apiProductId);

        let applicationVersion = null;
        const applicationVersionSemVer = `1.0.0`;
        if (appResponse.numberofVersions == 0 && request) {

            const applicationVersionData = _.cloneDeep(this.TPL_APP_VERSION_CREATE);
            applicationVersionData.applicationId = appResponse.id;
            applicationVersionData.version = applicationVersionSemVer;
            applicationVersionData.declaredConsumedEventVersionIds = [eventVersionId];
            applicationVersionData.description = `Version for callback URL ${request.callbackUrl}`;
            applicationVersion = (await this.sendAPICallWithBody('POST', `api/v2/architecture/applicationVersions`, applicationVersionData)).data;
        } else {
            applicationVersion = (await this.sendAPICall('GET', `api/v2/architecture/applicationVersions?applicationIds=${appResponse.id}`)).data[0];

        }
        if (!applicationVersion) {
            return null;
        }
        let applicationVersionId = applicationVersion.id;
        // check if already subscribed, return
        if (request && (applicationVersion.consumers.length == 0 || applicationVersion.consumers[0].subscriptions?.length == 0 ||
            applicationVersion.consumers[0].subscriptions?.find(subscription => subscription.value == topic) === undefined)
        ) {
            const declaredConsumedEventVersionIds = applicationVersion.declaredConsumedEventVersionIds.concat(eventVersionId);
            const patch = {
                declaredConsumedEventVersionIds: declaredConsumedEventVersionIds,
                applicationId: appResponse.id,
                version: applicationVersionSemVer
            }
            applicationVersion = (await this.sendAPICallWithBody('PATCH', `api/v2/architecture/applicationVersions/${applicationVersionId}`, patch)).data;
            await this.updateApplicationVersion(apiProduct, applicationVersionId, topic, request, declaredConsumedEventVersionIds, applicationVersionSemVer, appResponse);
        } else if (applicationVersion.consumers.length > 0 && applicationVersion.consumers[0].subscriptions?.length > 0
            && applicationVersion.consumers[0].subscriptions?.find(subscription => subscription.value == topic)
        ) {
            const declaredConsumedEventVersionIds = applicationVersion.declaredConsumedEventVersionIds.filter(id => id != eventVersionId);


            const patch = {
                declaredConsumedEventVersionIds: declaredConsumedEventVersionIds,
                applicationId: appResponse.id,
                version: applicationVersionSemVer
            }
            applicationVersion = (await this.sendAPICallWithBody('PATCH', `api/v2/architecture/applicationVersions/${applicationVersionId}`, patch)).data;

            await this.updateApplicationVersion(apiProduct, applicationVersionId, topic, request, declaredConsumedEventVersionIds, applicationVersionSemVer, appResponse);
        }

        return applicationVersionId;
    }

    private async updateApplicationVersion(apiProduct: any, applicationVersionId: any, topic: string, request: SubscribeRequest, declaredConsumedEventVersionIds: string[], applicationVersionSemVer: string, appResponse: EPApplicationResponse) {
        const messagingServiceData = _.cloneDeep(this.TPL_APP_VERSION_MESSAGINGSERVICES_PUT);
        messagingServiceData.messagingServiceIds.push(apiProduct.solaceMessagingServices[0]);
        await this.sendAPICallWithBody('PUT', `api/v2/architecture/applicationVersions/${applicationVersionId}/messagingServices`, messagingServiceData);

        // create the consumer
        const consumers = (await this.sendAPICall('GET', `api/v2/architecture/consumers?applicationVersionIds=${applicationVersionId}`));
        let consumer = null;
        if (request && consumers?.data.length == 0) {
            const consumerData = _.cloneDeep(this.TPL_APP_VERSION_CONSUMERS_POST);
            consumerData.subscriptions[0].value = topic;
            consumerData.applicationVersionId = applicationVersionId;
            consumerData.name = `c-${Md5.hashStr(request.callbackUrl)}`;
            consumer = (await this.sendAPICallWithBody('POST', `api/v2/architecture/consumers`, consumerData)).data;
        } else if (request) {
            const subscriptions = consumers.data[0].subscriptions;
            subscriptions.push({
                subscriptionType: "topic",
                value: topic
            });
            const updatedConsumerData = {
                applicationVersionId: applicationVersionId,
                subscriptions: subscriptions

            };
            consumer = (await this.sendAPICallWithBody('PATCH', `api/v2/architecture/consumers/${consumers.data[0].id}`, updatedConsumerData)).data;
        } else if (!request) {
            const updatedConsumerData = {
                applicationVersionId: applicationVersionId,
                subscriptions: consumers.data[0].subscriptions.filter(subscription => subscription.value != topic)

            };

            consumer = (await this.sendAPICallWithBody('PATCH', `api/v2/architecture/consumers/${consumers.data[0].id}`, updatedConsumerData)).data;
        }
        const consumerId = consumer.id;
        const subscriptions = consumer.subscriptions;


        // create or update the application version configuration
        const applicationName = Md5.hashStr(appResponse.name);
        const applicationVersionConfiguration = _.cloneDeep(this.TPL_APP_VERSION_CONFIG_PUT);
        // configurations
        if (request) {
            applicationVersionConfiguration.configurations[0].value.restDeliveryPointConfiguration.restDeliveryPointName = `rdp-${applicationName}`;
            applicationVersionConfiguration.configurations[0].value.restConsumers[0].restConsumerConfiguration.remoteHost = new URL(request.callbackUrl).hostname;
            applicationVersionConfiguration.configurations[0].value.restConsumers[0].restConsumerConfiguration.remotePort = Number(new URL(request.callbackUrl).port) || (new URL(request.callbackUrl).protocol === 'https:' ? 443 : 80);
            applicationVersionConfiguration.configurations[0].value.restConsumers[0].restConsumerConfiguration.tlsEnabled = new URL(request.callbackUrl).protocol === 'https:';
            applicationVersionConfiguration.configurations[0].contextId = apiProduct.solaceMessagingServices[0];
            applicationVersionConfiguration.configurations[1].contextId = apiProduct.solaceMessagingServices[0];
        } else {
            delete applicationVersionConfiguration.configurations;
        }
        // consumers
        applicationVersionConfiguration.consumers[0].name = `c-${applicationName}`;
        applicationVersionConfiguration.consumers[0].id = consumerId;
        applicationVersionConfiguration.consumers[0].subscriptions = subscriptions;
        if (request) {
            applicationVersionConfiguration.consumers[0].configurations[0].value.queueName = `q-${applicationName}`;
            applicationVersionConfiguration.consumers[0].configurations[0].contextId = apiProduct.solaceMessagingServices[0];
            applicationVersionConfiguration.consumers[0].configurations[1].contextId = apiProduct.solaceMessagingServices[0];
            applicationVersionConfiguration.consumers[0].configurations[1].value.queueBindingConfiguration.postRequestTarget = new URL(request.callbackUrl).pathname;
        } else {
            delete applicationVersionConfiguration.consumers[0].configurations;
        }

        // set other properties
        applicationVersionConfiguration.declaredConsumedEventVersionIds = declaredConsumedEventVersionIds;
        applicationVersionConfiguration.id = applicationVersionId;
        applicationVersionConfiguration.version = applicationVersionSemVer;
        const response = (await this.sendAPICallWithBody('PUT', `api/v2/architecture/ui/applications/${appResponse.id}/versions/${applicationVersionId}`, applicationVersionConfiguration));
    }

    private async sendAPICallWithBody(method: string, apiPath: string, body: any): Promise<any> {
        const response = await fetch(`${process.env.AP_API_BASE_URL}/${apiPath}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const responseBody = await response.json();
        console.log(responseBody)
        return responseBody;
    }

    private async sendAPICall(method: string, apiPath: string): Promise<any> {
        const response = await fetch(`${process.env.AP_API_BASE_URL}/${apiPath}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
                'Content-Type': 'application/json'
            }
        });
        const responseBody = await response.json();
        console.log(responseBody)
        return responseBody;
    }

    private async getEventAPIProduct(apiProductId: string): Promise<any> {
        const apiPath = `api/v2/apim/eventApiProducts/${apiProductId}`;
        const apiProduct = await this.sendAPICall('GET', apiPath);

        const mappedApiProduct: EPApiProduct = {
            id: apiProduct.data.id,
            plans: apiProduct.data.plans,
            solaceMessagingServices: apiProduct.data.solaceMessagingServices.map((sms: any) => sms.messagingServiceId)
        };
        return mappedApiProduct;
    }

    private async upsertApplication(applicationDomainId: string, sanitisedAppName: any): Promise<EPApplicationResponse> {
        const applicationData = _.cloneDeep(this.TPL_APP_CREATE);
        applicationData.applicationDomainId = applicationDomainId;
        applicationData.name = sanitisedAppName;
        const apiPath = `api/v2/architecture/applications?name=${sanitisedAppName}`;
        console.log(`Bearer ${this.getToken()}`);
        //does the app exist?
        const getResponse = await this.sendAPICall('GET', apiPath);

        if (getResponse.status > 299 || getResponse.meta.pagination.count == 0) {
            console.log(`Failed to find Application: ${getResponse.meta.pagination.count} ${getResponse.status}`);
            const response = await this.sendAPICallWithBody('POST', apiPath, applicationData);

            if (response.status > 299) {
                throw new Error(`Failed to create Application: ${response.status} - ${await response.text()}`);
            } else {
                
                return {
                    id: response.data.id,
                    numberofVersions: response.data.numberOfVersions,
                    name: response.data.name
                }
            }
        } else {
            return {
                id: getResponse.data[0].id,
                numberofVersions: getResponse.data[0].numberOfVersions,
                name: getResponse.data[0].name
            };
        }
    }
}

export default new EPClient();