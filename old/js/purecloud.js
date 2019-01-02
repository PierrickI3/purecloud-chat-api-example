'use strict';

const env = "mypurecloud.ie";

var currentJWT, currentConversationId, currentMemberId, currentConversationState;

$("#btnStartChat").on("click", () => {
  createGuestChat("3b03b67a-2349-4a03-8b28-c8ac5c26c49a", "179caf22-76c6-43fb-b191-eb099955c5ef", "queue", "Pierrick Chat", "Pierrick Lozach");
});

function createGuestChat(organizationId, deploymentId, targetType, targetAddress, displayName) {

  var options = {
    "organizationId": organizationId,
    "deploymentId": deploymentId,
    "routingTarget": {
      "targetType": targetType,
      "targetAddress": targetAddress
    },
    "memberInfo": {
      "displayName": displayName,
      "role": "CUSTOMER"
    }
  };

  console.log(options);

  $.ajax({
    method: "POST",
    url: `https://api.${env}/api/v2/webchat/guest/conversations`,
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Content-Type", "application/json");
    },
    data: JSON.stringify(options)
  }).done((data, textStatus, jqXHR) => {
    //console.log("POST /guest/conversations complete");
    // console.log(textStatus);
    // console.log(jqXHR);
    console.log("Result from POST /guest/conversations:", data);

    // data.id = token that refers to your ACD Chat conversation. You will most likely want to store this in the browser's data area so you can supply it to subsequent endpoints.
    // data.jwt = token that is the security to your new conversation. You should keep this value private! Anyone who has this token can masquerade as you in the conversation and/or see conversation updates.
    // data.eventStreamUri = event stream location mentioned earlier. You should connect to this event stream as soon as the create returns. No further actions are permitted against the conversation (except disconnect) until you do, and as previously mentioned no agents will be selected for your conversation either until you connect. Once you do connect, new events will just start coming to this webscocket; including events such as members joining/leaving, new chat text available, typing indicator updates, etc.
    // data.member.id = token that represent the web guest in the conversation. You will also want to store this somewhere handy to supply to subsequent endpoints.

    currentConversationId = data.id;
    console.log("Current Conversation Id:", currentConversationId);
    currentJWT = data.jwt;
    currentMemberId = data.member.id;
    console.log("Current Member Id:", currentMemberId);

    //#region WebSocket

    // Create WebSocket connection
    const webSocket = new WebSocket(data.eventStreamUri);

    // Open Connection
    webSocket.addEventListener("open", (event) => {
      console.log("WebSocket connection opened");
      updateChatControls(true);
    });

    webSocket.addEventListener("message", (event) => {

      var eventData = JSON.parse(event.data);

      switch (eventData.topicName) {
        case "channel.metadata":
          //console.log("Message heartbeat");
          break;
        case `v2.webchat.conversations.${currentConversationId}`:
          console.debug("Event:", event);
          console.debug("Event Data:", eventData);
          switch (eventData.metadata.type) {
            case "member-join":
              console.log("Member has joined the chat. State:", eventData.eventBody.member.state);
              updateChatControls(true);
              break;
            case "member-change":
              // GET MEMBER INFO

              console.log("Member state changed to", eventData.eventBody.member.state);
              switch (eventData.eventBody.member.state) {
                case "CONNECTED":
                  updateChatControls(true);
                  break;
                case "ALERTING":
                  updateChatControls(false);
                  break;
                default:
                  console.error("Unknown member state:", eventData.eventBody.member.state);
                  break;
              }
              break;
            case "member-leave":
              console.log("Member has left the chat. State:", eventData.eventBody.member.state);
              updateChatControls(false);
              break;
            default:
              console.error("Unrecognized type received from server", eventData.metadata.type);
              break;
          }
          break;
        default:
          console.error("Unrecognized message received from server", eventData.topicName, ". Conversation id:", currentConversationId);
          break;
      }
    });

    //#endregion

  }).fail((jqXHR, textStatus, errorThrown) => {
    console.error("An error occurred while creating the chat conversation");
    console.error(textStatus);
    console.error(jqXHR);
    console.error(errorThrown);
  });
}

function getMemberInfo(memberId) {
  return new Promise((resolve, reject) => {
    $.ajax({
      method: "GET",
      beforeSend: function (xhr) {
        //xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
        xhr.setRequestHeader("Authorization", "Bearer " + currentJWT);
      },
      url: `https://api.${env}/api/v2/webchat/guest/conversations/${conversationId}/members/${memberId}`
    }).done((data, textStatus, jqXHR) => {
    }).fail((jqXHR, textStatus, errorThrown) => {
      console.error("An error occurred while getting the member info");
      console.error(textStatus);
      console.error(jqXHR);
      console.error(errorThrown);
    });
  });
}

function disconnectChat(conversationId, memberId) {

  console.log(`Disconnecting member ${memberId} from chat conversation ${conversationId}`);

  $.ajax({
    method: "DELETE",
    beforeSend: function (xhr) {
      //xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
      xhr.setRequestHeader("Authorization", "Bearer " + currentJWT);
    },
    url: `https://api.${env}/api/v2/webchat/guest/conversations/${conversationId}/members/${memberId}`
  }).done((data, textStatus, jqXHR) => {
    console.log(`DELETE /guest/conversations/${conversationId}/members/${memberId} complete`);
    console.log(textStatus);
    console.log(jqXHR);
    console.log(data);

    updateChatControls(false);

  }).fail((jqXHR, textStatus, errorThrown) => {
    console.error("An error occurred while disconnecting");
    console.error("jqXHR:", jqXHR);
    console.error("textStatus:", textStatus);
    console.error("errorThrown:", errorThrown);

    switch (jqXHR.status) {
      case 400:
        if (jqXHR.responseJSON.code == "chat.error.conversation.state") {
          console.warning("Was the conversation already disconnected?");
        }
        break;
      default:
        break;
    }
  });
}

function updateChatControls(isUsingChat) {

  // Start Chat button
  $("#btnStartChat").prop("disabled", isUsingChat);

  // Disconnect Chat button
  $("#btnDisconnectChat").prop("disabled", !isUsingChat);

  if (isUsingChat) {
    $("#btnDisconnectChat").unbind().on("click", () => {
      disconnectChat(currentConversationId, currentMemberId);
    });
  }

  // Show Chat Controls

}