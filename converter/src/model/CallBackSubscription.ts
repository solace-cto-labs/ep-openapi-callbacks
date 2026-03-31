export type SubscribeRequest = {
    callbackUrl: string;
    authenticationType: 'none' | 'http-basic' | 'http-header' | 'oauth-client';
    authenticationHttpBasicPassword?: string;
    authenticationHttpBasicUsername?: string;
    authenticationHttpHeaderName?: string;
    authenticationHttpHeaderValue?: string;
    authenticationOauthClientTokenEndpoint?: string;
    authenticationOauthClientId?: string;
    authenticationOauthClientSecret?: string;
    authenticationOauthClientScope?: string[];
};
export type SubscribeSuccessResponse = {
    subscriptionTopic: string;
    callbackId: string;
};
export type ErrorResponse = {
    message: string;
    errorId: string;
};
export type UnSubscribeSuccessResponse = {
    subscriptionTopic: string;
};
