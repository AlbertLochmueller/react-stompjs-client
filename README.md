# react-stompjs-client
Lightweight websocket client for react SPAs based on typescript, sockJS & stompJS

### Usage
````shell
import * as React from 'react';
import WebSocketClient from 'react-stompjs-client';

export const WebSocketWrapper = (props) => (
    <WebSocketClient {...props}>
        <div>Hello World</div>
    </WebSocketClient>
);

````

