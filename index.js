const module_name = `Call Auto-Decline`;
const reconnectInterval = 5000;
function generateUUID() {
    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return uuid;
  }
  
const guildedClientId = generateUUID();
console.log(guildedClientId);  

//This is the data sent/received on calls.

// 1. Call is received.
// 42["ChatChannelBroadcastCall",{"type":"ChatChannelBroadcastCall","channelId":" channel id of the channel that called ","participants":[{"id":" participant id "}],"callStartTime":" startTime (example: 2023-10-25T23:42:14.887Z) ","callerName":" the caller's username ","callType":"voice"},null]

// 2. The sent call decline data. This is what's sent when you decline a call.
// 42["ChatChannelBroadcastCallResponse",{"response":"declined","channelId":" channel id of the channel that called ","callType":"voice","guildedClientId":" guildedClientId, a UUID4 "}]

// 3. The received call declined data. This is what's received when a call is declined. This'll stop the call on all clients.
// 42["ChatChannelBroadcastCallResponse",{"type":"ChatChannelBroadcastCallResponse","userId":" user who declined the call ","channelId":" channel id of the channel that called ","callType":"voice","response":"hangup"},null]

function sendHeartbeat() {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('2');
    } else {
      console.error(`${module_name}: WebSocket is not open for sending heartbeats`);
    }
  }

function connectWebSocket() {
    const cookies = document.cookie;
    ws = new WebSocket(`wss://www.guilded.gg/ws/?jwt=undefined&guildedClientId=${guildedClientId}&EIO=3&transport=websocket`, [], {
      headers: {
        Cookie: cookies
      }
    });
  
    ws.onopen = function open() {
      console.log(`${module_name}: WebSocket connection established`);
      sendHeartbeat();
    };
  
    ws.onmessage = function(event) {
      const data = event.data;
      if (data.startsWith('0[')) {
        try {
          const jsonData = JSON.parse(data.slice(1));
          const pingInterval = jsonData.pingInterval || 25000;
          clearInterval(heartbeatInterval); // Clear the previous interval
          heartbeatInterval = setInterval(sendHeartbeat, pingInterval);
        } catch (error) {
          console.error(`${module_name}: Error parsing initial message data:`, error);
        }
      } else if (data.startsWith('42[')) {
        try {
          const jsonData = JSON.parse(data.slice(2));
          if (jsonData[0] === 'ChatChannelBroadcastCall') {
            const response = {
              response: 'declined',
              channelId: jsonData[1].channelId,
              callType: jsonData[1].callType,
              guildedClientId: guildedClientId
            };
            const responseMessage = `42["ChatChannelBroadcastCallResponse",${JSON.stringify(response)}]`;
            ws.send(responseMessage);
            var allAudioElements = document.querySelectorAll('audio');
            allAudioElements.forEach(function(audio) {
              audio.pause(); // pause the audio first
              audio.remove(); // remove the audio element from the DOM
            });            
          }
        } catch (error) {
          console.error(`${module_name}: Error parsing message data:`, error);
        }
      }
    };
  
    ws.onerror = function(err) {
      console.error(`${module_name}: WebSocket error: `, err);
      reconnect();
    };
  
    ws.onclose = function() {
      console.log(`${module_name}: WebSocket connection closed`);
      reconnect();
    };
  
    function reconnect() {
      setTimeout(function() {
        console.log(`${module_name}: Attempting to reconnect...`);
        connectWebSocket();
      }, reconnectInterval);
    }
  }

module.exports = {
  init() {},
  load() {
    console.log(`${module_name}: Loaded`);
    const success = connectWebSocket();
    if (success === false) {
        this.unload()
    }
  },
  unload() {
    console.log(`${module_name}: Unloaded`);
    if (ws) {
      ws.onclose = function() {}; // Disable onclose handler to prevent reconnection
      ws.close();
    }
  }
};