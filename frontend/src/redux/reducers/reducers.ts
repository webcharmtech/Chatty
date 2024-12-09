import {
  TOGGLE_OVERVIEW,
  TOGGLE_MENU,
  SET_WS_CONNECTED,
  SET_CONNECTIONS,
  TOGGLE_CONNECTIONS,
  LOAD_PREVIOUS_MESSAGES,
  ADD_MESSAGE,
  SEND_MESSAGE,
  MARK_MESSAGE_VIEWED,
  TOGGLE_TIME_FILTER,
  SET_TIME_WINDOW,
  IToggleOverview,
  IToggleMenu,
  ISetWSConnected,
  ISetConnections,
  IToggleConnections,
  ILoadPreviousMessages,
  IAddMessage,
  ISendMessage,
  IMarkMessageViewed,
  IToggleTimeFilter,
  ISetTimeWindow,
} from '../actions/actions';
import { AUTH_LOGIN_SUCCESS, AUTH_LOGOUT, AuthActionTypes } from '../actions/authActions';
import { AppState } from '../actions/types';
import initialState from '../initialState';

type AppAction =
  | AuthActionTypes
  | IToggleOverview
  | IToggleMenu
  | ISetWSConnected
  | ISetConnections
  | IToggleConnections
  | ILoadPreviousMessages
  | IAddMessage
  | ISendMessage
  | IMarkMessageViewed
  | IToggleTimeFilter
  | ISetTimeWindow;

const rootReducer = (state = initialState, action: AppAction): AppState => {
  switch (action.type) {
    case SET_WS_CONNECTED: {
      const currentTimestamp = new Date();
      return {
        ...state,
        websockets: {
          ...state.websockets,
          isConnected: action.payload,
          lastConnectionsTimestamp: action.payload ? currentTimestamp.toLocaleString('en-GB', options) : '',
          lastConnectionsTimestampISO: action.payload ? currentTimestamp.toISOString() : '',
        },
      };
    }
    case SET_CONNECTIONS: {
      const currentTimestamp = new Date();
      return {
        ...state,
        websockets: {
          ...state.websockets,
          connections: action.payload ? action.payload : state.websockets.connections,
          lastConnectionsTimestamp: currentTimestamp.toLocaleString('en-GB', options),
          lastConnectionsTimestampISO: currentTimestamp.toISOString(),
        },
      };
    }
    case TOGGLE_CONNECTIONS:
      return {
        ...state,
        websockets: {
          ...state.websockets,
          showConnections: action.payload,
        },
      };

    // Authentication Actions
    case AUTH_LOGIN_SUCCESS:
      return {
        ...state,
        auth: {
          isAuthenticated: true,
          JWT: action.payload.JWT,
          username: action.payload.username,
        },
      };
    case AUTH_LOGOUT:
      return {
        ...state,
        auth: {
          isAuthenticated: false,
          JWT: null,
          username: null,
        },
      };

    case TOGGLE_OVERVIEW:
      return { ...state, mnu: { ...state.mnu, showOverview: action.payload } };
    case TOGGLE_MENU:
      return { ...state, mnu: { ...state.mnu, menuOpen: action.payload } };
    case TOGGLE_TIME_FILTER:
      return { ...state, mnu: { ...state.mnu, timeFilterVisible: action.payload } };
    case SET_TIME_WINDOW:
      return { ...state, mnu: { ...state.mnu, timeWindowDays: action.payload } };

    case LOAD_PREVIOUS_MESSAGES:
      return {
        ...state,
        msg: {
          ...state.msg,
          messages: [...action.payload],
        },
      };
    case SEND_MESSAGE:
      return {
        ...state,
        msg: {
          ...state.msg,
          lastSentMessage: action.payload,
        },
      };
    case ADD_MESSAGE:
      return {
        ...state,
        msg: {
          ...state.msg,
          messages: [
            {
              id: performance.now().toString(),
              content: action.payload.content,
              sender: action.payload.sender,
              timestamp: Date.now(),
              viewed: action.payload.sender === null,
            },
            ...state.msg.messages,
          ],
        },
      };
    case MARK_MESSAGE_VIEWED:
      return {
        ...state,
        msg: {
          ...state.msg,
          messages: state.msg.messages.map((message) => (message.id === action.payload ? { ...message, viewed: true } : message)),
        },
      };

    default:
      return state;
  }
};

const options: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
};

export default rootReducer;
