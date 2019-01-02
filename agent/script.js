
const clientId = "1db38a1e-2398-4435-91f6-d51493e17e23";
const redirectUri = window.location.href;
console.log(window.location.href);

// Set PureCloud Objects
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const notificationsApi = new platformClient.NotificationsApi();
const presenceApi = new platformClient.PresenceApi();
const usersApi = new platformClient.UsersApi();
const conversationsApi = new platformClient.ConversationsApi();

// Set PureCloud Settings
client.setEnvironment('mypurecloud.ie');
client.setPersistSettings(true, 'test_app');

// Local Variables
let presences = {};
let userPresenceTopic = '', userConversationsTopic = '';
let webSocket = null;
let me, notificationChannel;

$(document).ready(() => {
  // Authenticate with PureCloud
  client.loginImplicitGrant(clientId, redirectUri)
    .then(() => {
      console.log('Logged in');

      // Get presences
      return presenceApi.getPresencedefinitions({ pageSize: 100 });
    })
    .then((presenceListing) => {
      console.log(`Found ${presenceListing.entities.length} presences`);

      // Create button for each presence
      presenceListing.entities.forEach((presence) => {
        presences[presence.id] = presence;
        $('div#presenceButtons').append($('<button>')
          .addClass('btn btn-primary')
          .click(() => setPresence(presence.id))
          .text(presence.languageLabels.en_US)
        );
      });

      // Get authenticated user's data, including current presence
      return usersApi.getUsersMe({ expand: ['presence'] });
    })
    .then((userMe) => {
      me = userMe;

      // Set current presence text in UI
      $('#currentPresence').text(presences[me.presence.presenceDefinition.id].languageLabels.en_US);

      // Create notification channel
      return notificationsApi.postNotificationsChannels();
    })
    .then((channel) => {
      console.log('channel: ', channel);
      notificationChannel = channel;

      // Set up web socket
      webSocket = new WebSocket(notificationChannel.connectUri);
      webSocket.onmessage = handleNotification;

      // Subscribe to authenticated user's presence & conversations
      userPresenceTopic = `v2.users.${me.id}.presence`;
      userConversationsTopic = `v2.users.${me.id}.conversations`;
      const body = [
        { id: userPresenceTopic },
        { id: userConversationsTopic }
      ];
      return notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, body);
    })
    .then((channel) => {
      console.log('Channel subscriptions set successfully:', channel);
    })
    .catch(console.error);
});

function setPresence(presenceId) {
  console.log(`Setting presence to ${presences[presenceId].languageLabels.en_US} (${presenceId})`);

  // Set presence
  presenceApi.patchUserPresence(me.id, 'PURECLOUD', { presenceDefinition: { id: presenceId } })
    .then(() => {
      console.log('Presence set successfully');
    })
    .catch(console.error);
}

// Handle incoming PureCloud notification from WebSocket
function handleNotification(message) {
  // Parse notification string to a JSON object
  const notification = JSON.parse(message.data);

  // Discard unwanted notifications
  if (notification.topicName.toLowerCase() === 'channel.metadata') {
    // Heartbeat
    return;
  } else if (notification.topicName.toLowerCase() == userPresenceTopic.toLowerCase()) {
    // User Presence Notification
    console.debug('User Presence Notification: ', notification);
    // Set current presence text in UI
    $('#currentPresence').text(presences[notification.eventBody.presenceDefinition.id].languageLabels.en_US);
    return;
  } else if (notification.topicName.toLowerCase() == userConversationsTopic.toLowerCase()) {
    // User Conversations Notification
    console.debug('User Conversations Notification: ', notification);

    // Get agent participant
    $.each(notification.eventBody.participants, (i, participant) => {
      if (participant.purpose == "agent" && !participant.endTime) {
        if (participant.chats[0].state !== "connected") {
          // Set conversation to connected
          let conversationId = notification.eventBody.id;
          let participantId = participant.id;
          conversationsApi.patchConversationsChatParticipant(conversationId, participantId, { state: "CONNECTED" })
            .then(() => {
              console.log(`Conversation ${conversationId} is connected`);
            }).catch(console.error);
        }
      }
    });
    return;
  } else {
    console.warn('Unknown notification: ', notification);
  }

}

function sendMessage(message) {
  // Which function to call?
}