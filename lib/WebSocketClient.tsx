import * as React from 'react';
import {Component} from 'react';
import * as _ from "lodash";
import * as Stomp from 'stompjs';
import * as SockJS from 'sockjs-client';

export interface WebSocketProps {
    endpoint: string;
    topics: any[];
    publish: any;
    options?: any;
    stompHeaders: any,
    stompSubscribeHeaders?: any,
    autoReconnect: boolean;
    heartbeat: number;
    maxReconnects?: number;
    heartbeatIncoming?: number;
    heartbeatOutgoing?: number;

    onConnect();
    onDisconnect();
    onMessage(object, topic);
}

export interface WebSocketState {
    connected: boolean;
    webSocket: any;
    timeStamp: number;
    maxReconnects: number;
}

const getRetryInterval = (count) => {return 1000 * count;};

export class WebSocketClient extends Component<WebSocketProps, WebSocketState> {

    subscriptions: any;
    retryCount: number;
    timeOutId: any;

    constructor(props) {
        super(props);

        this.subscriptions = new Map();
        this.retryCount = 0;
    }

    componentWillMount() {
        this.setState({connected: false});
        const {endpoint, options, heartbeat, heartbeatIncoming, heartbeatOutgoing} = this.props;
        const socket = new SockJS(endpoint, null, options && options);
        const ws = Stomp.over(socket);

        if (heartbeat) {
            ws.heartbeat.outgoing = heartbeat;
            ws.heartbeat.incoming = heartbeat;
        }
        if (heartbeatIncoming) {
            ws.heartbeat.incoming = heartbeatIncoming;
        }
        if (heartbeatOutgoing) {
            ws.heartbeat.outgoing = heartbeatOutgoing;
        }

            this.setState({
            webSocket: ws,
            timeStamp: Date.now(),
            maxReconnects:1
        })
    }

    componentDidMount() {
        this.setupWebSocket();
    }

    componentWillReceiveProps(nextProps) {
        const {topics} = this.props;
        const {connected} = this.state;
        if (connected) {

            // Subscribe to new topics
            _.difference(nextProps.topics, topics)
                .forEach((newTopic) => {
                    this.subscribe(newTopic);
                });

            // Unsubscribe from old topics
            _.difference(topics, nextProps.topics)
                .forEach((oldTopic) => {
                    this.unsubscribe(oldTopic);
                });
        }
    }

    componentWillUnmount() {
        this.disconnect();
    }

    setupWebSocket = () => {
        const {stompHeaders, onConnect, onDisconnect, autoReconnect} = this.props;
        const {webSocket} = this.state;
        webSocket.connect(stompHeaders, () => {
            this.setState({connected: true});
            this.connect();
            onConnect();
        }, error => {
            if (this.state.connected) {
                this.cleanUp();
                onDisconnect();
            }
            if (autoReconnect) {
                this.timeOutId = setTimeout(this.connect, getRetryInterval(this.retryCount++))
            }
            });
        webSocket.message = (body) => this.setState({ timeStamp: Date.now()});
        webSocket.error = (err) => {
            if (this.state.maxReconnects > 0) {
                this.setState({ maxReconnects: this.state.maxReconnects - 1 }, this.connect);
            }
        };
    };

    connect = () => {
        const {topics, maxReconnects, publish} = this.props;
        maxReconnects && this.setState({maxReconnects});

        topics.forEach((topic) => {
            const webSocket = this.state.webSocket;
            this.subscribe(topic);
            webSocket.send(publish, { timeStamp: this.state.timeStamp.toString() }, 'timeStamp');
        });
    };

    disconnect = () => {
        const {onDisconnect} = this.props;
        const {connected, webSocket} = this.state;

        if (this.timeOutId) {
            clearTimeout(this.timeOutId);
        }
        if (connected) {
            this.subscriptions.forEach((subid, topic) => {
                this.unsubscribe(topic);
            });
            webSocket.disconnect(() => {
                this.cleanUp();
                onDisconnect();
            });
        }
    };

    subscribe = (topic) => {
        const {webSocket} = this.state;
        const {onMessage, stompSubscribeHeaders} = this.props;

        if (!this.subscriptions.has(topic)) {
            let sub = webSocket.subscribe(topic, (msg) => {
                onMessage(JSON.parse(msg.body), topic);
            }, stompSubscribeHeaders && _.slice(stompSubscribeHeaders));
            this.subscriptions.set(topic, sub);
        }
    };

    unsubscribe = (topic) => {
        let sub = this.subscriptions.get(topic);
        sub.unsubscribe();
        this.subscriptions.delete(topic);
    };

    cleanUp = () => {
        this.setState({ connected: false });
        this.retryCount = 0;
        this.subscriptions.clear();
    };

    public sendMessage = (topic, msg, opt_headers = {}) => {
        const {connected, webSocket} = this.state;
        if (connected) {
            webSocket.send(topic, opt_headers, msg);
        } else {
            console.error("Send error: SockJsClient is disconnected");
        }
    };

    render() {
        return <span />;
    }
}

