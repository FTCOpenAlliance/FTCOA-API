import { google } from "googleapis";
import { Constants } from "./config";

type formSubmitNotificationData = {
    teamNumber: number,
    dbDelta: string,
    timestamp: EpochTimeStamp,
    sourceIP: string,
}

export default class Chat {
    
    private static jwt = new google.auth.JWT({
        email: process.env.GCHAT_SERVICE_EMAIL,
        key: process.env.GCHAT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/chat.bot'],
    })
    
    private static api = google.chat({
        version: "v1",
        auth: this.jwt
    })
    
    public static async getSpaces() {
        let res = await this.api.spaces.list()
        console.log(res.data.spaces)
    }
    
    public static async sendFormSubmitNotification(data: formSubmitNotificationData) {
        
        let spaceListResponse = await this.api.spaces.list()
        let spaceList = spaceListResponse.data.spaces
        
        spaceList?.forEach(async (space) => {
            await this.api.spaces.messages.create({
                parent: space.name ?? "",
                requestBody: {
                    cardsV2: [
                        {
                            card: {
                                "header": {
                                    "title": "New Team Update!",
                                    "subtitle": `New information has just been recieved for team ${data.teamNumber} by the Open Alliance API.`
                                },
                                "sections": [
                                    {
                                        "header": "Request Deltas:",
                                        "collapsible": true,
                                        "uncollapsibleWidgetsCount": 0,
                                        "widgets": [
                                            {
                                                "textParagraph": {
                                                    "text": data.dbDelta,
                                                    "maxLines": 2
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        "header": "Information",
                                        "collapsible": true,
                                        "uncollapsibleWidgetsCount": 1,
                                        "widgets": [
                                            {
                                                "textParagraph": {
                                                    "text": `Timestamp: ${new Date(data.timestamp).toUTCString()} <br> Source IP: ${data.sourceIP}`,
                                                    "maxLines": 2
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        "header": "Actions",
                                        "collapsible": true,
                                        "uncollapsibleWidgetsCount": 1,
                                        "widgets": [
                                            {
                                                "buttonList": {
                                                    "buttons": [
                                                        {
                                                            "text": "Explore Database",
                                                            "type": "OUTLINED",
                                                            "onClick": {
                                                                "openLink": {
                                                                    "url": Constants.notificationDBLink
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "text": "Access API Kill-Switches",
                                                            "type": "FILLED",
                                                            "onClick": {
                                                                "openLink": {
                                                                    "url": Constants.notificationKVLink
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            })
        });
    }
    
}