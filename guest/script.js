const platformClient = require('platformClient');

const client = platformClient.ApiClient.instance;
client.setEnvironment('mypurecloud.ie');
client.setPersistSettings(true, 'optional_prefix');

// Create API instance
const webChatApi = new platformClient.WebChatApi();

const createChatBody = {
  organizationId: '3b03b67a-2349-4a03-8b28-c8ac5c26c49a',
  deploymentId: '179caf22-76c6-43fb-b191-eb099955c5ef',
  routingTarget: {
    targetType: 'QUEUE',
    targetAddress: 'Pierrick Chat',
  },
  memberInfo: {
    role: 'CUSTOMER',
    displayName: 'JavaScript Guest',
    profileImageUrl: 'http://i.imgur.com/ECqHlpw.jpg',
    customFields: {
      firstName: 'John',
      lastName: 'Doe',
      phoneType: 'Cell',
      customField1Label: 'Chat source',
      customField1: 'Java Guest Chat SDK Test App',
      customField2: 'Small-medium business',
      purpose: 'sales',
      customField3: 'Partner',
      customField2Label: 'Customer category',
      addressState: 'FL',
      accountNumber: 'A123456789',
      addressPostalCode: '50163-2735',
      customField3Label: 'Customer type',
      phoneNumber: '1-916-892-2045 x293',
      addressStreet: '64472 Brown Street',
      customerId: '59606',
      addressCity: 'Lindgrenmouth',
    }
  }
};
let chatInfo;
let socket;
let members = {};

$(document).ready(() => {
  $('#startchat').click((event) => {
    event.preventDefault();
    startChat($('#firstname').val(), $('#lastname').val());
  });

  $('#sendmessage').click((event) => {
    event.preventDefault();
    sendMessage($('#guestmessage').val());
    $('#guestmessage').val('');
  });
});


function startChat(firstName, lastName) {
  // Set user-defined data
  createChatBody.memberInfo.customFields.firstName = firstName;
  createChatBody.memberInfo.customFields.lastName = lastName;
  createChatBody.memberInfo.displayName = `${firstName} ${lastName}`;

  // Create chat
  webChatApi.postWebchatGuestConversations(createChatBody)
    .then((createChatResponse) => {
      // Handle successful result
      console.log(createChatResponse);
      chatInfo = createChatResponse;

      // Set JWT
      client.setJwt(chatInfo.jwt);

      // Connect to notifications
      socket = new WebSocket(chatInfo.eventStreamUri);

      // Connection opened
      socket.addEventListener('open', function (event) {
        console.log('WebSocket connected');
      });

      // Listen for messages
      socket.addEventListener('message', function (event) {
        console.log(event.data);
        const message = JSON.parse(event.data);

        // Chat message
        if (message.metadata) {
          switch (message.metadata.type) {
            case 'message': {
              handleMessage(message.eventBody.sender.id, message.eventBody.body);
              break;
            }
            case 'member-change': {
              handleMessage('', `${getMember(message.eventBody.member.id).displayName} is now ${message.eventBody.member.state}`);
              break;
            }
            case 'member-join': {
              handleMessage('', `${getMember(message.eventBody.member.id).displayName} is now ${message.eventBody.member.state}`);
              break;
            }
            case 'member-leave': {
              handleMessage('', `${getMember(message.eventBody.member.id).displayName} is now ${message.eventBody.member.state}`);
              break;
            }
            default: {
              console.log('Unknown message type: ' + message.metadata.type);
            }
          }
        }

      });
    })
    .catch(console.error);
}

function sendMessage(text) {
  webChatApi.postWebchatGuestConversationMemberMessages(chatInfo.id, chatInfo.member.id, { body: text })
    .then((response) => {
      console.log('Message sent', response);
    })
    .catch(console.error);
}

function handleMessage(memberId, message) {
  const memberName = getMember(memberId);
  $('#output').prepend(`${memberName ? `${memberName.displayName} - ` : ''}${message}\n`);
}

function getMember(id) {
  if (!id || id === '') return;
  if (members[id]) return members[id];

  webChatApi.getWebchatGuestConversationMember(chatInfo.id, id)
    .then((memberInfo) => {
      console.log(memberInfo);
      members[id] = memberInfo;
      if (!members[id].displayName) {
        switch (members[id].role) {
          case 'CUSTOMER': {
            members[id].displayName = 'Guest';
            break;
          }
          case 'AGENT': {
            members[id].displayName = 'Agent';
            break;
          }
          default: {
            members[id].displayName = '*' + members[id].role;
            break;
          }
        }
      }
      console.log('Member Info:', memberInfo);
    })
    .catch(console.error);

  return { displayName: 'pending', role: 'UNKNOWN' };
}
