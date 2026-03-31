# ep-openapi-callbacks

# ep-openapi-callbacks

A proof of concept to explore how OpenAPI 3.0 callbacks can be used to build event-driven interactions with the Solace broker, all while staying within the familiar world of REST APIs and OpenAPI tooling.

## Why OpenAPI Callbacks?
OpenAPI callbacks allow you to define asynchronous, out-of-band requests that a service can send to a client when certain events occur. It is a way to express webhooks directly in your OpenAPI spec. This is powerful because it lets developers use the same tools and workflows they already know to subscribe to events and receive notifications.

In the context of Solace, this means a developer can use a REST API to subscribe to topics by providing a callback URL (i.e., a webhook) that is invoked when relevant events are published. So, developers can dynamically configure subscriptions without needing knowledge of the broker.

## The Developer Experience
One of the things I wanted to test was how intuitive this would be for a developer who’s used to REST APIs. So, I built an API server that exposes endpoints for subscribing and unsubscribing to topics. Under the hood, it creates a REST Delivery Point (RDP) application in Solace Event Portal, associates the appropriate event flows, and pushes the RDP configuration to the broker once approved.
From the developer’s perspective, it’s just a matter of:
1.	Making a POST request to subscribe to a topic.
2.	Including a callback URL in the request.
3.	Watching their webhook get invoked when an event is published.
I tested this using Postman requests and its mock server feature, and it worked end-to-end. The moment I published a message to a subscribed topic, the mock server received the webhook call—no polling, no manual setup.

## Under the Covers: Event Portal Integration
What makes this approach particularly interesting is that it ties into Solace Event Portal. When a client subscribes to a topic, the API server:
•	Creates or updates an RDP application in Event Portal
•	Associates the relevant events and subscriptions to the application
•	Then applies the configuration to the broker via the Event Portal’s governance model.
This means all subscriptions are tracked, approved, and managed centrally; bringing the benefits of governed event API management to what would otherwise be a manual RDP setup on the broker.
## From AsyncAPI to OpenAPI
To make this work, I designed an event API product in Event Portal and downloaded the Event API Products’ AsyncAPI. Using a converter using a generator I created, I transformed the AsyncAPI spec into an OpenAPI spec that defines the callback behaviour. The converter preserves the Event Portal specific extensions in the AsyncAPI such as event and event version id, and event API product id – so when a client interacts with the API their requests can be associated with the Event Portal objects.
Once the spec was ready, I dropped it into the generic API server which works for any OpenAPI created using the converter. The server reads the spec, exposes the endpoints and validates incoming requests. It also handles the subscription logic creating all necessary objects in Event Portal. It’s a plug-and-play model: drop in a new OpenAPI file, restart the server, and you’re ready to go.
