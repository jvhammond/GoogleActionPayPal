'use strict';

const _ = require('lodash');
const url = require('url');
const https = require('https');
const request = require("request");
const queryString = require('query-string');

let urlObj = {
                            protocol: "https",
                            host: "api-3t.sandbox.paypal.com",
                            pathname: "nvp",
                            query: {
                                version: '98',
                                user: 'xxxxx',
                                pwd: 'xxxxx',
                                signature: "xxxxx"
                            }
                        };



const functions = require('firebase-functions'); // Cloud Functions for Firebase library
const DialogflowApp = require('actions-on-google').DialogflowApp; // Google Assistant helper library
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  if (request.body.result) {
    console.log('processV1Request');
    processV1Request(request, response);
  } else if (request.body.queryResult) {
    console.log('processV2Request');
    //processV2Request(request, response);
  } else {
    console.log('Invalid Request');
    return response.status(400).end('Invalid Webhook Request (expecting v1 or v2 webhook request)');
  }
});
/*
* Function to handle v1 webhook requests from Dialogflow
*/
function processV1Request (request, response) {
  let action = request.body.result.action; // https://dialogflow.com/docs/actions-and-parameters
  let parameters = request.body.result.parameters; // https://dialogflow.com/docs/actions-and-parameters
  let inputContexts = request.body.result.contexts; // https://dialogflow.com/docs/contexts
  let requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
  const googleAssistantRequest = 'google'; // Constant to identify Google Assistant requests
  const app = new DialogflowApp({request: request, response: response});
  // Create handlers for Dialogflow actions as well as a 'default' handler
  const actionHandlers = {
    // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
    'input.welcome': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('Hello, Welcome to my Dialogflow agent!'); // Send simple response to user
      } else {
        sendResponse('Hello, are you an action?'); // Send simple response to user
      }
    },
    // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
    'input.unknown': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
      } else {
        sendResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
      }
    },
    'input.fact': () => {
        console.log("input fact");
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('What do you want to know?'); // Send simple response to user
      } else {
        sendResponse("parameters"); // Send simple response to user
      }
    },
     'input.paypal': () => {
        console.log(parameters["fact-wallet"]);
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if(parameters["fact-wallet"] === 'credit') {
        sendResponse("Your payment of 23.50 is due on January 3rd"); // Send simple response to user
      } else if(parameters["fact-wallet"] === 'shabai') {
          getGitInfo('shabai', function(err, result) {
              
              if (result){
                  sendResponse(`Shaabay has ${_.get(result, 'public_repos')} github repos and ${_.get(result, 'followers')} followers, sad face`);
              }
              else {
                  console.log('error: ' + err);
                  sendResponse(`We are having trouble, please try again later.`);
              }
          });
      } else if(parameters["fact-wallet"] === 'sound') {
        let text_to_speech = '<speak>'
            + '<audio src="https://actions.google.com/sounds/v1/human_voices/baby_whine.ogg">cry</audio>'
            + '</speak>';
         sendGoogleResponse(text_to_speech);
      } else {
          
          urlObj.query.method = 'GetBalance';

          getBalance(urlObj, function(err, result) {
              
              if (result){
                  const parsed = queryString.parse(result);
                  console.log(JSON.stringify(parsed));
                  sendResponse(`You have ${_.get(parsed, 'L_AMT0')} dollars`);
              }
              else {
                  console.log('error: ' + err);
                  sendResponse(`We are having trouble getting your balance, please try again later.`);
              }
          });
      }
    },
    
    // Default handler for unknown or undefined actions
    'default': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        let responseToUser = {
          //googleRichResponse: googleRichResponse, // Optional, uncomment to enable
          //googleOutputContexts: ['weather', 2, { ['city']: 'rome' }], // Optional, uncomment to enable
          speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
          text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
        };
        sendGoogleResponse(responseToUser);
      } else {
        let responseToUser = {
          //data: richResponsesV1, // Optional, uncomment to enable
          //outputContexts: [{'name': 'weather', 'lifespan': 2, 'parameters': {'city': 'Rome'}}], // Optional, uncomment to enable
          speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
          text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
        };
        sendResponse(responseToUser);
      }
    }
  };
  // If undefined or unknown action use the default handler
  if (!actionHandlers[action]) {
    action = 'default';
  }
  // Run the proper handler function to handle the request from Dialogflow
  actionHandlers[action]();
    // Function to send correctly formatted Google Assistant responses to Dialogflow which are then sent to the user
  function sendGoogleResponse (responseToUser) {
    if (typeof responseToUser === 'string') {
      app.ask(responseToUser); // Google Assistant response
    } else {
      // If speech or displayText is defined use it to respond
      let googleResponse = app.buildRichResponse().addSimpleResponse({
        speech: responseToUser.speech || responseToUser.displayText,
        displayText: responseToUser.displayText || responseToUser.speech
      });
      // Optional: Overwrite previous response with rich response
      if (responseToUser.googleRichResponse) {
        googleResponse = responseToUser.googleRichResponse;
      }
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      if (responseToUser.googleOutputContexts) {
        app.setContext(...responseToUser.googleOutputContexts);
      }
      console.log('Response to Dialogflow (AoG): ' + JSON.stringify(googleResponse));
      app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
    }
  }
  // Function to send correctly formatted responses to Dialogflow which are then sent to the user
  function sendResponse (responseToUser) {
    // if the response is a string send it as a response to the user
    if (typeof responseToUser === 'string') {
      let responseJson = {};
      responseJson.speech = responseToUser; // spoken response
      responseJson.displayText = responseToUser; // displayed response
      response.json(responseJson); // Send response to Dialogflow
    } else {
      // If the response to the user includes rich responses or contexts send them to Dialogflow
      let responseJson = {};
      // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
      responseJson.speech = responseToUser.speech || responseToUser.displayText;
      responseJson.displayText = responseToUser.displayText || responseToUser.speech;
      // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
      responseJson.data = responseToUser.data;
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      responseJson.contextOut = responseToUser.outputContexts;
      console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
      response.json(responseJson); // Send response to Dialogflow
    }
  }
}
// Construct rich response for Google Assistant (v1 requests only)
const app = new DialogflowApp();
const googleRichResponse = app.buildRichResponse()
  .addSimpleResponse('This is the first simple response for Google Assistant')
  .addSuggestions(
    ['Suggestion Chip', 'Another Suggestion Chip'])
    // Create a basic card and add it to the rich response
  .addBasicCard(app.buildBasicCard(`This is a basic card.  Text in a
 basic card can include "quotes" and most other unicode characters
 including emoji 📱.  Basic cards also support some markdown
 formatting like *emphasis* or _italics_, **strong** or __bold__,
 and ***bold itallic*** or ___strong emphasis___ as well as other things
 like line  \nbreaks`) // Note the two spaces before '\n' required for a
                        // line break to be rendered in the card
    .setSubtitle('This is a subtitle')
    .setTitle('Title: this is a title')
    .addButton('This is a button', 'https://assistant.google.com/')
    .setImage('https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
      'Image alternate text'))
  .addSimpleResponse({ speech: 'This is another simple response',
    displayText: 'This is the another simple response 💁' });
