import { connect, ConnectedProps } from 'react-redux';
import { Component } from 'react';
import { RootState } from '../redux/store/store';
import { setWSConnected, setConnections, toggleConnections, loadPreviousMessages, addMessage } from '../redux/actions/actions';
import { Network } from 'lucide-react';
import appConfigData from '../appConfig.json';
import { IConnection, INewMessage } from 'redux/actions/types';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type Props = ConnectedProps<typeof connector>;
class WebSocketService extends Component<Props> {
  private webSocket: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private reconnectAttempts = 0;
  private reconnectDelay = 1000;

  async componentDidMount() {
    try {
      this.logFormatted(
        `wsConnected: ${this.props.wsConnected} , JWT: ${this.props.JWT?.substring(0, 10)} ` +
          this.props.connections.map((conn: IConnection) => conn.username).join(', ')
      );

      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    } catch (err) {
      console.error('Error initializing WebSocket service:', err);
      this.props.setWSConnected(false);
    }
  }

  // Handle change from hidden to visible:
  handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (this.props.wsConnected) {
        try {
          // Ping the websocket server:
          this.webSocket?.send(
            JSON.stringify({
              action: 'SendMessage',
              data: { ping: true },
            })
          );
          // Wait for a response for few seconds. If this.props.lastConnectionsTimestampISO didn't change (i.e. not response was received), invalidate the connection (i.e. cause the client to reconnect).
          const MAX_TIME_TO_WAIT_FOR_PING_RESPONSE_MS = 5000;
          const LAST_CONNECTIONS_TIMESTAMP_ISO = this.props.lastConnectionsTimestampISO;
          setTimeout(() => {
            if (this.props.lastConnectionsTimestampISO === LAST_CONNECTIONS_TIMESTAMP_ISO) {
              console.warn('No response to ping, setWSConnected --> false ...');
              this.props.setWSConnected(false);
            }
          }, MAX_TIME_TO_WAIT_FOR_PING_RESPONSE_MS);
        } catch (error) {
          toast.error(`Failed to send a message to the websocket server: ${error}`);
          this.props.setWSConnected(false);
        }
      }
    }
  };

  componentDidUpdate(prevProps: Props) {
    this.logFormatted(
      `wsConnected: ${this.props.wsConnected} , prev: ${prevProps.wsConnected}, jwt: ${this.props.JWT?.substring(
        0,
        10
      )}, prev: ${prevProps.JWT?.substring(0, 10)} , connected users: ` + this.props.connections.map((conn: IConnection) => conn.username).join(', ')
    );
    // this.props.addMessage({ content: `this.props.lastConnectionsTimestamp: ${this.props.lastConnectionsTimestamp}`, sender: 'componentDidUpdate', });

    if (!this.props.wsConnected || this.props.JWT !== prevProps.JWT) this.connect();
    else if (!this.props.wsConnected && prevProps.wsConnected) this.closeConnection();

    // If this is a new message, send it to websocket:
    if (this.props.lastSentMessage && this.props.lastSentMessage !== prevProps.lastSentMessage) {
      const message = this.props.lastSentMessage;
      this.props.addMessage({ content: message, sender: null });
      try {
        this.webSocket?.send(
          JSON.stringify({
            action: 'SendMessage',
            data: { message },
          })
        );
      } catch (error) {
        toast.error(`Failed to send a message to the websocket server: ${error}`);
      }
    }
  }

  componentWillUnmount() {
    this.cleanup();
  }

  private logFormatted(message: string) {
    // console.log(`${new Date().toLocaleTimeString()} : ${message}`);
  }

  private async connect(): Promise<void> {
    if (!this.props.chatId) console.error("'chatId' is mandatory in the query string");
    else {
      const url = `${appConfigData.WEBSOCKET_API_URL}?token=${this.props.JWT}&chatId=${this.props.chatId}`;

      // Reset the previous connection (if opened):
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this.closeConnection();

      // Introduce a delay of 100 milliseconds before proceeding with the next line of code
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Open the new connection:
      this.logFormatted(`Creating WebSocket connection with URL: ${url}`);
      this.webSocket = new WebSocket(url);

      this.webSocket.onopen = () => {
        this.logFormatted('** WebSocket connection opened **');
        this.props.setWSConnected(true);
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.webSocket.onclose = (event) => {
        this.logFormatted(`** WebSocket connection closed **: ${JSON.stringify(event)}`);
        this.props.setWSConnected(false);

        if (event.code === 1006 && ++this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.logFormatted(`Attempting to reconnect in ${this.reconnectDelay / 1000} seconds...`);
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectDelay *= 2;
            this.props.setWSConnected(true);
          }, this.reconnectDelay);
        } else if (event.isTrusted && ++this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectTimeout = setTimeout(() => {
            this.logFormatted('Attempting to reconnect...');
            this.props.setWSConnected(true);
          }, 1000);
        } else {
          this.logFormatted('Maximum reconnection attempts reached or manual closure.');
        }
      };

      this.webSocket.onmessage = (event) => {
        const messageData = JSON.parse(event.data);
        if (messageData.previousMessages) {
          // Added functionality on $connect to load and send to the client previous chat messages and active connections.
          this.props.loadPreviousMessages(messageData.previousMessages);
          this.props.setConnections(messageData.connections);
        } else if (messageData.connections) {
          this.props.setConnections(messageData.connections);
        } else if (messageData.ping) {
          this.props.setConnections(null);
        } else {
          const newMessage: INewMessage = messageData;
          this.props.addMessage(newMessage);
          if (newMessage.sender !== '$connect' && !newMessage.sender?.includes('AWS::Events::Rule'))
            toast(`${newMessage.content} , from ${newMessage.sender}`, { autoClose: Math.max(Math.min(newMessage.content.length * 75, 4000), 2000) });
          // notify(`${messageData.content}, from: ${messageData}`);
        }
      };

      this.webSocket.onerror = (error) => {
        console.error('** WebSocket error: **', error);
        this.props.setWSConnected(false);
      };
    }
  }

  private closeConnection(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
      this.props.setWSConnected(false);
    }
  }

  private cleanup(): void {
    this.closeConnection();
  }

  render() {
    return (
      <div
        title={this.props.wsConnected ? `Connected, last connections update on ${this.props.lastConnectionsTimestamp}` : 'Disconnected'}
        onClick={() => this.props.toggleConnections(!this.props.showConnections)}>
        <div className='network-container'>
          <div className='left-column'>
            <Network size={20} className={`network-icon ${this.props.wsConnected ? 'connected' : 'disconnected'}`} />
            <span className='last-connections-timestamp'>{this.props.lastConnectionsTimestamp}</span>
          </div>
          <ul className='right-column'>
            {this.props.connections &&
              this.props.showConnections &&
              this.props.connections.map((item: IConnection) => (
                <li key={item.connectionId} className='username'>
                  {item.username}
                </li>
              ))}
          </ul>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  isAuthenticated: state.auth.isAuthenticated,
  JWT: state.auth.JWT,
  wsConnected: state.websockets.isConnected,
  connections: state.websockets.connections,
  showConnections: state.websockets.showConnections,
  lastConnectionsTimestamp: state.websockets.lastConnectionsTimestamp,
  lastConnectionsTimestampISO: state.websockets.lastConnectionsTimestampISO,
  chatId: state.msg.chatId,
  lastSentMessage: state.msg.lastSentMessage,
});

const mapDispatchToProps = {
  setWSConnected,
  setConnections,
  toggleConnections,
  loadPreviousMessages,
  addMessage,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(WebSocketService);
