
    var https = require('https');

    // todo add a help intent
    exports.handler = (event, context) => {
        var accessToken   = event.session.user.accessToken;
        var endpoint      = "https://api_url/api?access_token=" + accessToken;
        var botEndpoint   = "https://api_url/bot?text=";
        var mediaEndpoint = "https://api_url/media?access_token=" + accessToken;

        console.log('access token: ' + accessToken);
        console.log('is new session session: ' + event.session.new);

        // if the session is not new, we are likley in a conversation
        if(event.session.new === false && event.request.intent !== undefined && event.request.intent.slots !== undefined && event.request.type !== 'SessionEndedRequest'){
            console.log(event.request.intent);

            var reply = event.request.intent.slots.Reply.value;

            botLogic(https, botEndpoint + reply, context);
        } else {
            try {
                switch (event.request.type) {
                    case "LaunchRequest":
                        console.log(`LAUNCH REQUEST`);

                        cheersLogic(https, endpoint, context);

                        break;
                    case "IntentRequest":
                        switch (event.request.intent.name) {
                            case "MyCheerleader":
                                console.log(`MyCheerleader`);

                                cheersLogic(https, endpoint, context);

                                break;
                            case "ChatSession":
                                console.log(`StartChatSession`);

                                returnSpeach({noCard: true, cheer: 'Hi, I\'m Alice, tell me something about you.', useReprompt: true, reprompt: 'Please reply'}, false, context);

                                break;
                            case "MeditationSession":
                                console.log(`MEDITATION INTENT`);

                                mediaLogic(https, mediaEndpoint, context);
                                break;
                            case "Test":
                                console.log(`TEST INTENT`);

                                //mediaLogic(https, mediaEndpoint, context);
                                break;
                            case "AMAZON.ResumeIntent":
                                console.log(`RESUME INTENT`);

                                returnSpeach({noCard: true, cheer: 'Resuming', useDirectives: {action: "play"}}, true, context);
                                break;
                            case "AMAZON.PauseIntent":
                                console.log(`PAUSE INTENT`);

                                returnSpeach({noCard: true, cheer: 'Your meditation session ended.', useDirectives: {action: "stop"}}, true, context);
                                break;
                            case "AMAZON.HelpIntent":
                                console.log(`HELP INTENT`);

                                cheersLogic(https, endpoint, context);
                                break;
                            default:
                                throw "Invalid intent"
                        }

                        break;
                    case "SessionEndedRequest":
                        console.log(`SESSION ENDED REQUEST`);
                        break;
                    default:
                        context.fail(`INVALID REQUEST TYPE: ${event.request.type}`)
                }
            } catch (error) {
                context.fail(`Exception: ${error}`)
            }
        }
    };


    /**
     * basic text logic, mostly return speech
     */
    function cheersLogic(https, endpoint, context) {
        var body = "";
        https.get(endpoint, (response) => {
            if (response.statusCode !== 200) {
                context.succeed(
                    generateResponse(buildSpeechletResponse('There was a problem with your request. Please try again lather', true, {type: 'LinkAccount'}), {})
                )
            }

            response.on('data', (chunk) => {
                body += chunk
            });

            response.on('end', function () {
                var data = JSON.parse(body);
                returnSpeach(data, true, context);
            });
        });
    }

    /**
     * bot logic, mostly return speech
     */
    function botLogic(https, endpoint, context) {
        console.log(endpoint);
        var body = "";
        https.get(endpoint, (response) => {
            response.on('error',function(e){
                console.log(e);
            });

            response.on('data', (chunk) => {
                body += chunk
            });

            response.on('end', function () {
                var data = JSON.parse(body);
                console.log(data);

                returnSpeach({noCard: true, cheer: data.response}, false, context);
            });
        });
    }

    /**
     * play media, like form a mp3
     */
    function mediaLogic(https, endpoint, context) {
        console.log(endpoint);
        var body = "";
        https.get(endpoint, (response) => {
            response.on('error',function(e){
                console.log(e);
            });

            response.on('data', (chunk) => {
                body += chunk
            });

            response.on('end', function () {
                var data = JSON.parse(body);
                console.log(data);

                returnSpeach({title: data.name, content: data.text + ' Configure your meditation media at mycheerleader.net', cheer: data.text, useDirectives: {action: "play", token: data.name, url: data.url}}, true, context);
            });
        });
    }

    /**
     * logic. a bit overdone, but good enough for now
     * whtaver you do, return stuff needed in here:
     *      buildSpeechletResponse = (outputText, shouldEndSession, card, reprompt, directives)
     *
     * @param data
     * @param endSession
     * @param context
     */
    function returnSpeach(data, endSession, context){
        var type          = data.linked === 'no' ? 'LinkAccount' : 'Simple';
        var useCard       = data.noCard !== undefined ? 'no' : 'yes';
        var useReprompt   = data.useReprompt === undefined ? 'no' : 'yes';
        var useDirectives = data.useDirectives === undefined ? 'no' : 'yes';

        var card = useCard === 'no' ? null : {
            type   : type,
            title  : data.title,
            content: data.cheer
        };

        var reprompt = useReprompt === 'no' ? null : {
            outputSpeech: {
                type: "PlainText",
                text: data.reprompt
            }
        };

        //console.log(data);

        var directives = null;
        if(useDirectives !== 'no') {
            if(data.useDirectives.action === 'stop') {
                directives = [
                    {
                        type          : "AudioPlayer.ClearQueue",
                        clearBehavior : "CLEAR_ALL"
                    }
                ];
            } else {
                directives = [
                    {
                        type        : "AudioPlayer.Play",
                        playBehavior: "REPLACE_ALL",
                        audioItem   : {
                            stream: {
                                token               : data.useDirectives.token,
                                url                 : data.useDirectives.url,
                                offsetInMilliseconds: 0
                            }
                        }
                    }
                ];
            }
        }

        context.succeed(
            generateResponse(buildSpeechletResponse(data.cheer, endSession, card, reprompt, directives), {})
        )
    }

    // Helpers
    buildSpeechletResponse = (outputText, shouldEndSession, card, reprompt, directives) => {
        return {
            outputSpeech    : {
                type: "PlainText",
                text: outputText
            },
            card            : card,
            reprompt        : reprompt,
            directives      : directives,
            shouldEndSession: shouldEndSession
        }
    };

    generateResponse = (speechletResponse, sessionAttributes) => {
        return {
            version          : "1.0",
            sessionAttributes: sessionAttributes,
            response         : speechletResponse
        }
    };