// Rich responses for Slack and Facebook for v1 webhook requests
const richResponsesV1 = {
  'slack': {
    'text': 'This is a text response for Slack.',
    'attachments': [
      {
        'title': 'Title: this is a title',
        'title_link': 'https://assistant.google.com/',
        'text': 'This is an attachment.  Text in attachments can include \'quotes\' and most other unicode characters including emoji 📱.  Attachments also upport line\nbreaks.',
        'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
        'fallback': 'This is a fallback.'
      }
    ]
  },
  'facebook': {
    'attachment': {
      'type': 'template',
      'payload': {
        'template_type': 'generic',
        'elements': [
          {
            'title': 'Title: this is a title',
            'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
            'subtitle': 'This is a subtitle',
            'default_action': {
              'type': 'web_url',
              'url': 'https://assistant.google.com/'
            },
            'buttons': [
              {
                'type': 'web_url',
                'url': 'https://assistant.google.com/',
                'title': 'This is a button'
              }
            ]
          }
        ]
      }
    }
  }
};


/**
 *
 * @param options Required attributes on "options" are "protocol", "host", "pathname",
 * "query.method", "query.user", "query.pwd", "query.signature" and "query.token".
 * @param callback
 */
function getBalance(options, callback) {
    const clone = formatOptions(_.cloneDeep(options)),
        requiredParameters = ['protocol', 'host', 'pathname', 'query.METHOD', 'query.USER', 'query.PWD', 'query.SIGNATURE'];

    if (!isOptionsValid(clone, requiredParameters)) {
        return callback(Error('Incomplete or invalid options'));
    }

    makeNvpRequest(options, callback);
}


// helper function to set the query properties
function setQueryParams(urlObj, c) {

    // Default the version if it wasn't provided.
    c.query.VERSION = c.query.VERSION || '124.0';

    urlObj.query = c.query;
    return url.format(urlObj);
}

// helper funtion to format the incoming options object
function formatOptions(options) {
    options.query = _.mapKeys(options.query, function(value, key) {
        return key.toUpperCase();
    });

    return options;
}

// helper function to perform cursory validation that required fields present
function isOptionsValid(c, requiredParameters) {
    return _.every(requiredParameters, function(val) {
        const doesHave = _.has(c, val);

        if(!doesHave) {
            console.log("Missing required parameter: " + val);
        }

        return doesHave;
    });
}

// helper function to set the base common properties of the nvp query payload
function setCommonProperties(urlObj, c) {
    // required fields
    urlObj.protocol = _.get(c, 'protocol');
    urlObj.host = _.get(c, 'host');
    urlObj.pathname = _.get(c, 'pathname');
}

// helper function to go through the process of making an nvp request.
function makeNvpRequest(options, callback) {
    
    options = {
        uri: 'https://api-3t.sandbox.paypal.com/nvp',
        method:'POST',
        json: true,
        form: {
            method: 'GetBalance',
            version: '98',
            user: 'xxxxx',
            pwd: 'xxxxx',
            signature: "xxxxx"
        }
      };

  
    request.post(options, (error, response, body) => {
      console.log('error: ' + error);
      console.log('response: ' + JSON.stringify(response));
      console.log('body: ' + body);
      callback(error, body);
    });
}

// helper function to go through the process of making an nvp request.
function getGitInfo(options, callback) {
    
  options = {
      url: 'https://api.github.com/users/sbl03',
      headers: {
        'User-Agent': 'request'
      }
    };
  
    request.get(options, (error, response, body) => {
      let json = JSON.parse(body);
      console.log('shabai: ' + JSON.stringify(json));
      callback(error, json);
    });

}



